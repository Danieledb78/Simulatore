import axios from 'axios';
import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { stripeService } from './stripe.service.js';

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'interactive' | 'button';
  text?: { body: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

interface ConversationContext {
  step: string;
  orderId?: string;
  items?: Array<{ productId: string; name: string; quantity: number; price: number }>;
  tempData?: Record<string, any>;
}

export class WhatsAppService {
  private apiUrl: string;
  private phoneNumberId: string;
  private accessToken: string;

  constructor() {
    this.apiUrl = config.whatsapp.apiUrl;
    this.phoneNumberId = config.whatsapp.phoneNumberId;
    this.accessToken = config.whatsapp.accessToken;
  }

  /**
   * Invia messaggio di testo
   */
  async sendTextMessage(to: string, message: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body: message },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const messageId = response.data.messages[0].id;
      logger.info(`Messaggio WhatsApp inviato a ${to}: ${messageId}`);
      return messageId;
    } catch (error: any) {
      logger.error(`Errore invio WhatsApp a ${to}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Invia template message (per iniziare conversazione)
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = 'it',
    components?: any[]
  ): Promise<string> {
    const response = await axios.post(
      `${this.apiUrl}/${this.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.messages[0].id;
  }

  /**
   * Invia messaggio interattivo con bottoni
   */
  async sendButtonMessage(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<string> {
    const response = await axios.post(
      `${this.apiUrl}/${this.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map(btn => ({
              type: 'reply',
              reply: { id: btn.id, title: btn.title },
            })),
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.messages[0].id;
  }

  /**
   * Invia lista interattiva
   */
  async sendListMessage(
    to: string,
    headerText: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>
  ): Promise<string> {
    const response = await axios.post(
      `${this.apiUrl}/${this.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: headerText },
          body: { text: bodyText },
          action: {
            button: buttonText,
            sections,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.messages[0].id;
  }

  /**
   * Invia documento (listino, fattura, etc.)
   */
  async sendDocument(
    to: string,
    documentUrl: string,
    filename: string,
    caption?: string
  ): Promise<string> {
    const response = await axios.post(
      `${this.apiUrl}/${this.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'document',
        document: {
          link: documentUrl,
          filename,
          caption,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.messages[0].id;
  }

  /**
   * Gestisce webhook incoming message
   */
  async handleIncomingMessage(message: WhatsAppMessage): Promise<void> {
    const phoneNumber = message.from;

    // Trova o crea conversazione
    let conversation = await prisma.whatsAppConversation.findFirst({
      where: { phoneNumber },
      include: { customer: true },
    });

    if (!conversation) {
      conversation = await prisma.whatsAppConversation.create({
        data: {
          phoneNumber,
          whatsappId: message.from,
          status: 'ACTIVE',
          context: { step: 'WELCOME' } as any,
        },
        include: { customer: true },
      });
    }

    // Salva messaggio in arrivo
    await prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        messageId: message.id,
        direction: 'INBOUND',
        type: message.type.toUpperCase() as any,
        content: message.text?.body ||
                 message.interactive?.button_reply?.title ||
                 message.interactive?.list_reply?.title,
      },
    });

    // Aggiorna timestamp ultima attività
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    // Processa messaggio in base al contesto
    await this.processMessage(conversation, message);
  }

  /**
   * Processa messaggio in base al contesto conversazione
   */
  private async processMessage(
    conversation: any,
    message: WhatsAppMessage
  ): Promise<void> {
    const context = (conversation.context as ConversationContext) || { step: 'WELCOME' };
    const phoneNumber = conversation.phoneNumber;
    const messageText = message.text?.body?.toLowerCase() || '';
    const buttonReply = message.interactive?.button_reply?.id;
    const listReply = message.interactive?.list_reply?.id;

    switch (context.step) {
      case 'WELCOME':
        await this.handleWelcome(conversation, phoneNumber);
        break;

      case 'WAITING_NAME':
        await this.handleNameInput(conversation, message.text?.body || '');
        break;

      case 'WAITING_ADDRESS':
        await this.handleAddressInput(conversation, message.text?.body || '');
        break;

      case 'MAIN_MENU':
        await this.handleMainMenu(conversation, buttonReply || messageText);
        break;

      case 'BROWSING_CATALOG':
        await this.handleCatalogBrowsing(conversation, listReply || messageText);
        break;

      case 'ADDING_QUANTITY':
        await this.handleQuantityInput(conversation, messageText);
        break;

      case 'VIEWING_CART':
        await this.handleCartAction(conversation, buttonReply || messageText);
        break;

      case 'CONFIRMING_ORDER':
        await this.handleOrderConfirmation(conversation, buttonReply || messageText);
        break;

      default:
        await this.sendMainMenu(phoneNumber);
        await this.updateContext(conversation.id, { step: 'MAIN_MENU' });
    }
  }

  /**
   * Gestisce messaggio di benvenuto
   */
  private async handleWelcome(conversation: any, phoneNumber: string): Promise<void> {
    // Controlla se cliente già registrato
    const customer = await prisma.customer.findFirst({
      where: { phone: phoneNumber },
    });

    if (customer) {
      // Cliente esistente
      await this.sendTextMessage(
        phoneNumber,
        `Ciao ${customer.firstName}! Bentornato. Come posso aiutarti oggi?`
      );

      await prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { customerId: customer.id },
      });

      await this.sendMainMenu(phoneNumber);
      await this.updateContext(conversation.id, { step: 'MAIN_MENU' });
    } else {
      // Nuovo cliente
      await this.sendTextMessage(
        phoneNumber,
        `Ciao! Benvenuto nel nostro servizio di ordinazione bevande.

Per poterti servire al meglio, ho bisogno di alcune informazioni.

Come ti chiami? (Nome e Cognome)`
      );
      await this.updateContext(conversation.id, { step: 'WAITING_NAME' });
    }
  }

  /**
   * Gestisce input nome
   */
  private async handleNameInput(conversation: any, name: string): Promise<void> {
    const phoneNumber = conversation.phoneNumber;
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    await this.updateContext(conversation.id, {
      step: 'WAITING_ADDRESS',
      tempData: { firstName, lastName },
    });

    await this.sendTextMessage(
      phoneNumber,
      `Piacere ${firstName}!

Ora ho bisogno del tuo indirizzo di consegna.

Inserisci l'indirizzo completo (Via, Numero, CAP, Città):`
    );
  }

  /**
   * Gestisce input indirizzo
   */
  private async handleAddressInput(conversation: any, address: string): Promise<void> {
    const phoneNumber = conversation.phoneNumber;
    const context = conversation.context as ConversationContext;

    // Crea nuovo cliente
    const customer = await prisma.customer.create({
      data: {
        firstName: context.tempData?.firstName || 'Cliente',
        lastName: context.tempData?.lastName || '',
        phone: phoneNumber,
        whatsappId: phoneNumber,
        address,
        isVerified: true,
      },
    });

    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { customerId: customer.id },
    });

    await this.sendTextMessage(
      phoneNumber,
      `Perfetto! Registrazione completata.

Ecco cosa puoi fare:`
    );

    await this.sendMainMenu(phoneNumber);
    await this.updateContext(conversation.id, { step: 'MAIN_MENU' });
  }

  /**
   * Invia menu principale
   */
  private async sendMainMenu(phoneNumber: string): Promise<void> {
    await this.sendButtonMessage(
      phoneNumber,
      'Scegli un\'opzione:',
      [
        { id: 'ORDER', title: 'Nuovo Ordine' },
        { id: 'CATALOG', title: 'Vedi Listino' },
        { id: 'STATUS', title: 'Stato Ordini' },
      ]
    );
  }

  /**
   * Gestisce selezione menu principale
   */
  private async handleMainMenu(conversation: any, selection: string): Promise<void> {
    const phoneNumber = conversation.phoneNumber;

    switch (selection.toUpperCase()) {
      case 'ORDER':
      case 'NUOVO ORDINE':
        await this.showCatalog(conversation);
        break;

      case 'CATALOG':
      case 'VEDI LISTINO':
        await this.sendPriceList(conversation);
        break;

      case 'STATUS':
      case 'STATO ORDINI':
        await this.showOrderStatus(conversation);
        break;

      default:
        await this.sendTextMessage(phoneNumber, 'Non ho capito. Seleziona un\'opzione dal menu.');
        await this.sendMainMenu(phoneNumber);
    }
  }

  /**
   * Mostra catalogo prodotti come lista
   */
  private async showCatalog(conversation: any): Promise<void> {
    const phoneNumber = conversation.phoneNumber;

    // Recupera categorie con prodotti
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        products: {
          where: { isActive: true },
          take: 10,
        },
      },
    });

    const sections = categories.map(cat => ({
      title: cat.name,
      rows: cat.products.map(prod => ({
        id: `PROD_${prod.id}`,
        title: prod.name.substring(0, 24),
        description: `€${prod.sellingPrice} - ${prod.unitSize || ''}`,
      })),
    }));

    if (sections.length > 0 && sections.some(s => s.rows.length > 0)) {
      await this.sendListMessage(
        phoneNumber,
        'Catalogo Prodotti',
        'Sfoglia le nostre bevande e seleziona i prodotti da aggiungere al carrello.',
        'Vedi Prodotti',
        sections
      );
      await this.updateContext(conversation.id, {
        step: 'BROWSING_CATALOG',
        items: [],
      });
    } else {
      await this.sendTextMessage(phoneNumber, 'Catalogo al momento non disponibile. Riprova più tardi.');
      await this.sendMainMenu(phoneNumber);
    }
  }

  /**
   * Gestisce selezione prodotto dal catalogo
   */
  private async handleCatalogBrowsing(conversation: any, selection: string): Promise<void> {
    const phoneNumber = conversation.phoneNumber;

    if (selection.startsWith('PROD_')) {
      const productId = selection.replace('PROD_', '');
      const product = await prisma.product.findUnique({ where: { id: productId } });

      if (product) {
        await this.updateContext(conversation.id, {
          ...conversation.context,
          tempData: { selectedProductId: productId, selectedProductName: product.name },
          step: 'ADDING_QUANTITY',
        });

        await this.sendTextMessage(
          phoneNumber,
          `Hai selezionato: ${product.name}
Prezzo: €${product.sellingPrice}

Quante unità vuoi ordinare?`
        );
      }
    } else if (selection === 'CART' || selection.toLowerCase() === 'carrello') {
      await this.showCart(conversation);
    } else {
      await this.showCatalog(conversation);
    }
  }

  /**
   * Gestisce input quantità
   */
  private async handleQuantityInput(conversation: any, input: string): Promise<void> {
    const phoneNumber = conversation.phoneNumber;
    const quantity = parseInt(input);
    const context = conversation.context as ConversationContext;

    if (isNaN(quantity) || quantity <= 0) {
      await this.sendTextMessage(phoneNumber, 'Inserisci un numero valido (es: 2, 5, 10)');
      return;
    }

    const product = await prisma.product.findUnique({
      where: { id: context.tempData?.selectedProductId },
    });

    if (!product) {
      await this.sendTextMessage(phoneNumber, 'Prodotto non trovato. Riprova.');
      await this.showCatalog(conversation);
      return;
    }

    // Aggiungi al carrello
    const items = context.items || [];
    items.push({
      productId: product.id,
      name: product.name,
      quantity,
      price: Number(product.sellingPrice),
    });

    await this.updateContext(conversation.id, {
      ...context,
      items,
      step: 'VIEWING_CART',
    });

    await this.sendTextMessage(
      phoneNumber,
      `Aggiunto al carrello: ${quantity}x ${product.name}`
    );

    await this.sendButtonMessage(
      phoneNumber,
      'Cosa vuoi fare?',
      [
        { id: 'ADD_MORE', title: 'Aggiungi altro' },
        { id: 'VIEW_CART', title: 'Vedi carrello' },
        { id: 'CHECKOUT', title: 'Completa ordine' },
      ]
    );
  }

  /**
   * Mostra carrello
   */
  private async showCart(conversation: any): Promise<void> {
    const phoneNumber = conversation.phoneNumber;
    const context = conversation.context as ConversationContext;
    const items = context.items || [];

    if (items.length === 0) {
      await this.sendTextMessage(phoneNumber, 'Il carrello è vuoto.');
      await this.sendMainMenu(phoneNumber);
      await this.updateContext(conversation.id, { step: 'MAIN_MENU' });
      return;
    }

    let total = 0;
    let cartText = '🛒 *Il tuo carrello:*\n\n';

    items.forEach((item, index) => {
      const subtotal = item.quantity * item.price;
      total += subtotal;
      cartText += `${index + 1}. ${item.name}\n   ${item.quantity} x €${item.price.toFixed(2)} = €${subtotal.toFixed(2)}\n\n`;
    });

    cartText += `\n*TOTALE: €${total.toFixed(2)}*`;

    await this.sendTextMessage(phoneNumber, cartText);
    await this.updateContext(conversation.id, { ...context, step: 'VIEWING_CART' });

    await this.sendButtonMessage(
      phoneNumber,
      'Cosa vuoi fare?',
      [
        { id: 'ADD_MORE', title: 'Aggiungi altro' },
        { id: 'CLEAR_CART', title: 'Svuota carrello' },
        { id: 'CHECKOUT', title: 'Conferma ordine' },
      ]
    );
  }

  /**
   * Gestisce azioni carrello
   */
  private async handleCartAction(conversation: any, action: string): Promise<void> {
    const phoneNumber = conversation.phoneNumber;

    switch (action.toUpperCase()) {
      case 'ADD_MORE':
        await this.showCatalog(conversation);
        break;

      case 'CLEAR_CART':
        await this.updateContext(conversation.id, { step: 'MAIN_MENU', items: [] });
        await this.sendTextMessage(phoneNumber, 'Carrello svuotato.');
        await this.sendMainMenu(phoneNumber);
        break;

      case 'CHECKOUT':
      case 'VIEW_CART':
        await this.initiateCheckout(conversation);
        break;

      default:
        await this.showCart(conversation);
    }
  }

  /**
   * Inizia processo checkout
   */
  private async initiateCheckout(conversation: any): Promise<void> {
    const phoneNumber = conversation.phoneNumber;
    const context = conversation.context as ConversationContext;
    const items = context.items || [];

    if (items.length === 0) {
      await this.sendTextMessage(phoneNumber, 'Il carrello è vuoto.');
      await this.sendMainMenu(phoneNumber);
      return;
    }

    const customer = await prisma.customer.findUnique({
      where: { id: conversation.customerId },
    });

    if (!customer) {
      await this.sendTextMessage(phoneNumber, 'Errore: cliente non trovato.');
      return;
    }

    // Calcola totale
    let subtotal = 0;
    items.forEach(item => {
      subtotal += item.quantity * item.price;
    });
    const vat = subtotal * 0.22;
    const total = subtotal + vat;

    const orderSummary = `📋 *RIEPILOGO ORDINE*

${items.map((item, i) => `${i + 1}. ${item.name} x${item.quantity} - €${(item.quantity * item.price).toFixed(2)}`).join('\n')}

━━━━━━━━━━━━━━━
Subtotale: €${subtotal.toFixed(2)}
IVA (22%): €${vat.toFixed(2)}
*TOTALE: €${total.toFixed(2)}*

📍 Consegna: ${customer.address || 'Da definire'}`;

    await this.sendTextMessage(phoneNumber, orderSummary);

    await this.updateContext(conversation.id, { ...context, step: 'CONFIRMING_ORDER' });

    await this.sendButtonMessage(
      phoneNumber,
      'Confermi l\'ordine?',
      [
        { id: 'CONFIRM_ORDER', title: '✅ Conferma' },
        { id: 'MODIFY_ORDER', title: '✏️ Modifica' },
        { id: 'CANCEL_ORDER', title: '❌ Annulla' },
      ]
    );
  }

  /**
   * Gestisce conferma ordine
   */
  private async handleOrderConfirmation(conversation: any, action: string): Promise<void> {
    const phoneNumber = conversation.phoneNumber;
    const context = conversation.context as ConversationContext;

    switch (action.toUpperCase()) {
      case 'CONFIRM_ORDER':
        await this.createOrderFromConversation(conversation);
        break;

      case 'MODIFY_ORDER':
        await this.showCart(conversation);
        break;

      case 'CANCEL_ORDER':
        await this.updateContext(conversation.id, { step: 'MAIN_MENU', items: [] });
        await this.sendTextMessage(phoneNumber, 'Ordine annullato.');
        await this.sendMainMenu(phoneNumber);
        break;

      default:
        await this.sendButtonMessage(
          phoneNumber,
          'Confermi l\'ordine?',
          [
            { id: 'CONFIRM_ORDER', title: '✅ Conferma' },
            { id: 'MODIFY_ORDER', title: '✏️ Modifica' },
            { id: 'CANCEL_ORDER', title: '❌ Annulla' },
          ]
        );
    }
  }

  /**
   * Crea ordine dal carrello
   */
  private async createOrderFromConversation(conversation: any): Promise<void> {
    const phoneNumber = conversation.phoneNumber;
    const context = conversation.context as ConversationContext;
    const items = context.items || [];

    const customer = await prisma.customer.findUnique({
      where: { id: conversation.customerId },
    });

    if (!customer) {
      await this.sendTextMessage(phoneNumber, 'Errore: cliente non trovato.');
      return;
    }

    // Calcola totali
    let subtotal = 0;
    const orderItems = items.map(item => {
      const itemTotal = item.quantity * item.price;
      subtotal += itemTotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price,
        vatRate: 22,
        discount: 0,
        total: itemTotal,
      };
    });

    const vatAmount = subtotal * 0.22;
    const total = subtotal + vatAmount;

    // Genera numero ordine
    const orderCount = await prisma.order.count();
    const orderNumber = `ORD-${new Date().getFullYear()}${String(orderCount + 1).padStart(6, '0')}`;

    // Crea ordine
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        status: 'PENDING',
        source: 'WHATSAPP',
        deliveryAddress: customer.address || '',
        deliveryCity: customer.city || '',
        deliveryProvince: customer.province || '',
        deliveryPostalCode: customer.postalCode || '',
        subtotal,
        vatAmount,
        total,
        paymentStatus: 'PENDING',
        items: {
          create: orderItems,
        },
      },
      include: { items: { include: { product: true } } },
    });

    // Crea link pagamento Stripe
    const paymentLink = await stripeService.createPaymentLink(
      order.id,
      Number(order.total),
      customer.id
    );

    await this.sendTextMessage(
      phoneNumber,
      `✅ *ORDINE CONFERMATO!*

Numero ordine: ${order.orderNumber}
Totale: €${total.toFixed(2)}

Per completare l'ordine, effettua il pagamento cliccando qui:
${paymentLink}

Riceverai una conferma appena il pagamento sarà verificato.

Grazie per il tuo ordine! 🍷`
    );

    // Resetta contesto
    await this.updateContext(conversation.id, {
      step: 'MAIN_MENU',
      items: [],
      orderId: order.id,
    });

    logger.info(`Ordine ${order.orderNumber} creato da WhatsApp per cliente ${customer.id}`);
  }

  /**
   * Invia listino prezzi PDF
   */
  private async sendPriceList(conversation: any): Promise<void> {
    const phoneNumber = conversation.phoneNumber;

    // In produzione, genera PDF con listino
    // Per ora invia lista testuale
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

    await this.sendTextMessage(phoneNumber, listText);
    await this.sendMainMenu(phoneNumber);
    await this.updateContext(conversation.id, { ...conversation.context, step: 'MAIN_MENU' });
  }

  /**
   * Mostra stato ordini
   */
  private async showOrderStatus(conversation: any): Promise<void> {
    const phoneNumber = conversation.phoneNumber;

    const orders = await prisma.order.findMany({
      where: { customerId: conversation.customerId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (orders.length === 0) {
      await this.sendTextMessage(phoneNumber, 'Non hai ordini recenti.');
      await this.sendMainMenu(phoneNumber);
      return;
    }

    const statusEmoji: Record<string, string> = {
      PENDING: '⏳',
      CONFIRMED: '✅',
      PROCESSING: '📦',
      READY: '🎁',
      OUT_FOR_DELIVERY: '🚚',
      DELIVERED: '✔️',
      CANCELLED: '❌',
    };

    let statusText = '📦 *I TUOI ORDINI*\n\n';
    orders.forEach(order => {
      const emoji = statusEmoji[order.status] || '📋';
      statusText += `${emoji} ${order.orderNumber}\n`;
      statusText += `   Data: ${order.createdAt.toLocaleDateString('it-IT')}\n`;
      statusText += `   Stato: ${order.status}\n`;
      statusText += `   Totale: €${order.total}\n\n`;
    });

    await this.sendTextMessage(phoneNumber, statusText);
    await this.sendMainMenu(phoneNumber);
    await this.updateContext(conversation.id, { ...conversation.context, step: 'MAIN_MENU' });
  }

  /**
   * Aggiorna contesto conversazione
   */
  private async updateContext(conversationId: string, context: ConversationContext): Promise<void> {
    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { context: context as any },
    });
  }

  /**
   * Invia notifica conferma ordine
   */
  async sendOrderConfirmation(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order || !order.customer.phone) return;

    await this.sendTextMessage(
      order.customer.phone,
      `✅ Il tuo ordine ${order.orderNumber} è stato confermato!

Stiamo preparando la tua consegna.
Ti avviseremo quando sarà in arrivo.`
    );
  }

  /**
   * Invia notifica ordine in consegna
   */
  async sendDeliveryNotification(orderId: string, driverName: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order || !order.customer.phone) return;

    await this.sendTextMessage(
      order.customer.phone,
      `🚚 Il tuo ordine ${order.orderNumber} è in consegna!

Autista: ${driverName}
Indirizzo: ${order.deliveryAddress}

A breve sarai contattato per la consegna.`
    );
  }

  /**
   * Invia ricevuta/fattura
   */
  async sendInvoice(invoiceId: string): Promise<void> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        order: true,
      },
    });

    if (!invoice || !invoice.customer.phone) return;

    if (invoice.pdfUrl) {
      await this.sendDocument(
        invoice.customer.phone,
        invoice.pdfUrl,
        `Fattura_${invoice.invoiceNumber}.pdf`,
        `Fattura n. ${invoice.invoiceNumber} - €${invoice.total}`
      );
    } else {
      await this.sendTextMessage(
        invoice.customer.phone,
        `📄 *FATTURA ${invoice.invoiceNumber}*

Ordine: ${invoice.order.orderNumber}
Totale: €${invoice.total}

La fattura è stata inviata anche via email.`
      );
    }
  }
}

export const whatsappService = new WhatsAppService();
export default whatsappService;
