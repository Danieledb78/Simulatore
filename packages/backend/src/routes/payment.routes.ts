import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { stripeService } from '../services/stripe.service.js';
import { config } from '../config/index.js';
import Stripe from 'stripe';

const router = Router();

// GET /api/payments
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { orderId, customerId, status, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (orderId) where.orderId = orderId;
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          order: { select: { orderNumber: true } },
          customer: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      data: payments,
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

// POST /api/payments/create-intent
router.post('/create-intent', authenticate, async (req, res, next) => {
  try {
    const { orderId, amount, customerId } = z.object({
      orderId: z.string().uuid(),
      amount: z.number().positive(),
      customerId: z.string().uuid(),
    }).parse(req.body);

    const paymentIntent = await stripeService.createPaymentIntent(orderId, amount, customerId);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/create-payment-link
router.post('/create-payment-link', authenticate, async (req, res, next) => {
  try {
    const { orderId, amount, customerId } = z.object({
      orderId: z.string().uuid(),
      amount: z.number().positive(),
      customerId: z.string().uuid(),
    }).parse(req.body);

    const paymentLink = await stripeService.createPaymentLink(orderId, amount, customerId);

    res.json({ paymentLink });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/webhook (Stripe webhook)
router.post('/webhook', async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const stripe = new Stripe(config.stripe.secretKey);

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret
      );
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    await stripeService.handleWebhook(event);

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/record-manual
router.post('/record-manual', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = z.object({
      orderId: z.string().uuid(),
      amount: z.number().positive(),
      method: z.enum(['BANK_TRANSFER', 'CASH', 'CREDIT']),
      transactionRef: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
    });

    if (!order) {
      return res.status(404).json({ error: 'Ordine non trovato' });
    }

    const payment = await prisma.payment.create({
      data: {
        orderId: data.orderId,
        customerId: order.customerId,
        amount: data.amount,
        method: data.method,
        status: 'PAID',
        transactionRef: data.transactionRef,
        notes: data.notes,
        paidAt: new Date(),
      },
    });

    // Aggiorna stato ordine
    const totalPaid = await prisma.payment.aggregate({
      where: { orderId: data.orderId, status: 'PAID' },
      _sum: { amount: true },
    });

    const paidAmount = Number(totalPaid._sum.amount) || 0;
    const orderTotal = Number(order.total);

    await prisma.order.update({
      where: { id: data.orderId },
      data: {
        paidAmount,
        paymentStatus: paidAmount >= orderTotal ? 'PAID' : 'PARTIAL',
        paymentMethod: data.method,
      },
    });

    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/:id/refund
router.post('/:id/refund', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { amount, reason } = z.object({
      amount: z.number().positive().optional(),
      reason: z.string().optional(),
    }).parse(req.body);

    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
    });

    if (!payment || !payment.stripePaymentId) {
      return res.status(400).json({ error: 'Pagamento non rimborsabile' });
    }

    const refund = await stripeService.createRefund(
      payment.stripePaymentId,
      amount,
      reason
    );

    res.json({ refund });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/:id/receipt
router.get('/:id/receipt', authenticate, async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
    });

    if (!payment?.stripeReceiptUrl) {
      return res.status(404).json({ error: 'Ricevuta non disponibile' });
    }

    res.json({ receiptUrl: payment.stripeReceiptUrl });
  } catch (error) {
    next(error);
  }
});

export default router;
