import express, { Request, Response, NextFunction } from 'express';
import Cart from '../models/Cart';
import Product from '../models/Product';
import { authenticateJWT } from '../middleware/auth';
import { verifyToken } from '../utils/jwt';

const router = express.Router();

// Optional authentication middleware
const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  next();
};

// Get cart (by user authentication or session)
router.get('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user is authenticated first
    const userId = req.user ? req.user.userId : null;
    const sessionId = req.query.sessionId || null;

    if (!userId && !sessionId) {
      res.status(400).json({
        success: false,
        message: 'Authentication or session ID required'
      });
      return;
    }

    // Find cart by userId (if logged in) or sessionId (if guest)
    const query: any = {};
    if (userId) {
      query.user = userId;
    } else {
      query.sessionId = sessionId;
    }

    const cart = await Cart.findOne(query)
      .populate('items.product', 'name slug images price brand inventory')
      .sort({ updatedAt: -1 });

    if (!cart) {
      res.json({
        success: true,
        data: {
          items: [],
          totals: { subtotal: 0, tax: 0, shipping: 0, total: 0 }
        }
      });
      return;
    }

    res.json({
      success: true,
      data: cart
    });
  } catch (error: any) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cart',
      error: error.message
    });
  }
});

// Add item to cart
router.post('/add', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity = 1, sessionId } = req.body;

    if (!productId) {
      res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
      return;
    }

    // Check if user is authenticated first
    const userId = req.user ? req.user.userId : null;
    const finalSessionId = sessionId || null;

    if (!userId && !finalSessionId) {
      res.status(400).json({
        success: false,
        message: 'Authentication or session ID required'
      });
      return;
    }

    // Get product details
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    // Check inventory
    if (product.inventory.trackQuantity && product.inventory.quantity < quantity) {
      res.status(400).json({
        success: false,
        message: 'Insufficient inventory'
      });
      return;
    }

    // Find or create cart
    const query: any = {};
    if (userId) {
      query.user = userId;
    } else {
      query.sessionId = finalSessionId;
    }

    let cart = await Cart.findOne(query);

    if (!cart) {
      cart = new Cart({
        sessionId: finalSessionId,
        user: userId || null,
        items: [],
        totals: { subtotal: 0, tax: 0, shipping: 0, total: 0 }
      });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    const itemPrice = product.price.sale || product.price.regular;

    if (existingItemIndex >= 0) {
      // Update existing item
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].total = 
        cart.items[existingItemIndex].quantity * itemPrice;
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        quantity,
        price: itemPrice,
        total: quantity * itemPrice
      });
    }

    await cart.save();

    // Populate product details for response
    await cart.populate('items.product', 'name slug images price brand inventory');

    res.status(201).json({
      success: true,
      message: 'Item added to cart successfully',
      data: cart
    });
  } catch (error: any) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding item to cart',
      error: error.message
    });
  }
});

// Update item quantity in cart
router.put('/update', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity, sessionId } = req.body;

    if (!productId || !quantity) {
      res.status(400).json({
        success: false,
        message: 'Product ID and quantity are required'
      });
      return;
    }

    if (quantity < 1) {
      res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
      return;
    }

    // Check if user is authenticated first
    const userId = req.user ? req.user.userId : null;
    const finalSessionId = sessionId || null;

    if (!userId && !finalSessionId) {
      res.status(400).json({
        success: false,
        message: 'Authentication or session ID required'
      });
      return;
    }

    // Find cart
    const query: any = {};
    if (userId) {
      query.user = userId;
    } else {
      query.sessionId = finalSessionId;
    }

    const cart = await Cart.findOne(query);
    if (!cart) {
      res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
      return;
    }

    // Find item in cart
    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
      return;
    }

    // Get product for price validation
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    // Check inventory
    if (product.inventory.trackQuantity && product.inventory.quantity < quantity) {
      res.status(400).json({
        success: false,
        message: 'Insufficient inventory'
      });
      return;
    }

    // Update item
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].total = quantity * cart.items[itemIndex].price;

    await cart.save();
    await cart.populate('items.product', 'name slug images price brand inventory');

    res.json({
      success: true,
      message: 'Cart updated successfully',
      data: cart
    });
  } catch (error: any) {
    console.error('Update cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating cart',
      error: error.message
    });
  }
});

// Remove item from cart
router.delete('/remove', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, sessionId } = req.body;

    if (!productId) {
      res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
      return;
    }

    // Check if user is authenticated first
    const userId = req.user ? req.user.userId : null;
    const finalSessionId = sessionId || null;

    if (!userId && !finalSessionId) {
      res.status(400).json({
        success: false,
        message: 'Authentication or session ID required'
      });
      return;
    }

    // Find cart
    const query: any = {};
    if (userId) {
      query.user = userId;
    } else {
      query.sessionId = finalSessionId;
    }

    const cart = await Cart.findOne(query);
    if (!cart) {
      res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
      return;
    }

    // Remove item from cart
    cart.items = cart.items.filter(
      item => item.product.toString() !== productId
    );

    await cart.save();
    await cart.populate('items.product', 'name slug images price brand inventory');

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cart
    });
  } catch (error: any) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing item from cart',
      error: error.message
    });
  }
});

// Clear entire cart
router.delete('/clear', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.body;

    // Check if user is authenticated first
    const userId = req.user ? req.user.userId : null;
    const finalSessionId = sessionId || null;

    if (!userId && !finalSessionId) {
      res.status(400).json({
        success: false,
        message: 'Authentication or session ID required'
      });
      return;
    }

    // Find cart
    const query: any = {};
    if (userId) {
      query.user = userId;
    } else {
      query.sessionId = finalSessionId;
    }

    const cart = await Cart.findOne(query);
    if (!cart) {
      res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
      return;
    }

    cart.items = [];
    cart.totals = { subtotal: 0, tax: 0, shipping: 0, total: 0 };
    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error: any) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing cart',
      error: error.message
    });
  }
});

// Merge session cart with user cart (call after login)
router.post('/merge', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      res.json({
        success: true,
        message: 'No session cart to merge'
      });
      return;
    }

    // Find session cart
    const sessionCart = await Cart.findOne({ sessionId });
    if (!sessionCart || sessionCart.items.length === 0) {
      res.json({
        success: true,
        message: 'No session cart found to merge'
      });
      return;
    }

    // Find or create user cart
    let userCart = await Cart.findOne({ user: req.user!.userId });
    
    if (!userCart) {
      // Create new user cart from session cart
      userCart = new Cart({
        user: req.user!.userId,
        items: sessionCart.items,
        totals: sessionCart.totals
      });
    } else {
      // Merge session cart items into user cart
      for (const sessionItem of sessionCart.items) {
        const existingItemIndex = userCart.items.findIndex(
          item => item.product.toString() === sessionItem.product.toString()
        );

        if (existingItemIndex > -1) {
          // Add quantities
          userCart.items[existingItemIndex].quantity += sessionItem.quantity;
          userCart.items[existingItemIndex].total = 
            userCart.items[existingItemIndex].quantity * userCart.items[existingItemIndex].price;
        } else {
          // Add new item
          userCart.items.push(sessionItem);
        }
      }
    }

    await userCart.save();

    // Delete session cart
    await Cart.findOneAndDelete({ sessionId });

    // Return merged cart
    const mergedCart = await Cart.findById(userCart._id)
      .populate('items.product', 'name slug images price brand inventory');

    res.json({
      success: true,
      message: 'Carts merged successfully',
      data: mergedCart
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error during cart merge',
      error: error.message
    });
  }
});

export default router;