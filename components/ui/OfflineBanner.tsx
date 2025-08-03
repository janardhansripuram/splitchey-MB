import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOffline } from '../../hooks/useOffline';

interface OfflineBannerProps {
  topOffset?: number;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ topOffset = 0 }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isOnline } = useOffline();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const slideAnim = useState(new Animated.Value(-50))[0];
  const opacityAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (!isOnline && !wasOffline) {
      // Going offline
      setWasOffline(true);
      setShowBackOnline(false);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isOnline && wasOffline) {
      // Coming back online
      setShowBackOnline(true);
      setWasOffline(false);
      
      // Show "back online" message for 5 seconds
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: -50,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowBackOnline(false);
        });
      }, 5000);
    }
  }, [isOnline, wasOffline, slideAnim, opacityAnim]);

  if (!wasOffline && !showBackOnline) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: showBackOnline ? colors.primary : colors.error,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
          top: topOffset + insets.top,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={showBackOnline ? 'wifi' : 'wifi-off'}
        size={20}
        color="white"
        style={styles.icon}
      />
      <Text style={styles.text}>
        {showBackOnline ? 'Back online!' : 'You are offline'}
      </Text>
      {showBackOnline && (
        <Text style={styles.subText}>
          Your data will sync automatically
        </Text>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  subText: {
    color: 'white',
    fontSize: 12,
    opacity: 0.8,
    marginLeft: 8,
  },
}); 