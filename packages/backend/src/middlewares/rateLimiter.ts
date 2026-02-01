import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // Limite di 100 richieste per finestra
  message: {
    error: 'Troppe richieste, riprova più tardi',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Limite più restrittivo per auth
  message: {
    error: 'Troppi tentativi di accesso, riprova tra 15 minuti',
  },
});

export const whatsappRateLimiter = rateLimit({
  windowMs: 1000, // 1 secondo
  max: 10, // 10 richieste al secondo per WhatsApp
  message: {
    error: 'Rate limit WhatsApp superato',
  },
});

export default rateLimiter;
