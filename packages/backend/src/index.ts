import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { rateLimiter } from './middlewares/rateLimiter.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import customerRoutes from './routes/customer.routes.js';
import orderRoutes from './routes/order.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import driverRoutes from './routes/driver.routes.js';
import zoneRoutes from './routes/zone.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import settingsRoutes from './routes/settings.routes.js';

const app = express();
const httpServer = createServer(app);

// Socket.IO per real-time updates
const io = new SocketServer(httpServer, {
  cors: {
    origin: [config.webAppUrl, 'http://localhost:5173', 'http://localhost:19006'],
    methods: ['GET', 'POST'],
  },
});

// Middleware globali
app.use(helmet());
app.use(cors({
  origin: [config.webAppUrl, 'http://localhost:5173', 'http://localhost:19006'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// Static files per uploads
app.use('/uploads', express.static(config.uploadDir));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);

// Socket.IO events
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join:admin', () => {
    socket.join('admin');
    logger.info(`Socket ${socket.id} joined admin room`);
  });

  socket.on('join:driver', (driverId: string) => {
    socket.join(`driver:${driverId}`);
    logger.info(`Socket ${socket.id} joined driver:${driverId} room`);
  });

  socket.on('driver:location', (data: { driverId: string; lat: number; lng: number }) => {
    io.to('admin').emit('driver:location:update', data);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Export io per usarlo nei services
export { io };

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
httpServer.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
});

export default app;
