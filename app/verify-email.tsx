import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Surface, Text, Button, Card, useTheme, ActivityIndicator, Snackbar, Avatar } from 'react-native-paper';
import { useAuth } from '../hooks/useAuth';
import { useRouter } from 'expo-router';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function VerifyEmailScreen() {
  const { authUser, userProfile, loading, refetchAuthUser } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [isSending, setIsSending] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '', color: '' });

  useEffect(() => {
    if (loading) return;
    if (authUser && authUser.emailVerified) {
      router.replace('/');
      return;
    }
    if (!authUser) {
      router.replace('/login');
      return;
    }
    const interval = setInterval(async () => {
      await refetchAuthUser();
    }, 5000);
    return () => clearInterval(interval);
  }, [loading, authUser, router, refetchAuthUser]);

  const handleResend = async () => {
    if (!authUser) return;
    setIsSending(true);
    try {
      await sendEmailVerification(authUser);
      setSnackbar({ visible: true, message: 'A new verification link has been sent to your email address.', color: 'green' });
    } catch (error: any) {
      setSnackbar({ visible: true, message: error.message || 'Failed to send verification email.', color: 'red' });
    } finally {
      setIsSending(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (loading || !authUser || authUser.emailVerified) {
    return <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator animating color={colors.primary} size="large" /><Text>Loading...</Text></Surface>;
  }

  return (
    <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, paddingHorizontal: 16 }}>
      <Card style={{ width: '100%', maxWidth: 400, alignItems: 'center', paddingVertical: 24, backgroundColor: colors.elevation.level1, borderRadius: 18, shadowColor: colors.primary, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 }}>
        <Card.Content style={{ width: '100%', alignItems: 'center' }}>
          <MaterialCommunityIcons name="email-check-outline" size={48} color={colors.primary} style={{ marginBottom: 12 }} />
          <Text style={{ fontWeight: 'bold', fontSize: 24, textAlign: 'center', marginBottom: 4, color: colors.primary }}>Verify Your Email</Text>
          <Text style={{ color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 16 }}>
            A verification link has been sent to <Text style={{ fontWeight: 'bold', color: colors.onSurface }}>{authUser?.email}</Text>. Please check your inbox and spam folder.
          </Text>
          <Button mode="contained" onPress={handleResend} loading={isSending} style={{ marginBottom: 12, borderRadius: 8, height: 48, justifyContent: 'center', width: '100%' }} labelStyle={{ fontWeight: 'bold', fontSize: 16 }}>Resend Verification Email</Button>
          <Button mode="outlined" onPress={handleLogout} style={{ borderRadius: 8, height: 48, justifyContent: 'center', width: '100%' }} labelStyle={{ fontWeight: 'bold', fontSize: 16 }}>Log Out</Button>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, textAlign: 'center', marginTop: 16 }}>This page will automatically update after you have verified your email.</Text>
        </Card.Content>
      </Card>
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