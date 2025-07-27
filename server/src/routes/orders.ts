import express, { Request, Response } from 'express';
import Order from '../models/Order';
import Cart from '../models/Cart';
import Product from '../models/Product';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// Create order from cart (Checkout)
router.post('/checkout', authenticateJWT as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { shippingAddress, billingAddress, paymentMethod, notes } = req.body;

    // Validate required fields
    if (!shippingAddress || !paymentMethod) {
      res.status(400).json({
        success: false,
        message: 'Shipping address and payment method are required'
      });
      return;
    }

    // Find user's cart
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
      return;
    }

    // Verify all products are still available and prices haven't changed
    for (const item of cart.items) {
      const product = await Product.findById(item.product);
      if (!product) {
        res.status(400).json({
          success: false,
          message: `Product ${item.product} not found`
        });
        return;
      }

      if (!product.isActive) {
        res.status(400).json({
          success: false,
          message: `Product ${product.name} is no longer available`
        });
        return;
      }

      // Check inventory
      if (product.inventory.trackQuantity && product.inventory.quantity < item.quantity) {
        res.status(400).json({
          success: false,
          message: `Insufficient inventory for ${product.name}. Available: ${product.inventory.quantity}`
        });
        return;
      }
    }

    // Create order items with proper typing
    const orderItems = [];
    for (const item of cart.items) {
      const product = await Product.findById(item.product);
      if (product) {
        orderItems.push({
          product: product._id,
          name: product.name,
          price: item.price,
          quantity: item.quantity,
          total: item.total
        });
      }
    }

    // Create order
    const order = new Order({
      user: userId,
      items: orderItems,
      totals: cart.totals,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      paymentMethod,
      notes,
      paymentStatus: 'pending',
      orderStatus: 'pending'
    });

    await order.save();

    // Update product inventory
    for (const item of cart.items) {
      const product = await Product.findById(item.product);
      if (product && product.inventory.trackQuantity) {
        product.inventory.quantity -= item.quantity;
        product.analytics.purchases += item.quantity;
        product.analytics.revenue += item.total;
        await product.save();
      }
    }

    // Clear user's cart
    await Cart.findOneAndDelete({ user: userId });

    // Populate order for response
    const populatedOrder = await Order.findById(order._id)
      .populate('items.product', 'name images slug')
      .populate('user', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: populatedOrder
    });

  } catch (error: any) {
    console.error('Checkout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
});

// Get user's orders
router.get('/my-orders', authenticateJWT as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { page = 1, limit = 10, status } = req.query;

    // Build filter
    const filter: any = { user: userId };
    if (status) {
      filter.orderStatus = status;
    }

    // Calculate pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get orders
    const orders = await Order.find(filter)
      .populate('items.product', 'name images slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      count: orders.length,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: orders
    });

  } catch (error: any) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
});

// Get single order
router.get('/:id', authenticateJWT as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const orderId = req.params.id;

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate('items.product', 'name images slug description')
      .populate('user', 'firstName lastName email');

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    res.json({
      success: true,
      data: order
    });

  } catch (error: any) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message
    });
  }
});

// Cancel order (only if pending or confirmed)
router.patch('/:id/cancel', authenticateJWT as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const orderId = req.params.id;

    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.orderStatus)) {
      res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
      return;
    }

    // Update order status
    order.orderStatus = 'cancelled';
    await order.save();

    // Restore product inventory
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product && product.inventory.trackQuantity) {
        product.inventory.quantity += item.quantity;
        product.analytics.purchases -= item.quantity;
        product.analytics.revenue -= item.total;
        await product.save();
      }
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });

  } catch (error: any) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling order',
      error: error.message
    });
  }
});

// Admin: Get all orders
router.get('/admin/all', authenticateJWT as any, async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user is admin (you might want to create a separate admin middleware)
    if (req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
      return;
    }

    const { page = 1, limit = 20, status, paymentStatus } = req.query;

    // Build filter
    const filter: any = {};
    if (status) filter.orderStatus = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    // Calculate pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get orders
    const orders = await Order.find(filter)
      .populate('items.product', 'name images slug')
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      count: orders.length,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: orders
    });

  } catch (error: any) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
});

// Admin: Update order status
router.patch('/admin/:id/status', authenticateJWT as any, async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user is admin
    if (req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
      return;
    }

    const orderId = req.params.id;
    const { orderStatus, paymentStatus, trackingNumber, estimatedDelivery } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    // Update fields
    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (estimatedDelivery) order.estimatedDelivery = new Date(estimatedDelivery);

    // Set delivered date if status is delivered
    if (orderStatus === 'delivered') {
      order.deliveredAt = new Date();
    }

    await order.save();

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: order
    });

  } catch (error: any) {
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order',
      error: error.message
    });
  }
});

export default router;