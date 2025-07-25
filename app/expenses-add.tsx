import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { manipulateAsync } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { DollarSign, Repeat, Split, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Image, ScrollView as RNScrollView, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, Card, Divider, HelperText, Snackbar, Surface, Switch, Text, TextInput, useTheme } from 'react-native-paper';
import RNPickerSelect from 'react-native-picker-select';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DesignSystem } from '../constants/DesignSystem';
import { SUPPORTED_CURRENCIES } from '../constants/types';
import { addExpense, createSplitExpense, getFriends, getGroupsForUser } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const recurrenceOptions = [
  { label: 'None', value: 'none', icon: <Repeat size={16} color={DesignSystem.colors.neutral[500]} /> },
  { label: 'Daily', value: 'daily', icon: <Repeat size={16} color={DesignSystem.colors.neutral[500]} /> },
  { label: 'Weekly', value: 'weekly', icon: <Repeat size={16} color={DesignSystem.colors.neutral[500]} /> },
  { label: 'Monthly', value: 'monthly', icon: <Repeat size={16} color={DesignSystem.colors.neutral[500]} /> },
  { label: 'Yearly', value: 'yearly', icon: <Repeat size={16} color={DesignSystem.colors.neutral[500]} /> },
];

const splitMethods = [
  { label: 'Equally', value: 'equally', icon: <Split size={16} color={DesignSystem.colors.neutral[500]} /> },
  { label: 'By Amount', value: 'byAmount', icon: <DollarSign size={16} color={DesignSystem.colors.neutral[500]} /> },
  { label: 'By Percentage', value: 'byPercentage', icon: <Split size={16} color={DesignSystem.colors.neutral[500]} /> },
];

const categories = [
  { label: 'Food', value: 'Food', icon: <MaterialCommunityIcons name="food" size={16} color={DesignSystem.colors.neutral[500]} /> },
  { label: 'Transport', value: 'Transport', icon: <MaterialCommunityIcons name="car" size={16} color={DesignSystem.colors.neutral[500]} /> },
  { label: 'Shopping', value: 'Shopping', icon: <MaterialCommunityIcons name="shopping" size={16} color={DesignSystem.colors.neutral[500]} /> },
  { label: 'Groceries', value: 'Groceries', icon: <MaterialCommunityIcons name="cart" size={16} color={DesignSystem.colors.neutral[500]} /> },
  { label: 'Bills', value: 'Bills', icon: <MaterialCommunityIcons name="receipt" size={16} color={DesignSystem.colors.neutral[500]} /> },
  { label: 'Entertainment', value: 'Entertainment', icon: <MaterialCommunityIcons name="movie" size={16} color={DesignSystem.colors.neutral[500]} /> },
  { label: 'Other', value: 'Other', icon: <MaterialCommunityIcons name="dots-horizontal" size={16} color={DesignSystem.colors.neutral[500]} /> },
];

// Utility to remove undefined fields
function removeUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  } else if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, removeUndefined(v)])
    );
  }
  return obj;
}

const pickerSelectStyles = {
  inputIOS: {
    fontSize: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    color: DesignSystem.colors.neutral[900],
    paddingRight: 30, // to ensure the text is never behind the icon
  },
  inputAndroid: {
    fontSize: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    color: DesignSystem.colors.neutral[900],
    paddingRight: 30, // to ensure the text is never behind the icon
  },
  placeholder: {
    color: DesignSystem.colors.neutral[400],
  },
};

export default function AddExpensesScreen() {
  const { authUser, userProfile, loading: authLoading } = useAuth();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');
  const [currency, setCurrency] = useState('USD');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [groupId, setGroupId] = useState('');
  const [groups, setGroups] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showRecurrenceEndDatePicker, setShowRecurrenceEndDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [splitMethod, setSplitMethod] = useState<'equally' | 'byAmount' | 'byPercentage'>('equally');
  const [friends, setFriends] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]); // Array of {uid, displayName, selected, amount, percentage}
  const [paidBy, setPaidBy] = useState('');
  const [splitError, setSplitError] = useState('');
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, dark } = useTheme();
  const scrollViewRef = React.useRef<RNScrollView>(null);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');

  // 1. Add state for field errors
  const [amountError, setAmountError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [currencyError, setCurrencyError] = useState('');
  const [dateError, setDateError] = useState('');
  const [formError, setFormError] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchGroupsAndFriends = async () => {
      if (!authUser) return;
      const userGroups = await getGroupsForUser(authUser.uid);
      setGroups(userGroups);
      const userFriends = await getFriends(authUser.uid);
      setFriends(userFriends);
    };
    fetchGroupsAndFriends();
  }, [authUser]);

  useEffect(() => {
    // Reset participants when group or split toggled
    if (showSplit) {
      let baseList = [];
      if (groupId) {
        const group = groups.find((g: any) => g.id === groupId);
        baseList = group ? group.memberDetails : [];
      } else {
        baseList = [{ uid: authUser?.uid, displayName: userProfile?.displayName || 'You' }, ...friends];
      }
      setParticipants(baseList.map((p: any) => ({ ...p, selected: true, amount: '', percentage: '' })));
      setPaidBy(authUser?.uid || '');
    } else {
      setParticipants([]);
      setPaidBy(authUser?.uid || '');
    }
  }, [showSplit, groupId, groups, friends, authUser, userProfile]);

  useEffect(() => {
    if (params.groupId && typeof params.groupId === 'string') {
      setGroupId(params.groupId);
    }
  }, [params.groupId]);

  const handleParticipantChange = (uid: string, field: 'amount' | 'percentage', value: string) => {
    setParticipants((prev: any[]) => prev.map((p: any) => p.uid === uid ? { ...p, [field]: value } : p));
  };

  const handleParticipantToggle = (uid: string) => {
    setParticipants((prev: any[]) => prev.map((p: any) => p.uid === uid ? { ...p, selected: !p.selected } : p));
  };

  const validateSplit = () => {
    if (!showSplit) return true;
    const selected = participants.filter((p: any) => p.selected);
    if (selected.length === 0) {
      setSplitError('Select at least one participant.');
      return false;
    }
    if (splitMethod === 'byAmount') {
      const total = selected.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);
      if (Math.abs(total - parseFloat(amount || '0')) > 0.01) {
        setSplitError('Sum of amounts must equal total.');
        return false;
      }
    }
    if (splitMethod === 'byPercentage') {
      const total = selected.reduce((sum: number, p: any) => sum + parseFloat(p.percentage || '0'), 0);
      if (Math.abs(total - 100) > 0.01) {
        setSplitError('Sum of percentages must be 100%.');
        return false;
      }
    }
    setSplitError('');
    return true;
  };

  // OCR: Pick or capture receipt image
  const handlePickReceipt = async () => {
    setOcrError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets && result.assets[0].uri) {
      setReceiptImage(result.assets[0].uri);
      // Resize for faster upload
      const manipulated = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1024 } }],
        { base64: true }
      );
      const base64 = manipulated.base64;
      await handleOcrExtract(base64);
    }
  };

  // OCR: Call backend to extract expense fields
  const handleOcrExtract = async (imageBase64: string) => {
    setOcrLoading(true);
    setOcrError('');
    try {
      const functions = getFunctions();
      const extractReceiptText = httpsCallable(functions, 'extractReceiptText');
      const res = await extractReceiptText({ imageBase64 });
      const data = res.data;
      // Pre-fill fields if present
      if (data.extracted?.amount) setAmount(data.extracted.amount.toString());
      if (data.extracted?.date) setDate(data.extracted.date);
      if (data.extracted?.merchant) setNotes((prev) => prev ? prev + `\nMerchant: ${data.extracted.merchant}` : `Merchant: ${data.extracted.merchant}`);
      // Optionally, show fullText or other fields
    } catch (e: any) {
      setOcrError(e.message || 'Failed to extract receipt data.');
    }
    setOcrLoading(false);
  };

  // 2. Update handleSubmit to validate each field and set error states
  const handleSubmit = async () => {
    setFormError('');
    let hasError = false;
    let localAmountError = '';
    let localDescriptionError = '';
    let localCategoryError = '';
    let localCurrencyError = '';
    let localDateError = '';
    const missingFields: string[] = [];
    let firstErrorField = null;

    if (!amount || isNaN(Number(amount))) {
      localAmountError = 'Amount is required and must be a valid number.';
      hasError = true;
      missingFields.push('Amount');
      firstErrorField = firstErrorField || 'amount';
    }
    if (!description) {
      localDescriptionError = 'Description is required.';
      hasError = true;
      missingFields.push('Description');
      firstErrorField = firstErrorField || 'description';
    }
    if (!category) {
      localCategoryError = 'Category is required.';
      hasError = true;
      missingFields.push('Category');
      firstErrorField = firstErrorField || 'category';
    }
    if (!currency) {
      localCurrencyError = 'Currency is required.';
      hasError = true;
      missingFields.push('Currency');
      firstErrorField = firstErrorField || 'currency';
    }
    if (!date) {
      localDateError = 'Date is required.';
      hasError = true;
      missingFields.push('Date');
      firstErrorField = firstErrorField || 'date';
    }
    if (showSplit && !validateSplit()) {
      Alert.alert('Error', splitError || 'Invalid split.');
      hasError = true;
      firstErrorField = firstErrorField || 'split';
    }

    setAmountError(localAmountError);
    setDescriptionError(localDescriptionError);
    setCategoryError(localCategoryError);
    setCurrencyError(localCurrencyError);
    setDateError(localDateError);

    if (hasError) {
      setFormError('Please fill all required fields: ' + missingFields.join(', '));
      setSnackbar({ visible: true, message: 'Please fill all required fields: ' + missingFields.join(', ') });
      // Scroll to the first error field
      if (scrollViewRef.current) {
        let y = 0;
        switch (firstErrorField) {
          case 'amount': y = 0; break;
          case 'currency': y = 0; break;
          case 'description': y = 80; break;
          case 'category': y = 160; break;
          case 'date': y = 240; break;
          case 'split': y = 600; break;
          default: y = 0;
        }
        scrollViewRef.current.scrollTo({ y, animated: true });
      }
      console.log('[AddExpense] Validation failed', {
        localAmountError, localDescriptionError, localCategoryError, localCurrencyError, localDateError, splitError
      });
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
        groupId: groupId || undefined,
        groupName: groupId ? (groups.find((g: any) => g.id === groupId)?.name || undefined) : undefined,
        receiptUrl: receiptUrl || undefined,
      };
      console.log('[AddExpense] Calling addExpense', expenseData);
      const expenseId = await addExpense(authUser.uid, expenseData, userProfile, receiptUrl ? 'ocr' : 'manual');
      if (showSplit) {
        const selected = participants.filter((p: any) => p.selected);
        const splitPayload = {
          originalExpenseId: expenseId,
          originalExpenseDescription: description,
          currency,
          splitMethod,
          totalAmount: parseFloat(amount),
          paidBy,
          participants: selected.map((p: any) => ({
            userId: p.uid,
            displayName: p.displayName,
            email: p.email,
            amountOwed: splitMethod === 'equally' ? parseFloat(amount) / selected.length : splitMethod === 'byAmount' ? parseFloat(p.amount || '0') : splitMethod === 'byPercentage' ? parseFloat(amount) * (parseFloat(p.percentage || '0') / 100) : 0,
            percentage: splitMethod === 'byPercentage' ? parseFloat(p.percentage || '0') : undefined,
            settlementStatus: 'unsettled' as const,
          })),
          groupId: groupId || undefined,
          groupName: groupId ? (groups.find((g: any) => g.id === groupId)?.name || undefined) : undefined,
          notes,
          actorProfile: userProfile,
          involvedUserIds: selected.map((p: any) => p.uid),
        };
        console.log('[AddExpense] Calling createSplitExpense', splitPayload);
        const cleanSplitPayload = removeUndefined(splitPayload);
        await createSplitExpense(cleanSplitPayload);
      }
      console.log('[AddExpense] Success');
      Alert.alert('Success', 'Expense added!');
      router.back();
    } catch (e) {
      console.error('[AddExpense] Error:', e);
      Alert.alert('Error', 'Failed to add expense.');
    }
    setLoading(false);
  };

  // Handler for disabled Add Expense button
  const handleDisabledAddExpense = () => {
    let message = 'Please fill all required fields correctly.';
    if (amountError) message = amountError;
    else if (descriptionError) message = descriptionError;
    else if (categoryError) message = categoryError;
    else if (currencyError) message = currencyError;
    else if (dateError) message = dateError;
    else if (showSplit && participants.filter((p: any) => p.selected).length === 0) message = 'Select at least one participant.';
    else if (showSplit && splitError) message = splitError;
    setSnackbar({ visible: true, message });
  };

  if (authLoading || !authUser || !userProfile) {
    return (
      <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </Surface>
    );
  }

  const currencyOptions = SUPPORTED_CURRENCIES.map(c => ({
    label: `${c.code} - ${c.name}`,
    value: c.code,
    icon: <DollarSign size={16} color={DesignSystem.colors.neutral[500]} />,
  }));

  const groupOptions = [
    { label: 'Personal', value: '', icon: <Users size={16} color={DesignSystem.colors.neutral[500]} /> },
    ...groups.map(g => ({ 
      label: g.name, 
      value: g.id,
      icon: <Users size={16} color={DesignSystem.colors.neutral[500]} />
    }))
  ];

  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background }}>
      <RNScrollView ref={scrollViewRef} contentContainerStyle={{ padding: 20, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {formError ? <View style={{ backgroundColor: colors.errorContainer, padding: 12, borderRadius: 12, marginBottom: 16 }}><Text style={{ color: colors.error, fontWeight: 'bold', textAlign: 'center' }}>{formError}</Text></View> : null}
        {/* OCR Receipt Section */}
        <Card style={{ marginBottom: 20, borderRadius: 20, elevation: 2, backgroundColor: colors.elevation.level1 }}>
          <Card.Content>
            <Text variant="titleMedium" style={{ color: colors.primary, fontWeight: 'bold', marginBottom: 8 }}>
              Receipt OCR (Optional)
            </Text>
            <Button icon="camera" mode="outlined" onPress={handlePickReceipt} loading={ocrLoading} disabled={ocrLoading} style={{ marginBottom: 8 }}>
              {receiptImage ? 'Change Receipt Image' : 'Upload or Capture Receipt'}
            </Button>
            {receiptImage && (
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ marginBottom: 4 }}>Preview:</Text>
                <View style={{ borderWidth: 1, borderColor: colors.outline, borderRadius: 12, overflow: 'hidden' }}>
                  <Image source={{ uri: receiptImage }} style={{ width: 200, height: 200, resizeMode: 'contain' }} />
                </View>
                {ocrLoading && <ActivityIndicator style={{ marginTop: 8 }} />}
              </View>
            )}
            {ocrError ? <Text style={{ color: colors.error }}>{ocrError}</Text> : null}
            <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4 }}>
              Use your phone camera or gallery to upload a receipt. We'll try to extract the details for you!
            </Text>
          </Card.Content>
        </Card>
        <Card style={{ marginBottom: 20, borderRadius: 20, elevation: 2, backgroundColor: colors.elevation.level1 }}>
          <Card.Content>
            <Text variant="titleLarge" style={{ color: colors.primary, fontWeight: 'bold', marginBottom: 16 }}>
              Expense Details
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* 3. Amount field: autoFocus, large font, full width, error state */}
              <TextInput
                label="Amount"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                mode="outlined"
                left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="currency-usd" size={22} color={colors.primary} />} />}
                style={{ flex: 1, borderRadius: 16, marginBottom: 12, backgroundColor: colors.surface, fontSize: 22, height: 56, paddingVertical: 12 }}
                theme={{ roundness: 16 }}
                autoFocus
              />
              {/* 4. Dropdowns: full width, large, clear placeholder, error state, wrap in View for spacing */}
              <View style={{ borderRadius: 16, marginBottom: 12, backgroundColor: colors.surface, minHeight: 56, justifyContent: 'center', paddingHorizontal: 4 }}>
                <RNPickerSelect
                  value={currency}
                  onValueChange={v => setCurrency(v || '')}
                  items={SUPPORTED_CURRENCIES.map(c => ({ label: `${c.code} - ${c.name}`, value: c.code }))}
                  placeholder={{ label: 'Select Currency', value: '' }}
                  style={pickerSelectStyles}
                  Icon={() => <MaterialCommunityIcons name="currency-usd" size={22} color={colors.primary} />}
                />
                {currencyError ? <HelperText type="error" visible={true}>{currencyError}</HelperText> : null}
              </View>
            </View>
            <TextInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="text" size={22} color={colors.primary} />} />}
              style={{ borderRadius: 16, marginBottom: 12, backgroundColor: colors.surface }}
              theme={{ roundness: 16 }}
              error={!!descriptionError}
            />
            {descriptionError ? <HelperText type="error" visible={true}>{descriptionError}</HelperText> : null}
            {/* 4. Dropdowns: full width, large, clear placeholder, error state, wrap in View for spacing */}
            <View style={{ borderRadius: 16, marginBottom: 12, backgroundColor: colors.surface, minHeight: 56, justifyContent: 'center', paddingHorizontal: 4 }}>
              <RNPickerSelect
                value={category}
                onValueChange={v => setCategory(v || '')}
                items={categories}
                placeholder={{ label: 'Select Category', value: '' }}
                style={pickerSelectStyles}
                Icon={() => <MaterialCommunityIcons name="text-box-outline" size={22} color={colors.primary} />}
              />
              {categoryError ? <HelperText type="error" visible={true}>{categoryError}</HelperText> : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* 4. Dropdowns: full width, large, clear placeholder, error state, wrap in View for spacing */}
              <View style={{ flex: 1, borderRadius: 16, marginBottom: 12, backgroundColor: colors.surface, minHeight: 56, justifyContent: 'center', paddingHorizontal: 4 }}>
                <RNPickerSelect
                  value={date}
                  onValueChange={v => setDate(v || '')}
                  items={[{ label: 'Select Date', value: '' }]}
                  placeholder={{ label: 'Select Date', value: '' }}
                  style={pickerSelectStyles}
                  Icon={() => <MaterialCommunityIcons name="calendar" size={22} color={colors.primary} />}
                />
                {dateError ? <HelperText type="error" visible={true}>{dateError}</HelperText> : null}
              </View>
              <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                <TextInput
                  label="Date"
                  value={date}
                  editable={false}
                  mode="outlined"
                  left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="calendar" size={22} color={colors.primary} />} />}
                  style={{ borderRadius: 16, marginBottom: 12, backgroundColor: colors.surface }}
                  theme={{ roundness: 16 }}
                  right={<TextInput.Icon icon="calendar" />}
                />
              </TouchableOpacity>
            </View>
            {showDatePicker && (
              <DateTimePicker
                value={date ? new Date(date) : new Date()}
                mode="date"
                display="default"
                onChange={(_, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setDate(selectedDate.toISOString().slice(0, 10));
                }}
              />
            )}
            {/* 4. Dropdowns: full width, large, clear placeholder, error state, wrap in View for spacing */}
            <View style={{ borderRadius: 16, marginBottom: 12, backgroundColor: colors.surface, minHeight: 56, justifyContent: 'center', paddingHorizontal: 4 }}>
              <RNPickerSelect
                value={groupId}
                onValueChange={v => setGroupId(v || '')}
                items={[{ label: 'Personal', value: '' }, ...groups.map((g: any) => ({ label: g.name, value: g.id }))]}
                placeholder={{ label: 'Select Group', value: '' }}
                style={pickerSelectStyles}
                Icon={() => <MaterialCommunityIcons name="account-group" size={22} color={colors.primary} />}
              />
              {currencyError ? <HelperText type="error" visible={true}>{currencyError}</HelperText> : null}
            </View>
          </Card.Content>
        </Card>
        <Card style={{ marginBottom: 20, borderRadius: 20, elevation: 2, backgroundColor: colors.elevation.level1 }}>
          <Card.Content>
            <Text variant="titleLarge" style={{ color: colors.primary, fontWeight: 'bold', marginBottom: 16 }}>
              Additional Details
            </Text>
            <TextInput
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="note-text-outline" size={22} color={colors.primary} />} />}
              style={{ borderRadius: 16, marginBottom: 12, backgroundColor: colors.surface }}
              theme={{ roundness: 16 }}
              multiline
            />
            <TextInput
              label="Tags (comma separated)"
              value={tags}
              onChangeText={setTags}
              mode="outlined"
              left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="tag-outline" size={22} color={colors.primary} />} />}
              style={{ borderRadius: 16, marginBottom: 12, backgroundColor: colors.surface }}
              theme={{ roundness: 16 }}
            />
            <View style={{ borderRadius: 16, marginBottom: 12, backgroundColor: colors.surface, minHeight: 56, justifyContent: 'center', paddingHorizontal: 4 }}>
              <RNPickerSelect
                value={recurrence}
                onValueChange={v => setRecurrence(v || '')}
                items={recurrenceOptions}
                placeholder={{ label: 'Select Recurrence', value: '' }}
                style={pickerSelectStyles}
                Icon={() => <MaterialCommunityIcons name="repeat" size={22} color={colors.primary} />}
              />
              {recurrence !== 'none' && (
                <TouchableOpacity onPress={() => setShowRecurrenceEndDatePicker(true)}>
                  <TextInput
                    label="Recurrence End Date"
                    value={recurrenceEndDate}
                    editable={false}
                    mode="outlined"
                    left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="calendar" size={22} color={colors.primary} />} />}
                    style={{ borderRadius: 16, marginBottom: 12, backgroundColor: colors.surface }}
                    theme={{ roundness: 16 }}
                    right={<TextInput.Icon icon="calendar" />}
                  />
                </TouchableOpacity>
              )}
              {showRecurrenceEndDatePicker && (
                <DateTimePicker
                  value={recurrenceEndDate ? new Date(recurrenceEndDate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(_, selectedDate) => {
                    setShowRecurrenceEndDatePicker(false);
                    if (selectedDate) setRecurrenceEndDate(selectedDate.toISOString().slice(0, 10));
                  }}
                />
              )}
            </View>
          </Card.Content>
        </Card>
        <Card style={{ marginBottom: 20, borderRadius: 20, elevation: 2, backgroundColor: colors.elevation.level1 }}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Switch value={showSplit} onValueChange={setShowSplit} color={colors.primary} />
              <Text style={{ marginLeft: 8, fontWeight: 'bold', fontSize: 16 }}>Split this Expense</Text>
            </View>
            {showSplit && (
              <View style={{ marginBottom: 8 }}>
                <View style={{ borderRadius: 16, marginBottom: 12, backgroundColor: colors.surface, minHeight: 56, justifyContent: 'center', paddingHorizontal: 4 }}>
                  <RNPickerSelect
                    value={splitMethod}
                    onValueChange={v => setSplitMethod((v as 'equally' | 'byAmount' | 'byPercentage') || 'equally')}
                    items={splitMethods}
                    placeholder={{ label: 'Select Split Method', value: '' }}
                    style={pickerSelectStyles}
                    Icon={() => <MaterialCommunityIcons name="swap-horizontal" size={22} color={colors.primary} />}
                  />
                  {currencyError ? <HelperText type="error" visible={true}>{currencyError}</HelperText> : null}
                </View>
                <Divider style={{ marginVertical: 8 }} />
                <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Participants</Text>
                {participants.map((p: any) => (
                  <View key={p.uid} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: p.selected ? colors.surface : 'transparent', borderRadius: 12, padding: 6 }}>
                    <Switch value={p.selected} onValueChange={() => handleParticipantToggle(p.uid)} color={colors.primary} />
                    <Text style={{ marginLeft: 8, flex: 1 }}>{p.displayName || p.email || 'Unknown'}</Text>
                    {splitMethod === 'byAmount' && p.selected && (
                      <TextInput
                        label="Amount"
                        value={p.amount}
                        onChangeText={v => handleParticipantChange(p.uid, 'amount', v)}
                        keyboardType="decimal-pad"
                        mode="outlined"
                        style={{ width: 80, marginLeft: 8, borderRadius: 12, backgroundColor: colors.surface }}
                        theme={{ roundness: 12 }}
                      />
                    )}
                    {splitMethod === 'byPercentage' && p.selected && (
                      <TextInput
                        label="%"
                        value={p.percentage}
                        onChangeText={v => handleParticipantChange(p.uid, 'percentage', v)}
                        keyboardType="decimal-pad"
                        mode="outlined"
                        style={{ width: 60, marginLeft: 8, borderRadius: 12, backgroundColor: colors.surface }}
                        theme={{ roundness: 12 }}
                      />
                    )}
                    {splitMethod === 'equally' && p.selected && (
                      <Text style={{ marginLeft: 8 }}>{amount && participants.filter((x: any) => x.selected).length ? (parseFloat(amount) / participants.filter((x: any) => x.selected).length).toFixed(2) : '0.00'}</Text>
                    )}
                  </View>
                ))}
                <Divider style={{ marginVertical: 8 }} />
                <View style={{ borderRadius: 16, marginBottom: 12, backgroundColor: colors.surface, minHeight: 56, justifyContent: 'center', paddingHorizontal: 4 }}>
                  <RNPickerSelect
                    value={paidBy}
                    onValueChange={v => setPaidBy(v || '')}
                    items={participants.filter((p: any) => p.selected).map((p: any) => ({ label: p.displayName || p.email || 'Unknown', value: p.uid }))}
                    placeholder={{ label: 'Select Paid By', value: '' }}
                    style={pickerSelectStyles}
                    Icon={() => <MaterialCommunityIcons name="account-check" size={22} color={colors.primary} />}
                  />
                  {currencyError ? <HelperText type="error" visible={true}>{currencyError}</HelperText> : null}
                </View>
                {splitError ? <HelperText type="error" visible={true}>{splitError}</HelperText> : null}
              </View>
            )}
          </Card.Content>
        </Card>
      </RNScrollView>
      {/* 7. Add Expense button: full width, large, always visible, disabled if any required field is missing */}
      <Surface style={{ position: 'absolute', left: 0, right: 0, bottom: 16, backgroundColor: colors.elevation.level2, padding: 16, flexDirection: 'row', gap: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 8 }}>
        <Button
          mode="contained"
          onPress={!(loading || amountError || descriptionError || categoryError || currencyError || dateError || (showSplit && participants.filter((p: any) => p.selected).length === 0) || (showSplit && splitError !== '') || ocrLoading) ? handleSubmit : handleDisabledAddExpense}
          loading={loading || ocrLoading}
          style={{ flex: 1, borderRadius: 16, height: 48 }}
          labelStyle={{ fontWeight: 'bold', fontSize: 18 }}
          testID="add-expense-btn"
          disabled={loading || ocrLoading}
        >
          Add Expense
        </Button>
        <Button mode="outlined" onPress={() => router.back()} style={{ flex: 1, borderRadius: 16, height: 48 }} labelStyle={{ fontWeight: 'bold', fontSize: 18 }}>
          Cancel
        </Button>
      </Surface>
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: '' })}
        duration={2500}
        style={{ backgroundColor: colors.error }}
      >
        {snackbar.message}
      </Snackbar>
      {loading && <ActivityIndicator style={{ position: 'absolute', top: '50%', left: '50%' }} />}
    </Surface>
  );
} 