# Setup su Replit - Guida Passo Passo

## 1. Carica il progetto
1. Vai su [replit.com](https://replit.com)
2. Clicca "Create Repl"
3. Scegli "Import from GitHub" oppure "Upload folder"
4. Carica lo zip o connetti il repository

## 2. Configura le variabili d'ambiente
Nel pannello "Secrets" (icona lucchetto) di Replit, aggiungi:

```
DATABASE_URL = file:./dev.db
JWT_SECRET = cambia-questa-chiave-segreta-123
PORT = 3000
NODE_ENV = development
```

## 3. Installa le dipendenze
Apri la Shell di Replit e esegui:
```bash
npm install
```

## 4. Setup Database (SQLite per test)
```bash
cd packages/backend
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

## 5. Avvia il Backend
```bash
npm run backend:dev
```

## 6. Avvia il Frontend (in un altro terminale)
```bash
npm run web:dev
```

## 7. Accedi all'app
- Backend API: `https://tuo-repl.replit.dev` (porta 3000)
- Frontend: `https://tuo-repl.replit.dev:3000` (porta 5173)

## Credenziali Demo
- **Email:** admin@beverage.local
- **Password:** admin123

## Note Importanti
- Per WhatsApp e Stripe servono account reali (vedi README.md)
- SQLite è solo per test, in produzione usa PostgreSQL
- Per l'app mobile, usa Expo Go sul telefono

## Problemi Comuni

### "Cannot find module"
```bash
npm install
```

### "Database error"
```bash
cd packages/backend
npx prisma db push --force-reset
npx tsx prisma/seed.ts
```

### Porta già in uso
Cambia PORT nelle variabili d'ambiente
