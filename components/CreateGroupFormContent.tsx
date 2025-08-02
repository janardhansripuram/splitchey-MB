import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernButton } from './ui/ModernButton';
import { ModernInput } from './ui/ModernInput';

interface CreateGroupFormContentProps {
  groupName: string;
  setGroupName: (name: string) => void;
  children?: React.ReactNode;
  groupImage: string | null;
  setGroupImage: (image: string | null) => void;
  handlePickImage: () => Promise<void>;
  handleSubmit: () => Promise<void>;
  loading: boolean;
  onGroupCreated: () => void;
  onCancel: () => void;
}

export default function CreateGroupFormContent({
  groupName,
  setGroupName,
  groupImage,
  setGroupImage,
  handlePickImage,
  handleSubmit,
  loading,
  onGroupCreated,
  onCancel,
  children,
}: CreateGroupFormContentProps) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
  

        <TouchableOpacity onPress={handlePickImage} style={{ alignItems: 'center', marginBottom: 20 }}>
          {groupImage ? (
            <Image source={{ uri: groupImage }} style={{ width: 100, height: 100, borderRadius: 50 }} />
          ) : (
            <View style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: colors.surfaceVariant,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <MaterialCommunityIcons name="camera-plus" size={40} color={colors.onSurfaceVariant} />
            </View>
          )}
          <Text style={{ marginTop: 8, color: colors.primary }}>Add Group Image</Text>
        </TouchableOpacity>

        <ModernInput
          label="Group Name"
          value={groupName}
          onChangeText={setGroupName}
          style={{ marginBottom: 18 }}
          placeholder="e.g., Family Trip, Roommates"
        />

        {children}

        <ModernButton
          title="Create Group"
          onPress={handleSubmit}
          loading={loading}
          fullWidth
          style={{ marginBottom: 12 }}
        />
        <ModernButton
          title="Cancel"
          onPress={onCancel}
          variant="ghost"
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}