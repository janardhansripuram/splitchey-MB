import * as Haptics from 'expo-haptics';
import React, { useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, PanGestureHandler } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: {
    icon: string;
    color: string;
    label: string;
  };
  rightAction?: {
    icon: string;
    color: string;
    label: string;
  };
  disabled?: boolean;
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const lastTranslateX = useRef(0);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (disabled) return;

    const { translationX, state } = event.nativeEvent;

    if (state === 5) { // State.END = 5
      const shouldTriggerAction = Math.abs(translationX) > SWIPE_THRESHOLD;

      if (shouldTriggerAction) {
        if (translationX > 0 && onSwipeRight) {
          // Swipe right
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSwipeRight();
        } else if (translationX < 0 && onSwipeLeft) {
          // Swipe left
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSwipeLeft();
        }
      }

      // Reset position
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  const cardStyle = {
    transform: [{ translateX }],
  };

  const leftActionStyle = {
    backgroundColor: leftAction?.color || colors.error,
  };

  const rightActionStyle = {
    backgroundColor: rightAction?.color || colors.primary,
  };

  return (
    <View style={styles.container}>
      {/* Background Actions */}
      <View style={styles.backgroundActions}>
        {leftAction && (
          <View style={[styles.actionContainer, styles.leftAction, leftActionStyle]}>
            <MaterialCommunityIcons name={leftAction.icon} size={24} color="white" />
            <Text style={styles.actionText}>{leftAction.label}</Text>
          </View>
        )}
        {rightAction && (
          <View style={[styles.actionContainer, styles.rightAction, rightActionStyle]}>
            <MaterialCommunityIcons name={rightAction.icon} size={24} color="white" />
            <Text style={styles.actionText}>{rightAction.label}</Text>
          </View>
        )}
      </View>

      {/* Swipeable Content */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        enabled={!disabled}
      >
        <Animated.View style={[styles.card, cardStyle]}>
          {children}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginVertical: 4,
  },
  backgroundActions: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  actionContainer: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  leftAction: {
    marginRight: 'auto',
  },
  rightAction: {
    marginLeft: 'auto',
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
}); 