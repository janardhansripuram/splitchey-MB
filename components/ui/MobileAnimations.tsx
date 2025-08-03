import React from 'react';
import { View } from 'react-native';

interface SlideInAnimationProps {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  delay?: number;
  duration?: number;
}

export const SlideInAnimation: React.FC<SlideInAnimationProps> = ({
  children,
  direction = 'up',
  delay = 0,
  duration = 500,
}) => {
  // Simplified version without animations for now
  return <View>{children}</View>;
};

interface FadeInAnimationProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
}

export const FadeInAnimation: React.FC<FadeInAnimationProps> = ({
  children,
  delay = 0,
  duration = 500,
}) => {
  // Simplified version without animations for now
  return <View>{children}</View>;
};

interface PulseAnimationProps {
  children: React.ReactNode;
  duration?: number;
  scale?: number;
}

export const PulseAnimation: React.FC<PulseAnimationProps> = ({
  children,
  duration = 1000,
  scale = 1.1,
}) => {
  // Simplified version without animations for now
  return <View>{children}</View>;
};

interface ShakeAnimationProps {
  children: React.ReactNode;
  trigger?: boolean;
  onComplete?: () => void;
}

export const ShakeAnimation: React.FC<ShakeAnimationProps> = ({
  children,
  trigger = false,
  onComplete,
}) => {
  // Simplified version without animations for now
  return <View>{children}</View>;
};

interface BounceAnimationProps {
  children: React.ReactNode;
  trigger?: boolean;
  scale?: number;
}

export const BounceAnimation: React.FC<BounceAnimationProps> = ({
  children,
  trigger = false,
  scale = 1.2,
}) => {
  // Simplified version without animations for now
  return <View>{children}</View>;
};

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 24,
  color,
}) => {
  // Simplified version without animations for now
  return <View style={{ width: size, height: size, backgroundColor: color || '#ccc' }} />;
}; 