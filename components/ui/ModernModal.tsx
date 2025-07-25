import React, { useEffect } from 'react';
import { Dimensions, Modal, TouchableOpacity, View, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { DesignSystem } from '../../constants/DesignSystem';

interface ModernModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
  position?: 'center' | 'bottom' | 'top';
  style?: ViewStyle;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  animationType?: 'slide' | 'fade' | 'scale';
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ModernModal: React.FC<ModernModalProps> = ({
  visible,
  onClose,
  children,
  size = 'md',
  position = 'center',
  style,
  showCloseButton = true,
  closeOnBackdrop = true,
  animationType = 'scale',
}) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const translateY = useSharedValue(position === 'bottom' ? SCREEN_HEIGHT : position === 'top' ? -SCREEN_HEIGHT : 0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 20, stiffness: 300 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.8, { duration: 200 });
      translateY.value = withTiming(
        position === 'bottom' ? SCREEN_HEIGHT : position === 'top' ? -SCREEN_HEIGHT : 0,
        { duration: 200 }
      );
    }
  }, [visible, position]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => {
    const baseStyle = {
      opacity: opacity.value,
    };

    if (animationType === 'scale') {
      return {
        ...baseStyle,
        transform: [{ scale: scale.value }],
      };
    } else if (animationType === 'slide') {
      return {
        ...baseStyle,
        transform: [{ translateY: translateY.value }],
      };
    } else {
      return baseStyle;
    }
  });

  const getModalSize = () => {
    const sizes = {
      sm: { width: SCREEN_WIDTH * 0.8, maxHeight: SCREEN_HEIGHT * 0.4 },
      md: { width: SCREEN_WIDTH * 0.9, maxHeight: SCREEN_HEIGHT * 0.6 },
      lg: { width: SCREEN_WIDTH * 0.95, maxHeight: SCREEN_HEIGHT * 0.8 },
      full: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
    };
    return sizes[size];
  };

  const getModalPosition = (): ViewStyle => {
    const positions = {
      center: {
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
      },
      bottom: {
        justifyContent: 'flex-end' as const,
        alignItems: 'center' as const,
      },
      top: {
        justifyContent: 'flex-start' as const,
        alignItems: 'center' as const,
        paddingTop: 60,
      },
    };
    return positions[position];
  };

  const modalContainerStyle: ViewStyle = {
    ...getModalSize(),
    backgroundColor: '#ffffff',
    borderRadius: position === 'center' ? DesignSystem.borderRadius['2xl'] : 
                   position === 'bottom' ? DesignSystem.borderRadius['2xl'] : 
                   DesignSystem.borderRadius.xl,
    ...DesignSystem.shadows.lg,
    overflow: 'hidden',
  };

  if (position === 'bottom') {
    modalContainerStyle.borderBottomLeftRadius = 0;
    modalContainerStyle.borderBottomRightRadius = 0;
  } else if (position === 'top') {
    modalContainerStyle.borderTopLeftRadius = 0;
    modalContainerStyle.borderTopRightRadius = 0;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={{ flex: 1, ...getModalPosition() }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            },
            backdropStyle,
          ]}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={closeOnBackdrop ? onClose : undefined}
            activeOpacity={1}
          />
        </Animated.View>

        <Animated.View style={[modalContainerStyle, modalStyle, style]}>
          {showCloseButton && position !== 'full' && (
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: DesignSystem.spacing[4],
                right: DesignSystem.spacing[4],
                zIndex: 10,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: DesignSystem.colors.neutral[100],
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={onClose}
            >
              <View
                style={{
                  width: 16,
                  height: 2,
                  backgroundColor: DesignSystem.colors.neutral[600],
                  transform: [{ rotate: '45deg' }],
                  position: 'absolute',
                }}
              />
              <View
                style={{
                  width: 16,
                  height: 2,
                  backgroundColor: DesignSystem.colors.neutral[600],
                  transform: [{ rotate: '-45deg' }],
                  position: 'absolute',
                }}
              />
            </TouchableOpacity>
          )}
          
          {position === 'bottom' && (
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: DesignSystem.colors.neutral[300],
                borderRadius: 2,
                alignSelf: 'center',
                marginTop: DesignSystem.spacing[2],
                marginBottom: DesignSystem.spacing[4],
              }}
            />
          )}

          <View style={{ flex: 1, padding: DesignSystem.spacing[6] }}>
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};