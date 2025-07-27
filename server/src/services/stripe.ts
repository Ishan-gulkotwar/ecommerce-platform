import Stripe from 'stripe';

// Initialize Stripe with correct API version format
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

// Create Payment Intent
export const createPaymentIntent = async (amount: number, currency: string = 'usd', metadata: any = {}) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }
    };
  } catch (error: any) {
    console.error('Stripe Payment Intent Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Confirm Payment Intent
export const confirmPaymentIntent = async (paymentIntentId: string) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    return {
      success: true,
      data: {
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100, // Convert back to dollars
        currency: paymentIntent.currency,
        paymentMethod: paymentIntent.payment_method,
      }
    };
  } catch (error: any) {
    console.error('Stripe Confirm Payment Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Create Customer
export const createStripeCustomer = async (email: string, name: string, metadata: any = {}) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata,
    });

    return {
      success: true,
      data: {
        customerId: customer.id,
        email: customer.email,
      }
    };
  } catch (error: any) {
    console.error('Stripe Create Customer Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Refund Payment
export const refundPayment = async (paymentIntentId: string, amount?: number) => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined, // Convert to cents if specified
    });

    return {
      success: true,
      data: {
        refundId: refund.id,
        amount: refund.amount / 100, // Convert back to dollars
        status: refund.status,
      }
    };
  } catch (error: any) {
    console.error('Stripe Refund Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Handle Stripe Webhooks
export const handleStripeWebhook = async (body: any, signature: string) => {
  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    return {
      success: true,
      data: event
    };
  } catch (error: any) {
    console.error('Stripe Webhook Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default stripe;