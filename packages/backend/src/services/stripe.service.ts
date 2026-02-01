import Stripe from 'stripe';
import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

export class StripeService {
  /**
   * Crea o recupera un cliente Stripe
   */
  async getOrCreateCustomer(customerId: string): Promise<Stripe.Customer> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error('Cliente non trovato');
    }

    // Se esiste già un customer Stripe, recuperalo
    if (customer.stripeCustomerId) {
      const stripeCustomer = await stripe.customers.retrieve(customer.stripeCustomerId);
      if (!stripeCustomer.deleted) {
        return stripeCustomer as Stripe.Customer;
      }
    }

    // Crea nuovo customer Stripe
    const stripeCustomer = await stripe.customers.create({
      email: customer.email || undefined,
      name: customer.companyName || `${customer.firstName} ${customer.lastName}`,
      phone: customer.phone,
      metadata: {
        customerId: customer.id,
        type: customer.type,
      },
      address: customer.address ? {
        line1: customer.address,
        city: customer.city || undefined,
        postal_code: customer.postalCode || undefined,
        state: customer.province || undefined,
        country: 'IT',
      } : undefined,
    });

    // Salva ID Stripe nel database
    await prisma.customer.update({
      where: { id: customerId },
      data: { stripeCustomerId: stripeCustomer.id },
    });

    return stripeCustomer;
  }

  /**
   * Crea un Payment Intent per un ordine
   */
  async createPaymentIntent(
    orderId: string,
    amount: number,
    customerId: string
  ): Promise<Stripe.PaymentIntent> {
    const stripeCustomer = await this.getOrCreateCustomer(customerId);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe usa centesimi
      currency: 'eur',
      customer: stripeCustomer.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: customerId,
      },
      description: `Ordine ${order.orderNumber}`,
      receipt_email: order.customer.email || undefined,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    logger.info(`Payment Intent creato: ${paymentIntent.id} per ordine ${order.orderNumber}`);

    return paymentIntent;
  }

  /**
   * Crea un link di pagamento per WhatsApp/Email
   */
  async createPaymentLink(
    orderId: string,
    amount: number,
    customerId: string
  ): Promise<string> {
    const stripeCustomer = await this.getOrCreateCustomer(customerId);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    // Crea line items per Checkout Session
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.product.name,
          description: item.product.description || undefined,
        },
        unit_amount: Math.round(Number(item.unitPrice) * 100),
      },
      quantity: item.quantity,
    }));

    // Aggiungi spese di consegna se presenti
    if (Number(order.deliveryFee) > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Spese di consegna',
          },
          unit_amount: Math.round(Number(order.deliveryFee) * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      line_items: lineItems,
      mode: 'payment',
      success_url: `${config.webAppUrl}/orders/${orderId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.webAppUrl}/orders/${orderId}/payment`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
      payment_intent_data: {
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
      },
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: `Fattura ordine ${order.orderNumber}`,
          metadata: {
            orderId: order.id,
          },
        },
      },
      locale: 'it',
    });

    logger.info(`Checkout Session creata: ${session.id} per ordine ${order.orderNumber}`);

    return session.url!;
  }

  /**
   * Gestisce webhook Stripe per conferma pagamento
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.handlePaymentSuccess(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.handlePaymentFailed(paymentIntent);
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === 'paid') {
          await this.handleCheckoutComplete(session);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        logger.info(`Fattura Stripe pagata: ${invoice.id}`);
        break;
      }

      default:
        logger.debug(`Evento Stripe non gestito: ${event.type}`);
    }
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) return;

    const amount = paymentIntent.amount / 100;

    // Crea record pagamento
    await prisma.payment.create({
      data: {
        orderId,
        customerId: paymentIntent.metadata.customerId,
        amount,
        method: 'STRIPE',
        status: 'PAID',
        stripePaymentId: paymentIntent.id,
        stripeReceiptUrl: paymentIntent.charges?.data[0]?.receipt_url || null,
        paidAt: new Date(),
      },
    });

    // Aggiorna ordine
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'PAID',
        paymentMethod: 'STRIPE',
        paidAmount: { increment: amount },
      },
    });

    logger.info(`Pagamento completato per ordine ${orderId}: €${amount}`);
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) return;

    await prisma.payment.create({
      data: {
        orderId,
        customerId: paymentIntent.metadata.customerId,
        amount: paymentIntent.amount / 100,
        method: 'STRIPE',
        status: 'FAILED',
        stripePaymentId: paymentIntent.id,
        notes: paymentIntent.last_payment_error?.message || 'Pagamento fallito',
      },
    });

    logger.warn(`Pagamento fallito per ordine ${orderId}`);
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const orderId = session.metadata?.orderId;
    if (!orderId) return;

    logger.info(`Checkout completato per ordine ${orderId}`);
  }

  /**
   * Genera ricevuta PDF da Stripe
   */
  async getReceipt(paymentId: string): Promise<string | null> {
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentId: paymentId },
    });

    return payment?.stripeReceiptUrl || null;
  }

  /**
   * Crea rimborso
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<Stripe.Refund> {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason: reason as Stripe.RefundCreateParams.Reason || 'requested_by_customer',
    });

    // Aggiorna pagamento nel database
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentId: paymentIntentId },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'REFUNDED' },
      });

      await prisma.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: 'REFUNDED' },
      });
    }

    logger.info(`Rimborso creato: ${refund.id}`);

    return refund;
  }
}

export const stripeService = new StripeService();
export default stripeService;
