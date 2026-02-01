import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { orderService } from '../services/order.service.js';

const router = Router();

// GET /api/dashboard/overview
router.get('/overview', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalProducts,
      totalCustomers,
      totalOrders,
      todayOrders,
      pendingOrders,
      lowStockCount,
      todayRevenue,
      monthRevenue,
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM products p
        JOIN inventory i ON p.id = i."productId"
        WHERE p."isActive" = true AND i.quantity <= p."minStockLevel"
      `.then(r => Number(r[0]?.count || 0)),
      prisma.order.aggregate({
        where: { createdAt: { gte: today }, paymentStatus: 'PAID' },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) },
          paymentStatus: 'PAID',
        },
        _sum: { total: true },
      }),
    ]);

    res.json({
      totalProducts,
      totalCustomers,
      totalOrders,
      todayOrders,
      pendingOrders,
      lowStockCount,
      todayRevenue: todayRevenue._sum.total || 0,
      monthRevenue: monthRevenue._sum.total || 0,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/orders-chart
router.get('/orders-chart', authenticate, async (req, res, next) => {
  try {
    const { days = '7' } = req.query;
    const numDays = parseInt(days as string);

    const data = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [orders, revenue] = await Promise.all([
        prisma.order.count({
          where: { createdAt: { gte: date, lt: nextDate } },
        }),
        prisma.order.aggregate({
          where: { createdAt: { gte: date, lt: nextDate }, paymentStatus: 'PAID' },
          _sum: { total: true },
        }),
      ]);

      data.push({
        date: date.toISOString().split('T')[0],
        orders,
        revenue: revenue._sum.total || 0,
      });
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/top-products
router.get('/top-products', authenticate, async (req, res, next) => {
  try {
    const { limit = '10', period = 'month' } = req.query;

    let startDate: Date;
    const now = new Date();

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { createdAt: { gte: startDate } } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: parseInt(limit as string),
    });

    const productsWithDetails = await Promise.all(
      topProducts.map(async (tp) => {
        const product = await prisma.product.findUnique({
          where: { id: tp.productId },
          select: { name: true, barcode: true, imageUrl: true },
        });
        return {
          productId: tp.productId,
          name: product?.name || 'Sconosciuto',
          barcode: product?.barcode,
          imageUrl: product?.imageUrl,
          totalQuantity: tp._sum.quantity || 0,
          totalRevenue: tp._sum.total || 0,
        };
      })
    );

    res.json(productsWithDetails);
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/top-customers
router.get('/top-customers', authenticate, async (req, res, next) => {
  try {
    const { limit = '10' } = req.query;

    const topCustomers = await prisma.order.groupBy({
      by: ['customerId'],
      where: { paymentStatus: 'PAID' },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: parseInt(limit as string),
    });

    const customersWithDetails = await Promise.all(
      topCustomers.map(async (tc) => {
        const customer = await prisma.customer.findUnique({
          where: { id: tc.customerId },
          select: { firstName: true, lastName: true, companyName: true, type: true },
        });
        return {
          customerId: tc.customerId,
          name: customer?.companyName || `${customer?.firstName} ${customer?.lastName}`,
          type: customer?.type,
          totalOrders: tc._count,
          totalSpent: tc._sum.total || 0,
        };
      })
    );

    res.json(customersWithDetails);
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/orders-by-status
router.get('/orders-by-status', authenticate, async (req, res, next) => {
  try {
    const byStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: true,
    });

    res.json(byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}));
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/drivers-status
router.get('/drivers-status', authenticate, async (req, res, next) => {
  try {
    const drivers = await prisma.driver.findMany({
      include: {
        user: { select: { firstName: true, lastName: true, isActive: true } },
        zone: { select: { name: true } },
        _count: {
          select: {
            orders: { where: { status: { in: ['READY', 'OUT_FOR_DELIVERY'] } } },
          },
        },
      },
    });

    res.json(drivers.map(d => ({
      id: d.id,
      name: `${d.user.firstName} ${d.user.lastName}`,
      zone: d.zone?.name,
      isAvailable: d.isAvailable,
      isActive: d.user.isActive,
      pendingDeliveries: d._count.orders,
      lastLocation: d.currentLat && d.currentLng ? {
        lat: d.currentLat,
        lng: d.currentLng,
        at: d.lastLocationAt,
      } : null,
    })));
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/recent-orders
router.get('/recent-orders', authenticate, async (req, res, next) => {
  try {
    const { limit = '10' } = req.query;

    const orders = await prisma.order.findMany({
      include: {
        customer: { select: { firstName: true, lastName: true } },
        items: { select: { quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    res.json(orders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customer: `${o.customer.firstName} ${o.customer.lastName}`,
      items: o.items.reduce((sum, i) => sum + i.quantity, 0),
      total: o.total,
      status: o.status,
      paymentStatus: o.paymentStatus,
      source: o.source,
      createdAt: o.createdAt,
    })));
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/notifications
router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: (req as any).user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

// PUT /api/dashboard/notifications/:id/read
router.put('/notifications/:id/read', authenticate, async (req, res, next) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
