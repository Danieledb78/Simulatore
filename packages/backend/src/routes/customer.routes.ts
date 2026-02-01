import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { stripeService } from '../services/stripe.service.js';

const router = Router();

const customerSchema = z.object({
  type: z.enum(['PRIVATE', 'BAR', 'RESTAURANT', 'HOTEL', 'SHOP', 'WHOLESALE']).optional(),
  companyName: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  zoneId: z.string().uuid().optional(),
  vatNumber: z.string().optional(),
  fiscalCode: z.string().optional(),
  sdiCode: z.string().optional(),
  pecEmail: z.string().email().optional(),
  priceListId: z.string().uuid().optional(),
  creditLimit: z.number().optional(),
  paymentTerms: z.enum(['IMMEDIATE', 'NET_7', 'NET_15', 'NET_30', 'NET_60']).optional(),
  notes: z.string().optional(),
});

// GET /api/customers
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, type, zone, page = '1', limit = '50' } = req.query;

    const where: any = { isActive: true };
    if (type) where.type = type;
    if (zone) where.zoneId = zone;
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { companyName: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          zone: { select: { id: true, name: true } },
          priceList: { select: { id: true, name: true } },
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      data: customers,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        zone: true,
        priceList: { include: { items: { include: { product: true } } } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            items: { include: { product: true } },
          },
        },
      },
    });

    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/:id/orders
router.get('/:id/orders', authenticate, async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.params.id },
      include: {
        items: { include: { product: true } },
        driver: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// POST /api/customers
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = customerSchema.parse(req.body);

    const customer = await prisma.customer.create({
      data,
      include: { zone: true, priceList: true },
    });

    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

// PUT /api/customers/:id
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = customerSchema.partial().parse(req.body);

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data,
      include: { zone: true, priceList: true },
    });

    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/customers/:id
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    await prisma.customer.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: 'Cliente disattivato' });
  } catch (error) {
    next(error);
  }
});

// POST /api/customers/:id/stripe
router.post('/:id/stripe', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const stripeCustomer = await stripeService.getOrCreateCustomer(req.params.id);
    res.json({ stripeCustomerId: stripeCustomer.id });
  } catch (error) {
    next(error);
  }
});

export default router;
