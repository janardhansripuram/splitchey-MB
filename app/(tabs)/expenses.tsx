import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Dialog, Divider, FAB, IconButton, Menu, Paragraph, Portal, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernButton } from '../../components/ui/ModernButton';
import { ModernCard } from '../../components/ui/ModernCard';
import { deleteExpense, getExpensesByUser, getGroupsForUser, getSplitExpensesForUser, updateExpense } from '../../firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import AddExpensesSheet from '../expenses-add';
import ExpensesEditModal from '../expenses-edit-modal';

const BOTTOM_SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.68);

export default function ExpensesScreen() {
  const { authUser, loading } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; expenseId?: string }>({ open: false });
  const { colors, dark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Add sheet state
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  
  // Edit sheet state
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Filter/Sort State
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filters, setFilters] = useState({
    searchTerm: '',
    currency: 'all',
    startDate: '',
    endDate: '',
    category: 'all',
    minAmount: '',
    maxAmount: '',
    groupId: 'all',
  });
  const [sort, setSort] = useState({ sortBy: 'date', sortOrder: 'desc' });
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);

  // Dropdown menu state
  const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [groupMenuVisible, setGroupMenuVisible] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);



  // Unique categories/currencies/groups for dropdowns
  const uniqueCategories = Array.from(new Set(expenses.map(e => e.category))).filter(Boolean);
  const uniqueCurrencies = Array.from(new Set(expenses.map(e => e.currency))).filter(Boolean);

  // Filter/sort logic
  const filteredExpenses = expenses.filter(exp => {
    if (filters.searchTerm &&
      !exp.description?.toLowerCase().includes(filters.searchTerm.toLowerCase()) &&
      !(exp.tags && exp.tags.some((tag: string) => tag.toLowerCase().includes(filters.searchTerm.toLowerCase())))) {
      return false;
    }
    if (filters.currency !== 'all' && exp.currency !== filters.currency) return false;
    if (filters.startDate && new Date(exp.date) < new Date(filters.startDate)) return false;
    if (filters.endDate && new Date(exp.date) > new Date(filters.endDate)) return false;
    if (filters.category !== 'all' && exp.category !== filters.category) return false;
    if (filters.minAmount && Number(exp.amount) < Number(filters.minAmount)) return false;
    if (filters.maxAmount && Number(exp.amount) > Number(filters.maxAmount)) return false;
    if (filters.groupId !== 'all') {
      if (filters.groupId === 'personal' && exp.groupId) return false;
      if (filters.groupId !== 'personal' && exp.groupId !== filters.groupId) return false;
    }
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

  const fetchData = useCallback(async () => {
    if (!authUser) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      console.log('[Expenses] Fetching for user:', authUser.uid);
      const [expensesList, splitExpensesList, groupsList] = await Promise.all([
        getExpensesByUser(authUser.uid),
        getSplitExpensesForUser(authUser.uid),
        getGroupsForUser(authUser.uid),
      ]);
      const expenseIds = new Set(expensesList.map((e: any) => e.id));
      const splitExpenses = (splitExpensesList || []).map((split: any) => {
        let dateStr = '';
        if (typeof split.createdAt === 'string') {
          dateStr = split.createdAt.split('T')[0];
        } else if (split.createdAt && split.createdAt.toDate) {
          dateStr = split.createdAt.toDate().toISOString().split('T')[0];
        }
        return {
          ...split,
          isSplitShare: true,
          description: split.originalExpenseDescription,
          amount: split.totalAmount,
          currency: split.currency,
          category: split.category || 'Shared',
          date: dateStr,
          groupId: split.groupId,
          groupName: split.groupName,
          notes: split.notes,
          originalExpenseId: split.originalExpenseId,
        };
      }).filter(split => !expenseIds.has(split.originalExpenseId));
      const allExpenses = [...expensesList, ...splitExpenses];
      setExpenses(allExpenses);
      setGroups(groupsList);
    } catch (e) {
      setFetchError('Failed to fetch expenses.');
      console.error('[Expenses] Fetch error:', e);
    }
    setIsLoading(false);
  }, [authUser]);

  useEffect(() => {
    if (!loading && authUser) {
      fetchData();
    }
  }, [authUser, loading, fetchData]);

  const handleDelete = async (expenseId: string) => {
    setDeleteDialog({ open: false });
    try {
      await deleteExpense(expenseId);
      fetchData();
    } catch (e) {
      Alert.alert('Error', 'Failed to delete expense.');
    }
  };

  const handleEditSave = async (updatedExpense: any) => {
    setEditLoading(true);
    try {
      // Update the expense in Firebase
      await updateExpense(editExpense.id, updatedExpense);
      setEditSheetOpen(false);
      setEditExpense(null);
      fetchData();
    } catch (e) {
      Alert.alert('Error', 'Failed to update expense.');
    } finally {
      setEditLoading(false);
    }
  };

  // In renderExpense, pass the entire expense object:
  const renderExpense = ({ item }: { item: any }) => {
    const group = item.groupId ? groups.find((g: any) => g.id === item.groupId) : null;
    return (
      <ModernCard
        style={{
          backgroundColor: colors.elevation.level1,
          borderColor: colors.outlineVariant || colors.outline,
          shadowColor: colors.shadow || '#000',
          borderRadius: 16, // Apply directly here
          marginBottom: 16, // Apply directly here
          elevation: 4, // Apply directly here
          shadowOpacity: 0.08, // Apply directly here
          shadowRadius: 8, // Apply directly here
          borderWidth: 1, // Apply directly here
          padding: 16, // Apply directly here
        }}
      >
        <View style={styles.expenseHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.expenseTitle, { color: colors.onSurface }]}>
              {item.description || 'Expense'}
            </Text>
            <Text style={[styles.expenseCategory, { color: colors.primary }]}>
              {item.category || 'Uncategorized'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton
              icon="pencil"
              size={20}
              onPress={() => {
                setEditExpense(item);
                setEditSheetOpen(true);
              }}
              iconColor={colors.primary}
            />
            <IconButton
              icon="delete"
              size={20}
              onPress={() => setDeleteDialog({ open: true, expenseId: item.id })}
              iconColor={colors.error}
            />
          </View>
        </View>
        <Divider style={{ marginVertical: 6, backgroundColor: colors.outlineVariant || colors.outline }} />
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <MaterialCommunityIcons name="currency-usd" size={20} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.amount, { color: colors.primary }]}>{item.amount} {item.currency}</Text>
          </View>
          <View style={styles.rowItem}>
            <MaterialCommunityIcons name="calendar" size={16} color={colors.onSurfaceVariant} style={{ marginRight: 2 }} />
            <Text style={[styles.date, { color: colors.onSurfaceVariant }]}>
              {item.date && !isNaN(new Date(item.date).getTime())
                ? format(new Date(item.date), 'MMM dd, yyyy')
                : 'No date'}
            </Text>
          </View>
        </View>
        {group && (
          <Chip
            icon="account-group"
            style={[
              styles.chip,
              { backgroundColor: colors.primaryContainer, marginBottom: 4 },
            ]}
            textStyle={{ color: colors.onPrimaryContainer }}
          >
            {group.name}
          </Chip>
        )}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {item.tags.map((tag: string) => (
              <Chip
                key={tag}
                style={[
                  styles.tagChip,
                  { backgroundColor: colors.secondaryContainer },
                ]}
                textStyle={{ color: colors.onSecondaryContainer }}
              >
                {tag}
              </Chip>
            ))}
          </View>
        )}
        {item.isRecurring && item.recurrence && item.recurrence !== 'none' && (
          <Chip
            icon="repeat"
            style={[
              styles.chip,
              { backgroundColor: colors.tertiaryContainer },
            ]}
            textStyle={{ color: colors.onTertiaryContainer }}
          >
            {item.recurrence}
          </Chip>
        )}
        {item.notes && (
          <View style={styles.notesRow}>
            <MaterialCommunityIcons name="note-text-outline" size={16} color={colors.onSurfaceVariant} style={{ marginRight: 4 }} />
            <Text style={[styles.notes, { color: colors.onSurfaceVariant }]}>{item.notes}</Text>
          </View>
        )}
      </ModernCard>
    );
  };

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['68%'], []);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);



  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text variant="headlineLarge" style={[styles.headerTitle, { color: colors.onBackground }]}>My Expenses</Text>
              <Text style={[styles.headerSubtitle, { color: colors.onSurfaceVariant }]}>View and manage your recorded expenses.</Text>
            </View>
            <IconButton icon="filter-variant" size={28} onPress={() => {
              setFilterSheetOpen(true);
              if (bottomSheetRef.current) bottomSheetRef.current.expand();
            }} style={{ marginLeft: 8 }} iconColor={colors.primary} />
          </View>
        </View>
        {fetchError && <Text style={{ color: colors.error, textAlign: 'center', marginVertical: 8 }}>{fetchError}</Text>}
        {isLoading ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : filteredExpenses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="file-document-outline" size={60} color={colors.primary + (dark ? '55' : '99')} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No expenses match your filters.</Text>
            <ModernButton variant="primary" icon="plus" onPress={() => setAddSheetOpen(true)} title="Add Expense" style={{ marginTop: 8, borderRadius: 16, minWidth: 160 }} />
          </View>
        ) : (
          <FlatList
            data={filteredExpenses}
            keyExtractor={item => item.id}
            renderItem={renderExpense}
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            scrollEnabled={false}
          />
        )}
        {filterSheetOpen && (
          <BottomSheet
            ref={bottomSheetRef}
            index={0}
            snapPoints={snapPoints}
            enablePanDownToClose
            onClose={() => setFilterSheetOpen(false)}
            backdropComponent={props => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />}
            backgroundStyle={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
            handleIndicatorStyle={{ backgroundColor: colors.outlineVariant || '#ccc', width: 44, height: 5, borderRadius: 3, marginTop: 8 }}
            style={{ zIndex: 100 }}
            onChange={index => console.log('[Filter] BottomSheet index changed:', index)}
          >
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            <Text style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 20, marginBottom: 8 }}>Filter & Sort</Text>
            {/* Search */}
            <TextInput
              label="Search"
              value={filters.searchTerm}
              onChangeText={v => setFilters(f => ({ ...f, searchTerm: v }))}
              style={{ marginBottom: 16, borderRadius: 12, backgroundColor: colors.surface }}
              left={<TextInput.Icon icon="magnify" />}
              mode="outlined"
            />
            {/* Amount Row */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <TextInput
                label="Min Amount"
                value={filters.minAmount}
                onChangeText={v => setFilters(f => ({ ...f, minAmount: v }))}
                keyboardType="numeric"
                style={{ flex: 1, borderRadius: 12, backgroundColor: colors.surface }}
                left={<TextInput.Icon icon="arrow-down" />}
                mode="outlined"
              />
              <TextInput
                label="Max Amount"
                value={filters.maxAmount}
                onChangeText={v => setFilters(f => ({ ...f, maxAmount: v }))}
                keyboardType="numeric"
                style={{ flex: 1, borderRadius: 12, backgroundColor: colors.surface }}
                left={<TextInput.Icon icon="arrow-up" />}
                mode="outlined"
              />
            </View>
            {/* Date Row */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowStartDate(true)}>
                <TextInput
                  label="Start Date"
                  value={filters.startDate}
                  editable={false}
                  style={{ borderRadius: 12, backgroundColor: colors.surface }}
                  left={<TextInput.Icon icon="calendar" />}
                  mode="outlined"
                />
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowEndDate(true)}>
                <TextInput
                  label="End Date"
                  value={filters.endDate}
                  editable={false}
                  style={{ borderRadius: 12, backgroundColor: colors.surface }}
                  left={<TextInput.Icon icon="calendar" />}
                  mode="outlined"
                />
              </TouchableOpacity>
            </View>
            {showStartDate && (
              <DateTimePicker
                value={filters.startDate ? new Date(filters.startDate) : new Date()}
                mode="date"
                display="default"
                onChange={(_, date) => {
                  setShowStartDate(false);
                  if (date) setFilters(f => ({ ...f, startDate: date.toISOString().split('T')[0] }));
                }}
              />
            )}
            {showEndDate && (
              <DateTimePicker
                value={filters.endDate ? new Date(filters.endDate) : new Date()}
                mode="date"
                display="default"
                onChange={(_, date) => {
                  setShowEndDate(false);
                  if (date) setFilters(f => ({ ...f, endDate: date.toISOString().split('T')[0] }));
                }}
              />
            )}
            {/* Dropdowns */}
            <Text style={{ fontWeight: 'bold', color: colors.onSurfaceVariant, marginBottom: 8, marginTop: 8 }}>Currency</Text>
            <Menu
              visible={currencyMenuVisible}
              onDismiss={() => setCurrencyMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  style={{ borderRadius: 12, marginBottom: 16, justifyContent: 'flex-start', backgroundColor: colors.surface }}
                  icon="currency-usd"
                  onPress={() => setCurrencyMenuVisible(true)}
                  contentStyle={{ flexDirection: 'row-reverse' }}
                >
                  {filters.currency === 'all' ? 'All' : filters.currency}
                </Button>
              }
            >
              <Menu.Item onPress={() => { setFilters(f => ({ ...f, currency: 'all' })); setCurrencyMenuVisible(false); }} title="All" />
              {uniqueCurrencies.map(curr => (
                <Menu.Item key={curr} onPress={() => { setFilters(f => ({ ...f, currency: curr })); setCurrencyMenuVisible(false); }} title={curr} />
              ))}
            </Menu>
            <Text style={{ fontWeight: 'bold', color: colors.onSurfaceVariant, marginBottom: 8, marginTop: 8 }}>Category</Text>
            <Menu
              visible={categoryMenuVisible}
              onDismiss={() => setCategoryMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  style={{ borderRadius: 12, marginBottom: 16, justifyContent: 'flex-start', backgroundColor: colors.surface }}
                  icon="tag"
                  onPress={() => setCategoryMenuVisible(true)}
                  contentStyle={{ flexDirection: 'row-reverse' }}
                >
                  {filters.category === 'all' ? 'All' : filters.category}
                </Button>
              }
            >
              <Menu.Item onPress={() => { setFilters(f => ({ ...f, category: 'all' })); setCategoryMenuVisible(false); }} title="All" />
              {uniqueCategories.map(cat => (
                <Menu.Item key={cat} onPress={() => { setFilters(f => ({ ...f, category: cat })); setCategoryMenuVisible(false); }} title={cat} />
              ))}
            </Menu>
            <Text style={{ fontWeight: 'bold', color: colors.onSurfaceVariant, marginBottom: 8, marginTop: 8 }}>Group</Text>
            <Menu
              visible={groupMenuVisible}
              onDismiss={() => setGroupMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  style={{ borderRadius: 12, marginBottom: 16, justifyContent: 'flex-start', backgroundColor: colors.surface }}
                  icon="account-group"
                  onPress={() => setGroupMenuVisible(true)}
                  contentStyle={{ flexDirection: 'row-reverse' }}
                >
                  {filters.groupId === 'all' ? 'All' : filters.groupId === 'personal' ? 'Personal' : (groups.find(g => g.id === filters.groupId)?.name || '')}
                </Button>
              }
            >
              <Menu.Item onPress={() => { setFilters(f => ({ ...f, groupId: 'all' })); setGroupMenuVisible(false); }} title="All" />
              <Menu.Item onPress={() => { setFilters(f => ({ ...f, groupId: 'personal' })); setGroupMenuVisible(false); }} title="Personal" />
              {groups.map(group => (
                <Menu.Item key={group.id} onPress={() => { setFilters(f => ({ ...f, groupId: group.id })); setGroupMenuVisible(false); }} title={group.name} />
              ))}
            </Menu>
            {/* Sort Section */}
            <Text style={{ fontWeight: 'bold', color: colors.onSurfaceVariant, marginBottom: 8, marginTop: 8 }}>Sort By</Text>
            <Menu
              visible={sortMenuVisible}
              onDismiss={() => setSortMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  style={{ borderRadius: 12, marginBottom: 16, justifyContent: 'flex-start', backgroundColor: colors.surface }}
                  icon="sort"
                  onPress={() => setSortMenuVisible(true)}
                  contentStyle={{ flexDirection: 'row-reverse' }}
                >
                  {sort.sortBy === 'date' ? 'Date' : sort.sortBy === 'amount' ? 'Amount' : sort.sortBy.charAt(0).toUpperCase() + sort.sortBy.slice(1)}
                </Button>
              }
            >
              <Menu.Item onPress={() => { setSort(s => ({ ...s, sortBy: 'date' })); setSortMenuVisible(false); }} title="Date" />
              <Menu.Item onPress={() => { setSort(s => ({ ...s, sortBy: 'amount' })); setSortMenuVisible(false); }} title="Amount" />
              <Menu.Item onPress={() => { setSort(s => ({ ...s, sortBy: 'category' })); setSortMenuVisible(false); }} title="Category" />
            </Menu>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontWeight: 'bold', color: colors.onSurfaceVariant, marginRight: 8 }}>Order</Text>
              <Button
                mode={sort.sortOrder === 'asc' ? 'contained' : 'outlined'}
                style={{ borderRadius: 12, marginRight: 8 }}
                onPress={() => setSort(s => ({ ...s, sortOrder: 'asc' }))}
              >
                Asc
              </Button>
              <Button
                mode={sort.sortOrder === 'desc' ? 'contained' : 'outlined'}
                style={{ borderRadius: 12 }}
                onPress={() => setSort(s => ({ ...s, sortOrder: 'desc' }))}
              >
                Desc
              </Button>
            </View>
            {/* Actions at the bottom of the sheet */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 }}>
              <Button onPress={() => { setFilters({ searchTerm: '', currency: 'all', startDate: '', endDate: '', category: 'all', minAmount: '', maxAmount: '', groupId: 'all' }); setSort({ sortBy: 'date', sortOrder: 'desc' }); }}>Clear</Button>
              <Button onPress={() => setFilterSheetOpen(false)}>Cancel</Button>
              <Button mode="contained" onPress={() => setFilterSheetOpen(false)} style={{ borderRadius: 12, minWidth: 90 }}>Apply</Button>
            </View>
          </ScrollView>
        </BottomSheet>
        )}
        <Portal>
          <Dialog visible={deleteDialog.open} onDismiss={() => setDeleteDialog({ open: false })}>
            <Dialog.Title>Delete Expense?</Dialog.Title>
            <Dialog.Content>
              <Paragraph>Are you sure you want to delete this expense? This action cannot be undone.</Paragraph>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setDeleteDialog({ open: false })}>Cancel</Button>
              <Button onPress={() => handleDelete(deleteDialog.expenseId!)} mode="contained" color={colors.error}>Delete</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </ScrollView>

      {/* FAB is now outside the ScrollView and will float */}
      <FAB
        icon="plus"
        style={[
          styles.fab,
          { bottom: 4 + insets.bottom, backgroundColor: colors.primary }
        ]}
        color={colors.onPrimary}
        onPress={() => setAddSheetOpen(true)}
        visible
      />

      {/* Add Expense Bottom Sheet */}
      <AddExpensesSheet
        visible={addSheetOpen}
        onClose={() => {
          setAddSheetOpen(false);
          fetchData();
        }}
      />

      {/* Edit Expense Modal */}
      <ExpensesEditModal
        visible={editSheetOpen}
        expense={editExpense}
        onClose={() => {
          setEditSheetOpen(false);
          setEditExpense(null);
        }}
        onSave={handleEditSave}
        loading={editLoading}
      />

    </Surface>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'left',
    fontSize: 32,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'left',
  },
  card: {
    // These styles are now applied directly in the component, but keeping for reference if needed elsewhere
    // borderRadius: 16,
    // marginBottom: 16,
    // elevation: 4,
    // shadowColor: '#000',
    // shadowOpacity: 0.08,
    // shadowRadius: 8,
    // borderWidth: 1,
    // padding: 16,
  },
  expenseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  expenseTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  expenseCategory: {
    fontSize: 15,
    marginBottom: 2,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amount: {
    fontWeight: 'bold',
    fontSize: 22,
  },
  date: {
    fontSize: 15,
    fontWeight: '500',
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
    alignSelf: 'flex-start',
    fontWeight: 'bold',
    fontSize: 13,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    marginBottom: 6,
  },
  tagChip: {
    marginRight: 8,
    marginBottom: 4,
    fontWeight: 'bold',
    fontSize: 13,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  notes: {
    fontSize: 15,
    marginTop: 0,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    backgroundColor: undefined, // Use theme color in component
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    borderRadius: 32,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 17,
    marginBottom: 18,
    textAlign: 'center',
    fontWeight: '500',
  },
});