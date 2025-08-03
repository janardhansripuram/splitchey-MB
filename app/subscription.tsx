import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text, Surface, Card, Chip, Switch, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeMode } from '../hooks/useThemeMode';
import { useAuth } from '../hooks/useAuth';
import paymentService, { Subscription, PaymentIntent } from '../lib/payments/PaymentService';
import PaymentModal from '../components/PaymentModal';

const subscriptionPlans = [
  {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    price: 999, // $9.99 in cents
    currency: 'USD',
    interval: 'monthly' as const,
    features: [
      'Unlimited expenses & income',
      'Advanced analytics & reports',
      'Priority customer support',
      'Export to multiple formats',
      'Custom categories & tags',
      'Group expense management',
      'Budget tracking & alerts',
      'Receipt scanning (OCR)',
      'Multi-currency support',
      'Cloud backup & sync'
    ],
    popular: false
  },
  {
    id: 'premium_yearly',
    name: 'Premium Yearly',
    price: 9999, // $99.99 in cents
    currency: 'USD',
    interval: 'yearly' as const,
    features: [
      'All monthly features',
      '2 months free',
      'Early access to new features',
      'Exclusive premium themes',
      'Advanced AI insights',
      'Priority feature requests'
    ],
    popular: true
  }
];

export default function SubscriptionScreen() {
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(subscriptionPlans[1]); // Default to yearly
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '', color: 'green' as 'green' | 'red' });
  const router = useRouter();
  const { paperTheme } = useThemeMode();
  const { colors } = paperTheme;
  const { authUser, userProfile } = useAuth();

  useEffect(() => {
    loadCurrentSubscription();
  }, [userProfile]);

  const loadCurrentSubscription = async () => {
    try {
      // Sync local storage with backend data
      if (userProfile) {
        await paymentService.syncSubscriptionWithBackend(userProfile);
      }
      
      // Read from backend (userProfile) instead of local storage
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
        setCurrentSubscription(backendSubscription);
      } else {
        setCurrentSubscription(null);
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    }
  };

  const handleSubscribe = (plan: typeof subscriptionPlans[0]) => {
    setSelectedPlan(plan);
    setPaymentModalVisible(true);
  };

  const handlePaymentSuccess = async (paymentIntent: PaymentIntent) => {
    try {
      setIsLoading(true);
      
      // Create subscription
      const subscription = await paymentService.createSubscription(
        selectedPlan.id,
        selectedPlan.name,
        selectedPlan.price,
        selectedPlan.currency,
        selectedPlan.interval,
        authUser.uid
      );

      setCurrentSubscription(subscription);
      setSnackbar({ 
        visible: true, 
        message: `Successfully subscribed to ${selectedPlan.name}!`, 
        color: 'green' 
      });

      // Close modal after a short delay
      setTimeout(() => {
        setPaymentModalVisible(false);
        // Navigate back with refresh parameter
        router.back();
      }, 2000);
    } catch (error) {
      console.error('Payment success error:', error);
      setSnackbar({ 
        visible: true, 
        message: 'Payment successful but subscription creation failed. Please contact support.', 
        color: 'red' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentError = (error: string) => {
    setSnackbar({ 
      visible: true, 
      message: `Payment failed: ${error}`, 
      color: 'red' 
    });
  };

  const handleCancelSubscription = async () => {
    if (!currentSubscription) return;

    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Starting subscription cancellation...');
              setIsLoading(true);
              console.log('Calling paymentService.cancelSubscription...');
              await paymentService.cancelSubscription(currentSubscription.id, authUser.uid);
              console.log('Subscription cancelled successfully');
              setCurrentSubscription(null);
              setSnackbar({ 
                visible: true, 
                message: 'Subscription cancelled successfully. You will lose access to premium features at the end of your current billing period.', 
                color: 'green' 
              });
              
              // Go back to profile after a short delay
              setTimeout(() => {
                console.log('Navigating back to profile page...');
                router.back();
              }, 2000);
            } catch (error) {
              console.error('Failed to cancel subscription:', error);
              setSnackbar({ 
                visible: true, 
                message: 'Failed to cancel subscription. Please try again or contact support.', 
                color: 'red' 
              });
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const formatPrice = (price: number, currency: string) => {
    const amount = price / 100; // Convert cents to dollars
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    } catch (error) {
      // Fallback for invalid dates
      return new Date(dateString).toLocaleDateString();
    }
  };

  return (
    <Surface style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.onBackground }]}>
            Premium Subscription
          </Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
            Unlock advanced features and take control of your finances
          </Text>
        </View>

        {currentSubscription && (
          <Card style={styles.currentSubscriptionCard}>
            <Card.Content>
              <View style={styles.subscriptionHeader}>
                <MaterialCommunityIcons 
                  name="crown" 
                  size={24} 
                  color={colors.primary} 
                />
                <Text style={[styles.subscriptionTitle, { color: colors.onSurface }]}>
                  Current Subscription
                </Text>
              </View>
              
              <Text style={[styles.subscriptionName, { color: colors.onSurface }]}>
                {currentSubscription.planName}
              </Text>
              
              <Text style={[styles.subscriptionPrice, { color: colors.onSurface }]}>
                {formatPrice(currentSubscription.amount, currentSubscription.currency)} / {currentSubscription.interval}
              </Text>
              
              <View style={styles.subscriptionDetails}>
                <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>
                  Status:
                </Text>
                <Chip 
                  style={[
                    styles.statusChip, 
                    { backgroundColor: currentSubscription.status === 'active' ? colors.primary : colors.error }
                  ]}
                >
                  {currentSubscription.status}
                </Chip>
              </View>
              
              <View style={styles.subscriptionDetails}>
                <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>
                  Next billing:
                </Text>
                <Text style={[styles.detailValue, { color: colors.onSurface }]}>
                  {formatDate(currentSubscription.currentPeriodEnd)}
                </Text>
              </View>
              
              {currentSubscription.cancelAtPeriodEnd && (
                <Text style={[styles.cancelNotice, { color: colors.error }]}>
                  ⚠️ Subscription will end on {formatDate(currentSubscription.currentPeriodEnd)}
                </Text>
              )}
              
              <Button
                mode="outlined"
                onPress={handleCancelSubscription}
                style={styles.cancelButton}
                textColor={colors.error}
                disabled={isLoading}
              >
                Cancel Subscription
              </Button>
            </Card.Content>
          </Card>
        )}

        {!currentSubscription && (
          <View style={styles.plansContainer}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
              Choose Your Plan
            </Text>
            
            {subscriptionPlans.map((plan) => (
              <Card key={plan.id} style={styles.planCard}>
                <Card.Content>
                  <View style={styles.planHeader}>
                    <Text style={[styles.planName, { color: colors.onSurface }]}>
                      {plan.name}
                    </Text>
                    {plan.popular && (
                      <Chip style={styles.popularChip}>
                        Most Popular
                      </Chip>
                    )}
                  </View>
                  
                  <Text style={[styles.planPrice, { color: colors.onSurface }]}>
                    {formatPrice(plan.price, plan.currency)}
                  </Text>
                  <Text style={[styles.planInterval, { color: colors.onSurfaceVariant }]}>
                    per {plan.interval}
                  </Text>
                  
                  <View style={styles.featuresList}>
                    {plan.features.map((feature, index) => (
                      <View key={index} style={styles.featureItem}>
                        <MaterialCommunityIcons 
                          name="check-circle" 
                          size={16} 
                          color={colors.primary} 
                        />
                        <Text style={[styles.featureText, { color: colors.onSurface }]}>
                          {feature}
                        </Text>
                      </View>
                    ))}
                  </View>
                  
                  <Button
                    mode="contained"
                    onPress={() => handleSubscribe(plan)}
                    style={styles.subscribeButton}
                    disabled={isLoading}
                  >
                    Subscribe Now
                  </Button>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.onSurfaceVariant }]}>
            🔒 Secure payment processing • Cancel anytime • 30-day money-back guarantee
          </Text>
        </View>
      </ScrollView>

      <PaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        amount={selectedPlan.price}
        currency={selectedPlan.currency}
        description={`${selectedPlan.name} Subscription`}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  currentSubscriptionCard: {
    margin: 20,
    marginTop: 0,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  subscriptionName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subscriptionPrice: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 16,
  },
  subscriptionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusChip: {
    marginLeft: 8,
  },
  cancelNotice: {
    fontSize: 14,
    marginTop: 12,
    marginBottom: 16,
  },
  cancelButton: {
    marginTop: 8,
  },
  plansContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  planCard: {
    marginBottom: 16,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  popularChip: {
    backgroundColor: '#FFD700',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planInterval: {
    fontSize: 16,
    marginBottom: 16,
  },
  featuresList: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  subscribeButton: {
    marginTop: 8,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
}); 