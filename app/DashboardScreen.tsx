import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, ScrollView, Image, StyleSheet, RefreshControl } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { Surface, Text, Avatar, Button, Card, ActivityIndicator, FAB, useTheme, Chip, IconButton, Divider, Snackbar } from 'react-native-paper';
import { useAuth } from '../hooks/useAuth';
import { getRecentExpensesByUser, getFriends, getSplitExpensesForUser, getGroupsForUser } from '../firebase/firestore';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function DashboardScreen() {
  const { authUser, userProfile } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '', color: '' });
  const [refreshing, setRefreshing] = useState(false);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    try {
      const [recent, fetchedFriends, fetchedSplits, fetchedGroups] = await Promise.all([
        getRecentExpensesByUser(authUser.uid, 5),
        getFriends(authUser.uid),
        getSplitExpensesForUser(authUser.uid),
        getGroupsForUser(authUser.uid)
      ]);
      setRecentExpenses(recent);
      setFriends(fetchedFriends);
      setSplits(fetchedSplits);
      setGroups(fetchedGroups.slice(0, 5));
    } catch (e) {
      setSnackbar({ visible: true, message: 'Failed to load dashboard data.', color: 'red' });
    }
    setLoading(false);
  }, [authUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Net balances calculation (same as web)
  const netBalances = useMemo(() => {
    if (!userProfile || splits.length === 0) return {};
    const balances = {};
    splits.filter(split => split.participants.some(p => p.settlementStatus !== 'settled')).forEach(split => {
      const currency = split.currency;
      if (split.paidBy === userProfile.uid) {
        split.participants.filter(p => p.userId !== userProfile.uid && p.settlementStatus !== 'settled').forEach(p => {
          balances[currency] = (balances[currency] || 0) + p.amountOwed;
        });
      } else {
        const currentUserParticipant = split.participants.find(p => p.userId === userProfile.uid);
        if (currentUserParticipant && currentUserParticipant.settlementStatus !== 'settled') {
          balances[currency] = (balances[currency] || 0) - currentUserParticipant.amountOwed;
        }
      }
    });
    return balances;
  }, [splits, userProfile]);

  // Recent expenses total by currency
  const recentExpensesTotalByCurrency = useMemo(() => {
    const totals = {};
    recentExpenses.forEach(exp => {
      totals[exp.currency] = (totals[exp.currency] || 0) + exp.amount;
    });
    return Object.entries(totals).sort(([a], [b]) => a.localeCompare(b));
  }, [recentExpenses]);

  // UI helpers
  const formatCurrency = (amount, currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency, signDisplay: 'auto' }).format(amount);
  const getInitials = (name, email) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : (email ? email[0].toUpperCase() : '?');

  // --- Web-matching logic for Who Owes Whom ---
  const friendBalances = useMemo(() => {
    if (!userProfile || friends.length === 0 || splits.length === 0) return [];
    const personalSplits = splits.filter((s: any) => !s.groupId);
    if (personalSplits.length === 0) return [];
    const friendMap = new Map(friends.map((f: any) => [f.uid, f]));
    const netDebts: Record<string, Record<string, number>> = {};
    personalSplits.forEach((split: any) => {
      const currency = split.currency;
      // Case 1: I am the payer
      if (split.paidBy === userProfile.uid) {
        split.participants.forEach((p: any) => {
          if (p.userId !== userProfile.uid && p.settlementStatus !== 'settled' && friendMap.has(p.userId)) {
            if (!netDebts[p.userId]) netDebts[p.userId] = {};
            netDebts[p.userId][currency] = (netDebts[p.userId][currency] || 0) + p.amountOwed;
          }
        });
      } else {
        // Case 2: I am a participant, but not the payer
        const currentUserParticipant = split.participants.find((p: any) => p.userId === userProfile.uid);
        if (currentUserParticipant && currentUserParticipant.settlementStatus !== 'settled') {
          if (friendMap.has(split.paidBy)) {
            if (!netDebts[split.paidBy]) netDebts[split.paidBy] = {};
            netDebts[split.paidBy][currency] = (netDebts[split.paidBy][currency] || 0) - currentUserParticipant.amountOwed;
          }
        }
      }
    });
    const summaries: any[] = [];
    Object.entries(netDebts).forEach(([friendId, currencyAmounts]) => {
      const friend = friendMap.get(friendId);
      if (!friend) return;
      Object.entries(currencyAmounts).forEach(([currency, amount]: [any, any]) => {
        if (Math.abs(amount) > 0.01) {
          summaries.push({ friend, amount, currency });
        }
      });
    });
    return summaries.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [userProfile, friends, splits]);

  const groupBalances = useMemo(() => {
    if (!userProfile || groups.length === 0 || splits.length === 0) return [];
    const groupSplits = splits.filter((s: any) => s.groupId);
    if (groupSplits.length === 0) return [];
    const groupMap = new Map(groups.map((g: any) => [g.id, g]));
    const netDebts: Record<string, Record<string, number>> = {};
    groupSplits.forEach((split: any) => {
      const currency = split.currency;
      const myParticipant = split.participants.find((p: any) => p.userId === userProfile.uid);
      if (!myParticipant || myParticipant.settlementStatus === 'settled') return;
      const myShare = myParticipant.amountOwed;
      const iPaid = split.paidBy === userProfile.uid ? split.totalAmount : 0;
      const balanceForThisSplit = iPaid - myShare;
      if (!netDebts[split.groupId]) netDebts[split.groupId] = {};
      netDebts[split.groupId][currency] = (netDebts[split.groupId][currency] || 0) + balanceForThisSplit;
    });
    const summaries: any[] = [];
    Object.entries(netDebts).forEach(([groupId, currencyAmounts]) => {
      const group = groupMap.get(groupId);
      if (!group) return;
      Object.entries(currencyAmounts).forEach(([currency, amount]: [any, any]) => {
        if (Math.abs(amount) > 0.01) {
          summaries.push({ group, amount, currency });
        }
      });
    });
    return summaries.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [userProfile, groups, splits]);

  const allBalances = useMemo(() => {
    const combined = [...friendBalances, ...groupBalances];
    return combined.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [friendBalances, groupBalances]);

  // Debug logs for troubleshooting 'Who Owes Whom'
  useEffect(() => {
    if (!loading) {
      // Print raw splits, friends, and computed debts
      // eslint-disable-next-line no-console
      console.log('DASHBOARD DEBUG: splits', splits);
      // eslint-disable-next-line no-console
      console.log('DASHBOARD DEBUG: friends', friends);
      // eslint-disable-next-line no-console
      console.log('DASHBOARD DEBUG: friendBalances', friendBalances);
      // eslint-disable-next-line no-console
      console.log('DASHBOARD DEBUG: groupBalances', groupBalances);
      // eslint-disable-next-line no-console
      console.log('DASHBOARD DEBUG: allBalances', allBalances);
    }
  }, [loading, splits, friends, friendBalances, groupBalances, allBalances]);

  if (loading) {
    return <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator animating color={colors.primary} size="large" /><Text>Loading...</Text></Surface>;
  }

  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar backgroundColor={colors.primary} style="light" translucent />
      {/* Header: Net Balance */}
      <View style={{ paddingTop: insets.top + 20, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, backgroundColor: colors.primary, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 22 }}>Dashboard</Text>
          <Avatar.Text size={40} label={getInitials(userProfile?.displayName, userProfile?.email)} style={{ backgroundColor: colors.elevation.level2 }} />
        </View>
        <Text style={{ color: '#fff', fontSize: 15, marginBottom: 4 }}>My Net Balance</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, minHeight: 40 }}>
          {Object.entries(netBalances).length > 0 ? Object.entries(netBalances).map(([currency, amount]) => (
            <Text key={currency} style={{ color: amount >= 0 ? '#fff' : '#fecaca', fontWeight: 'bold', fontSize: 24, marginRight: 16 }}>{formatCurrency(amount, currency)}</Text>
          )) : (
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 24 }}>{formatCurrency(0, userProfile?.defaultCurrency || 'USD')}</Text>
          )}
        </View>
        <Text style={{ color: '#fff', fontSize: 12, marginTop: 2, opacity: 0.8 }}>(You are owed vs. You owe)</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Who Owes Whom */}
        <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8, color: colors.onSurface }}>Who Owes Whom</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {allBalances.length > 0 ? allBalances.map(summary => (
            'friend' in summary ? (
              <TouchableOpacity key={summary.friend.uid + summary.currency} style={[styles.debtCard, { backgroundColor: colors.elevation.level1 }]} onPress={() => router.push(`/friend-detail?friendId=${summary.friend.uid}`)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Avatar.Text size={36} label={getInitials(summary.friend.displayName, summary.friend.email)} style={{ backgroundColor: colors.primary, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 15, color: colors.onSurface }}>{summary.amount > 0 ? `${summary.friend.displayName} owes you` : `You owe ${summary.friend.displayName}`}</Text>
                    <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>From personal splits</Text>
                  </View>
                </View>
                <Text style={{ fontWeight: 'bold', fontSize: 18, color: summary.amount > 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(Math.abs(summary.amount), summary.currency)}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity key={summary.group.id + summary.currency} style={[styles.debtCard, { backgroundColor: colors.elevation.level1 }]} onPress={() => router.push(`/groups-detail?groupId=${summary.group.id}`)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Avatar.Text size={36} label={getInitials(summary.group.name)} style={{ backgroundColor: colors.primary, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 15, color: colors.onSurface }}>{summary.amount > 0 ? `You're owed by ${summary.group.name}` : `You owe ${summary.group.name}`}</Text>
                    <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>From group splits</Text>
                  </View>
                </View>
                <Text style={{ fontWeight: 'bold', fontSize: 18, color: summary.amount > 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(Math.abs(summary.amount), summary.currency)}</Text>
              </TouchableOpacity>
            )
          )) : (
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 15 }}>No outstanding debts. All settled up!</Text>
          )}
        </ScrollView>

        {/* Friends */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' }}>
          <Text style={{ fontWeight: 'bold', fontSize: 18, color: colors.onSurface }}>Friends</Text>
          <Button mode="text" icon="account-plus" onPress={() => router.push('/friends')} compact labelStyle={{ color: colors.primary, fontWeight: 'bold' }}>Add</Button>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {friends.length > 0 ? friends.slice(0, 4).map(friend => (
            <TouchableOpacity key={friend.uid} style={[styles.friendCard, { backgroundColor: colors.elevation.level1 }]} onPress={() => router.push(`/friend-detail?friendId=${friend.uid}`)}>
              <Avatar.Text size={48} label={getInitials(friend.displayName, friend.email)} style={{ backgroundColor: colors.primary, marginBottom: 6 }} />
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.onSurface, textAlign: 'center' }}>{friend.displayName}</Text>
            </TouchableOpacity>
          )) : (
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 15 }}>No friends yet.</Text>
          )}
        </ScrollView>

        {/* Groups */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' }}>
          <Text style={{ fontWeight: 'bold', fontSize: 18, color: colors.onSurface }}>Groups</Text>
          <Button mode="text" icon="plus" onPress={() => router.push('/groups')} compact labelStyle={{ color: colors.primary, fontWeight: 'bold' }}>Create</Button>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {groups.length > 0 ? groups.map(group => (
            <TouchableOpacity key={group.id} style={[styles.groupCard, { backgroundColor: colors.elevation.level1 }]} onPress={() => router.push(`/groups-detail?groupId=${group.id}`)}>
              {group.imageUrl ? (
                <Image source={{ uri: group.imageUrl }} style={{ width: 80, height: 60, borderRadius: 10, marginBottom: 6 }} />
              ) : (
                <View style={{ width: 80, height: 60, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                  <Ionicons name="people-outline" size={32} color="#fff" />
                </View>
              )}
              <Text style={{ fontWeight: 'bold', fontSize: 15, color: colors.onSurface, textAlign: 'center' }}>{group.name}</Text>
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, textAlign: 'center' }}>{group.memberIds.length} members</Text>
            </TouchableOpacity>
          )) : (
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 15 }}>No groups yet.</Text>
          )}
        </ScrollView>

        {/* Recent Activity */}
        <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8, color: colors.onSurface }}>Recent Activity</Text>
        {recentExpenses.length > 0 ? recentExpenses.map(expense => (
          <Card key={expense.id} style={[styles.expenseCard, { backgroundColor: colors.elevation.level1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="cart-outline" size={28} color={colors.primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 15, color: colors.onSurface }}>{expense.description}</Text>
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>{expense.category}</Text>
              </View>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#ef4444' }}>- {formatCurrency(expense.amount, expense.currency)}</Text>
            </View>
          </Card>
        )) : (
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 15 }}>No recent expenses.</Text>
        )}

        {/* Smart Features */}
        <Text style={{ fontWeight: 'bold', fontSize: 18, marginVertical: 8, color: colors.onSurface }}>Smart Features</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <TouchableOpacity 
            style={[styles.featureCard, { backgroundColor: colors.elevation.level1 }]} 
            onPress={() => router.push('/ai-insights')}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="brain" size={28} color="#fff" />
            </View>
            <Text style={{ fontWeight: 'bold', fontSize: 15, color: colors.onSurface, textAlign: 'center' }}>AI Insights</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, textAlign: 'center' }}>Smart analysis of your finances</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.featureCard, { backgroundColor: colors.elevation.level1 }]} 
            onPress={() => router.push('/budgets')}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="wallet-outline" size={28} color="#fff" />
            </View>
            <Text style={{ fontWeight: 'bold', fontSize: 15, color: colors.onSurface, textAlign: 'center' }}>Budgets</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, textAlign: 'center' }}>Track and manage budgets</Text>
          </TouchableOpacity>
          {/* Add more smart features here */}
        </ScrollView>
      </ScrollView>
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: '' })}
        duration={2500}
        style={{ backgroundColor: snackbar.color || colors.primary }}
      >
        {snackbar.message}
      </Snackbar>
    </Surface>
  );
}

const styles = StyleSheet.create({
  debtCard: {
    width: 260,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  friendCard: {
    width: 100,
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  groupCard: {
    width: 120,
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  expenseCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  featureCard: {
    width: 160,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
}); 