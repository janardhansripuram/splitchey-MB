import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View, Modal } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Dialog, Divider, FAB, IconButton, Menu, Paragraph, Portal, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernButton } from '../components/ui/ModernButton';
import { ModernCard } from '../components/ui/ModernCard';
import { addFundsToWallet, getUserProfile } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { CurrencySelectionModal } from '../components/CurrencySelectionModal';
import { SUPPORTED_CURRENCIES } from '../constants/types';
import { CurrencyCode } from '../constants/types';

const BOTTOM_SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.68);

interface AddFundsFormData {
  amount: string;
  currency: string;
}

export default function WalletScreen() {
  const { authUser, loading } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { colors, dark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Add funds sheet state
  const [addFundsSheetOpen, setAddFundsSheetOpen] = useState(false);
  const [addFundsForm, setAddFundsForm] = useState<AddFundsFormData>({
    amount: '',
    currency: 'USD' as CurrencyCode,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);

  // Bottom sheet refs
  const addFundsSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [BOTTOM_SHEET_HEIGHT], []);

  // Handle bottom sheet state
  const handleOpenAddFunds = useCallback(() => {
    console.log('Opening add funds sheet, current state:', addFundsSheetOpen);
    setAddFundsSheetOpen(true);
    console.log('State set to true');
  }, [addFundsSheetOpen]);

  const handleCloseAddFunds = useCallback(() => {
    console.log('Closing add funds sheet');
    setAddFundsSheetOpen(false);
  }, []);

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async () => {
    if (!authUser) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const profile = await getUserProfile(authUser.uid);
      setUserProfile(profile);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      setFetchError('Failed to load wallet data');
    } finally {
      setIsLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (authUser && !loading) {
      fetchUserProfile();
    }
  }, [authUser, loading, fetchUserProfile]);

  const onRefresh = useCallback(async () => {
    await fetchUserProfile();
  }, [fetchUserProfile]);

  const handleAddFunds = async () => {
    if (!authUser || !addFundsForm.amount || parseFloat(addFundsForm.amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await addFundsToWallet(authUser.uid, parseFloat(addFundsForm.amount), addFundsForm.currency as CurrencyCode);
      Alert.alert('Success', `Added ${addFundsForm.currency} ${addFundsForm.amount} to your wallet`);
      setAddFundsForm({ amount: '', currency: 'USD' as CurrencyCode });
      setAddFundsSheetOpen(false);
      await fetchUserProfile(); // Refresh wallet data
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add funds to wallet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrencyDisplay = (amount: number, currencyCode: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const sortedWalletEntries = Object.entries(userProfile?.wallet || {})
    .sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB)) as [string, number][];

  const renderWalletCard = ({ item }: { item: [string, number] }) => {
    const [currency, amount] = item;
    const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency);

    return (
      <Card style={styles.walletCard}>
        <Card.Content style={styles.walletCardContent}>
          <View style={styles.walletCardHeader}>
            <View style={styles.currencyInfo}>
              <Text variant="titleLarge" style={styles.currencyCode}>
                {currency}
              </Text>
              <Text variant="bodySmall" style={styles.currencyName}>
                {currencyInfo?.name || currency}
              </Text>
            </View>
            <View style={styles.currencySymbol}>
              <Text variant="headlineMedium" style={styles.symbolText}>
                {currencyInfo?.symbol || currency}
              </Text>
            </View>
          </View>
          <Text variant="headlineLarge" style={styles.balanceAmount}>
            {formatCurrencyDisplay(amount, currency)}
          </Text>
        </Card.Content>
      </Card>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontWeight: 'bold',
    },
    content: {
      padding: 16,
    },
    walletCard: {
      marginBottom: 12,
      elevation: 2,
      borderRadius: 12,
    },
    walletCardContent: {
      padding: 20,
    },
    walletCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    currencyInfo: {
      flex: 1,
    },
    currencyCode: {
      fontWeight: 'bold',
      color: colors.primary,
    },
    currencyName: {
      opacity: 0.7,
      marginTop: 2,
    },
    currencySymbol: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primaryContainer,
      justifyContent: 'center',
      alignItems: 'center',
    },
    symbolText: {
      fontWeight: 'bold',
      color: colors.primary,
    },
    balanceAmount: {
      fontWeight: 'bold',
      color: colors.onSurface,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 48,
    },
    emptyTitle: {
      marginTop: 16,
      marginBottom: 8,
      fontWeight: 'bold',
    },
    emptySubtitle: {
      textAlign: 'center',
      opacity: 0.7,
    },
    fab: {
      position: 'absolute',
      margin: 16,
      right: 0,
      bottom: 0,
    },
    submitButton: {
      marginTop: 20,
    },
    errorText: {
      marginBottom: 16,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 8,
    },
    addFundsContent: {
      padding: 20,
    },
    formField: {
      marginBottom: 20,
    },
    currencyButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderRadius: 12,
      backgroundColor: colors.surfaceVariant,
    },
    currencyButtonContent: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      marginRight: 10,
    },
    currencyButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    currencyName: {
      fontSize: 14,
      marginTop: 2,
    },
    bottomSheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 20,
    },
    bottomSheetTitle: {
      fontWeight: 'bold',
    },
    closeButton: {
      padding: 5,
    },
    bottomSheetContent: {
      paddingHorizontal: 16,
    },
    fieldLabel: {
      marginBottom: 8,
      fontWeight: '600',
    },
    textInput: {
      borderRadius: 12,
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Surface style={styles.header} elevation={1}>
        <View style={styles.headerContent}>
          <Text variant="headlineSmall" style={styles.title}>
            Wallet
          </Text>
        </View>
      </Surface>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      ) : fetchError ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text variant="bodyLarge" style={styles.errorText}>
            {fetchError}
          </Text>
          <Button mode="contained" onPress={fetchUserProfile} style={styles.retryButton}>
            Retry
          </Button>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.content}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
            }
          >
            {sortedWalletEntries.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name="wallet"
                  size={64}
                  color={colors.outline}
                />
                <Text variant="titleMedium" style={styles.emptyTitle}>
                  Your Wallet is Empty
                </Text>
                <Text variant="bodyMedium" style={styles.emptySubtitle}>
                  Add funds to your wallet to get started
                </Text>
              </View>
            ) : (
              <FlatList
                data={sortedWalletEntries}
                renderItem={renderWalletCard}
                keyExtractor={(item) => item[0]}
                scrollEnabled={false}
              />
            )}
          </ScrollView>

          <FAB
            icon="plus"
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={handleOpenAddFunds}
            label="Add Funds"
          />
        </>
      )}

      {/* Add Funds Bottom Sheet */}
      <BottomSheet
        ref={addFundsSheetRef}
        index={addFundsSheetOpen ? 0 : -1}
        snapPoints={snapPoints}
        enablePanDownToClose
        enableOverDrag={false}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
        )}
        onClose={handleCloseAddFunds}
        onChange={(index) => {
          console.log('Bottom sheet index changed:', index);
          if (index === -1) {
            handleCloseAddFunds();
          }
        }}
        enableContentPanningGesture={true}
        enableHandlePanningGesture={true}
        handleIndicatorStyle={{ backgroundColor: colors.outline }}
        backgroundStyle={{ backgroundColor: colors.surface }}
      >
        <View style={styles.addFundsContent}>
          {/* Header */}
          <View style={styles.bottomSheetHeader}>
            <Text variant="headlineSmall" style={[styles.bottomSheetTitle, { color: colors.onSurface }]}>
              Add Funds to Wallet
            </Text>
            <TouchableOpacity onPress={handleCloseAddFunds} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <View style={styles.bottomSheetContent}>
            <View style={styles.formField}>
              <Text variant="bodyMedium" style={[styles.fieldLabel, { color: colors.onSurface }]}>
                Amount
              </Text>
              <TextInput
                mode="outlined"
                placeholder="Enter amount"
                value={addFundsForm.amount}
                onChangeText={(text) => setAddFundsForm({ ...addFundsForm, amount: text })}
                keyboardType="numeric"
                style={[styles.textInput, { backgroundColor: colors.surfaceVariant }]}
                outlineStyle={{ borderRadius: 12 }}
                contentStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
              />
            </View>

            <View style={styles.formField}>
              <Text variant="bodyMedium" style={[styles.fieldLabel, { color: colors.onSurface }]}>
                Currency
              </Text>
              <TouchableOpacity
                style={[styles.currencyButton, { backgroundColor: colors.surfaceVariant, borderColor: colors.outline }]}
                onPress={() => setCurrencyModalVisible(true)}
              >
                <View style={styles.currencyButtonContent}>
                  <Text style={[styles.currencyButtonText, { color: colors.onSurface }]}>
                    {addFundsForm.currency}
                  </Text>
                  <Text style={[styles.currencyName, { color: colors.onSurfaceVariant }]}>
                    {SUPPORTED_CURRENCIES.find(c => c.code === addFundsForm.currency)?.name}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-down" size={24} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <Button
              mode="contained"
              onPress={handleAddFunds}
              loading={isSubmitting}
              disabled={isSubmitting || !addFundsForm.amount}
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              contentStyle={{ paddingVertical: 8 }}
              labelStyle={{ fontSize: 16, fontWeight: '600' }}
            >
              Add Funds
            </Button>
          </View>
        </View>
      </BottomSheet>

      {/* Currency Selection Modal */}
      <CurrencySelectionModal
        visible={currencyModalVisible}
        onClose={() => setCurrencyModalVisible(false)}
        onSelect={(currency) => {
          setAddFundsForm({ ...addFundsForm, currency: currency as CurrencyCode });
          setCurrencyModalVisible(false);
        }}
        selectedCurrency={addFundsForm.currency}
        currencies={SUPPORTED_CURRENCIES.map(c => ({ code: c.code, name: c.name }))}
      />
    </View>
  );
} 