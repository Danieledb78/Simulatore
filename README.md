# Beverage Warehouse App

Sistema completo per la gestione di un magazzino di bevande con integrazione WhatsApp, pagamenti Stripe e gestione consegne.

## Funzionalità

### 📦 Gestione Magazzino
- Scansione codici a barre (EAN/UPC) per carico merce
- Tracciamento inventario in tempo reale
- Alert automatici per scorte basse
- Storico movimenti magazzino

### 🛒 Gestione Ordini
- Ordini da landing page web
- Ordini tramite WhatsApp con chatbot interattivo
- Riepilogo e conferma ordine automatica
- Verifica disponibilità prodotti in tempo reale

### 💳 Pagamenti Integrati (Stripe)
- Link di pagamento via WhatsApp/Email
- Fatturazione automatica
- Gestione rimborsi
- Ricevute digitali

### 🚚 Gestione Consegne
- 5 zone di consegna configurabili (espandibile)
- Assegnazione automatica driver per zona
- App mobile dedicata per driver
- Tracking consegne in tempo reale

### 📱 WhatsApp Business
- Chatbot per ordini automatizzati
- Invio listino prezzi
- Notifiche stato ordine
- Invio fatture/ricevute

## Architettura

```
beverage-warehouse-app/
├── packages/
│   ├── backend/          # API Node.js/Express + TypeScript
│   │   ├── prisma/       # Schema database PostgreSQL
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── controllers/
│   │   │   ├── middlewares/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── utils/
│   │   └── package.json
│   │
│   ├── web/              # Dashboard React + Vite
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── services/
│   │   │   ├── store/
│   │   │   └── styles/
│   │   └── package.json
│   │
│   └── mobile/           # App React Native (Expo)
│       ├── src/
│       │   ├── screens/
│       │   ├── services/
│       │   └── store/
│       └── package.json
│
└── package.json          # Monorepo root
```

## Requisiti

- Node.js >= 18
- PostgreSQL >= 14
- npm >= 9

## Installazione

### 1. Clona il repository
```bash
git clone <repository-url>
cd beverage-warehouse-app
```

### 2. Installa le dipendenze
```bash
npm install
```

### 3. Configura le variabili d'ambiente

Copia il file di esempio e configura le variabili:
```bash
cp packages/backend/.env.example packages/backend/.env
```

Configura:
- `DATABASE_URL` - Connessione PostgreSQL
- `JWT_SECRET` - Chiave segreta per JWT
- `STRIPE_SECRET_KEY` - Chiave API Stripe
- `WHATSAPP_*` - Credenziali WhatsApp Business API
- `SMTP_*` - Configurazione email

### 4. Setup Database
```bash
# Genera client Prisma
npm run generate --workspace=@beverage-app/backend

# Esegui migrazioni
npm run db:migrate

# Popola dati demo (opzionale)
npm run db:seed
```

### 5. Avvia l'applicazione

```bash
# Backend (porta 3000)
npm run backend:dev

# Web Dashboard (porta 5173)
npm run web:dev

# Mobile App
npm run mobile:start
```

## Credenziali Demo

Dopo aver eseguito il seed:

**Admin:**
- Email: `admin@beverage.local`
- Password: `admin123`

**Driver:**
- Email: `driver1@beverage.local` (fino a driver5)
- Password: `driver123`

## API Endpoints

### Autenticazione
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Utente corrente
- `PUT /api/auth/change-password` - Cambia password

### Prodotti
- `GET /api/products` - Lista prodotti
- `GET /api/products/barcode/:barcode` - Cerca per barcode
- `POST /api/products` - Crea prodotto
- `PUT /api/products/:id` - Modifica prodotto

### Inventario
- `GET /api/inventory` - Stato inventario
- `GET /api/inventory/low-stock` - Prodotti sotto soglia
- `POST /api/inventory/load` - Carica merce
- `POST /api/inventory/adjust` - Rettifica

### Ordini
- `GET /api/orders` - Lista ordini
- `POST /api/orders` - Crea ordine
- `PUT /api/orders/:id/status` - Aggiorna stato
- `POST /api/orders/:id/assign-driver` - Assegna driver

### Clienti
- `GET /api/customers` - Lista clienti
- `POST /api/customers` - Crea cliente
- `GET /api/customers/:id/orders` - Ordini cliente

### Driver & Zone
- `GET /api/drivers` - Lista driver
- `GET /api/zones` - Liste zone
- `PUT /api/drivers/:id/availability` - Disponibilità

### Pagamenti
- `POST /api/payments/create-payment-link` - Crea link pagamento
- `POST /api/payments/webhook` - Webhook Stripe

### WhatsApp
- `GET /api/whatsapp/webhook` - Verifica Meta
- `POST /api/whatsapp/webhook` - Ricevi messaggi

## Integrazioni

### Stripe
1. Crea account su [Stripe Dashboard](https://dashboard.stripe.com)
2. Ottieni API keys (Test e Live)
3. Configura webhook endpoint: `https://tuodominio.com/api/payments/webhook`
4. Aggiungi eventi: `payment_intent.succeeded`, `checkout.session.completed`

### WhatsApp Business API
1. Crea account [Meta Business](https://business.facebook.com)
2. Configura WhatsApp Business API
3. Ottieni Phone Number ID e Access Token
4. Configura webhook: `https://tuodominio.com/api/whatsapp/webhook`
5. Crea template messages per notifiche

### Fatturazione Elettronica (Opzionale)
Il sistema supporta l'invio di fatture elettroniche via SDI configurando le credenziali nel file `.env`.

## Personalizzazione

### Aggiungere Zone
1. Accedi alla dashboard web
2. Vai su Zone > Nuova Zona
3. Inserisci nome, CAP coperti e costo consegna

### Aggiungere Driver
1. Vai su Driver > Nuovo Driver
2. Inserisci dati e assegna zona
3. Il driver riceverà credenziali via email

### Listini Prezzi
1. Vai su Impostazioni > Listini Prezzi
2. Crea nuovo listino con sconti specifici
3. Assegna listino ai clienti desiderati

## Supporto

Per problemi o richieste:
- Apri una issue su GitHub
- Contatta: support@beveragewarehouse.it

## Licenza

MIT License - Vedi file LICENSE per dettagli.
