import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import DashboardScreen from '../DashboardScreen';

export default function HomeTab() {
  const { authUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !authUser) {
      router.replace('/login');
    }
  }, [authUser, loading]);

  if (loading || !authUser) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <DashboardScreen />;
}
