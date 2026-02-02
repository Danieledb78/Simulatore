import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest, authorize } from '../middlewares/auth.js';
import { orderService } from '../services/order.service.js';
import { prisma } from '../utils/prisma.js';

const router = Router();

const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
  source: z.enum(['WEB', 'WHATSAPP', 'PHONE', 'DIRECT']).optional(),
  deliveryAddress: z.string().optional(),
  deliveryCity: z.string().optional(),
  deliveryProvince: z.string().optional(),
  deliveryPostalCode: z.string().optional(),
  deliveryNotes: z.string().optional(),
  requestedDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// GET /api/orders
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, customerId, driverId, source, startDate, endDate, paymentStatus, page = '1', limit = '20' } = req.query;

    const result = await orderService.getOrders(
      {
        status: status as string,
        customerId: customerId as string,
        driverId: driverId as string,
        source: source as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        paymentStatus: paymentStatus as string,
      },
      {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      }
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/stats
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const { period = 'today' } = req.query;
    const stats = await orderService.getOrderStats(period as any);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        driver: { include: { user: true } },
        items: { include: { product: true } },
        payments: true,
        invoice: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    res.json(order);
  } catch (error) {
    next(error);
  }
});

// POST /api/orders
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = createOrderSchema.parse(req.body);

    const order = await orderService.createOrder({
      ...data,
      source: data.source || 'WEB',
      requestedDate: data.requestedDate ? new Date(data.requestedDate) : undefined,
    });

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

// PUT /api/orders/:id/status
router.put('/:id/status', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { status, notes } = z.object({
      status: z.enum([
        'PENDING', 'CONFIRMED', 'PROCESSING', 'READY',
        'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED'
      ]),
      notes: z.string().optional(),
    }).parse(req.body);

    const order = await orderService.updateOrderStatus(
      req.params.id,
      status,
      req.user!.id,
      notes
    );

    res.json(order);
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/:id/assign-driver
router.post('/:id/assign-driver', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const { driverId } = z.object({
      driverId: z.string().uuid(),
    }).parse(req.body);

    const order = await orderService.assignDriver(req.params.id, driverId, req.user!.id);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/:id/auto-assign
router.post('/:id/auto-assign', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const order = await orderService.autoAssignDriver(req.params.id, req.user!.id);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/:id/payment-link
router.post('/:id/payment-link', authenticate, async (req, res, next) => {
  try {
    const paymentLink = await orderService.generatePaymentLink(req.params.id);
    res.json({ paymentLink });
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/driver/:driverId
router.get('/driver/:driverId', authenticate, async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        driverId: req.params.driverId,
        status: { in: ['READY', 'OUT_FOR_DELIVERY'] },
      },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true, address: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(orders);
  } catch (error) {
    next(error);
  }
});

export default router;
