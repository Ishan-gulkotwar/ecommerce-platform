import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import orderRoutes from './routes/orders';

// Import routes
import authRoutes from './routes/auth';
import categoryRoutes from './routes/categories';
import productRoutes from './routes/product';
import cartRoutes from './routes/cart';
import paymentRoutes from './routes/payments';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

console.log('🔧 Environment variables loaded');
console.log('📝 MongoDB URI:', process.env.MONGODB_URI);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
const connectDB = async () => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI!);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
  }
};

// Connect to database
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);

// Basic route to test our server
app.get('/', (req, res) => {
  console.log('📨 Received request to /');
  res.json({ 
    message: 'E-Commerce API is running!',
    database: mongoose.connection.readyState === 1 ? 'Connected to MongoDB' : 'MongoDB disconnected',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/profile'
      },
      categories: {
        getAll: 'GET /api/categories',
        getOne: 'GET /api/categories/:id',
        create: 'POST /api/categories',
        update: 'PUT /api/categories/:id',
        delete: 'DELETE /api/categories/:id'
      },
      products: {
        getAll: 'GET /api/products',
        getOne: 'GET /api/products/:id',
        create: 'POST /api/products',
        update: 'PUT /api/products/:id',
        delete: 'DELETE /api/products/:id',
        featured: 'GET /api/products/featured/list'
      },
      cart: {
        get: 'GET /api/cart?sessionId=xxx',
        add: 'POST /api/cart/add',
        update: 'PUT /api/cart/update',
        remove: 'DELETE /api/cart/remove',
        clear: 'DELETE /api/cart/clear',
        merge: 'POST /api/cart/merge'
      }
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Visit: http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('👋 Shutting down gracefully...');
  mongoose.connection.close();
  process.exit(0);
});