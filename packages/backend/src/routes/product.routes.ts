import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';

const router = Router();

const productSchema = z.object({
  barcode: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().uuid(),
  brand: z.string().optional(),
  unit: z.enum(['PIECE', 'PACK', 'CASE', 'PALLET']).optional(),
  unitSize: z.string().optional(),
  purchasePrice: z.number().positive(),
  sellingPrice: z.number().positive(),
  vatRate: z.number().min(0).max(100).optional(),
  minStockLevel: z.number().int().min(0).optional(),
  imageUrl: z.string().url().optional(),
  expirationDays: z.number().int().positive().optional(),
});

// GET /api/products
router.get('/', async (req, res, next) => {
  try {
    const { category, search, active, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (category) where.categoryId = category;
    if (active !== undefined) where.isActive = active === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { barcode: { contains: search as string } },
        { brand: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          inventory: { select: { quantity: true, availableQty: true } },
        },
        orderBy: { name: 'asc' },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      data: products,
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

// GET /api/products/barcode/:barcode
router.get('/barcode/:barcode', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { barcode: req.params.barcode },
      include: {
        category: true,
        inventory: true,
      },
    });

    if (!product) {
      throw new AppError(404, 'Prodotto non trovato');
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        inventory: true,
        priceListItems: {
          include: { priceList: { select: { id: true, name: true } } },
        },
      },
    });

    if (!product) {
      throw new AppError(404, 'Prodotto non trovato');
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// POST /api/products
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);

    const existing = await prisma.product.findUnique({
      where: { barcode: data.barcode },
    });

    if (existing) {
      throw new AppError(409, 'Barcode già esistente');
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        inventory: {
          create: {
            quantity: 0,
            availableQty: 0,
            reservedQty: 0,
          },
        },
      },
      include: {
        category: true,
        inventory: true,
      },
    });

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// PUT /api/products/:id
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body);

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: {
        category: true,
        inventory: true,
      },
    });

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/products/:id (soft delete)
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: 'Prodotto disattivato' });
  } catch (error) {
    next(error);
  }
});

// POST /api/products/:id/activate
router.post('/:id/activate', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: true },
    });

    res.json(product);
  } catch (error) {
    next(error);
  }
});

export default router;
