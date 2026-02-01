import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.port === 465,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

export class EmailService {
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    attachments?: Array<{ filename: string; path?: string; content?: Buffer }>
  ): Promise<void> {
    try {
      await transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        html,
        attachments,
      });
      logger.info(`Email inviata a ${to}: ${subject}`);
    } catch (error) {
      logger.error(`Errore invio email a ${to}:`, error);
      throw error;
    }
  }

  async sendOrderConfirmation(
    email: string,
    orderNumber: string,
    customerName: string,
    total: number,
    items: Array<{ name: string; quantity: number; price: number }>
  ): Promise<void> {
    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">€${(item.quantity * item.price).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .order-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .order-table th { background: #34495e; color: white; padding: 10px; text-align: left; }
        .total { font-size: 1.2em; font-weight: bold; text-align: right; padding: 10px; }
        .footer { text-align: center; padding: 20px; font-size: 0.9em; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Conferma Ordine</h1>
        </div>
        <div class="content">
          <p>Ciao ${customerName},</p>
          <p>Grazie per il tuo ordine! Ecco il riepilogo:</p>

          <p><strong>Numero Ordine:</strong> ${orderNumber}</p>

          <table class="order-table">
            <thead>
              <tr>
                <th>Prodotto</th>
                <th style="text-align: center;">Quantità</th>
                <th style="text-align: right;">Totale</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <p class="total">Totale: €${total.toFixed(2)}</p>

          <p>Ti invieremo un'altra email quando l'ordine sarà in consegna.</p>
        </div>
        <div class="footer">
          <p>Beverage Warehouse - Il tuo fornitore di fiducia</p>
        </div>
      </div>
    </body>
    </html>
    `;

    await this.sendEmail(email, `Conferma Ordine ${orderNumber}`, html);
  }

  async sendDeliveryNotification(
    email: string,
    orderNumber: string,
    customerName: string,
    driverName: string,
    estimatedTime?: string
  ): Promise<void> {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #27ae60; color: white; padding: 20px; text-align: center;">
          <h1>🚚 Ordine in Consegna!</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <p>Ciao ${customerName},</p>
          <p>Il tuo ordine <strong>${orderNumber}</strong> è in arrivo!</p>

          <p><strong>Autista:</strong> ${driverName}</p>
          ${estimatedTime ? `<p><strong>Orario stimato:</strong> ${estimatedTime}</p>` : ''}

          <p>Preparati a ricevere la consegna.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    await this.sendEmail(email, `Ordine ${orderNumber} in consegna!`, html);
  }

  async sendPaymentLink(
    email: string,
    orderNumber: string,
    customerName: string,
    total: number,
    paymentLink: string
  ): Promise<void> {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #3498db; color: white; padding: 20px; text-align: center;">
          <h1>💳 Completa il Pagamento</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <p>Ciao ${customerName},</p>
          <p>Per completare il tuo ordine <strong>${orderNumber}</strong>, effettua il pagamento.</p>

          <p style="font-size: 1.2em;"><strong>Totale da pagare: €${total.toFixed(2)}</strong></p>

          <p style="text-align: center; margin: 30px 0;">
            <a href="${paymentLink}" style="background: #27ae60; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 1.1em;">
              Paga Ora
            </a>
          </p>

          <p style="font-size: 0.9em; color: #666;">
            Il link di pagamento scade tra 24 ore. Pagamento sicuro tramite Stripe.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    await this.sendEmail(email, `Pagamento Ordine ${orderNumber}`, html);
  }

  async sendInvoice(
    email: string,
    invoiceNumber: string,
    customerName: string,
    pdfBuffer: Buffer
  ): Promise<void> {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #9b59b6; color: white; padding: 20px; text-align: center;">
          <h1>📄 Fattura</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <p>Gentile ${customerName},</p>
          <p>In allegato trovi la fattura n. <strong>${invoiceNumber}</strong>.</p>
          <p>Grazie per aver scelto i nostri servizi.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    await this.sendEmail(
      email,
      `Fattura ${invoiceNumber}`,
      html,
      [{ filename: `Fattura_${invoiceNumber}.pdf`, content: pdfBuffer }]
    );
  }

  async sendLowStockAlert(
    adminEmail: string,
    products: Array<{ name: string; currentStock: number; minStock: number }>
  ): Promise<void> {
    const productsHtml = products.map(p => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${p.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; color: red;">${p.currentStock}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${p.minStock}</td>
      </tr>
    `).join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #e74c3c; color: white; padding: 20px; text-align: center;">
          <h1>⚠️ Allarme Scorte Basse</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <p>I seguenti prodotti sono sotto la soglia minima di stock:</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #34495e; color: white;">
                <th style="padding: 10px; text-align: left;">Prodotto</th>
                <th style="padding: 10px; text-align: center;">Scorta Attuale</th>
                <th style="padding: 10px; text-align: center;">Soglia Minima</th>
              </tr>
            </thead>
            <tbody>
              ${productsHtml}
            </tbody>
          </table>

          <p>Si consiglia di effettuare un riordino a breve.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    await this.sendEmail(adminEmail, '⚠️ Allarme Scorte Basse', html);
  }
}

export const emailService = new EmailService();
export default emailService;
