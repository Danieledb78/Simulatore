import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate, AuthRequest, authorize } from '../middlewares/auth.js';
import bcrypt from 'bcryptjs';

const router = Router();

// GET /api/drivers
router.get('/', authenticate, async (req, res, next) => {
  try {
    const drivers = await prisma.driver.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true } },
        zone: { select: { id: true, name: true } },
        _count: { select: { orders: { where: { status: { in: ['READY', 'OUT_FOR_DELIVERY'] } } } } },
      },
    });

    res.json(drivers);
  } catch (error) {
    next(error);
  }
});

// GET /api/drivers/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: req.params.id },
      include: {
        user: true,
        zone: true,
        orders: {
          where: { status: { in: ['READY', 'OUT_FOR_DELIVERY'] } },
          include: {
            customer: { select: { firstName: true, lastName: true, phone: true, address: true } },
            items: { include: { product: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    res.json(driver);
  } catch (error) {
    next(error);
  }
});

// POST /api/drivers
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      phone: z.string().optional(),
      zoneId: z.string().uuid().optional(),
      vehicleType: z.string().optional(),
      vehiclePlate: z.string().optional(),
      licenseNumber: z.string().optional(),
    }).parse(req.body);

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: 'DRIVER',
        driver: {
          create: {
            zoneId: data.zoneId,
            vehicleType: data.vehicleType,
            vehiclePlate: data.vehiclePlate,
            licenseNumber: data.licenseNumber,
          },
        },
      },
      include: {
        driver: { include: { zone: true } },
      },
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

// PUT /api/drivers/:id
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = z.object({
      zoneId: z.string().uuid().optional().nullable(),
      vehicleType: z.string().optional(),
      vehiclePlate: z.string().optional(),
      licenseNumber: z.string().optional(),
      isAvailable: z.boolean().optional(),
    }).parse(req.body);

    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data,
      include: { user: true, zone: true },
    });

    res.json(driver);
  } catch (error) {
    next(error);
  }
});

// PUT /api/drivers/:id/availability
router.put('/:id/availability', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { isAvailable } = z.object({ isAvailable: z.boolean() }).parse(req.body);

    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: { isAvailable },
    });

    res.json(driver);
  } catch (error) {
    next(error);
  }
});

// PUT /api/drivers/:id/location
router.put('/:id/location', authenticate, async (req, res, next) => {
  try {
    const { lat, lng } = z.object({
      lat: z.number(),
      lng: z.number(),
    }).parse(req.body);

    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: {
        currentLat: lat,
        currentLng: lng,
        lastLocationAt: new Date(),
      },
    });

    res.json(driver);
  } catch (error) {
    next(error);
  }
});

// GET /api/drivers/:id/deliveries
router.get('/:id/deliveries', authenticate, async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();

    const deliveries = await prisma.delivery.findMany({
      where: {
        driverId: req.params.id,
        date: {
          gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          lt: new Date(targetDate.setHours(23, 59, 59, 999)),
        },
      },
    });

    res.json(deliveries);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/drivers/:id
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: req.params.id },
    });

    if (driver) {
      await prisma.user.update({
        where: { id: driver.userId },
        data: { isActive: false },
      });
    }

    res.json({ message: 'Driver disattivato' });
  } catch (error) {
    next(error);
  }
});

export default router;
