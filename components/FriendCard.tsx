import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Avatar, IconButton, Text, useTheme } from 'react-native-paper';

interface FriendCardProps {
  friend: any;
  friendBalances: Record<string, Record<string, number>>;
  onRemoveFriend: (friend: any) => void;
}

export function FriendCard({ friend, friendBalances, onRemoveFriend }: FriendCardProps) {
  const { colors, dark } = useTheme();
  const router = useRouter();

  const styles = StyleSheet.create({
    friendCard: {
      borderRadius: 24,
      backgroundColor: dark ? colors.elevation.level1 : colors.background,
      borderWidth: 1,
      borderColor: dark ? colors.outline : '#e5e7eb',
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 20,
      flexDirection: 'column', // Changed to column for two rows
      alignItems: 'flex-start', // Align items to start for column layout
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    primaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      marginBottom: 12, // Space between primary and secondary row
    },
    friendInfo: {
      flex: 1,
      marginLeft: 16,
    },
    friendName: {
      fontWeight: 'bold',
      fontSize: 18,
      color: colors.onBackground,
      marginBottom: 2,
    },
    friendEmail: {
      color: colors.onSurfaceVariant,
      fontSize: 14,
      marginBottom: 2,
    },
    avatar: {
      backgroundColor: colors.primary,
      marginRight: 16,
      elevation: 2,
    },
    friendActions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 'auto',
    },
    chevron: {
      marginLeft: 8,
      color: colors.outlineVariant,
    },
    secondaryRow: {
      width: '100%',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: dark ? colors.outline : '#e0e0e0',
    },
    owesSectionTitle: {
      fontWeight: 'bold',
      fontSize: 16,
      color: colors.onBackground,
      marginBottom: 8,
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    balanceText: {
      fontSize: 15,
      fontWeight: '600',
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
      overflow: 'hidden',
    },
  });

  return (
    <TouchableOpacity
      key={friend.uid}
      style={styles.friendCard}
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: '/friend-detail', params: { friendId: friend.uid } })}
    >
      <View style={styles.primaryRow}>
        <Avatar.Text size={52} label={friend.displayName ? friend.displayName[0] : '?'} style={styles.avatar} />
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{friend.displayName || friend.email}</Text>
          <Text style={styles.friendEmail}>{friend.email}</Text>
        </View>
        <View style={styles.friendActions}>
          <IconButton
            icon="trash-can-outline"
            size={24}
            onPress={() => onRemoveFriend(friend)}
            iconColor={colors.error}
            accessibilityLabel="Remove friend"
          />
          <IconButton icon="chevron-right" size={28} style={styles.chevron} />
        </View>
      </View>
      {friendBalances[friend.uid] && Object.keys(friendBalances[friend.uid]).length > 0 && (
        <View style={styles.secondaryRow}>
          <Text style={styles.owesSectionTitle}>Owes:</Text>
          <View style={styles.balanceRow}>
            {Object.entries(friendBalances[friend.uid]).map(([currency, amount]) => (
              <Text
                key={currency}
                style={[
                  styles.balanceText,
                  {
                    backgroundColor: amount >= 0 ? '#d4edda' : '#f8d7da',
                    color: amount >= 0 ? '#155724' : '#721c24',
                  },
                ]}
              >
                {amount >= 0 ? '↗ Owes you ' : '↘ You owe '}
                {currency} {Math.abs(amount).toFixed(2)}
              </Text>
            ))}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}