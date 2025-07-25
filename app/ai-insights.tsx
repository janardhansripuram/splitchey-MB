import React, { useState, useEffect } from 'react';
import { View, ScrollView, Share } from 'react-native';
import { Surface, Text, TextInput, Button, Card, ActivityIndicator, useTheme, Snackbar, IconButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../hooks/useAuth';
import { getExpensesByUser, getIncomeByUser } from '../firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Voice from '@react-native-voice/voice';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PERIOD_OPTIONS = [
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 365 days', value: 365 },
];

export default function AIInsightsScreen() {
  const { authUser, userProfile, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [income, setIncome] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [qaLoading, setQaLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });
  const [anomalies, setAnomalies] = useState<any[] | null>(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [qaHistory, setQaHistory] = useState<{ question: string; answer: string }[]>([]);

  // Voice input for Q&A
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  useEffect(() => {
    Voice.onSpeechResults = (event) => {
      if (event.value && event.value.length > 0) {
        setQuestion(event.value[0]);
      }
      setIsListening(false);
    };
    Voice.onSpeechError = (event) => {
      setVoiceError(event.error?.message || 'Voice error');
      setIsListening(false);
    };
    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  const handleVoiceInput = async () => {
    setVoiceError(null);
    setIsListening(true);
    try {
      await Voice.start('en-US');
    } catch (e: any) {
      setVoiceError(e.message || 'Could not start voice recognition');
      setIsListening(false);
    }
  };

  useEffect(() => {
    if (!authUser) return;
    setLoading(true);
    Promise.all([
      getExpensesByUser(authUser.uid),
      getIncomeByUser(authUser.uid)
    ])
      .then(([expensesData, incomeData]) => {
        setExpenses(expensesData);
        setIncome(incomeData);
      })
      .catch(() => setSnackbar({ visible: true, message: 'Failed to fetch financial data.' }))
      .finally(() => setLoading(false));
  }, [authUser]);

  const filteredExpenses = expenses.filter(e => {
    const date = new Date(e.date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    return date >= cutoff;
  });

  const filteredIncome = income.filter(i => {
    const date = new Date(i.date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    return date >= cutoff;
  });

  const expenseDataString = filteredExpenses.map(e => `${e.category}: ${e.description} - ${e.amount} ${e.currency} on ${e.date}`).join('\n');
  const incomeDataString = filteredIncome.map(i => `${i.source} - ${i.amount} ${i.currency} on ${i.date}`).join('\n');

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    setSummary(null);
    setSnackbar({ visible: false, message: '' });
    try {
      const functions = getFunctions();
      const summarizeSpending = httpsCallable(functions, 'summarizeSpending');
      const res = await summarizeSpending({
        spendingData: expenseDataString,
        incomeData: incomeDataString,
        period: `Last ${period} days`,
      });
      let summaryText = '';
      if (res.data && typeof res.data === 'object' && 'summary' in res.data) {
        summaryText = String(res.data.summary);
      } else if (typeof res.data === 'string') {
        summaryText = res.data;
      } else {
        summaryText = String(res.data);
      }
      setSummary(summaryText);
    } catch (e: any) {
      setSnackbar({ visible: true, message: e.message || 'Failed to generate summary.' });
    }
    setSummaryLoading(false);
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    setQaLoading(true);
    setAnswer(null);
    setSnackbar({ visible: false, message: '' });
    try {
      const functions = getFunctions();
      const queryFinancialData = httpsCallable(functions, 'queryFinancialData');
      const res = await queryFinancialData({
        query: question,
        expenseData: expenseDataString,
        incomeData: incomeDataString,
        period: `Last ${period} days`,
      });
      let answerText = '';
      if (res.data && typeof res.data === 'object' && 'answer' in res.data) {
        answerText = String(res.data.answer);
      } else if (typeof res.data === 'string') {
        answerText = res.data;
      } else {
        answerText = String(res.data);
      }
      setAnswer(answerText);
      setQaHistory(prev => [{ question, answer: answerText }, ...prev].slice(0, 5));
    } catch (e: any) {
      setSnackbar({ visible: true, message: e.message || 'Failed to get answer.' });
    }
    setQaLoading(false);
  };

  const handleDetectAnomalies = async () => {
    setAnomalyLoading(true);
    setAnomalies(null);
    setSnackbar({ visible: false, message: '' });
    try {
      const functions = getFunctions();
      const detectSpendingAnomalies = httpsCallable(functions, 'detectSpendingAnomalies');
      const res = await detectSpendingAnomalies({
        spendingData: expenseDataString,
        incomeData: incomeDataString,
        period: `Last ${period} days`,
      });
      let foundAnomalies: any[] = [];
      if (res.data && Array.isArray(res.data)) {
        foundAnomalies = res.data;
        setAnomalies(res.data);
      } else if (res.data && res.data.anomalies) {
        foundAnomalies = res.data.anomalies;
        setAnomalies(res.data.anomalies);
      } else {
        setAnomalies([]);
      }
      if (foundAnomalies.length > 0) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Spending Anomaly Detected',
            body: foundAnomalies[0].anomalyDescription || foundAnomalies[0].description || 'Check your AI Insights for details.',
            data: { type: 'anomaly' },
          },
          trigger: null,
        });
      }
    } catch (e: any) {
      setSnackbar({ visible: true, message: e.message || 'Failed to detect anomalies.' });
    }
    setAnomalyLoading(false);
  };

  // Calculate top categories
  const categoryTotals: Record<string, number> = {};
  filteredExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxCategoryAmount = topCategories.length > 0 ? topCategories[0][1] : 1;

  // Extract AI tip from summary (if available)
  let aiTip = '';
  if (summary && typeof summary === 'string') {
    // Try to extract a tip from the summary (look for 'Potential Savings:' or similar)
    const match = summary.match(/Potential Savings:(.*)/i);
    if (match && match[1]) {
      aiTip = match[1].trim();
    } else {
      // Fallback: suggest a top category to budget
      if (topCategories.length > 0) {
        aiTip = `Consider setting a budget for ${topCategories[0][0]} to save more!`;
      }
    }
  } else if (topCategories.length > 0) {
    aiTip = `Consider setting a budget for ${topCategories[0][0]} to save more!`;
  } else {
    aiTip = 'Track your expenses regularly to discover new ways to save!';
  }

  // Share handler
  const handleShareInsights = async () => {
    let shareText = 'My AI Financial Insights:';
    if (summary) {
      shareText += `\n\nSummary:\n${summary}`;
    }
    if (topCategories.length > 0) {
      shareText += '\n\nTop Spending Categories:';
      topCategories.forEach(([cat, amt]) => {
        shareText += `\n- ${cat}: ${amt.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
      });
    }
    try {
      await Share.share({ message: shareText });
    } catch (e) {
      setSnackbar({ visible: true, message: 'Failed to share insights.' });
    }
  };

  const insets = useSafeAreaInsets();

  if (authLoading || loading) {
    return <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" /></Surface>;
  }

  // 1. Enable Share Insights button when there is a summary or top categories
  const canShare = !!summary || (Array.isArray(topCategories) && topCategories.length > 0);

  return (
    <Surface style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top + 16 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* Personalized AI Tip Section */}
        <Card style={{ marginBottom: 20, borderRadius: 20, elevation: 2, backgroundColor: colors.elevation.level1 }}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={22} color={colors.primary} style={{ marginRight: 8 }} />
              <Text variant="titleMedium" style={{ color: colors.primary, fontWeight: 'bold' }}>Personalized AI Tip</Text>
            </View>
            <Text style={{ color: colors.onSurfaceVariant }}>{aiTip}</Text>
          </Card.Content>
        </Card>
        {/* Export/Share Insights Button */}
        <Button mode="outlined" icon="share-variant" onPress={handleShareInsights} disabled={!canShare} style={{ marginBottom: 20 }}>
          Share Insights
        </Button>
        {/* Top Categories Section */}
        <Card style={{ marginBottom: 20, borderRadius: 20, elevation: 2, backgroundColor: colors.elevation.level1 }}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="chart-bar" size={22} color={colors.primary} style={{ marginRight: 8 }} />
              <Text variant="titleMedium" style={{ color: colors.primary, fontWeight: 'bold' }}>Top Spending Categories</Text>
            </View>
            {topCategories.length === 0 && <Text style={{ color: colors.onSurfaceVariant }}>No expenses in this period.</Text>}
            {/* 2. Fix top spending category amount overflow in the render */}
            {Array.isArray(topCategories) && topCategories.length > 0 && (
              <View style={{ marginTop: 8 }}>
                {topCategories.map((cat, idx) => {
                  let name = '';
                  let amount = 0;
                  let currency = '';
                  if (Array.isArray(cat)) {
                    name = cat[0];
                    amount = typeof cat[1] === 'number' ? cat[1] : 0;
                  } else {
                    name = cat.name;
                    amount = cat.amount;
                    currency = cat.currency || '';
                  }
                  return (
                    <View key={name} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontWeight: 'bold', color: colors.primary }}>{name}</Text>
                      <Text style={{ color: colors.onSurface, fontWeight: 'bold' }} numberOfLines={1}>{amount.toFixed(2)} {currency}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Card.Content>
        </Card>
        {/* AI Summary Section */}
        <Card style={{ marginBottom: 20, borderRadius: 20, elevation: 2, backgroundColor: colors.elevation.level1 }}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="file-document-outline" size={22} color={colors.primary} style={{ marginRight: 8 }} />
              <Text variant="titleMedium" style={{ color: colors.primary, fontWeight: 'bold' }}>AI Summary</Text>
            </View>
            {summaryLoading && <ActivityIndicator style={{ marginBottom: 8 }} />}
            {summary && <Text style={{ marginBottom: 8 }}>{summary}</Text>}
          </Card.Content>
        </Card>
        {/* Anomaly Detection Section */}
        <Card style={{ marginBottom: 20, borderRadius: 20, elevation: 2, backgroundColor: colors.elevation.level1 }}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="alert-decagram-outline" size={22} color={colors.primary} style={{ marginRight: 8 }} />
              <Text variant="titleMedium" style={{ color: colors.primary, fontWeight: 'bold' }}>Anomaly Detection</Text>
            </View>
            <Button mode="contained" onPress={handleDetectAnomalies} loading={anomalyLoading} style={{ marginBottom: 8 }}>Detect Anomalies</Button>
            {anomalyLoading && <ActivityIndicator style={{ marginBottom: 8 }} />}
            {Array.isArray(anomalies) && anomalies.length > 0 && (
              <View style={{ marginTop: 8 }}>
                {anomalies.map((a, i) => (
                  <Text key={i} style={{ marginBottom: 4, color: '#ef4444' }}>
                    <MaterialCommunityIcons name="alert-outline" size={16} color="#ef4444" style={{ marginRight: 4 }} />
                    {a.anomalyDescription || a.description || JSON.stringify(a)}
                    {a.reasoning ? ` (${a.reasoning})` : ''}
                  </Text>
                ))}
              </View>
            )}
            {Array.isArray(anomalies) && anomalies.length === 0 && !anomalyLoading && (
              <Text style={{ marginTop: 8, color: colors.onSurfaceVariant }}>No significant anomalies detected.</Text>
            )}
          </Card.Content>
        </Card>
        {/* Q&A Section */}
        <Card style={{ marginBottom: 20, borderRadius: 20, elevation: 2, backgroundColor: colors.elevation.level1 }}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="robot-outline" size={22} color={colors.primary} style={{ marginRight: 8 }} />
              <Text variant="titleMedium" style={{ color: colors.primary, fontWeight: 'bold' }}>Ask a Question</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                label="Ask about your spending (e.g., How much did I spend on food?)"
                value={question}
                onChangeText={setQuestion}
                mode="outlined"
                style={{ flex: 1, marginBottom: 8 }}
              />
              <IconButton icon={isListening ? 'microphone-off' : 'microphone'} size={24} onPress={handleVoiceInput} style={{ marginLeft: 4, marginBottom: 8 }} loading={isListening} />
            </View>
            <Button mode="contained" onPress={handleAskQuestion} loading={qaLoading} disabled={!question.trim()}>Ask AI</Button>
            {qaLoading && <ActivityIndicator style={{ marginTop: 8 }} />}
            {answer && <Text style={{ marginTop: 8 }}>{answer}</Text>}
          </Card.Content>
        </Card>
        {/* Recent Q&A History */}
        {qaHistory.length > 0 && (
          <Card style={{ marginBottom: 20, borderRadius: 20, elevation: 1, backgroundColor: colors.elevation.level1 }}>
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <MaterialCommunityIcons name="history" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                <Text variant="titleMedium" style={{ color: colors.primary, fontWeight: 'bold' }}>Recent AI Q&A</Text>
              </View>
              {qaHistory.map((item, idx) => (
                <View key={idx} style={{ marginBottom: 12 }}>
                  <Text style={{ fontWeight: 'bold', color: colors.onSurface }}>
                    <MaterialCommunityIcons name="comment-question-outline" size={16} color={colors.primary} style={{ marginRight: 4 }} />
                    Q: {item.question}
                  </Text>
                  <Text style={{ color: colors.onSurfaceVariant }}>
                    <MaterialCommunityIcons name="robot-outline" size={16} color={colors.primary} style={{ marginRight: 4 }} />
                    A: {item.answer}
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}
      </ScrollView>
      <Snackbar
        visible={snackbar.visible || !!voiceError}
        onDismiss={() => { setSnackbar({ visible: false, message: '' }); setVoiceError(null); }}
        duration={2500}
        style={{ backgroundColor: colors.error }}
      >
        {snackbar.message || voiceError}
      </Snackbar>
    </Surface>
  );
} 