import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// GET /api/settings
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const settings = await prisma.setting.findMany();
    const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
    res.json(settingsMap);
  } catch (error) {
    next(error);
  }
});

// GET /api/settings/:key
router.get('/:key', authenticate, async (req, res, next) => {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: req.params.key },
    });

    if (!setting) {
      return res.status(404).json({ error: 'Impostazione non trovata' });
    }

    res.json(setting.value);
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings/:key
router.put('/:key', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { value } = req.body;

    const setting = await prisma.setting.upsert({
      where: { key: req.params.key },
      update: { value },
      create: { key: req.params.key, value },
    });

    res.json(setting);
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings (bulk update)
router.put('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const settings = z.record(z.any()).parse(req.body);

    for (const [key, value] of Object.entries(settings)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    res.json({ message: 'Impostazioni aggiornate' });
  } catch (error) {
    next(error);
  }
});

// GET /api/settings/price-lists
router.get('/price-lists/all', authenticate, async (req, res, next) => {
  try {
    const priceLists = await prisma.priceList.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { customers: true, items: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(priceLists);
  } catch (error) {
    next(error);
  }
});

// POST /api/settings/price-lists
router.post('/price-lists', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      discountPct: z.number().min(0).max(100).optional(),
      isDefault: z.boolean().optional(),
    }).parse(req.body);

    // Se è default, rimuovi default dagli altri
    if (data.isDefault) {
      await prisma.priceList.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const priceList = await prisma.priceList.create({ data });
    res.status(201).json(priceList);
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings/price-lists/:id/items
router.put('/price-lists/:id/items', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { items } = z.object({
      items: z.array(z.object({
        productId: z.string().uuid(),
        price: z.number().positive(),
        discountPct: z.number().min(0).max(100).optional(),
      })),
    }).parse(req.body);

    // Elimina vecchi items
    await prisma.priceListItem.deleteMany({
      where: { priceListId: req.params.id },
    });

    // Crea nuovi items
    await prisma.priceListItem.createMany({
      data: items.map(item => ({
        priceListId: req.params.id,
        ...item,
      })),
    });

    const priceList = await prisma.priceList.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } } },
    });

    res.json(priceList);
  } catch (error) {
    next(error);
  }
});

// GET /api/settings/suppliers
router.get('/suppliers/all', authenticate, async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    res.json(suppliers);
  } catch (error) {
    next(error);
  }
});

// POST /api/settings/suppliers
router.post('/suppliers', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      province: z.string().optional(),
      postalCode: z.string().optional(),
      vatNumber: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const supplier = await prisma.supplier.create({ data });
    res.status(201).json(supplier);
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings/suppliers/:id
router.put('/suppliers/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      province: z.string().optional(),
      postalCode: z.string().optional(),
      vatNumber: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data,
    });

    res.json(supplier);
  } catch (error) {
    next(error);
  }
});

export default router;
