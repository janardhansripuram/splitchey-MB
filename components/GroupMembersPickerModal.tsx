import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Checkbox, Divider, Modal, Portal, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernButton } from './ui/ModernButton';

interface GroupMembersPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  friends: any[];
  selectedMembers: string[];
  onSelectMembers: (members: string[]) => void;
}

export default function GroupMembersPickerModal({
  isVisible,
  onClose,
  friends,
  selectedMembers,
  onSelectMembers,
}: GroupMembersPickerModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const handleToggleMember = (uid: string) => {
    if (selectedMembers.includes(uid)) {
      onSelectMembers(selectedMembers.filter(memberId => memberId !== uid));
    } else {
      onSelectMembers([...selectedMembers, uid]);
    }
  };

  return (
    <Portal>
      <Modal
        visible={isVisible}
        onDismiss={onClose}
        contentContainerStyle={{
          backgroundColor: colors.elevation.level2,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingBottom: insets.bottom + 16,
          paddingTop: 12,
          minHeight: 540,
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
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary, marginBottom: 12, textAlign: 'center' }}>
            Select Group Members
          </Text>
          <Divider style={{ marginBottom: 16 }} />

          {friends.map((friend: any) => (
            <TouchableOpacity
              key={friend.uid}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderRadius: 12,
                backgroundColor: selectedMembers.includes(friend.uid) ? colors.primaryContainer : 'transparent',
                marginBottom: 2,
              }}
              onPress={() => handleToggleMember(friend.uid)}
            >
              <Checkbox
                status={selectedMembers.includes(friend.uid) ? 'checked' : 'unchecked'}
                onPress={() => handleToggleMember(friend.uid)}
                color={colors.primary}
              />
              <MaterialCommunityIcons
                name="account-circle"
                size={20}
                color={selectedMembers.includes(friend.uid) ? colors.primary : colors.onSurfaceVariant}
                style={{ marginRight: 10 }}
              />
              <Text style={{
                fontSize: 16,
                color: selectedMembers.includes(friend.uid) ? colors.primary : colors.onSurface,
                fontWeight: selectedMembers.includes(friend.uid) ? 'bold' : 'normal'
              }}>
                {friend.displayName || friend.email || 'Unknown'}
              </Text>
            </TouchableOpacity>
          ))}

          <ModernButton
            title="Done"
            onPress={onClose}
            fullWidth
            style={{ marginTop: 20 }}
          />
        </ScrollView>
      </Modal>
    </Portal>
  );
}