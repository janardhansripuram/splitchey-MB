import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { Surface, Text, TextInput, Button, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
// import { sendFriendRequest } from '../firebase/firestore'; // TODO: Implement this

export default function AddFriendScreen() {
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { colors } = useTheme();

  const handleSubmit = async () => {
    if (!identifier) {
      Alert.alert('Error', 'Please enter an email or phone number.');
      return;
    }
    setLoading(true);
    try {
      // await sendFriendRequest(...)
      Alert.alert('Success', 'Friend request sent!');
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to send friend request.');
    }
    setLoading(false);
  };

  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text variant="headlineLarge" style={{ color: colors.primary, fontWeight: 'bold', marginBottom: 24 }}>
        Add Friend
      </Text>
      <View style={{ width: '100%', marginBottom: 16 }}>
        <TextInput
          label="Email or Phone"
          value={identifier}
          onChangeText={setIdentifier}
          style={{ marginBottom: 20, backgroundColor: colors.background }}
          mode="outlined"
        />
        <Button mode="contained" onPress={handleSubmit} loading={loading} style={{ marginTop: 8 }}>
          Send Friend Request
        </Button>
        <Button mode="text" onPress={() => router.back()} style={{ marginTop: 8 }}>
          Cancel
        </Button>
      </View>
    </Surface>
  );
} 