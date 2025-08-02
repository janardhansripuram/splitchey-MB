import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Dialog, Divider, FAB, IconButton, Menu, Paragraph, Portal, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernButton } from '../components/ui/ModernButton';
import { ModernCard } from '../components/ui/ModernCard';
import { deleteIncome, getIncomeByUser, getExpensesByUser } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import AddIncomeSheet from './income-add';
import { EditIncomeSheet } from './income-edit';
import type { Expense, Income } from '../constants/types';

const BOTTOM_SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.68);

interface FinancialOverview {
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  savingsRate: number;
}

export default function IncomeScreen() {
  const { authUser, loading } = useAuth();
  const [incomeList, setIncomeList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; incomeId?: string }>({ open: false });
  const { colors, dark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Financial overview state
  const [financialOverview, setFinancialOverview] = useState<FinancialOverview>({
    totalIncome: 0,
    totalExpenses: 0,
    netAmount: 0,
    savingsRate: 0,
  });
  const [financialOverviewLoading, setFinancialOverviewLoading] = useState(false);

  // Add sheet state
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  // Filter/Sort State
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filters, setFilters] = useState({
    searchTerm: '',
    currency: 'all',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
  });
  const [sort, setSort] = useState({ sortBy: 'date', sortOrder: 'desc' });
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);

  // Dropdown menu state
  const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);

  // Edit sheet state
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editIncome, setEditIncome] = useState<any | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Unique currencies for dropdowns
  const uniqueCurrencies = Array.from(new Set(incomeList.map(i => i.currency))).filter(Boolean);

  // Filter/sort logic
  const filteredIncome = incomeList.filter(inc => {
    if (filters.searchTerm &&
      !inc.source?.toLowerCase().includes(filters.searchTerm.toLowerCase()) &&
      !(inc.notes && inc.notes.toLowerCase().includes(filters.searchTerm.toLowerCase()))) {
      return false;
    }
    if (filters.currency !== 'all' && inc.currency !== filters.currency) return false;
    if (filters.startDate && new Date(inc.date) < new Date(filters.startDate)) return false;
    if (filters.endDate && new Date(inc.date) > new Date(filters.endDate)) return false;
    if (filters.minAmount && Number(inc.amount) < Number(filters.minAmount)) return false;
    if (filters.maxAmount && Number(inc.amount) > Number(filters.maxAmount)) return false;
    return true;
  }).sort((a, b) => {
    let valA = a[sort.sortBy];
    let valB = b[sort.sortBy];
    if (sort.sortBy === 'amount') {
      valA = Number(a.amount);
      valB = Number(b.amount);
    } else if (sort.sortBy === 'date') {
      valA = new Date(a.date).getTime();
      valB = new Date(b.date).getTime();
    }
    if (valA < valB) return sort.sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sort.sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const [fetchError, setFetchError] = useState<string | null>(null);

  const calculateFinancialOverview = useCallback(async () => {
    if (!authUser) return;
    
    setFinancialOverviewLoading(true);
    try {
      // Get current month's data
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get income data (already fetched)
      const currentMonthIncome = incomeList.filter(incomeItem => {
        const incomeDate = new Date(incomeItem.date);
        return incomeDate >= startOfMonth && incomeDate <= endOfMonth;
      });

      // Get expenses data
      const expenses = await getExpensesByUser(authUser.uid);
      const currentMonthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startOfMonth && expenseDate <= endOfMonth;
      });

      // Calculate totals
      const totalIncome = currentMonthIncome.reduce((sum, item) => sum + item.amount, 0);
      const totalExpenses = currentMonthExpenses.reduce((sum, item) => sum + item.amount, 0);
      const netAmount = totalIncome - totalExpenses;
      const savingsRate = totalIncome > 0 ? (netAmount / totalIncome) * 100 : 0;

      setFinancialOverview({
        totalIncome,
        totalExpenses,
        netAmount,
        savingsRate,
      });
    } catch (error) {
      console.error('Error calculating financial overview:', error);
      // Set default values if calculation fails
      setFinancialOverview({
        totalIncome: 0,
        totalExpenses: 0,
        netAmount: 0,
        savingsRate: 0,
      });
    } finally {
      setFinancialOverviewLoading(false);
    }
  }, [authUser, incomeList]);

  const fetchData = useCallback(async () => {
    if (!authUser) {
      console.log('No auth user, skipping fetch');
      return;
    }
    console.log('Starting to fetch income data...');
    setIsLoading(true);
    setFetchError(null);
    try {
      const userIncome = await getIncomeByUser(authUser.uid);
      console.log('Fetched income data:', userIncome.length, 'records');
      setIncomeList(userIncome);
    } catch (error) {
      console.error('Failed to fetch income data:', error);
      setFetchError('Failed to load income data');
    } finally {
      console.log('Setting loading to false');
      setIsLoading(false);
    }
  }, [authUser]);

  // Calculate financial overview separately after income data is loaded
  useEffect(() => {
    // Temporarily disabled for debugging
    /*
    if (incomeList.length > 0 && authUser && !isLoading) {
      calculateFinancialOverview();
    }
    */
  }, [incomeList, authUser, isLoading, calculateFinancialOverview]);

  const onRefresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (authUser && !loading) {
      fetchData();
    }
  }, [authUser, loading, fetchData]);

  const handleDelete = async (incomeId: string) => {
    try {
      await deleteIncome(incomeId);
      setDeleteDialog({ open: false });
      fetchData(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete income:', error);
      Alert.alert('Error', 'Failed to delete income');
    }
  };

  const renderIncome = ({ item }: { item: any }) => {
    const formatCurrency = (amount: number, currency: string) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
      }).format(amount);
    };

    return (
      <ModernCard key={item.id} style={styles.incomeCard}>
        <View style={styles.incomeHeader}>
          <View style={styles.incomeInfo}>
            <Text variant="titleMedium" style={styles.incomeSource}>
              {item.source}
            </Text>
            <Text variant="bodySmall" style={styles.incomeDate}>
              {format(new Date(item.date), 'MMM dd, yyyy')}
            </Text>
          </View>
          <Text variant="titleLarge" style={[styles.incomeAmount, { color: colors.primary }]}>
            {formatCurrency(item.amount, item.currency)}
          </Text>
        </View>
        
        {item.notes && (
          <Text variant="bodySmall" style={styles.incomeNotes}>
            {item.notes}
          </Text>
        )}

        <View style={styles.incomeFooter}>
          <Chip icon="currency-usd" compact>
            {item.currency}
          </Chip>
          {item.isRecurring && (
            <Chip icon="repeat" compact>
              {item.recurrence}
            </Chip>
          )}
        </View>

        <View style={styles.incomeActions}>
          <IconButton
            icon="pencil"
            size={20}
            onPress={() => {
              setEditIncome(item);
              setEditSheetOpen(true);
            }}
          />
          <IconButton
            icon="delete"
            size={20}
            onPress={() => setDeleteDialog({ open: true, incomeId: item.id })}
          />
        </View>
      </ModernCard>
    );
  };

  const handleEditSave = async (updated: any) => {
    setEditLoading(true);
    try {
      // Update logic will be handled in the edit sheet
      setEditSheetOpen(false);
      setEditIncome(null);
      fetchData(); // Refresh the list
    } catch (error) {
      console.error('Failed to update income:', error);
      Alert.alert('Error', 'Failed to update income');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Surface style={styles.header} elevation={1}>
        <View style={styles.headerContent}>
          <Text variant="headlineSmall" style={styles.title}>
            Income
          </Text>
          <View style={styles.headerActions}>
            <IconButton
              icon="filter-variant"
              size={24}
              onPress={() => setFilterSheetOpen(true)}
            />
            <Menu
              visible={sortMenuVisible}
              onDismiss={() => setSortMenuVisible(false)}
              anchor={
                <IconButton
                  icon="sort"
                  size={24}
                  onPress={() => setSortMenuVisible(true)}
                />
              }
            >
              <Menu.Item
                title="Date (Newest)"
                onPress={() => {
                  setSort({ sortBy: 'date', sortOrder: 'desc' });
                  setSortMenuVisible(false);
                }}
              />
              <Menu.Item
                title="Date (Oldest)"
                onPress={() => {
                  setSort({ sortBy: 'date', sortOrder: 'asc' });
                  setSortMenuVisible(false);
                }}
              />
              <Menu.Item
                title="Amount (High to Low)"
                onPress={() => {
                  setSort({ sortBy: 'amount', sortOrder: 'desc' });
                  setSortMenuVisible(false);
                }}
              />
              <Menu.Item
                title="Amount (Low to High)"
                onPress={() => {
                  setSort({ sortBy: 'amount', sortOrder: 'asc' });
                  setSortMenuVisible(false);
                }}
              />
            </Menu>
          </View>
        </View>
      </Surface>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : fetchError ? (
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={styles.errorText}>
            {fetchError}
          </Text>
          <Button mode="contained" onPress={fetchData} style={styles.retryButton}>
            Retry
          </Button>
        </View>
      ) : (
        <>
          {/* Financial Overview Section */}
          {/* Temporarily disabled for debugging
          <View style={styles.financialOverviewContainer}>
            <Surface style={styles.financialOverviewCard} elevation={2}>
              <Text variant="titleMedium" style={styles.financialOverviewTitle}>
                Financial Overview (This Month)
              </Text>
              {financialOverviewLoading ? (
                <View style={styles.financialOverviewLoading}>
                  <ActivityIndicator size="small" />
                  <Text variant="bodySmall" style={styles.financialOverviewLoadingText}>
                    Calculating...
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.financialOverviewRow}>
                    <View style={styles.financialOverviewItem}>
                      <Text variant="bodySmall" style={styles.financialOverviewLabel}>
                        Income
                      </Text>
                      <Text variant="titleMedium" style={[styles.financialOverviewValue, { color: colors.primary }]}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(financialOverview.totalIncome)}
                      </Text>
                    </View>
                    <View style={styles.financialOverviewItem}>
                      <Text variant="bodySmall" style={styles.financialOverviewLabel}>
                        Expenses
                      </Text>
                      <Text variant="titleMedium" style={[styles.financialOverviewValue, { color: colors.error }]}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(financialOverview.totalExpenses)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.netAmountContainer}>
                    <Text variant="bodySmall" style={styles.financialOverviewLabel}>
                      Net Amount
                    </Text>
                    <Text variant="headlineSmall" style={[
                      styles.netAmountValue,
                      { color: financialOverview.netAmount >= 0 ? colors.primary : colors.error }
                    ]}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(financialOverview.netAmount)}
                    </Text>
                    <Text variant="bodySmall" style={styles.savingsRate}>
                      {financialOverview.savingsRate >= 0 ? '+' : ''}{financialOverview.savingsRate.toFixed(1)}% savings rate
                    </Text>
                  </View>
                </>
              )}
            </Surface>
          </View>
          */}

          <FlatList
          data={filteredIncome}
          renderItem={renderIncome}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="trending-up"
                size={64}
                color={colors.outline}
              />
              <Text variant="titleMedium" style={styles.emptyTitle}>
                No Income Records
              </Text>
              <Text variant="bodyMedium" style={styles.emptySubtitle}>
                Start by adding your first income record
              </Text>
            </View>
          }
        />
      </>
      )}

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setAddSheetOpen(true)}
      />

      {/* Add Income Sheet */}
      <AddIncomeSheet
        visible={addSheetOpen}
        onDismiss={() => setAddSheetOpen(false)}
        onSave={async (incomeData) => {
          setAddSheetOpen(false);
          fetchData(); // Refresh the list
        }}
      />

      {/* Edit Income Sheet */}
      <EditIncomeSheet
        visible={editSheetOpen}
        income={editIncome}
        onDismiss={() => {
          setEditSheetOpen(false);
          setEditIncome(null);
        }}
        onSave={handleEditSave}
        loading={editLoading}
      />

      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog visible={deleteDialog.open} onDismiss={() => setDeleteDialog({ open: false })}>
          <Dialog.Title>Delete Income</Dialog.Title>
          <Dialog.Content>
            <Paragraph>Are you sure you want to delete this income record? This action cannot be undone.</Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialog({ open: false })}>Cancel</Button>
            <Button
              onPress={() => deleteDialog.incomeId && handleDelete(deleteDialog.incomeId)}
              textColor={colors.error}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerActions: {
    flexDirection: 'row',
  },
  listContainer: {
    padding: 16,
  },
  incomeCard: {
    marginBottom: 12,
    padding: 16,
  },
  incomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  incomeInfo: {
    flex: 1,
  },
  incomeSource: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  incomeDate: {
    opacity: 0.7,
  },
  incomeAmount: {
    fontWeight: 'bold',
  },
  incomeNotes: {
    marginBottom: 8,
    opacity: 0.8,
  },
  incomeFooter: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  incomeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
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
  errorText: {
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
  },
  financialOverviewContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  financialOverviewCard: {
    padding: 16,
    borderRadius: 8,
  },
  financialOverviewTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  financialOverviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  financialOverviewItem: {
    alignItems: 'center',
  },
  financialOverviewLabel: {
    opacity: 0.7,
    marginBottom: 4,
  },
  financialOverviewValue: {
    fontWeight: 'bold',
  },
  netAmountContainer: {
    alignItems: 'center',
  },
  netAmountValue: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  savingsRate: {
    opacity: 0.7,
  },
  financialOverviewLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  financialOverviewLoadingText: {
    marginLeft: 8,
    opacity: 0.7,
  },
}); 