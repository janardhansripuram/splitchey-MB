import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithPhoneNumber } from 'firebase/auth';
import { Eye, EyeOff, Gift, Lock, Mail, MessageSquare, Phone, User } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Modal, Portal, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernButton } from '../components/ui/ModernButton';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernInput } from '../components/ui/ModernInput';
import { DesignSystem } from '../constants/DesignSystem';
import { SUPPORTED_CURRENCIES } from '../constants/types'; // Assuming you have a list of supported currencies
import { auth } from '../firebase/config';
import { createUserProfile } from '../firebase/firestore';

// const SUPPORTED_CURRENCIES = [
//   { code: 'USD', name: 'US Dollar' },
//   { code: 'EUR', name: 'Euro' },
//   { code: 'MYR', name: 'Malaysian Ringgit' },
//   // Add more as needed
// ];

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH > 440 ? 400 : SCREEN_WIDTH - 32;

export default function SignupScreen() {
  const [tab, setTab] = useState<'email' | 'phone'>('email');
  // Common fields
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [currencyModal, setCurrencyModal] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '', color: '' });
  // Email signup fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Phone signup fields
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [otpStep, setOtpStep] = useState(false);
  const recaptchaVerifier = useRef<any>(null);
  const router = useRouter();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const [showPassword, setShowPassword] = useState(false);

  // Email signup logic
  const handleSignupEmail = async () => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await createUserProfile(user.uid, email, null, displayName, referralCode, currency);
      await sendEmailVerification(user);
      setSnackbar({ visible: true, message: 'A verification email has been sent. Please check your inbox.', color: 'green' });
      router.push('/verify-email');
    } catch (error: any) {
      setSnackbar({ visible: true, message: error.message || 'Signup failed.', color: 'red' });
    }
    setLoading(false);
  };

  // Phone signup logic
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
      const result = await confirmResult.confirm(otp);
      const user = result.user;
      await createUserProfile(user.uid, null, phone, displayName, referralCode, currency);
      setOtpStep(false);
      setOtp('');
      setSnackbar({ visible: true, message: 'Phone verified and account created!', color: 'green' });
      router.push('/');
    } catch (error: any) {
      setSnackbar({ visible: true, message: error.message || 'Invalid code.', color: 'red' });
    }
    setLoading(false);
  };


  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    backgroundGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '60%',
      backgroundColor: colors.primary,
    },
    content: {
      flex: 1,
      // paddingHorizontal: DesignSystem.spacing[4], // Add horizontal padding
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
      fontWeight: 'bold',
      color: colors.onPrimary,
      marginBottom: DesignSystem.spacing[2],
    },
    tagline: {
      fontSize: DesignSystem.typography.fontSizes.lg,
      color: colors.onPrimary,
      textAlign: 'center',
    },
    formCard: {
      width: '100%',
      maxWidth: 400,
      alignSelf: 'center',
      paddingHorizontal: DesignSystem.spacing[6], // Adjusted horizontal padding for better spacing
      paddingVertical: DesignSystem.spacing[8], // Adjusted vertical padding
     // marginRight: DesignSystem.spacing[16],
     // marginLeft: DesignSystem.spacing[4],
    },
    welcomeText: {
      fontSize: DesignSystem.typography.fontSizes['2xl'],
      fontWeight: 'bold',
      color: colors.onSurface,
      textAlign: 'center',
      marginBottom: DesignSystem.spacing[4],
    },
   subtitleText: {
        fontSize: DesignSystem.typography.fontSizes.base,
        color: colors.surface,
        textAlign: 'center',
        marginBottom: DesignSystem.spacing[8],
       // paddingHorizontal: DesignSystem.spacing[4]
      },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: dark ? colors.surfaceVariant : colors.surfaceDisabled,
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
      backgroundColor: dark ? colors.surface : colors.surface,
      ...DesignSystem.shadows.sm,
    },
    tabText: {
      fontSize: DesignSystem.typography.fontSizes.base,
      fontWeight: 'medium',
    },
    activeTabText: {
      color: colors.primary,
    },
    inactiveTabText: {
      color: colors.onSurfaceVariant,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: DesignSystem.spacing[6],
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.outlineVariant,
    },
    dividerText: {
      marginHorizontal: DesignSystem.spacing[4],
      fontSize: DesignSystem.typography.fontSizes.sm,
      fontWeight: 'medium',
      color: colors.onSurfaceVariant,
    },
    socialButton: {
      marginBottom: DesignSystem.spacing[3],
    },
    facebookButton: {
      marginBottom: DesignSystem.spacing[3],
      backgroundColor: '#1877F2',
    },
    bottomText: {
      textAlign: 'center',
     // marginTop: DesignSystem.spacing[4],
      fontSize: DesignSystem.typography.fontSizes.base,
      color: colors.onSurfaceVariant,
    },
    linkText: {
      color: colors.primary,
      fontWeight: 'semibold'
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      {/* Background Gradient */}
      <View style={styles.backgroundGradient} />
      
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center', flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: insets.bottom + DesignSystem.spacing[8] }}
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

            {/* Signup Form */}
            <Animated.View entering={FadeInDown.delay(400)}>
              <ModernCard style={styles.formCard} variant="elevated">
                <Text style={styles.welcomeText}>Create Account</Text>

                {/* <Text style={styles.subtitleText}>Start your journey to smarter expense management</Text> */}

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

                {/* Email Signup Form */}
                {tab === 'email' && (
                  <Animated.View entering={FadeInDown.delay(100)}>
                    <ModernInput
                      label="Display Name"
                      placeholder="Enter your full name"
                      value={displayName}
                      onChangeText={setDisplayName}
                      leftIcon={<User size={20} color={colors.onSurfaceVariant} />}
                    />
                    
                    <ModernInput
                      label="Email Address"
                      placeholder="Enter your email"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      leftIcon={<Mail size={20} color={colors.onSurfaceVariant} />}
                    />
                    
                    <ModernInput
                      label="Password"
                      placeholder="Create a strong password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      leftIcon={<Lock size={20} color={colors.onSurfaceVariant} />}
                      rightIcon={
                        showPassword ?
                          <EyeOff size={20} color={colors.onSurfaceVariant} /> :
                          <Eye size={20} color={colors.onSurfaceVariant} />
                      }
                      onRightIconPress={() => setShowPassword(!showPassword)}
                    />

                    <TouchableOpacity onPress={() => setCurrencyModal(true)} activeOpacity={0.7}>
                      <TextInput
                        label="Default Currency"
                        value={currency}
                        editable={false}
                        style={{ borderRadius: 16, backgroundColor: colors.surface, marginBottom: 8 }}
                        mode="outlined"
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="currency-inr" size={22} color={colors.onSurfaceVariant} />} />}
                        right={<TextInput.Icon icon="chevron-down" />}
                        pointerEvents="none"
                      />
                    </TouchableOpacity>

                    <ModernInput
                      label="Referral Code (Optional)"
                      placeholder="Enter referral code if you have one"
                      value={referralCode}
                      onChangeText={setReferralCode}
                      leftIcon={<Gift size={20} color={colors.onSurfaceVariant} />}
                    />

                    <ModernButton
                      title="Create Account"
                      onPress={handleSignupEmail}
                      loading={loading}
                      fullWidth
                      style={{ marginTop: DesignSystem.spacing[2] }}
                    />
                  </Animated.View>
                )}

                {/* Phone Signup Form */}
                {tab === 'phone' && (
                  <Animated.View entering={FadeInDown.delay(100)}>
                    <ModernInput
                      label="Display Name"
                      placeholder="Enter your full name"
                      value={displayName}
                      onChangeText={setDisplayName}
                      leftIcon={<User size={20} color={colors.onSurfaceVariant} />}
                    />
                    
                    <ModernInput
                      label="Phone Number"
                      placeholder="Enter your phone number"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      leftIcon={<Phone size={20} color={colors.onSurfaceVariant} />}
                    />

                    <TouchableOpacity onPress={() => setCurrencyModal(true)} activeOpacity={0.7}>
                      <ModernInput
                        label="Default Currency"
                        value={currency}
                        editable={false}
                        mode="outlined"
                        left={<TextInput.Icon icon={() => <MaterialCommunityIcons name="currency-usd" size={22} color={colors.primary} />} />}
                        right={<TextInput.Icon icon="chevron-down" />}
                        pointerEvents="none"
                      />
                    </TouchableOpacity>

                    <ModernInput
                      label="Referral Code (Optional)"
                      placeholder="Enter referral code if you have one"
                      value={referralCode}
                      onChangeText={setReferralCode}
                      leftIcon={<Gift size={20} color={colors.onSurfaceVariant} />}
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
                          leftIcon={<MessageSquare size={20} color={colors.onSurfaceVariant} />}
                          maxLength={6}
                        />
                        
                        <ModernButton
                          title="Verify & Create Account"
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

                {/* Social Signup Buttons */}
                <ModernButton
                  title="Continue with Google"
                  onPress={() => {}}
                  variant="outline"
                  disabled={loading}
                  fullWidth
                  style={styles.socialButton}
                  icon={<MaterialCommunityIcons name="google" size={20} color={colors.onSurfaceVariant} />}
                />

                <ModernButton
                  title="Continue with Facebook"
                  onPress={() => {}}
                  disabled={loading}
                  fullWidth
                  style={styles.facebookButton}
                  icon={<MaterialCommunityIcons name="facebook" size={20} color="#ffffff" />}
                />

                {/* Bottom Link */}
               <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
  <Text style={styles.bottomText}>Already have an account?</Text>
  <TouchableOpacity 
    onPress={() => router.push('/login')} 
    style={{ marginLeft: DesignSystem.spacing[1] }}
  >
    <Text style={styles.linkText}>Sign in</Text>
  </TouchableOpacity>
</View>
                
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
          backgroundColor: snackbar.color === 'red' ? colors.error :
                          snackbar.color === 'green' ? DesignSystem.colors.success[500] :
                          colors.primary,
          borderRadius: DesignSystem.borderRadius.md,
          margin: DesignSystem.spacing[4],
        }}
      >
        {snackbar.message}
      </Snackbar>

      <Portal>
        <Modal
          visible={currencyModal}
          onDismiss={() => setCurrencyModal(false)}
          contentContainerStyle={{
            margin: 24,
            padding: 16,
            backgroundColor: colors.surface,
            borderRadius: 18,
          }}
        >
          <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12, color: colors.primary }}>Select Currency</Text>
          {SUPPORTED_CURRENCIES.map(c => (
            <TouchableOpacity
              key={c.code}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderRadius: 12,
                backgroundColor: c.code === currency ? colors.primaryContainer : 'transparent',
                marginBottom: 2,
              }}
              onPress={() => {
                setCurrency(c.code);
                setCurrencyModal(false);
              }}
            >
              <Text style={{
                fontSize: 16,
                color: c.code === currency ? colors.primary : colors.onSurface,
                fontWeight: c.code === currency ? 'bold' : 'normal'
              }}>
                {c.code} - {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </Modal>
      </Portal>
    </View>
  );
}