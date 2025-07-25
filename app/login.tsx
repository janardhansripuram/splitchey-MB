import { MaterialCommunityIcons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as Google from 'expo-auth-session/providers/google';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { FacebookAuthProvider, GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, signInWithPhoneNumber } from 'firebase/auth';
import { Eye, EyeOff, Lock, Mail, MessageSquare, Phone } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Snackbar, Text, useTheme } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernButton } from '../components/ui/ModernButton';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernInput } from '../components/ui/ModernInput';
import { DesignSystem } from '../constants/DesignSystem';
import { auth } from '../firebase/config';

WebBrowser.maybeCompleteAuthSession();

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH > 440 ? 400 : SCREEN_WIDTH - 32;

export default function LoginScreen() {
  const [tab, setTab] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '', color: '' });
  const recaptchaVerifier = useRef<any>(null);
  const router = useRouter();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const [showPassword, setShowPassword] = useState(false);

  // Google Auth
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: 'YOUR_EXPO_GOOGLE_CLIENT_ID',
    redirectUri: makeRedirectUri(),
  });

  // Facebook Auth
  const [fbRequest, fbResponse, fbPromptAsync] = Facebook.useAuthRequest({
    clientId: 'YOUR_FACEBOOK_APP_ID',
    redirectUri: makeRedirectUri(),
  });

  React.useEffect(() => {
    const signInWithGoogle = async () => {
      if (response?.type === 'success') {
        const { authentication } = response;
        if (authentication?.idToken) {
          try {
            const credential = GoogleAuthProvider.credential(authentication.idToken, authentication.accessToken);
            await signInWithCredential(auth, credential);
            router.replace('/');
          } catch (error: any) {
            setSnackbar({ visible: true, message: error.message || 'Could not sign in with Google.', color: 'red' });
          }
        }
      }
    };
    signInWithGoogle();
  }, [response]);

  React.useEffect(() => {
    const signInWithFacebook = async () => {
      if (fbResponse?.type === 'success') {
        const { authentication } = fbResponse;
        if (authentication?.accessToken) {
          try {
            const credential = FacebookAuthProvider.credential(authentication.accessToken);
            await signInWithCredential(auth, credential);
            router.replace('/');
          } catch (error: any) {
            setSnackbar({ visible: true, message: error.message || 'Could not sign in with Facebook.', color: 'red' });
          }
        }
      }
    };
    signInWithFacebook();
  }, [fbResponse]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await userCredential.user.reload();
      if (!userCredential.user.emailVerified) {
        setSnackbar({ visible: true, message: 'Please verify your email before logging in.', color: 'orange' });
        await auth.signOut();
        router.replace('/verify-email');
        setLoading(false);
        return;
      }
      router.replace('/');
    } catch (error: any) {
      setSnackbar({ visible: true, message: error.message || 'Please check your email and password and try again.', color: 'red' });
    }
    setLoading(false);
  };

  const handleSendCode = async () => {
    setLoading(true);
    try {
      const result = await signInWithPhoneNumber(auth, phone, recaptchaVerifier.current);
      setConfirmResult(result);
      setOtpStep(true);
      setSnackbar({ visible: true, message: 'Code sent. Please check your phone.', color: 'green' });
    } catch (error: any) {
      setSnackbar({ visible: true, message: error.message || 'Could not send verification code.', color: 'red' });
    }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    try {
      await confirmResult.confirm(otp);
      setOtpStep(false);
      setOtp('');
      router.replace('/');
    } catch (error: any) {
      setSnackbar({ visible: true, message: error.message || 'Invalid code.', color: 'red' });
    }
    setLoading(false);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: DesignSystem.colors.primary[500],
    },
    backgroundGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '60%',
      backgroundColor: DesignSystem.colors.primary[500],
    },
    content: {
      flex: 1,
      paddingHorizontal: DesignSystem.spacing[6],
      paddingTop: insets.top + DesignSystem.spacing[8],
    },
    header: {
      alignItems: 'center',
      marginBottom: DesignSystem.spacing[10],
    },
    logo: {
      width: 80,
      height: 80,
      marginBottom: DesignSystem.spacing[4],
      borderRadius: DesignSystem.borderRadius.xl,
    },
    appName: {
      fontSize: DesignSystem.typography.fontSizes['3xl'],
      fontWeight: DesignSystem.typography.fontWeights.bold,
      color: '#ffffff',
      marginBottom: DesignSystem.spacing[2],
    },
    tagline: {
      fontSize: DesignSystem.typography.fontSizes.lg,
      color: 'rgba(255, 255, 255, 0.9)',
      textAlign: 'center',
    },
    formCard: {
      width: '100%',
      maxWidth: 400,
      alignSelf: 'center',
    },
    welcomeText: {
      fontSize: DesignSystem.typography.fontSizes['2xl'],
      fontWeight: DesignSystem.typography.fontWeights.bold,
      color: DesignSystem.colors.neutral[900],
      textAlign: 'center',
      marginBottom: DesignSystem.spacing[2],
    },
    subtitleText: {
      fontSize: DesignSystem.typography.fontSizes.base,
      color: DesignSystem.colors.neutral[600],
      textAlign: 'center',
      marginBottom: DesignSystem.spacing[8],
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: DesignSystem.colors.neutral[100],
      borderRadius: DesignSystem.borderRadius.md,
      padding: DesignSystem.spacing[1],
      marginBottom: DesignSystem.spacing[6],
    },
    tab: {
      flex: 1,
      paddingVertical: DesignSystem.spacing[3],
      borderRadius: DesignSystem.borderRadius.base,
      alignItems: 'center',
    },
    activeTab: {
      backgroundColor: '#ffffff',
      ...DesignSystem.shadows.sm,
    },
    tabText: {
      fontSize: DesignSystem.typography.fontSizes.base,
      fontWeight: DesignSystem.typography.fontWeights.medium,
    },
    activeTabText: {
      color: DesignSystem.colors.primary[600],
    },
    inactiveTabText: {
      color: DesignSystem.colors.neutral[600],
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: DesignSystem.spacing[6],
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: DesignSystem.colors.neutral[200],
    },
    dividerText: {
      marginHorizontal: DesignSystem.spacing[4],
      fontSize: DesignSystem.typography.fontSizes.sm,
      fontWeight: DesignSystem.typography.fontWeights.medium,
      color: DesignSystem.colors.neutral[500],
    },
    socialButton: {
      marginBottom: DesignSystem.spacing[3],
    },
    bottomText: {
      textAlign: 'center',
      marginTop: DesignSystem.spacing[6],
      fontSize: DesignSystem.typography.fontSizes.base,
      color: DesignSystem.colors.neutral[600],
    },
    linkText: {
      color: DesignSystem.colors.primary[600],
      fontWeight: DesignSystem.typography.fontWeights.semibold,
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={DesignSystem.colors.primary[500]} />
      
      {/* Background Gradient */}
      <View style={styles.backgroundGradient} />
      
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center', flex: 1 }}>
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Header */}
            <Animated.View entering={FadeInUp.delay(200)} style={styles.header}>
              <Image 
                source={require('../assets/images/icon.png')} 
                style={styles.logo}
              />
              <Text style={styles.appName}>SplitChey</Text>
              <Text style={styles.tagline}>Smart expense splitting made simple</Text>
            </Animated.View>

            {/* Login Form */}
            <Animated.View entering={FadeInDown.delay(400)}>
              <ModernCard style={styles.formCard} variant="elevated">
                <Text style={styles.welcomeText}>Welcome Back</Text>
                <Text style={styles.subtitleText}>Sign in to continue managing your expenses</Text>

                {/* Tab Selector */}
                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tab, tab === 'email' && styles.activeTab]}
                    onPress={() => setTab('email')}
                  >
                    <Text style={[styles.tabText, tab === 'email' ? styles.activeTabText : styles.inactiveTabText]}>
                      Email
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, tab === 'phone' && styles.activeTab]}
                    onPress={() => setTab('phone')}
                  >
                    <Text style={[styles.tabText, tab === 'phone' ? styles.activeTabText : styles.inactiveTabText]}>
                      Phone
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Email Login Form */}
                {tab === 'email' && (
                  <Animated.View entering={FadeInDown.delay(100)}>
                    <ModernInput
                      label="Email Address"
                      placeholder="Enter your email"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      leftIcon={<Mail size={20} color={DesignSystem.colors.neutral[500]} />}
                    />
                    
                    <ModernInput
                      label="Password"
                      placeholder="Enter your password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      leftIcon={<Lock size={20} color={DesignSystem.colors.neutral[500]} />}
                      rightIcon={
                        showPassword ? 
                          <EyeOff size={20} color={DesignSystem.colors.neutral[500]} /> :
                          <Eye size={20} color={DesignSystem.colors.neutral[500]} />
                      }
                      onRightIconPress={() => setShowPassword(!showPassword)}
                    />

                    <ModernButton
                      title="Sign In"
                      onPress={handleLogin}
                      loading={loading}
                      fullWidth
                      style={{ marginTop: DesignSystem.spacing[2] }}
                    />
                  </Animated.View>
                )}

                {/* Phone Login Form */}
                {tab === 'phone' && (
                  <Animated.View entering={FadeInDown.delay(100)}>
                    <ModernInput
                      label="Phone Number"
                      placeholder="Enter your phone number"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      leftIcon={<Phone size={20} color={DesignSystem.colors.neutral[500]} />}
                    />

                    {!otpStep ? (
                      <ModernButton
                        title="Send Verification Code"
                        onPress={handleSendCode}
                        loading={loading}
                        fullWidth
                        style={{ marginTop: DesignSystem.spacing[2] }}
                      />
                    ) : (
                      <>
                        <ModernInput
                          label="Verification Code"
                          placeholder="Enter 6-digit code"
                          value={otp}
                          onChangeText={setOtp}
                          keyboardType="number-pad"
                          leftIcon={<MessageSquare size={20} color={DesignSystem.colors.neutral[500]} />}
                          maxLength={6}
                        />
                        
                        <ModernButton
                          title="Verify & Sign In"
                          onPress={handleVerifyCode}
                          loading={loading}
                          fullWidth
                          style={{ marginTop: DesignSystem.spacing[2] }}
                        />
                      </>
                    )}
                  </Animated.View>
                )}

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Social Login Buttons */}
                <ModernButton
                  title="Continue with Google"
                  onPress={() => promptAsync()}
                  variant="outline"
                  disabled={!request || loading}
                  fullWidth
                  style={styles.socialButton}
                  icon={<MaterialCommunityIcons name="google" size={20} color={DesignSystem.colors.neutral[700]} />}
                />

                <ModernButton
                  title="Continue with Facebook"
                  onPress={() => fbPromptAsync()}
                  disabled={!fbRequest || loading}
                  fullWidth
                  style={[styles.socialButton, { backgroundColor: '#1877F2' }]}
                  icon={<MaterialCommunityIcons name="facebook" size={20} color="#ffffff" />}
                />

                {/* Bottom Link */}
                <Text style={styles.bottomText}>
                  Don't have an account?{' '}
                  <TouchableOpacity onPress={() => router.push('/signup')}>
                    <Text style={styles.linkText}>Sign up</Text>
                  </TouchableOpacity>
                </Text>
              </ModernCard>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={auth.app.options}
      />
      
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: '', color: '' })}
        duration={2500}
        style={{ 
          backgroundColor: snackbar.color === 'red' ? DesignSystem.colors.error[500] : 
                          snackbar.color === 'green' ? DesignSystem.colors.success[500] :
                          DesignSystem.colors.primary[500],
          borderRadius: DesignSystem.borderRadius.md,
          margin: DesignSystem.spacing[4],
        }}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
} 