import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { whatsappService } from '../services/whatsapp.service.js';
import { emailService } from '../services/email.service.js';
import PDFDocument from 'pdfkit';

const router = Router();

// GET /api/invoices
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { customerId, status, type, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (type) where.type = type;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: { select: { firstName: true, lastName: true, companyName: true } },
          order: { select: { orderNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      data: invoices,
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

// GET /api/invoices/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        order: {
          include: {
            items: { include: { product: true } },
          },
        },
      },
    });

    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

// POST /api/invoices
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = z.object({
      orderId: z.string().uuid(),
      type: z.enum(['INVOICE', 'RECEIPT', 'CREDIT_NOTE']).optional(),
    }).parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { customer: true },
    });

    if (!order) {
      return res.status(404).json({ error: 'Ordine non trovato' });
    }

    // Genera numero fattura
    const year = new Date().getFullYear();
    const count = await prisma.invoice.count({
      where: { createdAt: { gte: new Date(year, 0, 1) } },
    });
    const invoiceNumber = `FT-${year}/${String(count + 1).padStart(6, '0')}`;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        orderId: order.id,
        customerId: order.customerId,
        type: data.type || 'INVOICE',
        customerName: order.customer.companyName || `${order.customer.firstName} ${order.customer.lastName}`,
        customerAddress: order.customer.address || '',
        customerVat: order.customer.vatNumber,
        customerFiscalCode: order.customer.fiscalCode,
        customerSdi: order.customer.sdiCode,
        customerPec: order.customer.pecEmail,
        subtotal: order.subtotal,
        vatAmount: order.vatAmount,
        total: order.total,
        status: 'DRAFT',
      },
    });

    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
});

// POST /api/invoices/:id/issue
router.post('/:id/issue', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        status: 'ISSUED',
        issuedAt: new Date(),
      },
    });

    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

// POST /api/invoices/:id/send
router.post('/:id/send', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { via } = z.object({
      via: z.enum(['email', 'whatsapp', 'both']),
    }).parse(req.body);

    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        order: { include: { items: { include: { product: true } } } },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Fattura non trovata' });
    }

    // Genera PDF
    const pdfBuffer = await generateInvoicePDF(invoice);

    // Invia via email
    if ((via === 'email' || via === 'both') && invoice.customer.email) {
      await emailService.sendInvoice(
        invoice.customer.email,
        invoice.invoiceNumber,
        invoice.customerName,
        pdfBuffer
      );
    }

    // Invia via WhatsApp
    if ((via === 'whatsapp' || via === 'both') && invoice.customer.phone) {
      await whatsappService.sendInvoice(invoice.id);
    }

    await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        sentVia: via,
      },
    });

    res.json({ message: 'Fattura inviata' });
  } catch (error) {
    next(error);
  }
});

// GET /api/invoices/:id/pdf
router.get('/:id/pdf', authenticate, async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        order: { include: { items: { include: { product: true } } } },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Fattura non trovata' });
    }

    const pdfBuffer = await generateInvoicePDF(invoice);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Fattura_${invoice.invoiceNumber.replace('/', '-')}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// Helper function per generare PDF
async function generateInvoicePDF(invoice: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text('FATTURA', { align: 'center' });
    doc.moveDown();

    // Info fattura
    doc.fontSize(12);
    doc.text(`Numero: ${invoice.invoiceNumber}`);
    doc.text(`Data: ${new Date(invoice.issuedAt || invoice.createdAt).toLocaleDateString('it-IT')}`);
    doc.moveDown();

    // Dati cliente
    doc.fontSize(14).text('Cliente:', { underline: true });
    doc.fontSize(12);
    doc.text(invoice.customerName);
    if (invoice.customerAddress) doc.text(invoice.customerAddress);
    if (invoice.customerVat) doc.text(`P.IVA: ${invoice.customerVat}`);
    if (invoice.customerFiscalCode) doc.text(`C.F.: ${invoice.customerFiscalCode}`);
    doc.moveDown();

    // Tabella prodotti
    doc.fontSize(14).text('Dettaglio:', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    doc.fontSize(10);
    doc.text('Prodotto', 50, tableTop);
    doc.text('Qtà', 300, tableTop);
    doc.text('Prezzo', 350, tableTop);
    doc.text('Totale', 450, tableTop);

    let y = tableTop + 20;
    for (const item of invoice.order.items) {
      doc.text(item.product.name.substring(0, 40), 50, y);
      doc.text(String(item.quantity), 300, y);
      doc.text(`€${Number(item.unitPrice).toFixed(2)}`, 350, y);
      doc.text(`€${Number(item.total).toFixed(2)}`, 450, y);
      y += 20;
    }

    doc.moveDown(2);

    // Totali
    doc.fontSize(12);
    doc.text(`Imponibile: €${Number(invoice.subtotal).toFixed(2)}`, { align: 'right' });
    doc.text(`IVA: €${Number(invoice.vatAmount).toFixed(2)}`, { align: 'right' });
    doc.fontSize(14).text(`TOTALE: €${Number(invoice.total).toFixed(2)}`, { align: 'right' });

    doc.end();
  });
}

export default router;
