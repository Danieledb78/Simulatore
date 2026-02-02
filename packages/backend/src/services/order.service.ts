import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { inventoryService } from './inventory.service.js';
import { stripeService } from './stripe.service.js';
import { whatsappService } from './whatsapp.service.js';
import { emailService } from './email.service.js';
import { io } from '../index.js';

export class OrderService {
  /**
   * Crea nuovo ordine
   */
  async createOrder(data: {
    customerId: string;
    items: Array<{ productId: string; quantity: number }>;
    source: 'WEB' | 'WHATSAPP' | 'PHONE' | 'DIRECT';
    deliveryAddress?: string;
    deliveryCity?: string;
    deliveryProvince?: string;
    deliveryPostalCode?: string;
    deliveryNotes?: string;
    requestedDate?: Date;
    notes?: string;
  }) {
    // Recupera cliente
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
      include: { zone: true, priceList: { include: { items: true } } },
    });

    if (!customer) {
      throw new Error('Cliente non trovato');
    }

    // Verifica disponibilità
    const availability = await inventoryService.checkAvailability(data.items);
    if (!availability.allAvailable) {
      const unavailable = availability.items.filter(i => !i.isAvailable);
      throw new Error(
        `Prodotti non disponibili: ${unavailable.map(i => `${i.productName} (richiesti: ${i.requested}, disponibili: ${i.available})`).join(', ')}`
      );
    }

    // Calcola prezzi
    const orderItems = await Promise.all(
      data.items.map(async item => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) throw new Error(`Prodotto ${item.productId} non trovato`);

        // Cerca prezzo da listino cliente
        let unitPrice = Number(product.sellingPrice);
        if (customer.priceList) {
          const priceListItem = customer.priceList.items.find(
            pli => pli.productId === item.productId
          );
          if (priceListItem) {
            unitPrice = Number(priceListItem.price);
          }
        }

        const total = unitPrice * item.quantity;

        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          vatRate: Number(product.vatRate),
          discount: 0,
          total,
        };
      })
    );

    // Calcola totali
    const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    const vatAmount = orderItems.reduce(
      (sum, item) => sum + (item.total * item.vatRate) / 100,
      0
    );
    const deliveryFee = customer.zone ? Number(customer.zone.deliveryFee) : 0;
    const total = subtotal + vatAmount + deliveryFee;

    // Genera numero ordine
    const orderCount = await prisma.order.count();
    const orderNumber = `ORD-${new Date().getFullYear()}${String(orderCount + 1).padStart(6, '0')}`;

    // Crea ordine
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: data.customerId,
        status: 'PENDING',
        source: data.source,
        deliveryAddress: data.deliveryAddress || customer.address || '',
        deliveryCity: data.deliveryCity || customer.city || '',
        deliveryProvince: data.deliveryProvince || customer.province || '',
        deliveryPostalCode: data.deliveryPostalCode || customer.postalCode || '',
        deliveryNotes: data.deliveryNotes,
        subtotal,
        vatAmount,
        deliveryFee,
        discount: 0,
        total,
        requestedDate: data.requestedDate,
        notes: data.notes,
        paymentStatus: 'PENDING',
        items: {
          create: orderItems,
        },
        statusHistory: {
          create: {
            status: 'PENDING',
            notes: `Ordine creato da ${data.source}`,
          },
        },
      },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
    });

    // Riserva stock
    await inventoryService.reserveStock(data.items);

    // Notifica admin
    io?.to('admin').emit('order:new', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: `${customer.firstName} ${customer.lastName}`,
      total: order.total,
      source: order.source,
    });

    logger.info(`Ordine creato: ${order.orderNumber} da ${order.source}`);

    return order;
  }

  /**
   * Aggiorna stato ordine
   */
  async updateOrderStatus(
    orderId: string,
    status: string,
    userId: string,
    notes?: string
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { product: true } },
        driver: { include: { user: true } },
      },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    const previousStatus = order.status;

    // Aggiorna ordine
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: status as any,
        ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
      },
    });

    // Registra cambio stato
    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: status as any,
        notes,
        changedBy: userId,
      },
    });

    // Azioni per stato specifico
    switch (status) {
      case 'CONFIRMED':
        // Invia conferma al cliente
        if (order.customer.phone) {
          await whatsappService.sendOrderConfirmation(orderId);
        }
        if (order.customer.email) {
          await emailService.sendOrderConfirmation(
            order.customer.email,
            order.orderNumber,
            `${order.customer.firstName} ${order.customer.lastName}`,
            Number(order.total),
            order.items.map(i => ({
              name: i.product.name,
              quantity: i.quantity,
              price: Number(i.unitPrice),
            }))
          );
        }
        break;

      case 'OUT_FOR_DELIVERY':
        // Notifica cliente consegna in arrivo
        if (order.driver && order.customer.phone) {
          await whatsappService.sendDeliveryNotification(
            orderId,
            `${order.driver.user.firstName} ${order.driver.user.lastName}`
          );
        }
        break;

      case 'DELIVERED':
        // Scarica stock
        await inventoryService.unloadStock(
          orderId,
          order.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
          userId
        );
        break;

      case 'CANCELLED':
        // Rilascia stock riservato
        await inventoryService.releaseReservedStock(
          order.items.map(i => ({ productId: i.productId, quantity: i.quantity }))
        );
        break;
    }

    // Notifica real-time
    io?.to('admin').emit('order:status_update', {
      orderId,
      orderNumber: order.orderNumber,
      previousStatus,
      newStatus: status,
    });

    if (order.driver) {
      io?.to(`driver:${order.driver.id}`).emit('order:status_update', {
        orderId,
        newStatus: status,
      });
    }

    logger.info(`Ordine ${order.orderNumber}: ${previousStatus} -> ${status}`);

    return updatedOrder;
  }

  /**
   * Assegna driver a ordine
   */
  async assignDriver(orderId: string, driverId: string, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: true, zone: true },
    });

    if (!driver) {
      throw new Error('Driver non trovato');
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        driverId,
        status: 'READY',
      },
      include: {
        driver: { include: { user: true } },
      },
    });

    // Registra cambio stato
    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: 'READY',
        notes: `Assegnato a driver: ${driver.user.firstName} ${driver.user.lastName}`,
        changedBy: userId,
      },
    });

    // Notifica driver
    io?.to(`driver:${driverId}`).emit('order:assigned', {
      orderId,
      orderNumber: order.orderNumber,
      deliveryAddress: order.deliveryAddress,
      customerName: `${order.customer.firstName} ${order.customer.lastName}`,
    });

    logger.info(`Ordine ${order.orderNumber} assegnato a driver ${driver.user.firstName}`);

    return updatedOrder;
  }

  /**
   * Assegnazione automatica driver per zona
   */
  async autoAssignDriver(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: { include: { zone: true } } },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    if (!order.customer.zoneId) {
      throw new Error('Cliente senza zona assegnata');
    }

    // Trova driver disponibile per la zona
    const driver = await prisma.driver.findFirst({
      where: {
        zoneId: order.customer.zoneId,
        isAvailable: true,
      },
      include: { user: true },
    });

    if (!driver) {
      throw new Error('Nessun driver disponibile per questa zona');
    }

    return this.assignDriver(orderId, driver.id, userId);
  }

  /**
   * Ottieni ordini con filtri
   */
  async getOrders(
    filters: {
      status?: string;
      customerId?: string;
      driverId?: string;
      source?: string;
      startDate?: Date;
      endDate?: Date;
      paymentStatus?: string;
    },
    pagination: { page: number; limit: number }
  ) {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.driverId) where.driverId = filters.driverId;
    if (filters.source) where.source = filters.source;
    if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          driver: { include: { user: { select: { firstName: true, lastName: true } } } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  /**
   * Genera link di pagamento per ordine
   */
  async generatePaymentLink(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    const paymentLink = await stripeService.createPaymentLink(
      orderId,
      Number(order.total),
      order.customerId
    );

    // Invia link via WhatsApp e/o email
    if (order.customer.phone) {
      await whatsappService.sendTextMessage(
        order.customer.phone,
        `Per completare il pagamento del tuo ordine ${order.orderNumber} (€${order.total}), clicca qui:\n${paymentLink}`
      );
    }

    if (order.customer.email) {
      await emailService.sendPaymentLink(
        order.customer.email,
        order.orderNumber,
        `${order.customer.firstName} ${order.customer.lastName}`,
        Number(order.total),
        paymentLink
      );
    }

    return paymentLink;
  }

  /**
   * Statistiche ordini per dashboard
   */
  async getOrderStats(period: 'today' | 'week' | 'month' | 'year') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const [
      totalOrders,
      totalRevenue,
      byStatus,
      bySource,
      topProducts,
    ] = await Promise.all([
      prisma.order.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: startDate }, paymentStatus: 'PAID' },
        _sum: { total: true },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: startDate } },
        _count: true,
      }),
      prisma.order.groupBy({
        by: ['source'],
        where: { createdAt: { gte: startDate } },
        _count: true,
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { createdAt: { gte: startDate } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
    ]);

    // Arricchisci top products con nomi
    const topProductsWithNames = await Promise.all(
      topProducts.map(async tp => {
        const product = await prisma.product.findUnique({
          where: { id: tp.productId },
          select: { name: true },
        });
        return {
          productId: tp.productId,
          name: product?.name || 'Sconosciuto',
          quantity: tp._sum.quantity || 0,
        };
      })
    );

    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      bySource: bySource.reduce((acc, s) => ({ ...acc, [s.source]: s._count }), {}),
      topProducts: topProductsWithNames,
      period,
    };
  }
}

export const orderService = new OrderService();
export default orderService;
