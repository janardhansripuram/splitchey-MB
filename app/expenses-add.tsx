import { ModernInput } from '@/components/ui/ModernInput';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { Image, Keyboard, ScrollView, TouchableOpacity, View, Platform } from 'react-native';
import { ActivityIndicator, Divider, Modal, Portal, Snackbar, Switch, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { ModernButton } from '../components/ui/ModernButton';
import { CategorySelectionModal } from '../components/CategorySelectionModal';
import { EnhancedDatePicker } from '../components/ui/EnhancedDatePicker';
import { HapticButton } from '../components/ui/HapticButton';
import { SUPPORTED_CURRENCIES, CurrencyCode, SettlementStatus } from '../constants/types';
import { getCategoryIcon, getCategoryLabel } from '../constants/categories';
import { addExpense, createSplitExpense, getFriends, getGroupsForUser } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useOffline } from '../hooks/useOffline';
import { offlineManager } from '../lib/offline/OfflineManager';

const recurrenceOptions = [
  { label: 'None', value: 'none' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

const splitMethods = [
  { label: 'Equally', value: 'equally' },
  { label: 'By Amount', value: 'byAmount' },
  { label: 'By Percentage', value: 'byPercentage' },
];

export default function AddExpensesSheet({ visible, onClose, groupId: initialGroupId }: { visible: boolean; onClose: () => void; groupId?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { authUser, userProfile } = useAuth();
  const { isOnline } = useOffline();
  const params = useLocalSearchParams<{
    amount?: string;
    description?: string;
    category?: string;
    fromCamera?: string;
  }>();

  // Form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [currencyModal, setCurrencyModal] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [recurrenceModal, setRecurrenceModal] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [splitMethod, setSplitMethod] = useState<'equally' | 'byAmount' | 'byPercentage'>('equally');
  const [splitMethodModal, setSplitMethodModal] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(initialGroupId);
  const [groupModal, setGroupModal] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [paidBy, setPaidBy] = useState('');
  const [paidByModal, setPaidByModal] = useState(false);
  const [ocrImage, setOcrImage] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [splitError, setSplitError] = useState('');
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Error states
  const [amountError, setAmountError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [currencyError, setCurrencyError] = useState('');
  const [dateError, setDateError] = useState('');
  const [formError, setFormError] = useState('');

  // Handle pre-filled data from camera
  useEffect(() => {
    if (params.fromCamera === 'true') {
      if (params.amount) setAmount(params.amount);
      if (params.description) setDescription(params.description);
      if (params.category) setCategory(params.category);
    }
  }, [params]);

  // Fetch groups and friends
  useEffect(() => {
    if (!authUser) return;
    
      const fetchData = async () => {
    setIsLoadingData(true);
    try {
      if (isOnline) {
        // Fetch from Firebase when online with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        );
        
        const dataPromise = Promise.all([
          getGroupsForUser(authUser.uid),
          getFriends(authUser.uid)
        ]);
        
        const result = await Promise.race([dataPromise, timeoutPromise]) as [any[], any[]];
        const [groupsData, friendsData] = result;
        setGroups(groupsData);
        setFriends(friendsData);
        
        // Cache the data for offline use
        await offlineManager.cacheUserData('groups', groupsData);
        await offlineManager.cacheUserData('friends', friendsData);
      } else {
        // Use cached data when offline
        const [cachedGroups, cachedFriends] = await Promise.all([
          offlineManager.getCachedUserData('groups'),
          offlineManager.getCachedUserData('friends')
        ]);
        setGroups(cachedGroups || []);
        setFriends(cachedFriends || []);
      }
    } catch (error) {
      console.error('[AddExpense] Failed to fetch groups/friends:', error);
      // Set empty arrays to prevent hanging
      setGroups([]);
      setFriends([]);
    } finally {
      setIsLoadingData(false);
    }
  };
    
    fetchData();
  }, [authUser, isOnline]);

  // Split participants
  useEffect(() => {
    if (showSplit) {
      let baseList = [{ uid: authUser?.uid, displayName: userProfile?.displayName || 'You' }, ...friends];
      setParticipants(baseList.map((p: any) => ({ ...p, selected: true, amount: '', percentage: '' })));
      setPaidBy(authUser?.uid || '');
    } else {
      setParticipants([]);
      setPaidBy(authUser?.uid || '');
    }
  }, [showSplit, friends, authUser, userProfile]);

  // Validation
  const validateForm = () => {
    let hasError = false;
    setAmountError('');
    setDescriptionError('');
    setCategoryError('');
    setCurrencyError('');
    setDateError('');
    setFormError('');

    if (!amount || isNaN(Number(amount))) {
      setAmountError('Amount is required and must be a valid number.');
      hasError = true;
    }
    if (!description) {
      setDescriptionError('Description is required.');
      hasError = true;
    }
    if (!category) {
      setCategoryError('Category is required.');
      hasError = true;
    }
    if (!currency) {
      setCurrencyError('Currency is required.');
      hasError = true;
    }
    if (!date) {
      setDateError('Date is required.');
      hasError = true;
    }
    return !hasError;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) {
      setFormError('Please fill all required fields.');
      setSnackbar({ visible: true, message: 'Please fill all required fields.' });
      return;
    }
    setLoading(true);
    try {
      const expenseData = {
        description,
        amount,
        currency,
        category,
        date,
        notes,
        tags,
        isRecurring: recurrence !== 'none',
        recurrence,
        recurrenceEndDate: recurrence !== 'none' && recurrenceEndDate ? recurrenceEndDate : undefined,
        groupId: selectedGroup === 'personal' ? undefined : selectedGroup,
        groupName: selectedGroup === 'personal' ? undefined : groups.find(g => g.id === selectedGroup)?.name,
      };
      let expenseId: string;
      if (showSplit) {
        // Validate split participants
        const selectedParticipants = participants.filter(p => p.selected);
        if (selectedParticipants.length < 2) {
          setSplitError('Please select at least two participants for a split expense.');
          setSnackbar({ visible: true, message: 'Please select at least two participants for a split expense.' });
          setLoading(false);
          return;
        }

        let totalAmountForSplit = parseFloat(amount);
        if (isNaN(totalAmountForSplit) || totalAmountForSplit <= 0) {
          setSplitError('Please enter a valid amount for the split expense.');
          setSnackbar({ visible: true, message: 'Please enter a valid amount for the split expense.' });
          setLoading(false);
          return;
        }

        const splitParticipantsData = selectedParticipants.map(p => {
          let amountOwed = 0;
          let percentage = 0;

          if (splitMethod === 'byAmount') {
            amountOwed = parseFloat(p.amount);
            if (isNaN(amountOwed) || amountOwed < 0) {
              throw new Error(`Invalid amount for participant ${p.displayName || p.email}`);
            }
          } else if (splitMethod === 'byPercentage') {
            percentage = parseFloat(p.percentage);
            if (isNaN(percentage) || percentage < 0) {
              throw new Error(`Invalid percentage for participant ${p.displayName || p.email}`);
            }
            amountOwed = (totalAmountForSplit * percentage) / 100; // Will be re-calculated in backend
          } else { // Equally
            amountOwed = totalAmountForSplit / selectedParticipants.length; // Will be re-calculated in backend
          }

          return {
            userId: p.uid,
            displayName: p.displayName || p.email || 'Unknown',
            email: p.email || '',
            amountOwed: parseFloat(amountOwed.toFixed(2)), // Ensure 2 decimal places
            percentage: parseFloat(percentage.toFixed(2)),
            settlementStatus: 'unsettled' as SettlementStatus, // Default status
          };
        });

        const splitExpenseData = {
          originalExpenseId: 'temp-id-' + Date.now(), // Will be replaced by actual expense ID
          originalExpenseDescription: description,
          currency: currency as CurrencyCode,
          splitMethod: splitMethod,
          totalAmount: totalAmountForSplit,
          paidBy: paidBy,
          participants: splitParticipantsData,
          groupId: selectedGroup === 'personal' ? null : selectedGroup,
          groupName: selectedGroup === 'personal' ? null : groups.find(g => g.id === selectedGroup)?.name,
          notes: notes,
          actorProfile: userProfile,
        };

        // First add the main expense
        const mainExpenseId = await addExpense(authUser.uid, expenseData, userProfile);
        
        // Then create the split expense, linking it to the main expense
        splitExpenseData.originalExpenseId = mainExpenseId;
        expenseId = await createSplitExpense(splitExpenseData);

        setSnackbar({ visible: true, message: 'Split expense added!' });

      } else {
        if (isOnline) {
          expenseId = await addExpense(authUser.uid, expenseData, userProfile);
          setSnackbar({ visible: true, message: 'Expense added!' });
        } else {
          // Save offline
          const offlineExpense = {
            userId: authUser.uid,
            paidById: authUser.uid,
            paidByName: userProfile?.displayName || 'You',
            description,
            amount: parseFloat(amount),
            currency,
            category,
            date,
            notes,
            createdAt: new Date().toISOString(),
            groupId: selectedGroup === 'personal' ? undefined : selectedGroup,
            groupName: selectedGroup === 'personal' ? undefined : groups.find(g => g.id === selectedGroup)?.name,
            isRecurring: recurrence !== 'none',
            recurrence,
            recurrenceEndDate: recurrence !== 'none' && recurrenceEndDate ? recurrenceEndDate : undefined,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : undefined,
          };
          
          await offlineManager.saveExpenseOffline(offlineExpense);
          setSnackbar({ visible: true, message: 'Expense saved offline!' });
        }
      }
      onClose();
    } catch (e: any) {
      console.error("Error adding expense:", e);
      setSnackbar({ visible: true, message: `Failed to add expense: ${e.message || 'Unknown error'}` });
    }
    setLoading(false);
  };
const handleOcrScan = async () => {

}
  // OCR Scanner Handler
  // const handleOcrScan = async () => {
  //   setOcrLoading(true);
  //   try {
  //     const result = await ImagePicker.launchImageLibraryAsync({
  //       mediaTypes: ImagePicker.MediaTypeOptions.Images,
  //       allowsEditing: false,
  //       quality: 1,
  //     });
  //     if (!result.canceled && result.assets && result.assets.length > 0) {
  //       const uri = result.assets[0].uri;
  //       setOcrImage(uri);

  //       // Run OCR
  //       const ocrResult = await MLKitOcr.scanImage(uri);

  //       // Combine all recognized text into a single string
  //       const allText = ocrResult.map(block => block.text).join('\n');

  //       // --- Advanced Parsing ---

  //       // 1. Amount: Find all numbers with 2 decimals, pick the largest as total
  //       const amounts = allText.match(/(\d{1,5}[.,]\d{2})/g);
  //       if (amounts && amounts.length > 0) {
  //         const maxAmount = amounts
  //           .map((a: string) => parseFloat(a.replace(',', '.')))
  //           .reduce((a: number, b: number) => (a > b ? a : b), 0);
  //         setAmount(maxAmount.toFixed(2));
  //       }

  //       // 2. Date: Look for common date patterns (dd/mm/yyyy, yyyy-mm-dd, mm/dd/yyyy)
  //       const dateMatch = allText.match(/(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})|(\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2})/);
  //       if (dateMatch && dateMatch[0]) {
  //         // Normalize to yyyy-MM-dd
  //         let d = dateMatch[0].replace(/\./g, '-').replace(/\//g, '-');
  //         let parts = d.split('-');
  //         let normalized = '';
  //         if (parts[0].length === 4) {
  //           // yyyy-MM-dd
  //           normalized = d;
  //         } else {
  //           // dd-MM-yyyy or MM-dd-yyyy
  //           normalized = `${parts[2]}-${parts[1]}-${parts[0]}`;
  //         }
  //         setDate(normalized);
  //       }

  //       // 3. Merchant/Description: Use first line with letters, not all caps, not "TOTAL"
  //       const lines = allText.split('\n').map((l: string) => l.trim());
  //       const likelyDesc = lines.find((l: string) =>
  //         /[a-zA-Z]/.test(l) &&
  //         l.length > 3 &&
  //         !/^TOTAL/i.test(l) &&
  //         l !== l.toUpperCase()
  //       );
  //       if (likelyDesc) setDescription(likelyDesc);

  //       // 4. Category: Try to guess from keywords
  //       const lowerText = allText.toLowerCase();
  //       if (lowerText.includes('uber') || lowerText.includes('taxi') || lowerText.includes('cab')) setCategory('Transport');
  //       else if (lowerText.includes('grocery') || lowerText.includes('supermarket')) setCategory('Groceries');
  //       else if (lowerText.includes('restaurant') || lowerText.includes('food') || lowerText.includes('cafe')) setCategory('Food');
  //       else if (lowerText.includes('shopping') || lowerText.includes('mall')) setCategory('Shopping');
  //       else if (lowerText.includes('bill') || lowerText.includes('electricity') || lowerText.includes('water')) setCategory('Bills');
  //       else if (lowerText.includes('movie') || lowerText.includes('cinema')) setCategory('Entertainment');

  //       // 5. Tags: Extract all words after '#' or '@'
  //       const tagMatches = allText.match(/[#@][\w\-]+/g);
  //       if (tagMatches && tagMatches.length > 0) {
  //         setTags(tagMatches.map((t: string) => t.replace(/^[@#]/, '')).join(', '));
  //       }

  //       // 6. Notes: Optionally, store all OCR text for reference
  //       // setNotes(allText);
  //     }
  //   } catch (e) {
  //     setSnackbar({ visible: true, message: 'Failed to scan receipt.' });
  //   }
  //   setOcrLoading(false);
  // };

  if (!visible) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={{
          backgroundColor: colors.elevation.level2,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: insets.bottom + 24,
          paddingTop: 20,
          minHeight: 580,
          maxHeight: '90%',
        }}
        style={{
          justifyContent: 'flex-end',
          margin: 0,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <View style={{
            width: 44, height: 5, borderRadius: 3, backgroundColor: colors.outlineVariant || '#ccc', marginTop: 8, marginBottom: 8,
          }} />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.primary, marginBottom: 16, textAlign: 'center' }}>
            Add New Expense
          </Text>
          {isLoadingData && (
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, marginTop: 4 }}>
                {isOnline ? 'Loading data...' : 'Loading cached data...'}
              </Text>
            </View>
          )}
          <Divider style={{ marginBottom: 20 }} />

          {/* OCR Scanner */}
          <TouchableOpacity
            onPress={handleOcrScan}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primaryContainer,
              borderRadius: 14,
              padding: 10,
              marginBottom: 12,
              justifyContent: 'center',
            }}
            disabled={ocrLoading}
          >
            <MaterialCommunityIcons name="barcode-scan" size={22} color={colors.primary} />
            <Text style={{ marginLeft: 8, color: colors.primary, fontWeight: 'bold', fontSize: 16 }}>
              {ocrLoading ? 'Scanning...' : 'Scan Receipt (OCR)'}
            </Text>
          </TouchableOpacity>
          {ocrImage && (
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, marginBottom: 4 }}>Scanned Image:</Text>
              <Image source={{ uri: ocrImage }} style={{ width: 120, height: 80, borderRadius: 8 }} />
            </View>
          )}

          {/* Amount */}
          <ModernInput
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            leftIcon={<MaterialCommunityIcons name="currency-usd" size={22} color={colors.primary} />}
            style={{ marginBottom: 12 }}
            error={amountError}
          />

          {/* Currency Picker */}
          <TouchableOpacity 
            onPress={() => { setCurrencyModal(true); Keyboard.dismiss(); }} 
            activeOpacity={0.7}
            style={{ marginBottom: 12 }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 2,
              borderRadius: 12,
              backgroundColor: colors.surface,
              paddingHorizontal: 16,
              minHeight: 56,
              borderColor: currencyError ? colors.error : colors.outline,
            }}>
              <MaterialCommunityIcons name="currency-usd" size={22} color={colors.primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 2 }}>Currency</Text>
                <Text style={{ fontSize: 16, color: colors.onSurface }}>{currency}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={22} color={colors.primary} />
            </View>
          </TouchableOpacity>
          <Portal>
            <Modal
              visible={currencyModal}
              onDismiss={() => setCurrencyModal(false)}
              contentContainerStyle={{
                margin: 20,
                padding: 20,
                backgroundColor: colors.surface,
                borderRadius: 16,
              }}
            >
              <Text style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 16, color: colors.primary }}>Select Currency</Text>
              {SUPPORTED_CURRENCIES.map(c => (
                <TouchableOpacity
                  key={c.code}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: c.code === currency ? colors.primaryContainer : 'transparent',
                    marginBottom: 4,
                  }}
                  onPress={() => {
                    setCurrency(c.code);
                    setCurrencyModal(false);
                  }}
                >
                  <Text style={{
                    fontSize: 17,
                    color: c.code === currency ? colors.primary : colors.onSurface,
                    fontWeight: c.code === currency ? 'bold' : 'normal'
                  }}>
                    {c.code} - {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </Modal>
          </Portal>
          {currencyError ? null : null}

          {/* Description */}
          <ModernInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            leftIcon={<MaterialCommunityIcons name="text" size={22} color={colors.primary} />}
            style={{ marginBottom: 12 }}
            error={descriptionError}
          />

          {/* Category Picker */}
          <TouchableOpacity 
            onPress={() => { setShowCategoryModal(true); Keyboard.dismiss(); }} 
            activeOpacity={0.7}
            style={{ marginBottom: 12 }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 2,
              borderRadius: 12,
              backgroundColor: colors.surface,
              paddingHorizontal: 16,
              minHeight: 56,
              borderColor: categoryError ? colors.error : colors.outline,
            }}>
              <MaterialCommunityIcons name={getCategoryIcon(category)} size={22} color={colors.primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 2 }}>Category</Text>
                <Text style={{ fontSize: 16, color: colors.onSurface }}>{getCategoryLabel(category)}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={22} color={colors.primary} />
            </View>
          </TouchableOpacity>
          <Portal>
            <CategorySelectionModal
              visible={showCategoryModal}
              onDismiss={() => setShowCategoryModal(false)}
              onSelect={setCategory}
              selectedValue={category}
              type="expense"
              title="Select Category"
            />
          </Portal>
          {categoryError ? null : null}

          {/* Enhanced Date Picker */}
          <EnhancedDatePicker
            value={date}
            onValueChange={setDate}
            label="Date"
            placeholder="Select expense date"
            error={dateError}
            style={{ marginBottom: 12 }}
          />

          {/* Notes */}
          <ModernInput
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            leftIcon={<MaterialCommunityIcons name="note-text-outline" size={22} color={colors.primary} />}
            style={{ marginBottom: 12 }}
            multiline
          />

          {/* Tags */}
          <ModernInput
            label="Tags (comma separated)"
            value={tags}
            onChangeText={setTags}
            leftIcon={<MaterialCommunityIcons name="tag-outline" size={22} color={colors.primary} />}
            style={{ marginBottom: 12 }}
          />

          {/* Recurrence Picker */}
          <TouchableOpacity 
            onPress={() => { setRecurrenceModal(true); Keyboard.dismiss(); }} 
            activeOpacity={0.7}
            style={{ marginBottom: 12 }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 2,
              borderRadius: 12,
              backgroundColor: colors.surface,
              paddingHorizontal: 16,
              minHeight: 56,
              borderColor: colors.outline,
            }}>
              <MaterialCommunityIcons name="repeat" size={22} color={colors.primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 2 }}>Recurrence</Text>
                <Text style={{ fontSize: 16, color: colors.onSurface }}>
                  {recurrenceOptions.find(r => r.value === recurrence)?.label || 'None'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={22} color={colors.primary} />
            </View>
          </TouchableOpacity>
          <Portal>
            <Modal
              visible={recurrenceModal}
              onDismiss={() => setRecurrenceModal(false)}
              contentContainerStyle={{
                margin: 20,
                padding: 20,
                backgroundColor: colors.surface,
                borderRadius: 16,
              }}
            >
              <Text style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 16, color: colors.primary }}>Select Recurrence</Text>
              {recurrenceOptions.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: opt.value === recurrence ? colors.primaryContainer : 'transparent',
                    marginBottom: 4,
                  }}
                  onPress={() => {
                    setRecurrence(opt.value);
                    setRecurrenceModal(false);
                  }}
                >
                  <Text style={{
                    fontSize: 17,
                    color: opt.value === recurrence ? colors.primary : colors.onSurface,
                    fontWeight: opt.value === recurrence ? 'bold' : 'normal'
                  }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </Modal>
          </Portal>
          {recurrence !== 'none' && (
            <>
              <EnhancedDatePicker
                value={recurrenceEndDate}
                onValueChange={setRecurrenceEndDate}
                label="Recurrence End Date"
                placeholder="Select end date"
                style={{ marginBottom: 12 }}
              />
            </>
          )}

          {/* Group Picker */}
          <TouchableOpacity 
            onPress={() => { setGroupModal(true); Keyboard.dismiss(); }} 
            activeOpacity={0.7}
            style={{ marginBottom: 12 }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 2,
              borderRadius: 12,
              backgroundColor: colors.surface,
              paddingHorizontal: 16,
              minHeight: 56,
              borderColor: colors.outline,
            }}>
              <MaterialCommunityIcons name="account-group" size={22} color={colors.primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 2 }}>Group (Optional)</Text>
                <Text style={{ fontSize: 16, color: colors.onSurface }}>
                  {selectedGroup === 'personal' ? 'Personal Expense' : groups.find(g => g.id === selectedGroup)?.name || 'Select Group'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={22} color={colors.primary} />
            </View>
          </TouchableOpacity>
          <Portal>
            <Modal
              visible={groupModal}
              onDismiss={() => setGroupModal(false)}
              contentContainerStyle={{
                margin: 20,
                padding: 20,
                backgroundColor: colors.surface,
                borderRadius: 16,
              }}
            >
              <Text style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 16, color: colors.primary }}>Select Group</Text>
              <TouchableOpacity
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: selectedGroup === 'personal' ? colors.primaryContainer : 'transparent',
                  marginBottom: 4,
                }}
                onPress={() => {
                  setSelectedGroup('personal');
                  setGroupModal(false);
                }}
              >
                <Text style={{
                  fontSize: 17,
                  color: selectedGroup === 'personal' ? colors.primary : colors.onSurface,
                  fontWeight: selectedGroup === 'personal' ? 'bold' : 'normal'
                }}>
                  Personal Expense
                </Text>
              </TouchableOpacity>
              {groups.map(g => (
                <TouchableOpacity
                  key={g.id}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: g.id === selectedGroup ? colors.primaryContainer : 'transparent',
                    marginBottom: 4,
                  }}
                  onPress={() => {
                    setSelectedGroup(g.id);
                    setGroupModal(false);
                  }}
                >
                  <Text style={{
                    fontSize: 17,
                    color: g.id === selectedGroup ? colors.primary : colors.onSurface,
                    fontWeight: g.id === selectedGroup ? 'bold' : 'normal'
                  }}>
                    {g.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </Modal>
          </Portal>

          {/* Split Expense */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 16 }}>
            <Switch value={showSplit} onValueChange={setShowSplit} color={colors.primary} />
            <Text style={{ marginLeft: 8, fontWeight: 'bold', fontSize: 16 }}>Split this Expense</Text>
          </View>
          {showSplit && (
            <View style={{ marginBottom: 16 }}>
              <TouchableOpacity 
                onPress={() => { setSplitMethodModal(true); Keyboard.dismiss(); }} 
                activeOpacity={0.7}
                style={{ marginBottom: 12 }}
              >
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  paddingHorizontal: 16,
                  minHeight: 56,
                  borderColor: colors.outline,
                }}>
                  <MaterialCommunityIcons name="swap-horizontal" size={22} color={colors.primary} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 2 }}>Split Method</Text>
                    <Text style={{ fontSize: 16, color: colors.onSurface }}>
                      {splitMethods.find(m => m.value === splitMethod)?.label || 'Select Method'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-down" size={22} color={colors.primary} />
                </View>
              </TouchableOpacity>
              <Portal>
                <Modal
                  visible={splitMethodModal}
                  onDismiss={() => setSplitMethodModal(false)}
                  contentContainerStyle={{
                    margin: 20,
                    padding: 20,
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                  }}
                >
                  <Text style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 16, color: colors.primary }}>Select Split Method</Text>
                  {splitMethods.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={{
                        paddingVertical: 14,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: opt.value === splitMethod ? colors.primaryContainer : 'transparent',
                        marginBottom: 4,
                      }}
                      onPress={() => {
                        setSplitMethod(opt.value as any);
                        setSplitMethodModal(false);
                      }}
                    >
                      <Text style={{
                        fontSize: 17,
                        color: opt.value === splitMethod ? colors.primary : colors.onSurface,
                        fontWeight: opt.value === splitMethod ? 'bold' : 'normal'
                      }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </Modal>
              </Portal>
              <Divider style={{ marginVertical: 8 }} />
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Participants</Text>
              {participants.map((p: any) => (
                <View key={p.uid} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: p.selected ? colors.surface : 'transparent', borderRadius: 12, padding: 6 }}>
                  <Switch value={p.selected} onValueChange={() => {
                    setParticipants((prev: any[]) => prev.map((x: any) => x.uid === p.uid ? { ...x, selected: !x.selected } : x));
                  }} color={colors.primary} />
                  <Text style={{ marginLeft: 8, flex: 1 }}>{p.displayName || p.email || 'Unknown'}</Text>
                  {splitMethod === 'byAmount' && p.selected && (
                    <ModernInput
                      label="Amount"
                      value={p.amount}
                      onChangeText={(v: string) => setParticipants((prev: any[]) => prev.map((x: any) => x.uid === p.uid ? { ...x, amount: v } : x))}
                      keyboardType="decimal-pad"
                      style={{ width: 80, marginLeft: 8 }}
                    />
                  )}
                  {splitMethod === 'byPercentage' && p.selected && (
                    <ModernInput
                      label="%"
                      value={p.percentage}
                      onChangeText={(v: string) => setParticipants((prev: any[]) => prev.map((x: any) => x.uid === p.uid ? { ...x, percentage: v } : x))}
                      keyboardType="decimal-pad"
                      style={{ width: 60, marginLeft: 8 }}
                    />
                  )}
                  {splitMethod === 'equally' && p.selected && (
                    <Text style={{ marginLeft: 8 }}>
                      {amount && participants.filter((x: any) => x.selected).length
                        ? (parseFloat(amount) / participants.filter((x: any) => x.selected).length).toFixed(2)
                        : '0.00'}
                    </Text>
                  )}
                </View>
              ))}
              <Divider style={{ marginVertical: 8 }} />
              {/* Paid By Picker */}
              <TouchableOpacity 
                onPress={() => { setPaidByModal(true); Keyboard.dismiss(); }} 
                activeOpacity={0.7}
                style={{ marginBottom: 12 }}
              >
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  paddingHorizontal: 16,
                  minHeight: 56,
                  borderColor: colors.outline,
                }}>
                  <MaterialCommunityIcons name="account-check" size={22} color={colors.primary} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 2 }}>Paid By</Text>
                    <Text style={{ fontSize: 16, color: colors.onSurface }}>
                      {participants.find((p: any) => p.uid === paidBy)?.displayName || 'Select Person'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-down" size={22} color={colors.primary} />
                </View>
              </TouchableOpacity>
              <Portal>
                <Modal
                  visible={paidByModal}
                  onDismiss={() => setPaidByModal(false)}
                  contentContainerStyle={{
                    margin: 20,
                    padding: 20,
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                  }}
                >
                  <Text style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 16, color: colors.primary }}>Select Paid By</Text>
                  {participants.filter((p: any) => p.selected).map((p: any) => (
                    <TouchableOpacity
                      key={p.uid}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 14,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: p.uid === paidBy ? colors.primaryContainer : 'transparent',
                        marginBottom: 4,
                      }}
                      onPress={() => {
                        setPaidBy(p.uid);
                        setPaidByModal(false);
                      }}
                    >
                      <MaterialCommunityIcons
                        name="account"
                        size={20}
                        color={p.uid === paidBy ? colors.primary : colors.onSurfaceVariant}
                        style={{ marginRight: 12 }}
                      />
                      <Text style={{
                        fontSize: 17,
                        color: p.uid === paidBy ? colors.primary : colors.onSurface,
                        fontWeight: p.uid === paidBy ? 'bold' : 'normal'
                      }}>
                        {p.displayName || p.email || 'Unknown'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </Modal>
              </Portal>
            </View>
          )}

          {formError ? (
            <Text style={{ color: colors.error, fontWeight: 'bold', textAlign: 'center', marginVertical: 8 }}>
              {formError}
            </Text>
          ) : null}

          <ModernButton
            onPress={handleSubmit}
            loading={loading}
            style={{ borderRadius: 12, marginTop: 20, marginBottom: 12, height: 52 }}
            title="Add Expense"
            disabled={loading}
            variant="primary"
          />
          <ModernButton
            onPress={onClose}
            style={{ borderRadius: 12, marginBottom: 8, height: 52 }}
            title="Cancel"
            variant="outline"
          />
        </ScrollView>
        <Snackbar
          visible={snackbar.visible}
          onDismiss={() => setSnackbar({ visible: false, message: '' })}
          duration={2500}
          style={{ backgroundColor: colors.error }}
        >
          {snackbar.message}
        </Snackbar>
        {loading && <ActivityIndicator style={{ position: 'absolute', top: '50%', left: '50%' }}/> }
      </Modal>
    </Portal>
  );
}