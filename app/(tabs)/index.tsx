import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import DashboardScreen from '../DashboardScreen';

export default function HomeTab() {
  const { authUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !authUser) {
      router.replace('/login');
    }
    if (!loading && authUser && !authUser.emailVerified) {
      router.replace('/verify-email');
    }
  }, [authUser, loading]);

  if (loading || !authUser || (authUser && !authUser.emailVerified)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <DashboardScreen />;
}
