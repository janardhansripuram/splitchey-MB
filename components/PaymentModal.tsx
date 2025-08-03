import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Modal, Portal, Button, Text, Surface, Card, Chip, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeMode } from '../hooks/useThemeMode';
import paymentService, { PaymentMethod, PaymentIntent } from '../lib/payments/PaymentService';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  amount: number;
  currency: string;
  description: string;
  onSuccess: (paymentIntent: PaymentIntent) => void;
  onError: (error: string) => void;
}

export default function PaymentModal({ 
  visible, 
  onClose, 
  amount, 
  currency, 
  description, 
  onSuccess, 
  onError 
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'stripe' | 'paypal' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const { paperTheme } = useThemeMode();
  const { colors } = paperTheme;

  React.useEffect(() => {
    if (visible) {
      loadPaymentMethods();
    }
  }, [visible]);

  const loadPaymentMethods = async () => {
    try {
      const methods = await paymentService.getPaymentMethods();
      setPaymentMethods(methods);
    } catch (error) {
      console.error('Failed to load payment methods:', error);
    }
  };

  const handleStripePayment = async () => {
    try {
      setIsProcessing(true);
      setSelectedMethod('stripe');

      // Create payment intent
      const paymentIntent = await paymentService.createStripePaymentIntent(
        amount,
        currency,
        description,
        { type: 'premium_subscription' }
      );

      // Simulate payment confirmation
      const confirmedPayment = await paymentService.confirmStripePayment(
        paymentIntent.id,
        'pm_test_card'
      );

      onSuccess(confirmedPayment);
      onClose();
    } catch (error) {
      onError('Stripe payment failed. Please try again.');
      console.error('Stripe payment error:', error);
    } finally {
      setIsProcessing(false);
      setSelectedMethod(null);
    }
  };

  const handlePayPalPayment = async () => {
    try {
      setIsProcessing(true);
      setSelectedMethod('paypal');

      // Create PayPal order
      const paymentIntent = await paymentService.createPayPalOrder(
        amount,
        currency,
        description
      );

      // Simulate payment capture
      const capturedPayment = await paymentService.capturePayPalPayment(paymentIntent.id);

      onSuccess(capturedPayment);
      onClose();
    } catch (error) {
      onError('PayPal payment failed. Please try again.');
      console.error('PayPal payment error:', error);
    } finally {
      setIsProcessing(false);
      setSelectedMethod(null);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100); // Convert cents to dollars
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={styles.modal}
      >
        <Surface style={styles.container}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.onSurface }]}>
              Complete Payment
            </Text>
            <Button
              mode="text"
              onPress={onClose}
              icon="close"
              disabled={isProcessing}
            />
          </View>

          <Card style={styles.amountCard}>
            <Card.Content>
              <Text style={[styles.amount, { color: colors.onSurface }]}>
                {formatAmount(amount, currency)}
              </Text>
              <Text style={[styles.description, { color: colors.onSurfaceVariant }]}>
                {description}
              </Text>
            </Card.Content>
          </Card>

          <View style={styles.paymentMethods}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
              Choose Payment Method
            </Text>

            <View style={styles.methodButtons}>
              <Button
                mode={selectedMethod === 'stripe' ? 'contained' : 'outlined'}
                onPress={handleStripePayment}
                disabled={isProcessing}
                style={styles.methodButton}
                icon="credit-card"
                loading={isProcessing && selectedMethod === 'stripe'}
              >
                Pay with Card
              </Button>

              <Button
                mode={selectedMethod === 'paypal' ? 'contained' : 'outlined'}
                onPress={handlePayPalPayment}
                disabled={isProcessing}
                style={styles.methodButton}
                icon="credit-card-outline"
                loading={isProcessing && selectedMethod === 'paypal'}
              >
                Pay with PayPal
              </Button>
            </View>
          </View>

          {paymentMethods.length > 0 && (
            <View style={styles.savedMethods}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                Saved Payment Methods
              </Text>
              {paymentMethods.map((method) => (
                <Card key={method.id} style={styles.methodCard}>
                  <Card.Content>
                    <View style={styles.methodInfo}>
                                             <MaterialCommunityIcons
                         name={method.type === 'card' ? 'credit-card' : 'credit-card-outline'}
                         size={24}
                         color={colors.primary}
                       />
                      <View style={styles.methodDetails}>
                        <Text style={[styles.methodName, { color: colors.onSurface }]}>
                          {method.type === 'card' 
                            ? `${method.brand} •••• ${method.last4}`
                            : 'PayPal Account'
                          }
                        </Text>
                        {method.isDefault && (
                          <Chip size="small" style={styles.defaultChip}>
                            Default
                          </Chip>
                        )}
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              ))}
            </View>
          )}

          <View style={styles.footer}>
            <Text style={[styles.securityNote, { color: colors.onSurfaceVariant }]}>
              🔒 Your payment information is secure and encrypted
            </Text>
          </View>
        </Surface>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    borderRadius: 16,
  },
  container: {
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  amountCard: {
    marginBottom: 20,
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
  },
  paymentMethods: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  methodButtons: {
    gap: 12,
  },
  methodButton: {
    marginBottom: 8,
  },
  savedMethods: {
    marginBottom: 20,
  },
  methodCard: {
    marginBottom: 8,
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodDetails: {
    marginLeft: 12,
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '500',
  },
  defaultChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  footer: {
    alignItems: 'center',
  },
  securityNote: {
    fontSize: 12,
    textAlign: 'center',
  },
}); 