import AsyncStorage from '@react-native-async-storage/async-storage';
import { upgradeUserToPremium, cancelUserSubscription } from '../../firebase/firestore';

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'bank';
  last4?: string;
  brand?: string;
  isDefault: boolean;
  expiryMonth?: number;
  expiryYear?: number;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  description: string;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  currentPeriodStart: string; // ISO string
  currentPeriodEnd: string; // ISO string
  cancelAtPeriodEnd: boolean;
}

export interface PaymentSettings {
  enabled: boolean;
  defaultCurrency: string;
  supportedCurrencies: string[];
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  testMode: boolean;
}

class PaymentService {
  private settings: PaymentSettings = {
    enabled: false,
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    stripeEnabled: false,
    paypalEnabled: false,
    testMode: true
  };

  async initialize(): Promise<void> {
    try {
      await this.loadSettings();
      console.log('Payment service initialized');
    } catch (error) {
      console.error('Failed to initialize payment service:', error);
      throw error;
    }
  }

  // Stripe Integration
  async createStripePaymentIntent(amount: number, currency: string, description: string, metadata: Record<string, string> = {}): Promise<PaymentIntent> {
    try {
      // Simulate Stripe payment intent creation
      const paymentIntent: PaymentIntent = {
        id: `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        currency,
        status: 'pending',
        description,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save payment intent
      await this.savePaymentIntent(paymentIntent);
      
      return paymentIntent;
    } catch (error) {
      console.error('Failed to create Stripe payment intent:', error);
      throw error;
    }
  }

  async confirmStripePayment(paymentIntentId: string, paymentMethodId: string): Promise<PaymentIntent> {
    try {
      // Simulate payment confirmation
      const paymentIntent = await this.getPaymentIntent(paymentIntentId);
      if (!paymentIntent) {
        throw new Error('Payment intent not found');
      }

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      paymentIntent.status = 'succeeded';
      paymentIntent.updatedAt = new Date();
      
      await this.savePaymentIntent(paymentIntent);
      
      return paymentIntent;
    } catch (error) {
      console.error('Failed to confirm Stripe payment:', error);
      throw error;
    }
  }

  // PayPal Integration
  async createPayPalOrder(amount: number, currency: string, description: string): Promise<PaymentIntent> {
    try {
      // Simulate PayPal order creation
      const paymentIntent: PaymentIntent = {
        id: `pp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        currency,
        status: 'pending',
        description,
        metadata: { provider: 'paypal' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.savePaymentIntent(paymentIntent);
      
      return paymentIntent;
    } catch (error) {
      console.error('Failed to create PayPal order:', error);
      throw error;
    }
  }

  async capturePayPalPayment(orderId: string): Promise<PaymentIntent> {
    try {
      const paymentIntent = await this.getPaymentIntent(orderId);
      if (!paymentIntent) {
        throw new Error('PayPal order not found');
      }

      // Simulate payment capture
      await new Promise(resolve => setTimeout(resolve, 1500));

      paymentIntent.status = 'succeeded';
      paymentIntent.updatedAt = new Date();
      
      await this.savePaymentIntent(paymentIntent);
      
      return paymentIntent;
    } catch (error) {
      console.error('Failed to capture PayPal payment:', error);
      throw error;
    }
  }

  // Subscription Management - Integrated with Backend
  async createSubscription(planId: string, planName: string, amount: number, currency: string, interval: 'monthly' | 'yearly', userId: string): Promise<Subscription> {
    try {
      // Call the existing backend function
      await upgradeUserToPremium(userId, interval);

      // Create local subscription record that matches backend format
      const subscription: Subscription = {
        id: planId, // Use planId as the ID to match backend
        planId,
        planName,
        amount,
        currency,
        interval,
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + (interval === 'monthly' ? 30 * 24 * 60 * 60 * 1000 : 365 * 24 * 60 * 60 * 1000)).toISOString(),
        cancelAtPeriodEnd: false
      };

      await this.saveSubscription(subscription);
      
      return subscription;
    } catch (error) {
      console.error('Failed to create subscription:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string, userId: string, cancelAtPeriodEnd: boolean = true): Promise<Subscription> {
    try {
      console.log('Canceling subscription:', subscriptionId, 'for user:', userId);
      
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (!cancelAtPeriodEnd) {
        // Immediately cancel - call backend function
        console.log('Calling backend cancelUserSubscription...');
        await cancelUserSubscription(userId);
        console.log('Backend subscription cancelled successfully');
        
        // Update local subscription to match backend
        subscription.status = 'canceled';
        subscription.cancelAtPeriodEnd = false;
      } else {
        subscription.cancelAtPeriodEnd = true;
      }

      await this.saveSubscription(subscription);
      console.log('Local subscription updated successfully');
      
      return subscription;
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  // Payment Methods Management
  async addPaymentMethod(paymentMethod: Omit<PaymentMethod, 'id'>): Promise<PaymentMethod> {
    try {
      const newPaymentMethod: PaymentMethod = {
        ...paymentMethod,
        id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      const paymentMethods = await this.getPaymentMethods();
      paymentMethods.push(newPaymentMethod);
      
      await AsyncStorage.setItem('payment_methods', JSON.stringify(paymentMethods));
      
      return newPaymentMethod;
    } catch (error) {
      console.error('Failed to add payment method:', error);
      throw error;
    }
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      const data = await AsyncStorage.getItem('payment_methods');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get payment methods:', error);
      return [];
    }
  }

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      const paymentMethods = await this.getPaymentMethods();
      const filtered = paymentMethods.filter(pm => pm.id !== paymentMethodId);
      await AsyncStorage.setItem('payment_methods', JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove payment method:', error);
      throw error;
    }
  }

  // Settings Management
  async getSettings(): Promise<PaymentSettings> {
    return this.settings;
  }

  async updateSettings(updates: Partial<PaymentSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  // Helper Methods
  async syncSubscriptionWithBackend(userProfile: any): Promise<void> {
    try {
      if (userProfile?.subscription && userProfile.subscription.plan !== 'free') {
        // Convert backend subscription format to local format
        const backendSubscription: Subscription = {
          id: userProfile.subscription.planId || 'unknown',
          planId: userProfile.subscription.planId || 'unknown',
          planName: userProfile.subscription.planId?.replace('_', ' ') || 'Premium',
          amount: userProfile.subscription.planId?.includes('monthly') ? 999 : 9999,
          currency: 'USD',
          interval: userProfile.subscription.planId?.includes('yearly') ? 'yearly' : 'monthly',
          status: userProfile.subscription.status || 'active',
          currentPeriodStart: userProfile.subscription.startedAt || new Date().toISOString(),
          currentPeriodEnd: userProfile.subscription.currentPeriodEnd || new Date().toISOString(),
          cancelAtPeriodEnd: false
        };
        
        // Save to local storage to keep in sync
        await this.saveSubscription(backendSubscription);
      }
    } catch (error) {
      console.error('Failed to sync subscription with backend:', error);
    }
  }

  private async savePaymentIntent(paymentIntent: PaymentIntent): Promise<void> {
    try {
      const paymentIntents = await this.getPaymentIntents();
      const existingIndex = paymentIntents.findIndex(pi => pi.id === paymentIntent.id);
      
      if (existingIndex >= 0) {
        paymentIntents[existingIndex] = paymentIntent;
      } else {
        paymentIntents.push(paymentIntent);
      }
      
      await AsyncStorage.setItem('payment_intents', JSON.stringify(paymentIntents));
    } catch (error) {
      console.error('Failed to save payment intent:', error);
    }
  }

  private async getPaymentIntents(): Promise<PaymentIntent[]> {
    try {
      const data = await AsyncStorage.getItem('payment_intents');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get payment intents:', error);
      return [];
    }
  }

  private async getPaymentIntent(id: string): Promise<PaymentIntent | null> {
    try {
      const paymentIntents = await this.getPaymentIntents();
      return paymentIntents.find(pi => pi.id === id) || null;
    } catch (error) {
      console.error('Failed to get payment intent:', error);
      return null;
    }
  }

  private async saveSubscription(subscription: Subscription): Promise<void> {
    try {
      const subscriptions = await this.getSubscriptions();
      const existingIndex = subscriptions.findIndex(sub => sub.id === subscription.id);
      
      if (existingIndex >= 0) {
        subscriptions[existingIndex] = subscription;
      } else {
        subscriptions.push(subscription);
      }
      
      await AsyncStorage.setItem('subscriptions', JSON.stringify(subscriptions));
    } catch (error) {
      console.error('Failed to save subscription:', error);
    }
  }

  async getSubscriptions(): Promise<Subscription[]> {
    try {
      const data = await AsyncStorage.getItem('subscriptions');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get subscriptions:', error);
      return [];
    }
  }

  private async getSubscription(id: string): Promise<Subscription | null> {
    try {
      const subscriptions = await this.getSubscriptions();
      return subscriptions.find(sub => sub.id === id) || null;
    } catch (error) {
      console.error('Failed to get subscription:', error);
      return null;
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem('payment_settings');
      if (data) {
        this.settings = { ...this.settings, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Failed to load payment settings:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem('payment_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save payment settings:', error);
    }
  }
}

export default new PaymentService(); 