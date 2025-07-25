import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Surface, Text, Card, Button, List, ActivityIndicator, useTheme, Avatar } from 'react-native-paper';
import { useAuth } from '../hooks/useAuth';
import { getRecentExpensesByUser, getFriends, getGroupsForUser } from '../firebase/firestore';

export default function DashboardScreen() {
  const { authUser, loading } = useAuth();
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { colors } = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      if (!authUser) return;
      setIsLoading(true);
      try {
        const [expenses, friendsList, groupsList] = await Promise.all([
          getRecentExpensesByUser(authUser.uid, 5),
          getFriends(authUser.uid),
          getGroupsForUser(authUser.uid),
        ]);
        setRecentExpenses(expenses);
        setFriends(friendsList);
        setGroups(groupsList);
      } catch (e) {
        // Handle error
      }
      setIsLoading(false);
    };
    if (!loading && authUser) {
      fetchData();
    }
  }, [authUser, loading]);

  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text variant="headlineLarge" style={{ color: colors.primary, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>
          Dashboard
        </Text>
        {/* Net Balance Section */}
        <Card style={{ marginBottom: 20, backgroundColor: colors.elevation.level1 }}>
          <Card.Title
            title="Net Balance"
            left={(props) => <Avatar.Icon {...props} icon="wallet" style={{ backgroundColor: colors.primary }} />}
          />
          <Card.Content>
            {loading ? (
              <ActivityIndicator />
            ) : authUser ? (
              <Text variant="titleLarge">User: {authUser.email}</Text>
            ) : (
              <Text>No user signed in.</Text>
            )}
            {/* TODO: Net balance display here */}
          </Card.Content>
        </Card>
        {/* Recent Expenses Section */}
        <Card style={{ marginBottom: 20, backgroundColor: colors.elevation.level1 }}>
          <Card.Title title="Recent Expenses" left={(props) => <Avatar.Icon {...props} icon="cash" style={{ backgroundColor: colors.secondary }} />} />
          <Card.Content>
            {isLoading ? <ActivityIndicator /> : (
              recentExpenses.length > 0 ? (
                <List.Section>
                  {recentExpenses.map(exp => (
                    <List.Item
                      key={exp.id}
                      title={exp.description || 'Expense'}
                      description={`${exp.amount} ${exp.currency}`}
                      left={props => <List.Icon {...props} icon="currency-usd" />}
                    />
                  ))}
                </List.Section>
              ) : <Text>No recent expenses.</Text>
            )}
          </Card.Content>
        </Card>
        {/* Friends Section */}
        <Card style={{ marginBottom: 20, backgroundColor: colors.elevation.level1 }}>
          <Card.Title title="Friends" left={(props) => <Avatar.Icon {...props} icon="account-group" style={{ backgroundColor: colors.secondary }} />} />
          <Card.Content>
            {isLoading ? <ActivityIndicator /> : (
              friends.length > 0 ? (
                <List.Section>
                  {friends.map(friend => (
                    <List.Item
                      key={friend.id}
                      title={friend.displayName || friend.email}
                      left={props => <Avatar.Text {...props} label={friend.displayName ? friend.displayName[0] : '?'} />}
                    />
                  ))}
                </List.Section>
              ) : <Text>No friends found.</Text>
            )}
          </Card.Content>
        </Card>
        {/* Groups Section */}
        <Card style={{ marginBottom: 20, backgroundColor: colors.elevation.level1 }}>
          <Card.Title title="Groups" left={(props) => <Avatar.Icon {...props} icon="account-multiple" style={{ backgroundColor: colors.tertiary || colors.primary }} />} />
          <Card.Content>
            {isLoading ? <ActivityIndicator /> : (
              groups.length > 0 ? (
                <List.Section>
                  {groups.map(group => (
                    <List.Item
                      key={group.id}
                      title={group.name}
                      left={props => <List.Icon {...props} icon="account-group" />}
                    />
                  ))}
                </List.Section>
              ) : <Text>No groups found.</Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </Surface>
  );
} 