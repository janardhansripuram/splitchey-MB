import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { Surface, Text, TextInput, Button, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
// import { createGroup } from '../firebase/firestore'; // TODO: Implement this

export default function CreateGroupScreen() {
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState(''); // Comma-separated emails for now
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { colors } = useTheme();

  const handleSubmit = async () => {
    if (!groupName) {
      Alert.alert('Error', 'Please enter a group name.');
      return;
    }
    setLoading(true);
    try {
      // await createGroup(...)
      Alert.alert('Success', 'Group created!');
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to create group.');
    }
    setLoading(false);
  };

  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text variant="headlineLarge" style={{ color: colors.primary, fontWeight: 'bold', marginBottom: 24 }}>
        Create Group
      </Text>
      <View style={{ width: '100%', marginBottom: 16 }}>
        <TextInput
          label="Group Name"
          value={groupName}
          onChangeText={setGroupName}
          style={{ marginBottom: 12, backgroundColor: colors.background }}
          mode="outlined"
        />
        <TextInput
          label="Members (emails, comma separated)"
          value={members}
          onChangeText={setMembers}
          style={{ marginBottom: 20, backgroundColor: colors.background }}
          mode="outlined"
        />
        <Button mode="contained" onPress={handleSubmit} loading={loading} style={{ marginTop: 8 }}>
          Create Group
        </Button>
        <Button mode="text" onPress={() => router.back()} style={{ marginTop: 8 }}>
          Cancel
        </Button>
      </View>
    </Surface>
  );
} 