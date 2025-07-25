import React, { useEffect, useState } from 'react';
import { View, ScrollView, Alert, Image, SafeAreaView } from 'react-native';
import { Surface, Text, Button, Card, TextInput, Dialog, Portal, ProgressBar, useTheme, IconButton, ActivityIndicator } from 'react-native-paper';
import { getBudgetsByUser, addBudget, updateBudget, deleteBudget, getExpensesByUser, Budget, BudgetPeriod } from '../../firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import RNPickerSelect from 'react-native-picker-select';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SUPPORTED_CURRENCIES } from '../../constants/types';
import { getGlobalCategories } from '../../firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Circle, AlertCircle, Wand2 } from 'lucide-react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../../firebase/config';
import * as ImagePicker from 'expo-image-picker';
import { storage } from '../../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  custom: 'Custom',
};

function getPeriodDates(period: BudgetPeriod, startDate?: string, endDate?: string) {
  const now = new Date();
  let start: Date, end: Date;
  switch (period) {
    case 'weekly':
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + 1); // Monday
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      break;
    case 'monthly':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'yearly':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
      break;
    case 'custom':
      start = startDate ? new Date(startDate) : now;
      end = endDate ? new Date(endDate) : now;
      break;
    default:
      start = now;
      end = now;
  }
  return { start, end };
}

const CATEGORY_OPTIONS = [
  { label: 'Food', value: 'Food' },
  { label: 'Transport', value: 'Transport' },
  { label: 'Shopping', value: 'Shopping' },
  { label: 'Groceries', value: 'Groceries' },
  { label: 'Bills', value: 'Bills' },
  { label: 'Entertainment', value: 'Entertainment' },
  { label: 'Other', value: 'Other' },
];
const PERIOD_OPTIONS = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
  { label: 'Custom', value: 'custom' },
];

const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map(c => ({ label: `${c.code} - ${c.name}`, value: c.code }));

export default function BudgetsScreen() {
  const { authUser } = useAuth();
  const { colors } = useTheme();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<Partial<Budget>>({ period: 'monthly' });
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string; icon: string }[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string>('Our AI analyzed your spending and couldn’t find any new categories to suggest a budget for. Looks like you’re on top of things!');
  const [aiSuggestionsList, setAiSuggestionsList] = useState<{category: string, recommendedAmount: number}[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  // Image upload state
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  // AI image generation state
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  // Validation state
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const insets = useSafeAreaInsets();

  const handleCloseDialog = () => {
    setShowDialog(false);
    setForm({ period: 'monthly' });
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!form.name || !form.name.trim()) errors.name = 'Budget name is required.';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) errors.amount = 'Amount must be a positive number.';
    if (!form.category) errors.category = 'Category is required.';
    if (!form.currency) errors.currency = 'Currency is required.';
    if (!form.period) errors.period = 'Period is required.';
    if (form.period === 'custom') {
      if (!form.startDate) errors.startDate = 'Start date is required.';
      if (!form.endDate) errors.endDate = 'End date is required.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const fetchAiSuggestions = async () => {
    setAiLoading(true);
    try {
      const functions = getFunctions();
      const suggestBudgets = httpsCallable(functions, 'suggestBudgets');
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not logged in');
      const res: any = await suggestBudgets({ userId });
      if (res.data && Array.isArray(res.data.suggestions) && res.data.suggestions.length > 0) {
        setAiSuggestionsList(res.data.suggestions);
        setAiSuggestions('');
      } else {
        setAiSuggestions('Our AI analyzed your spending and couldn’t find any new categories to suggest a budget for. Looks like you’re on top of things!');
        setAiSuggestionsList([]);
      }
    } catch (e) {
      setAiSuggestions('Could not fetch AI suggestions.');
      setAiSuggestionsList([]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleOpenDialog = (budget?: Budget) => {
    if (budget) setForm(budget);
    else setForm({ period: 'monthly' });
    setShowDialog(true);
  };

  const handleDelete = async (budget: Budget) => {
    Alert.alert('Delete Budget', `Are you sure you want to delete the budget for ${budget.category}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteBudget(budget.id!);
          const updated = await getBudgetsByUser(authUser!.uid);
          setBudgets(updated);
        } catch (e) {
          Alert.alert('Error', 'Failed to delete budget.');
        }
      }},
    ]);
  };

  const handleUploadBudgetImage = async (budget: Budget) => {
    setUploadingImageId(budget.id || null);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'You need to grant permission to access your photos.');
        setUploadingImageId(null);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled) {
        setUploadingImageId(null);
        return;
      }
      const uri = result.assets?.[0]?.uri;
      if (!uri) {
        setUploadingImageId(null);
        return;
      }
      // Fetch the image as a blob
      const response = await fetch(uri);
      const blob = await response.blob();
      const imageRef = ref(storage, `budget-images/${budget.id || authUser?.uid + '-' + Date.now()}`);
      await uploadBytes(imageRef, blob);
      const downloadUrl = await getDownloadURL(imageRef);
      await updateBudget(budget.id!, { imageUrl: downloadUrl });
      const updated = await getBudgetsByUser(authUser!.uid);
      setBudgets(updated);
    } catch (e) {
      Alert.alert('Error', 'Failed to upload budget image.');
    } finally {
      setUploadingImageId(null);
    }
  };

  const handleGenerateBudgetImage = async (budget: Budget) => {
    setGeneratingImageId(budget.id || null);
    try {
      const functions = getFunctions();
      const generateCategoryImage = httpsCallable(functions, 'generateCategoryImage');
      const res: any = await generateCategoryImage({ category: budget.category });
      let imageUrl = res.data?.imageUrl;
      if (imageUrl && imageUrl.startsWith('data:image/')) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const imageRef = ref(storage, `budget-images/${budget.id || authUser?.uid + '-' + Date.now()}`);
        await uploadBytes(imageRef, blob);
        imageUrl = await getDownloadURL(imageRef);
      }
      if (imageUrl) {
        await updateBudget(budget.id!, { imageUrl });
        const updated = await getBudgetsByUser(authUser!.uid);
        setBudgets(updated);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to generate image.');
    } finally {
      setGeneratingImageId(null);
    }
  };

  const handleSave = async () => {
    if (!authUser) return;
    if (!validateForm()) return;
    setSaving(true);
    try {
      // Remove undefined fields from form
      const cleanForm: any = Object.fromEntries(Object.entries(form).filter(([_, v]) => v !== undefined));
      if (form.id) {
        await updateBudget(form.id, cleanForm);
      } else {
        await addBudget(authUser.uid, cleanForm);
      }
      const updated = await getBudgetsByUser(authUser.uid);
      setBudgets(updated);
      setShowDialog(false);
    } catch (e: any) {
      console.error('Failed to save budget:', e);
      Alert.alert('Error', 'Failed to save budget: ' + (e?.message || e?.toString() || 'Unknown error'));
    }
    setSaving(false);
  };

  useEffect(() => {
    if (!authUser) return;
    setLoading(true);
    getBudgetsByUser(authUser.uid)
      .then(setBudgets)
      .finally(() => setLoading(false));
  }, [authUser]);

  useEffect(() => {
    if (!authUser || budgets.length === 0) return;
    const fetchProgress = async () => {
      const allExpenses = await getExpensesByUser(authUser.uid);
      const newProgress: Record<string, number> = {};
      budgets.forEach(budget => {
        const { start, end } = getPeriodDates(budget.period, budget.startDate, budget.endDate);
        const total = allExpenses.filter(e => e.category === budget.category && new Date(e.date) >= start && new Date(e.date) <= end)
          .reduce((sum, e) => sum + e.amount, 0);
        newProgress[budget.id!] = total / budget.amount;
      });
      setProgress(newProgress);
    };
    fetchProgress();
  }, [authUser, budgets]);

  useEffect(() => {
    if (!authUser) return;
    getGlobalCategories()
      .then(setCategories)
      .catch(() => setCategories([
        { id: 'food', name: 'Food', icon: '' },
        { id: 'transport', name: 'Transport', icon: '' },
        { id: 'shopping', name: 'Shopping', icon: '' },
        { id: 'groceries', name: 'Groceries', icon: '' },
        { id: 'bills', name: 'Bills', icon: '' },
        { id: 'entertainment', name: 'Entertainment', icon: '' },
        { id: 'other', name: 'Other', icon: '' },
      ]));
  }, []);

  useEffect(() => {
    if (!authUser) return;
    getExpensesByUser(authUser.uid).then(setAllExpenses);
  }, [authUser, budgets]);

  // Helper: check if there are expenses in other currencies for this category
  const hasOtherCurrencyExpenses = (budget: Budget) => {
    return allExpenses.filter(e => e.category === budget.category).some((exp: any) => exp.currency !== budget.currency);
  };

  const selectedCategory = categories.find(cat => cat.name === form.category);

  return (
    <Surface style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top + 16 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          {/* Header */}
          <Text style={{ fontWeight: 'bold', fontSize: 26, marginBottom: 2, color: '#181028' }}>Budgets</Text>
          <Text style={{ color: '#6c6c80', fontSize: 15, marginBottom: 18 }}>Manage your spending targets and track progress.</Text>
          {/* Buttons */}
          <Button mode="contained" icon="lightbulb-on-outline" style={{ backgroundColor: '#f43f5e', borderRadius: 12, marginBottom: 10, height: 44, justifyContent: 'center' }} labelStyle={{ fontWeight: 'bold', fontSize: 16 }} onPress={fetchAiSuggestions} loading={aiLoading} disabled={aiLoading}>
            Get AI Suggestions
          </Button>
          <Button mode="contained" icon="plus-circle-outline" style={{ backgroundColor: '#7c3aed', borderRadius: 12, marginBottom: 18, height: 44, justifyContent: 'center' }} labelStyle={{ fontWeight: 'bold', fontSize: 16 }} onPress={() => handleOpenDialog()}>
            Add New Budget
          </Button>
          {/* AI Budget Suggestions Card */}
          <Card style={{ backgroundColor: '#f6f3ff', borderRadius: 18, marginBottom: 18, padding: 0, elevation: 0 }}>
            <Card.Content style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color="#fbbf24" style={{ marginRight: 8 }} />
                <Text style={{ fontWeight: 'bold', fontSize: 17, color: '#181028' }}>AI Budget Suggestions</Text>
              </View>
              {aiLoading ? (
                <ActivityIndicator />
              ) : aiSuggestionsList.length > 0 ? (
                <View style={{ marginTop: 4 }}>
                  {aiSuggestionsList.map((s, idx) => (
                    <View key={s.category} style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="star-outline" size={18} color="#7c3aed" style={{ marginRight: 8 }} />
                      <Text style={{ fontWeight: 'bold', color: '#7c3aed', fontSize: 15 }}>{s.category}</Text>
                      <Text style={{ marginLeft: 8, color: '#181028', fontSize: 15 }}>Suggested: {s.recommendedAmount}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: '#6c6c80', fontSize: 15 }}>{aiSuggestions}</Text>
              )}
            </Card.Content>
          </Card>
          {/* Active Budgets Card */}
          <Card style={{ backgroundColor: '#f6f3ff', borderRadius: 18, marginBottom: 18, padding: 0, elevation: 0 }}>
            <Card.Content style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <MaterialCommunityIcons name="wallet-outline" size={20} color="#7c3aed" style={{ marginRight: 8 }} />
                <Text style={{ fontWeight: 'bold', fontSize: 17, color: '#181028' }}>Active Budgets</Text>
              </View>
              <Text style={{ color: '#6c6c80', fontSize: 15, marginBottom: 12 }}>Overview of your current, ongoing budgets.</Text>
              {/* Budget List */}
              {loading ? <ActivityIndicator /> : budgets.length === 0 ? (
                <Text style={{ color: '#6c6c80' }}>No budgets yet. Add one to start tracking!</Text>
              ) : budgets.map(budget => {
                const percent = progress[budget.id!] || 0;
                const overBudget = percent >= 1;
                const spent = percent * budget.amount;
                const remaining = Math.max(0, budget.amount - spent);
                return (
                  <Card key={budget.id} style={{ marginBottom: 18, borderRadius: 16, backgroundColor: '#fff', elevation: 0, borderWidth: 1, borderColor: '#ececec', overflow: 'hidden' }}>
                    {/* Budget Image with overlay icons */}
                    <View style={{ position: 'relative', width: '100%', backgroundColor: '#faf9fb' }}>
                      {budget.imageUrl ? (
                        <Image source={{ uri: budget.imageUrl }} style={{ width: '100%', height: 120, resizeMode: 'cover' }} />
                      ) : (
                        <View style={{ width: '100%', height: 120, backgroundColor: '#f3f3f3', justifyContent: 'center', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="image-off-outline" size={40} color="#ccc" />
                        </View>
                      )}
                      {/* Overlay icon buttons */}
                      <View style={{ position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 8 }}>
                        <IconButton icon="upload" size={22} style={{ backgroundColor: '#fff', marginRight: 2, elevation: 2 }} onPress={() => handleUploadBudgetImage(budget)} loading={uploadingImageId === budget.id} disabled={uploadingImageId === budget.id || generatingImageId === budget.id} />
                        <IconButton icon={() => <Wand2 size={18} color="#7c3aed" />} size={22} style={{ backgroundColor: '#fff', elevation: 2 }} onPress={() => handleGenerateBudgetImage(budget)} loading={generatingImageId === budget.id} disabled={generatingImageId === budget.id || uploadingImageId === budget.id} />
                      </View>
                    </View>
                    <Card.Content style={{ padding: 16, paddingTop: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, justifyContent: 'space-between' }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#7c3aed' }}>{budget.name || 'Untitled Budget'}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <IconButton icon="pencil" size={20} onPress={() => handleOpenDialog(budget)} />
                          <IconButton icon="delete" size={20} onPress={() => handleDelete(budget)} />
                        </View>
                      </View>
                      <Text style={{ color: '#6c6c80', fontSize: 14, marginBottom: 8 }}>{budget.category} - {budget.amount.toFixed(2)} {budget.currency}</Text>
                      {/* Progress Bar and Spent/Remaining */}
                      <View style={{ height: 20, marginBottom: 6 }}>
                        <ProgressBar progress={percent > 1 ? 1 : percent} color={overBudget ? '#f43f5e' : '#7c3aed'} style={{ height: 8, borderRadius: 4, backgroundColor: '#ececec' }} />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ color: overBudget ? '#f43f5e' : '#181028', fontWeight: 'bold', fontSize: 14 }}>Spent: {spent.toFixed(2)} {budget.currency}</Text>
                        <Text style={{ color: '#181028', fontWeight: 'bold', fontSize: 14 }}>Remaining: {remaining.toFixed(2)} {budget.currency}</Text>
                      </View>
                      {/* Info/Warning Message */}
                      {hasOtherCurrencyExpenses(budget) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', borderRadius: 8, padding: 8, marginTop: 4, marginBottom: 6, borderWidth: 1, borderColor: '#fde68a' }}>
                          <AlertCircle size={18} color="#fbbf24" style={{ marginRight: 6 }} />
                          <Text style={{ color: '#b45309', fontSize: 13, flex: 1 }}>Expenses in other currencies for this category exist and are not included in this budget's progress.</Text>
                        </View>
                      )}
                      {/* Footer note */}
                      <Text style={{ color: '#6c6c80', fontSize: 12, marginTop: 2 }}>Monthly Budget for {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
                    </Card.Content>
                  </Card>
                );
              })}
            </Card.Content>
          </Card>
        </ScrollView>
        <Portal>
          <Dialog visible={showDialog} onDismiss={handleCloseDialog} style={{ borderRadius: 16 }}>
            <Dialog.Title style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 20, marginBottom: 0 }}>Add New Budget</Dialog.Title>
            <Dialog.Content style={{ paddingTop: 8 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, marginLeft: 2 }}>Budget Name</Text>
              <TextInput
                placeholder="e.g., Monthly Groceries"
                value={form.name || ''}
                onChangeText={v => setForm(f => ({ ...f, name: v }))}
                style={{ marginBottom: 4, borderRadius: 12, backgroundColor: '#faf9fb', borderWidth: 1, borderColor: '#e5e5e5' }}
                mode="outlined"
                placeholderTextColor="#b0b0b0"
                theme={{ colors: { background: '#faf9fb', placeholder: '#b0b0b0', primary: colors.primary } }}
                error={!!formErrors.name}
              />
              {formErrors.name ? <Text style={{ color: colors.error, marginBottom: 8, marginLeft: 2 }}>{formErrors.name}</Text> : <View style={{ marginBottom: 14 }} />}
              <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, marginLeft: 2 }}>Category</Text>
              <RNPickerSelect
                value={form.category || ''}
                onValueChange={v => setForm(f => ({ ...f, category: v }))}
                items={categories.map(cat => ({ label: cat.name, value: cat.name, key: cat.id }))}
                placeholder={{ label: 'Select a category', value: '' }}
                style={{
                  inputIOS: { fontSize: 16, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, color: colors.onSurface, backgroundColor: '#faf9fb', marginBottom: 4 },
                  inputAndroid: { fontSize: 16, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, color: colors.onSurface, backgroundColor: '#faf9fb', marginBottom: 4 },
                  placeholder: { color: '#b0b0b0' },
                }}
                useNativeAndroidPickerStyle={false}
              />
              {formErrors.category ? <Text style={{ color: colors.error, marginBottom: 8, marginLeft: 2 }}>{formErrors.category}</Text> : <View style={{ marginBottom: 14 }} />}
              <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, marginLeft: 2 }}>Amount</Text>
              <TextInput
                placeholder="e.g., 500"
                value={form.amount?.toString() || ''}
                onChangeText={v => setForm(f => ({ ...f, amount: parseFloat(v) }))}
                keyboardType="decimal-pad"
                mode="outlined"
                style={{ borderRadius: 12, backgroundColor: '#faf9fb', borderWidth: 1, borderColor: '#e5e5e5', marginBottom: 4 }}
                placeholderTextColor="#b0b0b0"
                theme={{ colors: { background: '#faf9fb', placeholder: '#b0b0b0', primary: colors.primary } }}
                error={!!formErrors.amount}
              />
              {formErrors.amount ? <Text style={{ color: colors.error, marginBottom: 8, marginLeft: 2 }}>{formErrors.amount}</Text> : <View style={{ marginBottom: 14 }} />}
              <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, marginLeft: 2 }}>Currency</Text>
              <RNPickerSelect
                value={form.currency || ''}
                onValueChange={v => setForm(f => ({ ...f, currency: v }))}
                items={SUPPORTED_CURRENCIES.map(c => ({ label: `${c.code} - ${c.name}`, value: c.code }))}
                placeholder={{ label: 'Select currency', value: '' }}
                style={{
                  inputIOS: { fontSize: 16, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, color: colors.onSurface, backgroundColor: '#faf9fb', marginBottom: 4 },
                  inputAndroid: { fontSize: 16, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, color: colors.onSurface, backgroundColor: '#faf9fb', marginBottom: 4 },
                  placeholder: { color: '#b0b0b0' },
                }}
                useNativeAndroidPickerStyle={false}
                Icon={() => <MaterialCommunityIcons name="bank" size={20} color={colors.primary} style={{ marginRight: 8 }} />}
              />
              {formErrors.currency ? <Text style={{ color: colors.error, marginBottom: 8, marginLeft: 2 }}>{formErrors.currency}</Text> : <View style={{ marginBottom: 14 }} />}
              <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, marginLeft: 2 }}>Period</Text>
              <RNPickerSelect
                value={form.period || 'monthly'}
                onValueChange={v => setForm(f => ({ ...f, period: v }))}
                items={PERIOD_OPTIONS}
                placeholder={{ label: 'Select period', value: '' }}
                style={{
                  inputIOS: { fontSize: 16, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, color: colors.onSurface, backgroundColor: '#faf9fb', marginBottom: 4 },
                  inputAndroid: { fontSize: 16, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, color: colors.onSurface, backgroundColor: '#faf9fb', marginBottom: 4 },
                  placeholder: { color: '#b0b0b0' },
                }}
                useNativeAndroidPickerStyle={false}
                Icon={() => <MaterialCommunityIcons name="calendar-range" size={20} color={colors.primary} style={{ marginRight: 8 }} />}
              />
              {formErrors.period ? <Text style={{ color: colors.error, marginBottom: 8, marginLeft: 2 }}>{formErrors.period}</Text> : <View style={{ marginBottom: 14 }} />}
              {form.period === 'custom' && (
                <>
                  <Button mode="outlined" onPress={() => setShowStartDatePicker(true)} style={{ marginBottom: 8 }}>
                    {form.startDate ? `Start: ${form.startDate}` : 'Pick Start Date'}
                  </Button>
                  {formErrors.startDate ? <Text style={{ color: colors.error, marginBottom: 8, marginLeft: 2 }}>{formErrors.startDate}</Text> : null}
                  {showStartDatePicker && (
                    <DateTimePicker
                      value={form.startDate ? new Date(form.startDate) : new Date()}
                      mode="date"
                      display="default"
                      onChange={(_, selectedDate) => {
                        setShowStartDatePicker(false);
                        if (selectedDate) setForm(f => ({ ...f, startDate: selectedDate.toISOString().slice(0, 10) }));
                      }}
                    />
                  )}
                  <Button mode="outlined" onPress={() => setShowEndDatePicker(true)} style={{ marginBottom: 8 }}>
                    {form.endDate ? `End: ${form.endDate}` : 'Pick End Date'}
                  </Button>
                  {formErrors.endDate ? <Text style={{ color: colors.error, marginBottom: 8, marginLeft: 2 }}>{formErrors.endDate}</Text> : null}
                  {showEndDatePicker && (
                    <DateTimePicker
                      value={form.endDate ? new Date(form.endDate) : new Date()}
                      mode="date"
                      display="default"
                      onChange={(_, selectedDate) => {
                        setShowEndDatePicker(false);
                        if (selectedDate) setForm(f => ({ ...f, endDate: selectedDate.toISOString().slice(0, 10) }));
                      }}
                    />
                  )}
                </>
              )}
            </Dialog.Content>
            <Dialog.Actions style={{ flexDirection: 'column', alignItems: 'stretch', paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
              <Button mode="contained" icon="content-save" onPress={handleSave} loading={saving} style={{ borderRadius: 8, backgroundColor: colors.primary, marginBottom: 8, width: '100%' }}>{form.id ? 'Save' : 'Create Budget'}</Button>
              <Button mode="outlined" onPress={handleCloseDialog} style={{ borderRadius: 8, borderWidth: 1, borderColor: colors.primary, width: '100%' }}>Cancel</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </Surface>
  );
} 