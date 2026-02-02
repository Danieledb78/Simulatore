import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

const zoneSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  postalCodes: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
  provinces: z.array(z.string()).optional(),
  deliveryFee: z.number().min(0).optional(),
});

// GET /api/zones
router.get('/', authenticate, async (req, res, next) => {
  try {
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { drivers: true, customers: true } },
        drivers: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(zones);
  } catch (error) {
    next(error);
  }
});

// GET /api/zones/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const zone = await prisma.zone.findUnique({
      where: { id: req.params.id },
      include: {
        drivers: { include: { user: true } },
        customers: { select: { id: true, firstName: true, lastName: true, address: true } },
      },
    });

    res.json(zone);
  } catch (error) {
    next(error);
  }
});

// POST /api/zones
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = zoneSchema.parse(req.body);
    const zone = await prisma.zone.create({ data });
    res.status(201).json(zone);
  } catch (error) {
    next(error);
  }
});

// PUT /api/zones/:id
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = zoneSchema.partial().parse(req.body);
    const zone = await prisma.zone.update({
      where: { id: req.params.id },
      data,
    });
    res.json(zone);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/zones/:id
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    await prisma.zone.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ message: 'Zona disattivata' });
  } catch (error) {
    next(error);
  }
});

// POST /api/zones/find-by-postal-code
router.post('/find-by-postal-code', async (req, res, next) => {
  try {
    const { postalCode } = z.object({ postalCode: z.string() }).parse(req.body);

    const zone = await prisma.zone.findFirst({
      where: {
        isActive: true,
        postalCodes: { has: postalCode },
      },
    });

    res.json(zone);
  } catch (error) {
    next(error);
  }
});

export default router;
