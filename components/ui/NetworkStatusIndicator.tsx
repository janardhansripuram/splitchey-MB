import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  withRepeat, 
  withSequence,
  withTiming 
} from 'react-native-reanimated';
import { useOffline } from '../../hooks/useOffline';

interface NetworkStatusIndicatorProps {
  onPress?: () => void;
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({ onPress }) => {
  const { colors } = useTheme();
  const { isOnline, pendingSyncCount, isSyncing, triggerSync } = useOffline();

  const animatedStyle = useAnimatedStyle(() => {
    if (isSyncing) {
      return {
        transform: [
          {
            rotate: withRepeat(
              withSequence(
                withTiming('0deg', { duration: 0 }),
                withTiming('360deg', { duration: 1000 })
              ),
              -1,
              false
            ),
          },
        ],
      };
    }
    return {
      transform: [{ rotate: '0deg' }],
    };
  });

  if (isOnline && pendingSyncCount === 0) {
    return null; // Don't show indicator when online and no pending sync
  }

  const getStatusColor = () => {
    if (isSyncing) return colors.primary;
    if (!isOnline) return colors.error;
    if (pendingSyncCount > 0) return colors.warning;
    return colors.success;
  };

  const getStatusText = () => {
    if (isSyncing) return 'Syncing...';
    if (!isOnline) return 'Offline';
    if (pendingSyncCount > 0) return `${pendingSyncCount} pending`;
    return 'Online';
  };

  const getIcon = () => {
    if (isSyncing) return 'sync';
    if (!isOnline) return 'wifi-off';
    if (pendingSyncCount > 0) return 'cloud-upload';
    return 'wifi';
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: getStatusColor() }
      ]}
      onPress={onPress || triggerSync}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.iconContainer, animatedStyle]}>
        <MaterialCommunityIcons
          name={getIcon() as any}
          size={16}
          color="white"
        />
      </Animated.View>
      <Text style={styles.text}>{getStatusText()}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  iconContainer: {
    marginRight: 6,
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
}); 