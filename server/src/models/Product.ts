import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  sku: string;
  category: mongoose.Types.ObjectId;
  brand: string;
  images: string[];
  price: {
    regular: number;
    sale?: number;
    currency: string;
  };
  inventory: {
    quantity: number;
    lowStockThreshold: number;
    trackQuantity: boolean;
  };
  specifications: Array<{
    name: string;
    value: string;
  }>;
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  analytics: {
    views: number;
    purchases: number;
    revenue: number;
  };
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters'],
    index: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [500, 'Short description cannot exceed 500 characters']
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
    index: true
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true,
    maxlength: [100, 'Brand name cannot exceed 100 characters'],
    index: true
  },
  images: [{
    type: String,
    required: true
  }],
  price: {
    regular: {
      type: Number,
      required: [true, 'Regular price is required'],
      min: [0, 'Price cannot be negative']
    },
    sale: {
      type: Number,
      min: [0, 'Sale price cannot be negative'],
      validate: {
        validator: function(this: IProduct, value: number) {
          return !value || value < this.price.regular;
        },
        message: 'Sale price must be less than regular price'
      }
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'INR']
    }
  },
  inventory: {
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
      default: 0
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: [0, 'Low stock threshold cannot be negative']
    },
    trackQuantity: {
      type: Boolean,
      default: true
    }
  },
  specifications: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: String,
      required: true,
      trim: true
    }
  }],
  seo: {
    title: {
      type: String,
      maxlength: [60, 'SEO title cannot exceed 60 characters']
    },
    description: {
      type: String,
      maxlength: [160, 'SEO description cannot exceed 160 characters']
    },
    keywords: [{
      type: String,
      trim: true
    }]
  },
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    purchases: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    }
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    index: true
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});

// Pre-save middleware to generate slug from name if not provided
productSchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  next();
});

// Pre-save middleware to auto-generate SEO fields if not provided
productSchema.pre('save', function(next) {
  if (!this.seo.title) {
    this.seo.title = this.name.substring(0, 60);
  }
  if (!this.seo.description) {
    this.seo.description = this.shortDescription?.substring(0, 160) || this.description.substring(0, 160);
  }
  next();
});

// Index for search functionality
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ 'price.regular': 1 });
productSchema.index({ brand: 1, category: 1 });
productSchema.index({ createdAt: -1 });

export default mongoose.model<IProduct>('Product', productSchema);