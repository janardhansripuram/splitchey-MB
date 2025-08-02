import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Image,
  StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';


const { width, height } = Dimensions.get('window');

interface OnboardingScreenProps {
  onComplete: () => void;
}

const walkthroughData = [
  {
    id: 1,
    title: 'Track Your Expenses',
    subtitle: 'Easily record and categorize your daily expenses with our intuitive interface',
    description: 'Keep track of every penny with smart categorization and detailed insights',
    icon: 'receipt',
    gradient: ['#667eea', '#764ba2'],
  },
  {
    id: 2,
    title: 'Split with Friends',
    subtitle: 'Split expenses with friends and family effortlessly',
    description: 'No more awkward conversations about money. Split bills fairly and track who owes what',
    icon: 'account-group',
    gradient: ['#f093fb', '#f5576c'],
  },
  {
    id: 3,
    title: 'Smart Insights',
    subtitle: 'Get AI-powered insights about your spending habits',
    description: 'Understand your spending patterns and get personalized recommendations to save more',
    icon: 'lightbulb-on',
    gradient: ['#4facfe', '#00f2fe'],
  },
];

export default function OnboardingScreens({ onComplete }: OnboardingScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const { authUser } = useAuth();
  const router = useRouter();



  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;



  // Entrance animation for icon
  React.useEffect(() => {
    Animated.sequence([
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for floating dots
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [currentIndex]);

  const previousSlide = () => {
    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (currentIndex > 0) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: width,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentIndex(currentIndex - 1);
        slideAnim.setValue(-width);
        fadeAnim.setValue(0);
        scaleAnim.setValue(0.8);
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  };

  const nextSlide = () => {
    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (currentIndex < walkthroughData.length - 1) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -width,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentIndex(currentIndex + 1);
        slideAnim.setValue(width);
        fadeAnim.setValue(0);
        scaleAnim.setValue(0.8);
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      onComplete();
      // Navigate to login screen after onboarding completion
      router.replace('/login');
    }
  };

  const skipOnboarding = () => {
    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onComplete();
    // Navigate to login screen after skipping onboarding
    router.replace('/login');
  };

  const currentSlide = walkthroughData[currentIndex];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      


      {/* Top Navigation Button */}
      <View style={[styles.topButtonContainer, { top: insets.top, left: 20 }]}>
        <TouchableOpacity 
          style={styles.topButton} 
          onPress={currentIndex > 0 ? previousSlide : skipOnboarding}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons 
            name={currentIndex > 0 ? "arrow-left" : "close"} 
            size={24} 
            color={colors.onSurface} 
          />
          {/* <Text style={[styles.topButtonText, { color: colors.onSurface }]}>
            {currentIndex > 0 ? 'Back' : 'Skip'}
          </Text> */}
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Animated Image Container */}
        <Animated.View
          style={[
            styles.imageContainer,
            {
              transform: [
                { translateX: slideAnim },
                { scale: scaleAnim },
              ],
              opacity: fadeAnim,
            },
          ]}
        >
          <LinearGradient
            colors={currentSlide.gradient}
            style={styles.gradientBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Animated.View 
              style={[
                styles.iconContainer,
                {
                  transform: [
                    {
                      rotate: rotateAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <MaterialCommunityIcons
                name={currentSlide.icon as any}
                size={80}
                color="#fff"
              />
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* Text Content */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              transform: [{ translateX: slideAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.onSurface }]}>
            {currentSlide.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
            {currentSlide.subtitle}
          </Text>
          <Text style={[styles.description, { color: colors.onSurfaceVariant }]}>
            {currentSlide.description}
          </Text>
        </Animated.View>

        {/* Floating Elements */}
        <Animated.View
          style={[
            styles.floatingElements,
            {
              transform: [{ translateX: slideAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          <Animated.View 
            style={[
              styles.floatingDot, 
              { 
                backgroundColor: currentSlide.gradient[0],
                transform: [{ scale: pulseAnim }],
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.floatingDot, 
              { 
                backgroundColor: currentSlide.gradient[1],
                transform: [{ scale: pulseAnim }],
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.floatingDot, 
              { 
                backgroundColor: currentSlide.gradient[0],
                transform: [{ scale: pulseAnim }],
              }
            ]} 
          />
        </Animated.View>

        {/* Progress Indicators */}
        <View style={styles.progressContainer}>
          {walkthroughData.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                {
                  backgroundColor: index === currentIndex ? colors.primary : colors.outline,
                  width: index === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Action Button */}
        <View style={styles.buttonContainer}>
          {currentIndex < walkthroughData.length - 1 ? (
            <TouchableOpacity 
              style={styles.fullButton} 
              onPress={nextSlide}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={currentSlide.gradient}
                style={styles.primaryButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.primaryButtonText}>Next</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.fullButton} 
              onPress={onComplete}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.primaryButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
                <MaterialCommunityIcons name="rocket-launch" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    padding: 12,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 30
  },
  imageContainer: {
    width: width * 0.8,
    height: height * 0.4,
    marginBottom: 40,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  gradientBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  progressDot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  topButtonContainer: {
    position: 'absolute',
    zIndex: 1,
  },
  topButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(10px)',
  },
  topButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 20,
  },
  fullButton: {
    width: '100%',
  },
  primaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
    letterSpacing: 0.5,
  },
  floatingElements: {
    position: 'absolute',
    top: height * 0.3,
    right: 20,
    zIndex: 1,
  },
  floatingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginVertical: 8,
    opacity: 0.6,
  },
}); 