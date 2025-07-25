import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Dialog, Divider, FAB, IconButton, Menu, Paragraph, Portal, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteExpense, getExpensesByUser, getGroupsForUser, getSplitExpensesForUser } from '../../firebase/firestore';
import { useAuth } from '../../hooks/useAuth';

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

  const renderExpense = ({ item }: { item: any }) => {
    const group = item.groupId ? groups.find((g: any) => g.id === item.groupId) : null;
    return (
      <Card style={[styles.card, { backgroundColor: colors.elevation?.level1 || colors.surface, borderColor: colors.outline, shadowColor: colors.shadow || '#000' }] }>
        <Card.Title
          title={item.description || 'Expense'}
          subtitle={item.category || 'Uncategorized'}
          titleStyle={{ color: colors.onSurface, fontWeight: 'bold', fontSize: 18 }}
          subtitleStyle={{ color: colors.onSurfaceVariant, fontSize: 14 }}
          right={() => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {item.isSplitShare && <Chip style={{ backgroundColor: colors.secondaryContainer, marginRight: 4 }} textStyle={{ color: colors.onSecondaryContainer, fontSize: 12 }}>Shared</Chip>}
              <IconButton icon="pencil" size={20} onPress={() => router.push(`/expenses-edit?expenseId=${item.id}`)} />
              <IconButton icon="delete" size={20} onPress={() => setDeleteDialog({ open: true, expenseId: item.id })} />
            </View>
          )}
        />
        <Card.Content>
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <MaterialCommunityIcons name="currency-usd" size={18} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.amount, { color: colors.onSurface }]}>{item.amount} {item.currency}</Text>
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
            <Chip icon="account-group" style={[styles.chip, { backgroundColor: colors.primaryContainer, marginBottom: 4 }]} textStyle={{ color: colors.onPrimaryContainer }}>{group.name}</Chip>
          )}
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {item.tags.map((tag: string) => (
                <Chip key={tag} style={[styles.tagChip, { backgroundColor: colors.secondaryContainer }]} textStyle={{ color: colors.onSecondaryContainer }}>{tag}</Chip>
              ))}
            </View>
          )}
          {item.isRecurring && item.recurrence && item.recurrence !== 'none' && (
            <Chip icon="repeat" style={[styles.chip, { backgroundColor: colors.tertiaryContainer }]} textStyle={{ color: colors.onTertiaryContainer }}>{item.recurrence}</Chip>
          )}
          {item.notes && (
            <View style={styles.notesRow}>
              <MaterialCommunityIcons name="note-text-outline" size={16} color={colors.onSurfaceVariant} style={{ marginRight: 4 }} />
              <Text style={[styles.notes, { color: colors.onSurfaceVariant }]}>{item.notes}</Text>
            </View>
          )}
        </Card.Content>
        <Divider style={{ marginVertical: 4, backgroundColor: colors.outlineVariant || colors.outline }} />
      </Card>
    );
  };

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['68%'], []);

  const testSheetRef = useRef<BottomSheet>(null);
  const testSnapPoints = useMemo(() => ['30%'], []);

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
              <Text variant="headlineLarge" style={styles.headerTitle}>My Expenses</Text>
              <Text style={styles.headerSubtitle}>View and manage your recorded expenses.</Text>
            </View>
            <IconButton icon="filter-variant" size={28} onPress={() => {
              console.log('[Filter] Filter button pressed');
              setFilterSheetOpen(true);
              if (bottomSheetRef.current) {
                console.log('[Filter] Expanding bottom sheet');
                bottomSheetRef.current.expand();
              } else {
                console.log('[Filter] bottomSheetRef.current is null');
              }
            }} style={{ marginLeft: 8 }} />
          </View>
        </View>
        {fetchError && <Text style={{ color: colors.error, textAlign: 'center', marginVertical: 8 }}>{fetchError}</Text>}
        {isLoading ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : filteredExpenses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No expenses match your filters.</Text>
            <Button mode="contained" icon="plus" onPress={() => router.push('/expenses-add')}>Add Expense</Button>
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
        <FAB
          icon="plus"
          style={[styles.fab, { bottom: 32 + insets.bottom }]}
          color={colors.onPrimary}
          onPress={() => router.push('/expenses-add')}
          visible
        />
        <BottomSheet
          ref={bottomSheetRef}
          index={filterSheetOpen ? 0 : -1}
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
              style={{ marginBottom: 18, borderRadius: 12 }}
              left={<TextInput.Icon icon="magnify" />}
              mode="outlined"
            />
            {/* Amount Row */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
              <TextInput
                label="Min Amount"
                value={filters.minAmount}
                onChangeText={v => setFilters(f => ({ ...f, minAmount: v }))}
                keyboardType="numeric"
                style={{ flex: 1, borderRadius: 12 }}
                left={<TextInput.Icon icon="arrow-down" />}
                mode="outlined"
              />
              <TextInput
                label="Max Amount"
                value={filters.maxAmount}
                onChangeText={v => setFilters(f => ({ ...f, maxAmount: v }))}
                keyboardType="numeric"
                style={{ flex: 1, borderRadius: 12 }}
                left={<TextInput.Icon icon="arrow-up" />}
                mode="outlined"
              />
            </View>
            {/* Date Row */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowStartDate(true)}>
                <TextInput
                  label="Start Date"
                  value={filters.startDate}
                  editable={false}
                  style={{ borderRadius: 12 }}
                  left={<TextInput.Icon icon="calendar" />}
                  mode="outlined"
                />
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowEndDate(true)}>
                <TextInput
                  label="End Date"
                  value={filters.endDate}
                  editable={false}
                  style={{ borderRadius: 12 }}
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
            <Text style={{ fontWeight: 'bold', color: colors.onSurfaceVariant, marginBottom: 4, marginTop: 8 }}>Currency</Text>
            <Menu
              visible={currencyMenuVisible}
              onDismiss={() => setCurrencyMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  style={{ borderRadius: 12, marginBottom: 12, justifyContent: 'flex-start' }}
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
            <Text style={{ fontWeight: 'bold', color: colors.onSurfaceVariant, marginBottom: 4, marginTop: 8 }}>Category</Text>
            <Menu
              visible={categoryMenuVisible}
              onDismiss={() => setCategoryMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  style={{ borderRadius: 12, marginBottom: 12, justifyContent: 'flex-start' }}
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
            <Text style={{ fontWeight: 'bold', color: colors.onSurfaceVariant, marginBottom: 4, marginTop: 8 }}>Group</Text>
            <Menu
              visible={groupMenuVisible}
              onDismiss={() => setGroupMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  style={{ borderRadius: 12, marginBottom: 12, justifyContent: 'flex-start' }}
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
            <Text style={{ fontWeight: 'bold', color: colors.onSurfaceVariant, marginBottom: 4, marginTop: 8 }}>Sort By</Text>
            <Menu
              visible={sortMenuVisible}
              onDismiss={() => setSortMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  style={{ borderRadius: 12, marginBottom: 12, justifyContent: 'flex-start' }}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
              <Button onPress={() => { setFilters({ searchTerm: '', currency: 'all', startDate: '', endDate: '', category: 'all', minAmount: '', maxAmount: '', groupId: 'all' }); setSort({ sortBy: 'date', sortOrder: 'desc' }); }}>Clear</Button>
              <Button onPress={() => setFilterSheetOpen(false)}>Cancel</Button>
              <Button mode="contained" onPress={() => setFilterSheetOpen(false)} style={{ borderRadius: 12, minWidth: 90 }}>Apply</Button>
            </View>
          </ScrollView>
        </BottomSheet>
        <BottomSheet
          ref={testSheetRef}
          index={0}
          snapPoints={testSnapPoints}
          enablePanDownToClose
          onClose={() => {}}
          backdropComponent={props => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />}
          backgroundStyle={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
          handleIndicatorStyle={{ backgroundColor: colors.outlineVariant || '#ccc', width: 44, height: 5, borderRadius: 3, marginTop: 8 }}
          style={{ zIndex: 200 }}
          onChange={index => console.log('[Test] Minimal BottomSheet index changed:', index)}
        >
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text>Test BottomSheet - Should Always Be Visible</Text>
          </View>
        </BottomSheet>
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
    </Surface>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 4,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 2,
    textAlign: 'left',
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'left',
  },
  card: {
    borderRadius: 18,
    marginBottom: 18,
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amount: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#222',
  },
  date: {
    color: '#888',
    fontSize: 15,
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
    alignSelf: 'flex-start',
    fontWeight: 'bold',
    fontSize: 13,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 4,
  },
  tagChip: {
    marginRight: 6,
    marginBottom: 4,
    backgroundColor: '#f3f4f6',
    fontWeight: 'bold',
    fontSize: 12,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  notes: {
    color: '#666',
    fontSize: 14,
    marginTop: 0,
  },
  fab: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    backgroundColor: '#2563eb',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
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
    color: '#888',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
}); 