import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Card, IconButton, Snackbar, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getExpensesByUser, getIncomeByUser } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';

const PERIOD_OPTIONS = [
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 365 days', value: 365 },
];

export default function AIInsightsScreen() {
  const router = useRouter();
  const { authUser, userProfile, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
    try {
      // Simple summary generation
      const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
      const totalIncome = filteredIncome.reduce((sum, i) => sum + i.amount, 0);
      const netSavings = totalIncome - totalExpenses;
      
      const topCategories = filteredExpenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {} as Record<string, number>);
      
      const topCategory = Object.entries(topCategories).sort((a, b) => b[1] - a[1])[0];
      
      const summaryText = `Financial Summary (${period} days):
• Total Income: ${totalIncome.toFixed(2)}
• Total Expenses: ${totalExpenses.toFixed(2)}
• Net Savings: ${netSavings.toFixed(2)}
• Top Spending Category: ${topCategory ? `${topCategory[0]} (${topCategory[1].toFixed(2)})` : 'N/A'}
• Number of Transactions: ${filteredExpenses.length + filteredIncome.length}`;
      
      setSummary(summaryText);
    } catch (error) {
      setSnackbar({ visible: true, message: 'Failed to generate summary.' });
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    
    setQaLoading(true);
    try {
      // Simple AI response based on question keywords
      const q = question.toLowerCase();
      let response = "I'm here to help with your financial insights!";
      
      if (q.includes('spend') || q.includes('expense')) {
        const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        response = `You've spent a total of ${total.toFixed(2)} in the last ${period} days.`;
      } else if (q.includes('income') || q.includes('earn')) {
        const total = filteredIncome.reduce((sum, i) => sum + i.amount, 0);
        response = `You've earned a total of ${total.toFixed(2)} in the last ${period} days.`;
      } else if (q.includes('category') || q.includes('spending')) {
        const categories = filteredExpenses.reduce((acc, e) => {
          acc[e.category] = (acc[e.category] || 0) + e.amount;
          return acc;
        }, {} as Record<string, number>);
        
        const topCategories = Object.entries(categories)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([cat, amt]) => `${cat}: ${amt.toFixed(2)}`)
          .join(', ');
        
        response = `Your top spending categories are: ${topCategories}`;
      } else if (q.includes('savings') || q.includes('save')) {
        const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totalIncome = filteredIncome.reduce((sum, i) => sum + i.amount, 0);
        const savings = totalIncome - totalExpenses;
        response = `Your net savings in the last ${period} days is ${savings.toFixed(2)}.`;
      }
      
      setAnswer(response);
      setQaHistory(prev => [...prev, { question: question, answer: response }]);
      setQuestion('');
    } catch (error) {
      setSnackbar({ visible: true, message: 'Failed to process question.' });
    } finally {
      setQaLoading(false);
    }
  };

  const handleDetectAnomalies = async () => {
    setAnomalyLoading(true);
    try {
      const anomalies = [];
      
      // Check for unusual spending patterns
      const avgExpense = filteredExpenses.reduce((sum, e) => sum + e.amount, 0) / filteredExpenses.length;
      const highExpenses = filteredExpenses.filter(e => e.amount > avgExpense * 2);
      
      if (highExpenses.length > 0) {
        anomalies.push({
          anomalyDescription: `Unusually high expenses detected: ${highExpenses.length} transactions above average`,
          reasoning: 'These expenses are more than 2x the average transaction amount'
        });
      }
      
      // Check for spending gaps
      if (filteredExpenses.length === 0 && filteredIncome.length > 0) {
        anomalies.push({
          anomalyDescription: 'No expenses recorded despite having income',
          reasoning: 'Consider tracking your expenses for better financial visibility'
        });
      }
      
      setAnomalies(anomalies);
    } catch (error) {
      setSnackbar({ visible: true, message: 'Failed to detect anomalies.' });
    } finally {
      setAnomalyLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" />
      </Surface>
    );
  }

  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ 
        paddingTop: insets.top + 20, 
        paddingBottom: 20, 
        paddingHorizontal: 20,
        backgroundColor: colors.primary,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => router.back()}
            iconColor="#fff"
          />
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 22, marginLeft: 8 }}>
            AI Insights
          </Text>
        </View>
        <Text style={{ color: '#fff', opacity: 0.9, fontSize: 16 }}>
          Smart analysis of your financial data
        </Text>
      </View>
      
      <ScrollView style={{ flex: 1, padding: 20 }}>
        {/* Period Selection */}
        <Card style={{ marginBottom: 20, borderRadius: 20, elevation: 2, backgroundColor: colors.elevation.level1 }}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="calendar-range" size={22} color={colors.primary} style={{ marginRight: 8 }} />
              <Text variant="titleMedium" style={{ color: colors.primary, fontWeight: 'bold' }}>Analysis Period</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {PERIOD_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  mode={period === option.value ? 'contained' : 'outlined'}
                  onPress={() => setPeriod(option.value)}
                  style={{ flex: 1 }}
                  compact
                >
                  {option.label}
                </Button>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Quick Stats */}
        <Card style={{ marginBottom: 20, borderRadius: 20, elevation: 2, backgroundColor: colors.elevation.level1 }}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="chart-line" size={22} color={colors.primary} style={{ marginRight: 8 }} />
              <Text variant="titleMedium" style={{ color: colors.primary, fontWeight: 'bold' }}>Quick Stats</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary }}>
                  {filteredExpenses.length}
                </Text>
                <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>Expenses</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary }}>
                  {filteredIncome.length}
                </Text>
                <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>Income</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary }}>
                  {(filteredIncome.reduce((sum, i) => sum + i.amount, 0) - filteredExpenses.reduce((sum, e) => sum + e.amount, 0)).toFixed(0)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>Net</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* AI Summary Section */}
        <Card style={{ marginBottom: 20, borderRadius: 20, elevation: 2, backgroundColor: colors.elevation.level1 }}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="file-document-outline" size={22} color={colors.primary} style={{ marginRight: 8 }} />
              <Text variant="titleMedium" style={{ color: colors.primary, fontWeight: 'bold' }}>AI Summary</Text>
            </View>
            <Button mode="contained" onPress={handleGenerateSummary} loading={summaryLoading} style={{ marginBottom: 8 }}>
              Generate Summary
            </Button>
            {summary && <Text style={{ marginTop: 8, lineHeight: 20 }}>{summary}</Text>}
          </Card.Content>
        </Card>

        {/* Anomaly Detection Section */}
        <Card style={{ marginBottom: 20, borderRadius: 20, elevation: 2, backgroundColor: colors.elevation.level1 }}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="alert-decagram-outline" size={22} color={colors.primary} style={{ marginRight: 8 }} />
              <Text variant="titleMedium" style={{ color: colors.primary, fontWeight: 'bold' }}>Anomaly Detection</Text>
            </View>
            <Button mode="contained" onPress={handleDetectAnomalies} loading={anomalyLoading} style={{ marginBottom: 8 }}>
              Detect Anomalies
            </Button>
            {Array.isArray(anomalies) && anomalies.length > 0 && (
              <View style={{ marginTop: 8 }}>
                {anomalies.map((a, i) => (
                  <Text key={i} style={{ marginBottom: 4, color: '#ef4444' }}>
                    <MaterialCommunityIcons name="alert-outline" size={16} color="#ef4444" style={{ marginRight: 4 }} />
                    {a.anomalyDescription}
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
            <TextInput
              label="Ask about your spending (e.g., How much did I spend on food?)"
              value={question}
              onChangeText={setQuestion}
              mode="outlined"
              style={{ marginBottom: 8 }}
            />
            <Button mode="contained" onPress={handleAskQuestion} loading={qaLoading} disabled={!question.trim()}>
              Ask AI
            </Button>
            {answer && <Text style={{ marginTop: 8, lineHeight: 20 }}>{answer}</Text>}
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
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: '' })}
        duration={2500}
        style={{ backgroundColor: colors.error }}
      >
        {snackbar.message}
      </Snackbar>
    </Surface>
  );
} 