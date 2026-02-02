import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { whatsappService } from '../services/whatsapp.service.js';
import { config } from '../config/index.js';
import { whatsappRateLimiter } from '../middlewares/rateLimiter.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/whatsapp/webhook (verifica webhook Meta)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    logger.info('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// POST /api/whatsapp/webhook (ricevi messaggi)
router.post('/webhook', whatsappRateLimiter, async (req, res, next) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const value = change.value;

            // Gestisci messaggi in arrivo
            for (const message of value.messages || []) {
              await whatsappService.handleIncomingMessage(message);
            }

            // Gestisci status updates
            for (const status of value.statuses || []) {
              await handleStatusUpdate(status);
            }
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error('WhatsApp webhook error:', error);
    res.sendStatus(200); // Rispondi sempre 200 a Meta
  }
});

// Gestisce aggiornamenti stato messaggio
async function handleStatusUpdate(status: any) {
  const { id, status: msgStatus } = status;

  await prisma.whatsAppMessage.updateMany({
    where: { messageId: id },
    data: {
      status: msgStatus.toUpperCase() as any,
    },
  });
}

// GET /api/whatsapp/conversations
router.get('/conversations', authenticate, async (req, res, next) => {
  try {
    const { status, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (status) where.status = status;

    const [conversations, total] = await Promise.all([
      prisma.whatsAppConversation.findMany({
        where,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
      }),
      prisma.whatsAppConversation.count({ where }),
    ]);

    res.json({
      data: conversations,
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

// GET /api/whatsapp/conversations/:id/messages
router.get('/conversations/:id/messages', authenticate, async (req, res, next) => {
  try {
    const messages = await prisma.whatsAppMessage.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });

    res.json(messages);
  } catch (error) {
    next(error);
  }
});

// POST /api/whatsapp/send
router.post('/send', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { to, message } = z.object({
      to: z.string(),
      message: z.string(),
    }).parse(req.body);

    const messageId = await whatsappService.sendTextMessage(to, message);
    res.json({ messageId });
  } catch (error) {
    next(error);
  }
});

// POST /api/whatsapp/send-template
router.post('/send-template', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { to, templateName, languageCode, components } = z.object({
      to: z.string(),
      templateName: z.string(),
      languageCode: z.string().optional(),
      components: z.array(z.any()).optional(),
    }).parse(req.body);

    const messageId = await whatsappService.sendTemplateMessage(
      to,
      templateName,
      languageCode,
      components
    );
    res.json({ messageId });
  } catch (error) {
    next(error);
  }
});

// POST /api/whatsapp/send-price-list
router.post('/send-price-list', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { to } = z.object({ to: z.string() }).parse(req.body);

    // Genera e invia listino
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });

    let listText = '📋 *LISTINO PREZZI*\n\n';
    let currentCategory = '';

    products.forEach(prod => {
      if (prod.category.name !== currentCategory) {
        currentCategory = prod.category.name;
        listText += `\n*${currentCategory.toUpperCase()}*\n`;
      }
      listText += `• ${prod.name} ${prod.unitSize || ''} - €${prod.sellingPrice}\n`;
    });

    const messageId = await whatsappService.sendTextMessage(to, listText);
    res.json({ messageId });
  } catch (error) {
    next(error);
  }
});

// POST /api/whatsapp/broadcast
router.post('/broadcast', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { message, customerIds } = z.object({
      message: z.string(),
      customerIds: z.array(z.string().uuid()).optional(),
    }).parse(req.body);

    const where: any = { phone: { not: null }, isActive: true };
    if (customerIds) {
      where.id = { in: customerIds };
    }

    const customers = await prisma.customer.findMany({
      where,
      select: { id: true, phone: true, firstName: true },
    });

    const results = [];
    for (const customer of customers) {
      try {
        const messageId = await whatsappService.sendTextMessage(customer.phone, message);
        results.push({ customerId: customer.id, success: true, messageId });
      } catch (error: any) {
        results.push({ customerId: customer.id, success: false, error: error.message });
      }
    }

    res.json({
      total: customers.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
