import mongoose, { Document, Schema } from 'mongoose';

// Order Item Interface
interface IOrderItem {
  product: mongoose.Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

// Shipping Address Interface
interface IShippingAddress {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
}

// Order Interface
interface IOrder extends Document {
  orderNumber: string;
  user: mongoose.Types.ObjectId;
  items: IOrderItem[];
  totals: {
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
  };
  shippingAddress: IShippingAddress;
  billingAddress?: IShippingAddress;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  notes?: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  // Payment fields
  paymentIntentId?: string;
  paidAt?: Date;
  refundedAt?: Date;
  refundReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Order Item Schema
const OrderItemSchema = new Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  total: {
    type: Number,
    required: true,
    min: 0
  }
});

// Shipping Address Schema
const ShippingAddressSchema = new Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  zipCode: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    required: true,
    trim: true,
    default: 'United States'
  },
  phone: {
    type: String,
    trim: true
  }
});

// Order Schema
const OrderSchema = new Schema({
  orderNumber: {
    type: String,
    unique: true,
    trim: true
    // Removed required: true since we'll generate it in pre-save
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [OrderItemSchema],
  totals: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    tax: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    shipping: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  },
  shippingAddress: {
    type: ShippingAddressSchema,
    required: true
  },
  billingAddress: {
    type: ShippingAddressSchema,
    required: false
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['credit_card', 'debit_card', 'paypal', 'stripe', 'cash_on_delivery'],
    default: 'credit_card'
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  orderStatus: {
    type: String,
    required: true,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  trackingNumber: {
    type: String,
    trim: true
  },
  estimatedDelivery: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  // Payment fields
  paymentIntentId: {
    type: String,
    trim: true
  },
  paidAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },
  refundReason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Generate order number before saving
OrderSchema.pre('save', function(next) {
  if (this.isNew && !this.orderNumber) {
    // Simple order number generation without async database call
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.orderNumber = `ORD-${timestamp}-${random}`;
  }
  next();
});

// Calculate totals before saving
OrderSchema.pre('save', function(next) {
  // Calculate subtotal
  this.totals.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  
  // Calculate tax (10% of subtotal)
  this.totals.tax = Math.round(this.totals.subtotal * 0.10 * 100) / 100;
  
  // Calculate shipping (free for orders over $100, otherwise $10)
  this.totals.shipping = this.totals.subtotal >= 100 ? 0 : 10;
  
  // Calculate total
  this.totals.total = this.totals.subtotal + this.totals.tax + this.totals.shipping;
  
  next();
});

// Create indexes for better performance
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ paymentStatus: 1 });

export default mongoose.model<IOrder>('Order', OrderSchema);