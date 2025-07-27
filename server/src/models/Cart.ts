import mongoose, { Document, Schema } from 'mongoose';

export interface ICartItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
  total: number;
}

export interface ICart extends Document {
  sessionId?: string;
  user?: mongoose.Types.ObjectId;
  items: ICartItem[];
  totals: {
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
  };
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    default: 1
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  total: {
    type: Number,
    required: true,
    min: [0, 'Total cannot be negative']
  }
}, { _id: false });

const cartSchema = new Schema<ICart>({
  sessionId: {
    type: String,
    index: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  items: [cartItemSchema],
  totals: {
    subtotal: {
      type: Number,
      default: 0,
      min: [0, 'Subtotal cannot be negative']
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative']
    },
    shipping: {
      type: Number,
      default: 0,
      min: [0, 'Shipping cannot be negative']
    },
    total: {
      type: Number,
      default: 0,
      min: [0, 'Total cannot be negative']
    }
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    index: { expireAfterSeconds: 0 }
  }
}, {
  timestamps: true
});

// Index for efficient queries
cartSchema.index({ sessionId: 1, user: 1 });

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  // Calculate subtotal
  this.totals.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  
  // Calculate tax (10% for simplicity)
  this.totals.tax = Math.round(this.totals.subtotal * 0.1 * 100) / 100;
  
  // Calculate shipping (free shipping over $100, otherwise $10)
  this.totals.shipping = this.totals.subtotal >= 100 ? 0 : 10;
  
  // Calculate total
  this.totals.total = this.totals.subtotal + this.totals.tax + this.totals.shipping;
  
  next();
});

export default mongoose.model<ICart>('Cart', cartSchema);