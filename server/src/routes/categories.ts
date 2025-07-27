import express, { Request, Response } from 'express';
import Category from '../models/Category';

const router = express.Router();

// Get all categories
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.find({ isActive: true })
      .populate('parent', 'name slug')
      .sort({ level: 1, sortOrder: 1, name: 1 });

    res.json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error: any) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
});

// Get single category
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('parent', 'name slug');
    
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found'
      });
      return;
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error: any) {
    console.error('Get category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: error.message
    });
  }
});

// Create new category
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, parent, image, sortOrder } = req.body;

    // Calculate level based on parent
    let level = 0;
    if (parent) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        res.status(400).json({
          success: false,
          message: 'Parent category not found'
        });
        return;
      }
      level = parentCategory.level + 1;
    }

    const category = new Category({
      name,
      description,
      parent: parent || null,
      level,
      image,
      sortOrder: sortOrder || 0
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error: any) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating category',
      error: error.message
    });
  }
});

// Update category
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, parent, image, sortOrder, isActive } = req.body;

    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found'
      });
      return;
    }

    // Update fields
    category.name = name || category.name;
    category.description = description || category.description;
    category.image = image || category.image;
    category.sortOrder = sortOrder !== undefined ? sortOrder : category.sortOrder;
    category.isActive = isActive !== undefined ? isActive : category.isActive;

    // Handle parent change
    if (parent !== undefined) {
      if (parent) {
        const parentCategory = await Category.findById(parent);
        if (!parentCategory) {
          res.status(400).json({
            success: false,
            message: 'Parent category not found'
          });
          return;
        }
        category.parent = parent;
        category.level = parentCategory.level + 1;
      } else {
        category.parent = null;
        category.level = 0;
      }
    }

    await category.save();

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error: any) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating category',
      error: error.message
    });
  }
});

// Delete category
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found'
      });
      return;
    }

    // Check if category has subcategories
    const subcategories = await Category.find({ parent: req.params.id });
    if (subcategories.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete category with subcategories'
      });
      return;
    }

    await Category.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting category',
      error: error.message
    });
  }
});

export default router;