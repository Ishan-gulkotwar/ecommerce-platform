import express, { Request, Response } from 'express';
import Product from '../models/Product';
import Category from '../models/Category';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// IMPORTANT: Specific routes MUST come before parameterized routes
// Get featured products - must be BEFORE /:id route
router.get('/featured/list', async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await Product.find({ 
      isActive: true, 
      isFeatured: true 
    })
    .populate('category', 'name slug')
    .sort({ createdAt: -1 })
    .limit(10);

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error: any) {
    console.error('Get featured products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching featured products',
      error: error.message
    });
  }
});

// Get all products with filtering, sorting, and pagination
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      brand,
      minPrice,
      maxPrice,
      search,
      featured,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter: any = { isActive: true };

    if (category) filter.category = category;
    if (brand) filter.brand = new RegExp(brand as string, 'i');
    if (featured !== undefined) filter.isFeatured = featured === 'true';

    // Price range filter
    if (minPrice || maxPrice) {
      filter['price.regular'] = {};
      if (minPrice) filter['price.regular'].$gte = Number(minPrice);
      if (maxPrice) filter['price.regular'].$lte = Number(maxPrice);
    }

    // Text search
    if (search) {
      filter.$text = { $search: search as string };
    }

    // Build sort object
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get products
    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      count: products.length,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: products
    });
  } catch (error: any) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

// Get single product - MUST come after specific routes
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug description');

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    // Increment view count
    product.analytics.views += 1;
    await product.save();

    res.json({
      success: true,
      data: product
    });
  } catch (error: any) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
});

// Create new product
router.post('/', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      shortDescription,
      sku,
      category,
      brand,
      images,
      price,
      inventory,
      specifications,
      tags,
      isFeatured
    } = req.body;

    // Verify category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      res.status(400).json({
        success: false,
        message: 'Category not found'
      });
      return;
    }

    // Check if SKU already exists
    const existingSKU = await Product.findOne({ sku });
    if (existingSKU) {
      res.status(400).json({
        success: false,
        message: 'Product with this SKU already exists'
      });
      return;
    }

    const product = new Product({
      name,
      description,
      shortDescription,
      sku,
      category,
      brand,
      images,
      price,
      inventory,
      specifications,
      tags,
      isFeatured: isFeatured || false
    });

    await product.save();

    // Populate category before sending response
    await product.populate('category', 'name slug');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error: any) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
});

// Update product
router.put('/:id', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    const {
      name,
      description,
      shortDescription,
      sku,
      category,
      brand,
      images,
      price,
      inventory,
      specifications,
      tags,
      isFeatured,
      isActive
    } = req.body;

    // Verify category exists if being updated
    if (category && category !== product.category.toString()) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        res.status(400).json({
          success: false,
          message: 'Category not found'
        });
        return;
      }
    }

    // Check SKU uniqueness if being updated
    if (sku && sku !== product.sku) {
      const existingSKU = await Product.findOne({ sku });
      if (existingSKU) {
        res.status(400).json({
          success: false,
          message: 'Product with this SKU already exists'
        });
        return;
      }
    }

    // Update fields
    product.name = name || product.name;
    product.description = description || product.description;
    product.shortDescription = shortDescription || product.shortDescription;
    product.sku = sku || product.sku;
    product.category = category || product.category;
    product.brand = brand || product.brand;
    product.images = images || product.images;
    product.price = price || product.price;
    product.inventory = inventory || product.inventory;
    product.specifications = specifications || product.specifications;
    product.tags = tags || product.tags;
    product.isFeatured = isFeatured !== undefined ? isFeatured : product.isFeatured;
    product.isActive = isActive !== undefined ? isActive : product.isActive;

    await product.save();
    await product.populate('category', 'name slug');

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error: any) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
});

// Delete product
router.delete('/:id', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
});

export default router;