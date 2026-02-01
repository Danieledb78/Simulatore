import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Crea Super Admin
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@beverage.local' },
    update: {},
    create: {
      email: 'admin@beverage.local',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'Sistema',
      role: 'SUPER_ADMIN',
    },
  });
  console.log('Created admin:', admin.email);

  // Crea Zone
  const zones = await Promise.all([
    prisma.zone.upsert({
      where: { name: 'Zona Nord' },
      update: {},
      create: {
        name: 'Zona Nord',
        description: 'Area nord della città',
        postalCodes: ['00100', '00101', '00102'],
        cities: ['Roma Nord'],
        deliveryFee: 5.00,
      },
    }),
    prisma.zone.upsert({
      where: { name: 'Zona Sud' },
      update: {},
      create: {
        name: 'Zona Sud',
        description: 'Area sud della città',
        postalCodes: ['00200', '00201', '00202'],
        cities: ['Roma Sud'],
        deliveryFee: 5.00,
      },
    }),
    prisma.zone.upsert({
      where: { name: 'Zona Centro' },
      update: {},
      create: {
        name: 'Zona Centro',
        description: 'Centro storico',
        postalCodes: ['00185', '00186', '00187'],
        cities: ['Roma Centro'],
        deliveryFee: 3.00,
      },
    }),
    prisma.zone.upsert({
      where: { name: 'Zona Est' },
      update: {},
      create: {
        name: 'Zona Est',
        description: 'Area est della città',
        postalCodes: ['00300', '00301'],
        cities: ['Roma Est'],
        deliveryFee: 6.00,
      },
    }),
    prisma.zone.upsert({
      where: { name: 'Zona Ovest' },
      update: {},
      create: {
        name: 'Zona Ovest',
        description: 'Area ovest della città',
        postalCodes: ['00400', '00401'],
        cities: ['Roma Ovest'],
        deliveryFee: 6.00,
      },
    }),
  ]);
  console.log('Created zones:', zones.length);

  // Crea Driver
  const driverPassword = await bcrypt.hash('driver123', 12);
  for (let i = 1; i <= 5; i++) {
    const driverUser = await prisma.user.upsert({
      where: { email: `driver${i}@beverage.local` },
      update: {},
      create: {
        email: `driver${i}@beverage.local`,
        password: driverPassword,
        firstName: `Driver`,
        lastName: `${i}`,
        phone: `+3933300000${i}`,
        role: 'DRIVER',
      },
    });

    await prisma.driver.upsert({
      where: { userId: driverUser.id },
      update: {},
      create: {
        userId: driverUser.id,
        zoneId: zones[i - 1].id,
        vehicleType: 'Furgone',
        vehiclePlate: `AA${i}00BB`,
        isAvailable: true,
      },
    });
  }
  console.log('Created 5 drivers');

  // Crea Categorie
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Acqua' },
      update: {},
      create: { name: 'Acqua', description: 'Acqua minerale naturale e frizzante' },
    }),
    prisma.category.upsert({
      where: { name: 'Birra' },
      update: {},
      create: { name: 'Birra', description: 'Birre nazionali e internazionali' },
    }),
    prisma.category.upsert({
      where: { name: 'Vino' },
      update: {},
      create: { name: 'Vino', description: 'Vini rossi, bianchi e rosati' },
    }),
    prisma.category.upsert({
      where: { name: 'Soft Drink' },
      update: {},
      create: { name: 'Soft Drink', description: 'Bevande analcoliche' },
    }),
    prisma.category.upsert({
      where: { name: 'Succhi' },
      update: {},
      create: { name: 'Succhi', description: 'Succhi di frutta' },
    }),
    prisma.category.upsert({
      where: { name: 'Spirits' },
      update: {},
      create: { name: 'Spirits', description: 'Liquori e superalcolici' },
    }),
  ]);
  console.log('Created categories:', categories.length);

  // Crea Prodotti
  const products = [
    // Acqua
    { barcode: '8001234567890', name: 'Acqua Naturale 1L', categoryName: 'Acqua', unitSize: '1L', purchasePrice: 0.20, sellingPrice: 0.50, minStockLevel: 100 },
    { barcode: '8001234567891', name: 'Acqua Frizzante 1L', categoryName: 'Acqua', unitSize: '1L', purchasePrice: 0.22, sellingPrice: 0.55, minStockLevel: 100 },
    { barcode: '8001234567892', name: 'Acqua Naturale 500ml', categoryName: 'Acqua', unitSize: '500ml', purchasePrice: 0.15, sellingPrice: 0.40, minStockLevel: 200 },
    { barcode: '8001234567893', name: 'Acqua Naturale Cassa 6x1.5L', categoryName: 'Acqua', unitSize: '6x1.5L', unit: 'CASE', purchasePrice: 2.00, sellingPrice: 4.50, minStockLevel: 50 },

    // Birra
    { barcode: '8002234567890', name: 'Peroni 66cl', categoryName: 'Birra', unitSize: '66cl', purchasePrice: 0.80, sellingPrice: 1.80, minStockLevel: 50 },
    { barcode: '8002234567891', name: 'Moretti 33cl', categoryName: 'Birra', unitSize: '33cl', purchasePrice: 0.50, sellingPrice: 1.20, minStockLevel: 100 },
    { barcode: '8002234567892', name: 'Heineken 33cl', categoryName: 'Birra', unitSize: '33cl', purchasePrice: 0.60, sellingPrice: 1.50, minStockLevel: 80 },
    { barcode: '8002234567893', name: 'Corona 33cl', categoryName: 'Birra', unitSize: '33cl', purchasePrice: 0.70, sellingPrice: 1.80, minStockLevel: 60 },
    { barcode: '8002234567894', name: 'Peroni Cassa 24x33cl', categoryName: 'Birra', unitSize: '24x33cl', unit: 'CASE', purchasePrice: 12.00, sellingPrice: 22.00, minStockLevel: 20 },

    // Vino
    { barcode: '8003234567890', name: 'Chianti DOCG 750ml', categoryName: 'Vino', unitSize: '750ml', purchasePrice: 4.00, sellingPrice: 8.50, minStockLevel: 30 },
    { barcode: '8003234567891', name: 'Prosecco DOC 750ml', categoryName: 'Vino', unitSize: '750ml', purchasePrice: 5.00, sellingPrice: 10.00, minStockLevel: 30 },
    { barcode: '8003234567892', name: 'Montepulciano 750ml', categoryName: 'Vino', unitSize: '750ml', purchasePrice: 3.50, sellingPrice: 7.00, minStockLevel: 40 },
    { barcode: '8003234567893', name: 'Pinot Grigio 750ml', categoryName: 'Vino', unitSize: '750ml', purchasePrice: 4.50, sellingPrice: 9.00, minStockLevel: 30 },

    // Soft Drink
    { barcode: '8004234567890', name: 'Coca-Cola 1L', categoryName: 'Soft Drink', unitSize: '1L', purchasePrice: 0.80, sellingPrice: 1.80, minStockLevel: 80 },
    { barcode: '8004234567891', name: 'Coca-Cola 33cl', categoryName: 'Soft Drink', unitSize: '33cl', purchasePrice: 0.40, sellingPrice: 1.00, minStockLevel: 150 },
    { barcode: '8004234567892', name: 'Fanta 1L', categoryName: 'Soft Drink', unitSize: '1L', purchasePrice: 0.75, sellingPrice: 1.70, minStockLevel: 60 },
    { barcode: '8004234567893', name: 'Sprite 1L', categoryName: 'Soft Drink', unitSize: '1L', purchasePrice: 0.75, sellingPrice: 1.70, minStockLevel: 60 },
    { barcode: '8004234567894', name: 'Coca-Cola Cassa 24x33cl', categoryName: 'Soft Drink', unitSize: '24x33cl', unit: 'CASE', purchasePrice: 10.00, sellingPrice: 18.00, minStockLevel: 25 },

    // Succhi
    { barcode: '8005234567890', name: 'Succo ACE 1L', categoryName: 'Succhi', unitSize: '1L', purchasePrice: 1.00, sellingPrice: 2.20, minStockLevel: 40 },
    { barcode: '8005234567891', name: 'Succo Arancia 1L', categoryName: 'Succhi', unitSize: '1L', purchasePrice: 0.90, sellingPrice: 2.00, minStockLevel: 40 },
    { barcode: '8005234567892', name: 'Succo Pesca 1L', categoryName: 'Succhi', unitSize: '1L', purchasePrice: 0.90, sellingPrice: 2.00, minStockLevel: 40 },

    // Spirits
    { barcode: '8006234567890', name: 'Aperol 1L', categoryName: 'Spirits', unitSize: '1L', purchasePrice: 10.00, sellingPrice: 16.00, minStockLevel: 15 },
    { barcode: '8006234567891', name: 'Campari 1L', categoryName: 'Spirits', unitSize: '1L', purchasePrice: 12.00, sellingPrice: 18.00, minStockLevel: 15 },
    { barcode: '8006234567892', name: 'Limoncello 700ml', categoryName: 'Spirits', unitSize: '700ml', purchasePrice: 8.00, sellingPrice: 14.00, minStockLevel: 20 },
  ];

  for (const prod of products) {
    const category = categories.find(c => c.name === prod.categoryName);
    if (!category) continue;

    const product = await prisma.product.upsert({
      where: { barcode: prod.barcode },
      update: {},
      create: {
        barcode: prod.barcode,
        name: prod.name,
        categoryId: category.id,
        unitSize: prod.unitSize,
        unit: (prod.unit as any) || 'PIECE',
        purchasePrice: prod.purchasePrice,
        sellingPrice: prod.sellingPrice,
        minStockLevel: prod.minStockLevel,
        vatRate: 22,
      },
    });

    // Crea inventory con stock iniziale random
    const initialStock = Math.floor(Math.random() * 100) + 20;
    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {},
      create: {
        productId: product.id,
        quantity: initialStock,
        availableQty: initialStock,
        reservedQty: 0,
      },
    });
  }
  console.log('Created products:', products.length);

  // Crea Listino Base
  const defaultPriceList = await prisma.priceList.upsert({
    where: { name: 'Listino Base' },
    update: {},
    create: {
      name: 'Listino Base',
      description: 'Listino prezzi standard',
      isDefault: true,
    },
  });

  const barPriceList = await prisma.priceList.upsert({
    where: { name: 'Listino Bar' },
    update: {},
    create: {
      name: 'Listino Bar',
      description: 'Listino scontato per bar e ristoranti',
      discountPct: 10,
    },
  });
  console.log('Created price lists');

  // Crea Clienti esempio
  const customers = [
    { firstName: 'Mario', lastName: 'Rossi', phone: '+393331234567', email: 'mario.rossi@email.com', type: 'PRIVATE', address: 'Via Roma 1', city: 'Roma', postalCode: '00185' },
    { firstName: 'Bar', lastName: 'Da Pino', phone: '+393332234567', email: 'bar.pino@email.com', type: 'BAR', companyName: 'Bar Da Pino', address: 'Via Nazionale 50', city: 'Roma', postalCode: '00186', vatNumber: 'IT12345678901' },
    { firstName: 'Ristorante', lastName: 'La Pergola', phone: '+393333234567', email: 'lapergola@email.com', type: 'RESTAURANT', companyName: 'Ristorante La Pergola', address: 'Via del Corso 100', city: 'Roma', postalCode: '00187', vatNumber: 'IT12345678902' },
    { firstName: 'Luigi', lastName: 'Bianchi', phone: '+393334234567', email: 'luigi.bianchi@email.com', type: 'PRIVATE', address: 'Via Appia 200', city: 'Roma', postalCode: '00200' },
    { firstName: 'Hotel', lastName: 'Splendid', phone: '+393335234567', email: 'hotel.splendid@email.com', type: 'HOTEL', companyName: 'Hotel Splendid', address: 'Piazza Navona 1', city: 'Roma', postalCode: '00186', vatNumber: 'IT12345678903' },
  ];

  for (const cust of customers) {
    await prisma.customer.upsert({
      where: { phone: cust.phone },
      update: {},
      create: {
        ...cust,
        type: cust.type as any,
        zoneId: zones[Math.floor(Math.random() * zones.length)].id,
        priceListId: cust.type === 'BAR' || cust.type === 'RESTAURANT' ? barPriceList.id : defaultPriceList.id,
      },
    });
  }
  console.log('Created customers:', customers.length);

  // Crea Fornitore esempio
  await prisma.supplier.upsert({
    where: { id: 'default-supplier' },
    update: {},
    create: {
      id: 'default-supplier',
      name: 'Fornitore Principale',
      email: 'fornitore@email.com',
      phone: '+393390000000',
      address: 'Via Industriale 1',
      city: 'Roma',
      vatNumber: 'IT99999999999',
    },
  });
  console.log('Created default supplier');

  // Impostazioni default
  const defaultSettings = [
    { key: 'company_name', value: 'Beverage Warehouse' },
    { key: 'company_address', value: 'Via del Magazzino 1, 00100 Roma' },
    { key: 'company_vat', value: 'IT00000000000' },
    { key: 'company_email', value: 'info@beveragewarehouse.it' },
    { key: 'company_phone', value: '+39 06 12345678' },
    { key: 'low_stock_threshold', value: 10 },
    { key: 'order_prefix', value: 'ORD' },
    { key: 'invoice_prefix', value: 'FT' },
    { key: 'default_vat_rate', value: 22 },
    { key: 'currency', value: 'EUR' },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: { key: setting.key, value: setting.value },
    });
  }
  console.log('Created default settings');

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
