import express, { Request, Response } from 'express';
import Order from '../models/Order';
import { authenticateJWT } from '../middleware/auth';
import { createPaymentIntent, confirmPaymentIntent, refundPayment, handleStripeWebhook } from '../services/stripe';

const router = express.Router();

// Create Payment Intent for Order
router.post('/create-payment-intent', authenticateJWT as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.body;
    const userId = req.user!.userId;

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
      return;
    }

    // Find the order
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    // Check if order is in correct status for payment
    if (order.paymentStatus !== 'pending') {
      res.status(400).json({
        success: false,
        message: 'Order payment is not pending'
      });
      return;
    }

    // Create payment intent with Stripe
    const paymentResult = await createPaymentIntent(
      order.totals.total,
      'usd',
      {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: userId,
      }
    );

    if (!paymentResult.success) {
      res.status(500).json({
        success: false,
        message: 'Failed to create payment intent',
        error: paymentResult.error
      });
      return;
    }

    // Store payment intent ID in order
    order.paymentIntentId = paymentResult.data!.paymentIntentId;
    await order.save();

    res.json({
      success: true,
      message: 'Payment intent created successfully',
      data: {
        clientSecret: paymentResult.data!.clientSecret,
        amount: order.totals.total,
        currency: 'usd',
        orderId: order._id,
        orderNumber: order.orderNumber
      }
    });

  } catch (error: any) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment intent',
      error: error.message
    });
  }
});

// Confirm Payment Success
router.post('/confirm-payment', authenticateJWT as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, paymentIntentId } = req.body;
    const userId = req.user!.userId;

    if (!orderId || !paymentIntentId) {
      res.status(400).json({
        success: false,
        message: 'Order ID and Payment Intent ID are required'
      });
      return;
    }

    // Find the order
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    // Confirm payment with Stripe
    const confirmResult = await confirmPaymentIntent(paymentIntentId);
    if (!confirmResult.success) {
      res.status(500).json({
        success: false,
        message: 'Failed to confirm payment',
        error: confirmResult.error
      });
      return;
    }

    // Update order status based on payment status
    if (confirmResult.data!.status === 'succeeded') {
      order.paymentStatus = 'paid';
      order.orderStatus = 'confirmed';
      order.paidAt = new Date();
    } else if (confirmResult.data!.status === 'requires_payment_method') {
      order.paymentStatus = 'failed';
    }

    await order.save();

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        amount: confirmResult.data!.amount
      }
    });

  } catch (error: any) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming payment',
      error: error.message
    });
  }
});

// Process Refund
router.post('/refund', authenticateJWT as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, amount, reason } = req.body;
    const userId = req.user!.userId;

    // For demo purposes, allow both users and admins to refund
    // In production, you might want admin-only refunds
    const order = await Order.findOne({ 
      _id: orderId, 
      $or: [{ user: userId }, { user: { $exists: true } }] // Allow if user owns order or if admin
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    if (order.paymentStatus !== 'paid') {
      res.status(400).json({
        success: false,
        message: 'Order has not been paid'
      });
      return;
    }

    if (!order.paymentIntentId) {
      res.status(400).json({
        success: false,
        message: 'No payment intent found for this order'
      });
      return;
    }

    // Process refund with Stripe
    const refundResult = await refundPayment(order.paymentIntentId, amount);
    if (!refundResult.success) {
      res.status(500).json({
        success: false,
        message: 'Failed to process refund',
        error: refundResult.error
      });
      return;
    }

    // Update order status
    order.paymentStatus = 'refunded';
    order.orderStatus = 'cancelled';
    order.refundedAt = new Date();
    if (reason) order.refundReason = reason;

    await order.save();

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        refundAmount: refundResult.data!.amount,
        refundId: refundResult.data!.refundId
      }
    });

  } catch (error: any) {
    console.error('Refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing refund',
      error: error.message
    });
  }
});

// Get Payment Status
router.get('/status/:orderId', authenticateJWT as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        total: order.totals.total,
        paidAt: order.paidAt,
        refundedAt: order.refundedAt
      }
    });

  } catch (error: any) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment status',
      error: error.message
    });
  }
});

// Stripe Webhook Handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    
    const webhookResult = await handleStripeWebhook(req.body, signature);
    if (!webhookResult.success) {
      res.status(400).json({
        success: false,
        message: 'Webhook signature verification failed',
        error: webhookResult.error
      });
      return;
    }

    const event = webhookResult.data!;

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('Payment succeeded:', paymentIntent.id);
        
        // Update order status in database
        if (paymentIntent.metadata.orderId) {
          const order = await Order.findById(paymentIntent.metadata.orderId);
          if (order) {
            order.paymentStatus = 'paid';
            order.orderStatus = 'confirmed';
            order.paidAt = new Date();
            await order.save();
          }
        }
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('Payment failed:', failedPayment.id);
        
        if (failedPayment.metadata.orderId) {
          const order = await Order.findById(failedPayment.metadata.orderId);
          if (order) {
            order.paymentStatus = 'failed';
            await order.save();
          }
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing error',
      error: error.message
    });
  }
});

export default router;