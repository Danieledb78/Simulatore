import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest, authorize } from '../middlewares/auth.js';
import { inventoryService } from '../services/inventory.service.js';
import { prisma } from '../utils/prisma.js';

const router = Router();

// GET /api/inventory
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { lowStock, search, page = '1', limit = '50' } = req.query;

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(search && {
          OR: [
            { name: { contains: search as string, mode: 'insensitive' } },
            { barcode: { contains: search as string } },
          ],
        }),
      },
      include: {
        category: { select: { name: true } },
        inventory: true,
      },
      orderBy: { name: 'asc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
    });

    let filteredProducts = products;
    if (lowStock === 'true') {
      filteredProducts = products.filter(
        p => p.inventory && p.inventory.quantity <= p.minStockLevel
      );
    }

    res.json(filteredProducts);
  } catch (error) {
    next(error);
  }
});

// GET /api/inventory/low-stock
router.get('/low-stock', authenticate, async (req, res, next) => {
  try {
    const lowStockProducts = await inventoryService.getLowStockProducts();
    res.json(lowStockProducts);
  } catch (error) {
    next(error);
  }
});

// GET /api/inventory/movements
router.get('/movements', authenticate, async (req, res, next) => {
  try {
    const { productId, type, startDate, endDate, page = '1', limit = '50' } = req.query;

    const result = await inventoryService.getStockMovements(
      {
        productId: productId as string,
        type: type as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
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

// POST /api/inventory/load
router.post('/load', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      barcode: z.string().min(1),
      quantity: z.number().int().positive(),
      supplierId: z.string().uuid().optional(),
      batchNumber: z.string().optional(),
      expirationDate: z.string().datetime().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const result = await inventoryService.loadStock(
      data.barcode,
      data.quantity,
      req.user!.id,
      {
        supplierId: data.supplierId,
        batchNumber: data.batchNumber,
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : undefined,
        notes: data.notes,
      }
    );

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/inventory/load-batch
router.post('/load-batch', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      items: z.array(z.object({
        barcode: z.string().min(1),
        quantity: z.number().int().positive(),
      })),
      supplierId: z.string().uuid().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const results = [];
    for (const item of data.items) {
      try {
        const result = await inventoryService.loadStock(
          item.barcode,
          item.quantity,
          req.user!.id,
          { supplierId: data.supplierId, notes: data.notes }
        );
        results.push({ barcode: item.barcode, success: true, result });
      } catch (error: any) {
        results.push({ barcode: item.barcode, success: false, error: error.message });
      }
    }

    res.json({ results });
  } catch (error) {
    next(error);
  }
});

// POST /api/inventory/adjust
router.post('/adjust', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      productId: z.string().uuid(),
      newQuantity: z.number().int().min(0),
      reason: z.string().min(1),
    }).parse(req.body);

    const movement = await inventoryService.adjustInventory(
      data.productId,
      data.newQuantity,
      data.reason,
      req.user!.id
    );

    res.json(movement);
  } catch (error) {
    next(error);
  }
});

// POST /api/inventory/check-availability
router.post('/check-availability', authenticate, async (req, res, next) => {
  try {
    const data = z.object({
      items: z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      })),
    }).parse(req.body);

    const result = await inventoryService.checkAvailability(data.items);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
