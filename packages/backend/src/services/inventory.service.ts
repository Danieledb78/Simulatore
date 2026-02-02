import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { emailService } from './email.service.js';
import { io } from '../index.js';

export class InventoryService {
  /**
   * Carica merce in magazzino (da barcode scanner)
   */
  async loadStock(
    barcode: string,
    quantity: number,
    userId: string,
    options?: {
      supplierId?: string;
      batchNumber?: string;
      expirationDate?: Date;
      notes?: string;
    }
  ) {
    // Trova prodotto da barcode
    const product = await prisma.product.findUnique({
      where: { barcode },
      include: { inventory: true },
    });

    if (!product) {
      throw new Error(`Prodotto con barcode ${barcode} non trovato`);
    }

    const previousQty = product.inventory?.quantity || 0;
    const newQty = previousQty + quantity;

    // Aggiorna o crea inventory
    const inventory = await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {
        quantity: newQty,
        availableQty: newQty - (product.inventory?.reservedQty || 0),
        lastRestockDate: new Date(),
      },
      create: {
        productId: product.id,
        quantity: newQty,
        availableQty: newQty,
        reservedQty: 0,
      },
    });

    // Registra movimento
    const movement = await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: 'INBOUND',
        quantity,
        previousQty,
        newQty,
        batchNumber: options?.batchNumber,
        expirationDate: options?.expirationDate,
        notes: options?.notes,
        supplierId: options?.supplierId,
        createdBy: userId,
      },
    });

    logger.info(`Caricato stock: ${product.name} +${quantity} (${previousQty} -> ${newQty})`);

    // Notifica real-time
    io?.to('admin').emit('inventory:update', {
      productId: product.id,
      productName: product.name,
      previousQty,
      newQty,
      type: 'INBOUND',
    });

    return { product, inventory, movement };
  }

  /**
   * Scarica merce per ordine
   */
  async unloadStock(
    orderId: string,
    items: Array<{ productId: string; quantity: number }>,
    userId: string
  ) {
    const movements = [];
    const lowStockProducts: Array<{ name: string; currentStock: number; minStock: number }> = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { inventory: true },
      });

      if (!product || !product.inventory) {
        throw new Error(`Prodotto ${item.productId} non trovato o senza inventario`);
      }

      const previousQty = product.inventory.quantity;
      const newQty = previousQty - item.quantity;

      if (newQty < 0) {
        throw new Error(`Stock insufficiente per ${product.name}: disponibili ${previousQty}, richiesti ${item.quantity}`);
      }

      // Aggiorna inventory
      await prisma.inventory.update({
        where: { productId: product.id },
        data: {
          quantity: newQty,
          availableQty: newQty - product.inventory.reservedQty + item.quantity,
          reservedQty: { decrement: item.quantity },
        },
      });

      // Registra movimento
      const movement = await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: 'OUTBOUND',
          quantity: -item.quantity,
          previousQty,
          newQty,
          orderId,
          createdBy: userId,
        },
      });

      movements.push(movement);

      // Controlla soglia minima
      if (newQty <= product.minStockLevel) {
        lowStockProducts.push({
          name: product.name,
          currentStock: newQty,
          minStock: product.minStockLevel,
        });
      }
    }

    // Invia alert se ci sono prodotti sotto soglia
    if (lowStockProducts.length > 0) {
      await this.sendLowStockAlert(lowStockProducts);
    }

    return movements;
  }

  /**
   * Riserva stock per ordine in attesa
   */
  async reserveStock(items: Array<{ productId: string; quantity: number }>) {
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { inventory: true },
      });

      if (!product?.inventory) {
        throw new Error(`Prodotto ${item.productId} non trovato`);
      }

      if (product.inventory.availableQty < item.quantity) {
        throw new Error(`Stock insufficiente per ${product.name}`);
      }

      await prisma.inventory.update({
        where: { productId: item.productId },
        data: {
          reservedQty: { increment: item.quantity },
          availableQty: { decrement: item.quantity },
        },
      });
    }
  }

  /**
   * Rilascia stock riservato (ordine annullato)
   */
  async releaseReservedStock(items: Array<{ productId: string; quantity: number }>) {
    for (const item of items) {
      await prisma.inventory.update({
        where: { productId: item.productId },
        data: {
          reservedQty: { decrement: item.quantity },
          availableQty: { increment: item.quantity },
        },
      });
    }
  }

  /**
   * Verifica disponibilità prodotti per ordine
   */
  async checkAvailability(items: Array<{ productId: string; quantity: number }>) {
    const availability: Array<{
      productId: string;
      productName: string;
      requested: number;
      available: number;
      isAvailable: boolean;
    }> = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { inventory: true },
      });

      availability.push({
        productId: item.productId,
        productName: product?.name || 'Sconosciuto',
        requested: item.quantity,
        available: product?.inventory?.availableQty || 0,
        isAvailable: (product?.inventory?.availableQty || 0) >= item.quantity,
      });
    }

    return {
      allAvailable: availability.every(a => a.isAvailable),
      items: availability,
    };
  }

  /**
   * Rettifica inventario
   */
  async adjustInventory(
    productId: string,
    newQuantity: number,
    reason: string,
    userId: string
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { inventory: true },
    });

    if (!product) {
      throw new Error('Prodotto non trovato');
    }

    const previousQty = product.inventory?.quantity || 0;
    const difference = newQuantity - previousQty;

    // Aggiorna inventory
    await prisma.inventory.upsert({
      where: { productId },
      update: {
        quantity: newQuantity,
        availableQty: newQuantity - (product.inventory?.reservedQty || 0),
      },
      create: {
        productId,
        quantity: newQuantity,
        availableQty: newQuantity,
        reservedQty: 0,
      },
    });

    // Registra movimento
    const movement = await prisma.stockMovement.create({
      data: {
        productId,
        type: 'ADJUSTMENT',
        quantity: difference,
        previousQty,
        newQty: newQuantity,
        notes: reason,
        createdBy: userId,
      },
    });

    logger.info(`Rettifica inventario: ${product.name} ${previousQty} -> ${newQuantity} (${reason})`);

    return movement;
  }

  /**
   * Ottieni prodotti sotto soglia minima
   */
  async getLowStockProducts() {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        inventory: {
          quantity: { lte: prisma.product.fields.minStockLevel as any },
        },
      },
      include: {
        inventory: true,
        category: true,
      },
    });

    // Fallback: query diretta
    const lowStock = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      barcode: string;
      quantity: number;
      minStockLevel: number;
      categoryName: string;
    }>>`
      SELECT p.id, p.name, p.barcode, i.quantity, p."minStockLevel", c.name as "categoryName"
      FROM products p
      JOIN inventory i ON p.id = i."productId"
      JOIN categories c ON p."categoryId" = c.id
      WHERE p."isActive" = true AND i.quantity <= p."minStockLevel"
      ORDER BY i.quantity ASC
    `;

    return lowStock;
  }

  /**
   * Invia alert per scorte basse
   */
  private async sendLowStockAlert(
    products: Array<{ name: string; currentStock: number; minStock: number }>
  ) {
    // Trova admin per email
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'] },
        isActive: true,
      },
      select: { email: true, id: true },
    });

    // Invia email a tutti gli admin
    for (const admin of admins) {
      await emailService.sendLowStockAlert(admin.email, products);

      // Crea notifica in-app
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'LOW_STOCK',
          title: 'Scorte Basse',
          message: `${products.length} prodotti sotto la soglia minima`,
          data: { products } as any,
        },
      });
    }

    // Notifica real-time
    io?.to('admin').emit('notification:low_stock', { products });

    logger.warn(`Alert scorte basse: ${products.map(p => p.name).join(', ')}`);
  }

  /**
   * Report movimenti stock
   */
  async getStockMovements(
    filters: {
      productId?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
    },
    pagination: { page: number; limit: number }
  ) {
    const where: any = {};

    if (filters.productId) where.productId = filters.productId;
    if (filters.type) where.type = filters.type;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { name: true, barcode: true } },
          supplier: { select: { name: true } },
          order: { select: { orderNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return {
      data: movements,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }
}

export const inventoryService = new InventoryService();
export default inventoryService;
