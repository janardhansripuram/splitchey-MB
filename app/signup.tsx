import React, { useState, useRef } from 'react';
import { View, Image, KeyboardAvoidingView, Platform, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, Surface, Card, useTheme, Snackbar, Modal, Portal, List } from 'react-native-paper';
import { auth } from '../firebase/config';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithPhoneNumber } from 'firebase/auth';
import { createUserProfile } from '../firebase/firestore';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';

const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  // Add more as needed
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH > 440 ? 400 : SCREEN_WIDTH - 32;

export default function SignupScreen() {
  const [tab, setTab] = useState<'email' | 'phone'>('email');
  // Common fields
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('USD');
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

  // Themed styles
  const styles = StyleSheet.create({
    input: {
      marginBottom: 14,
      backgroundColor: dark ? colors.elevation.level1 : '#fff',
      borderRadius: 8,
      width: CARD_WIDTH - 48, // 24px padding on each side
      borderWidth: 1,
      borderColor: dark ? colors.outline : '#e5e7eb',
      fontSize: 16,
      alignSelf: 'center',
    },
    button: {
      marginBottom: 12,
      borderRadius: 8,
      height: 44,
      justifyContent: 'center',
      width: CARD_WIDTH - 48,
      backgroundColor: colors.primary,
      alignSelf: 'center',
    },
    buttonLabel: {
      fontWeight: '700',
      fontSize: 16,
      color: colors.onPrimary,
    },
    card: {
      width: CARD_WIDTH,
      alignItems: 'center',
      paddingVertical: 24,
      backgroundColor: dark ? colors.elevation.level2 : '#fafbfc',
      borderRadius: 16,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
      borderWidth: 1,
      borderColor: dark ? colors.outline : '#f0f0f0',
    },
    currencyPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 14,
      backgroundColor: dark ? colors.elevation.level1 : '#fff',
      borderRadius: 8,
      width: CARD_WIDTH - 48,
      borderWidth: 1,
      borderColor: dark ? colors.outline : '#e5e7eb',
      alignSelf: 'center',
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 18,
      width: CARD_WIDTH - 48,
      alignSelf: 'center',
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: dark ? colors.outline : '#e5e7eb',
    },
    dividerText: {
      marginHorizontal: 10,
      color: colors.onSurfaceVariant,
      fontWeight: '700',
      fontSize: 13,
    },
    bottomText: {
      color: colors.onSurfaceVariant,
      fontSize: 15,
    },
    appName: {
      fontWeight: '700',
      fontSize: 22,
      color: colors.onBackground,
      marginBottom: 0,
    },
    tabText: {
      fontSize: 16,
    },
    tabActive: {
      fontWeight: '700',
      color: colors.onBackground,
    },
    tabInactive: {
      fontWeight: '400',
      color: colors.onSurfaceVariant,
    },
  });

  return (
    <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: dark ? colors.background : '#fff', paddingHorizontal: 16 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center', flex: 1 }}>
        <ScrollView contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ marginBottom: 32, alignItems: 'center' }}>
            <Image source={require('../assets/images/icon.png')} style={{ width: 48, height: 48, marginBottom: 8 }} />
            <Text style={styles.appName}>SplitChey</Text>
          </View>
          <Card style={styles.card}>
            <Card.Content style={{ width: '100%' }}>
              <Text style={{ fontWeight: '700', fontSize: 22, textAlign: 'center', marginBottom: 4, color: colors.onBackground }}>Create an Account</Text>
              <Text style={{ color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20, fontSize: 15 }}>Sign up to start managing your finances.</Text>
              {/* Tabs */}
              <View style={{
                flexDirection: 'row',
                backgroundColor: dark ? colors.elevation.level1 : '#f3f4f6',
                borderRadius: 8,
                marginBottom: 18,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: dark ? colors.outline : '#e5e7eb',
              }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: tab === 'email' ? (dark ? colors.background : '#fff') : 'transparent',
                    alignItems: 'center',
                  }}
                  onPress={() => setTab('email')}
                >
                  <Text style={[styles.tabText, tab === 'email' ? styles.tabActive : styles.tabInactive]}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: tab === 'phone' ? (dark ? colors.background : '#fff') : 'transparent',
                    alignItems: 'center',
                  }}
                  onPress={() => setTab('phone')}
                >
                  <Text style={[styles.tabText, tab === 'phone' ? styles.tabActive : styles.tabInactive]}>Phone</Text>
                </TouchableOpacity>
              </View>
              {/* Email Tab */}
              {tab === 'email' && (
                <View style={{ width: '100%' }}>
                  <Text style={{ color: colors.onBackground, fontWeight: '700', marginBottom: 6, marginLeft: 2 }}>Display Name</Text>
                  <TextInput
                    label="Your name"
                    value={displayName}
                    onChangeText={setDisplayName}
                    style={styles.input}
                    mode="flat"
                    underlineColor="transparent"
                    selectionColor={colors.primary}
                    theme={{ colors: { text: colors.onBackground, placeholder: colors.onSurfaceVariant } }}
                  />
                  <Text style={{ color: colors.onBackground, fontWeight: '700', marginBottom: 6, marginLeft: 2 }}>Email</Text>
                  <TextInput
                    label="you@example.com"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={styles.input}
                    mode="flat"
                    underlineColor="transparent"
                    selectionColor={colors.primary}
                    theme={{ colors: { text: colors.onBackground, placeholder: colors.onSurfaceVariant } }}
                  />
                  <Text style={{ color: colors.onBackground, fontWeight: '700', marginBottom: 6, marginLeft: 2 }}>Password</Text>
                  <TextInput
                    label="********"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={styles.input}
                    mode="flat"
                    underlineColor="transparent"
                    selectionColor={colors.primary}
                    theme={{ colors: { text: colors.onBackground, placeholder: colors.onSurfaceVariant } }}
                  />
                  <Text style={{ color: colors.onBackground, fontWeight: '700', marginBottom: 6, marginLeft: 2 }}>Default Currency</Text>
                  <TouchableOpacity onPress={() => setCurrencyModal(true)} style={styles.currencyPicker}>
                    <Text style={{ color: colors.onBackground, fontSize: 16 }}>{SUPPORTED_CURRENCIES.find(c => c.code === currency)?.code} - {SUPPORTED_CURRENCIES.find(c => c.code === currency)?.name}</Text>
                    <Ionicons name="chevron-down" size={20} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                  <Portal>
                    <Modal visible={currencyModal} onDismiss={() => setCurrencyModal(false)} contentContainerStyle={{ backgroundColor: colors.background, margin: 24, borderRadius: 12, padding: 0 }}>
                      <List.Section>
                        {SUPPORTED_CURRENCIES.map(c => (
                          <List.Item
                            key={c.code}
                            title={`${c.code} - ${c.name}`}
                            onPress={() => { setCurrency(c.code); setCurrencyModal(false); }}
                            left={props => <List.Icon {...props} icon={currency === c.code ? 'check-circle' : 'circle-outline'} color={currency === c.code ? colors.primary : colors.onSurfaceVariant} />}
                          />
                        ))}
                      </List.Section>
                    </Modal>
                  </Portal>
                  <Text style={{ color: colors.onBackground, fontWeight: '700', marginBottom: 6, marginLeft: 2 }}>Referral Code (Optional)</Text>
                  <TextInput
                    label="Referral code"
                    value={referralCode}
                    onChangeText={setReferralCode}
                    style={styles.input}
                    mode="flat"
                    underlineColor="transparent"
                    selectionColor={colors.primary}
                    theme={{ colors: { text: colors.onBackground, placeholder: colors.onSurfaceVariant } }}
                  />
                  <Button mode="contained" onPress={handleSignupEmail} loading={loading} style={styles.button} labelStyle={styles.buttonLabel}>Create Account</Button>
                </View>
              )}
              {/* Phone Tab */}
              {tab === 'phone' && (
                <View style={{ width: '100%' }}>
                  <Text style={{ color: colors.onBackground, fontWeight: '700', marginBottom: 6, marginLeft: 2 }}>Display Name</Text>
                  <TextInput
                    label="Your name"
                    value={displayName}
                    onChangeText={setDisplayName}
                    style={styles.input}
                    mode="flat"
                    underlineColor="transparent"
                    selectionColor={colors.primary}
                    theme={{ colors: { text: colors.onBackground, placeholder: colors.onSurfaceVariant } }}
                  />
                  <Text style={{ color: colors.onBackground, fontWeight: '700', marginBottom: 6, marginLeft: 2 }}>Phone</Text>
                  <TextInput
                    label="+1234567890"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    style={styles.input}
                    mode="flat"
                    underlineColor="transparent"
                    selectionColor={colors.primary}
                    theme={{ colors: { text: colors.onBackground, placeholder: colors.onSurfaceVariant } }}
                  />
                  <Text style={{ color: colors.onBackground, fontWeight: '700', marginBottom: 6, marginLeft: 2 }}>Default Currency</Text>
                  <TouchableOpacity onPress={() => setCurrencyModal(true)} style={styles.currencyPicker}>
                    <Text style={{ color: colors.onBackground, fontSize: 16 }}>{SUPPORTED_CURRENCIES.find(c => c.code === currency)?.code} - {SUPPORTED_CURRENCIES.find(c => c.code === currency)?.name}</Text>
                    <Ionicons name="chevron-down" size={20} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                  <Portal>
                    <Modal visible={currencyModal} onDismiss={() => setCurrencyModal(false)} contentContainerStyle={{ backgroundColor: colors.background, margin: 24, borderRadius: 12, padding: 0 }}>
                      <List.Section>
                        {SUPPORTED_CURRENCIES.map(c => (
                          <List.Item
                            key={c.code}
                            title={`${c.code} - ${c.name}`}
                            onPress={() => { setCurrency(c.code); setCurrencyModal(false); }}
                            left={props => <List.Icon {...props} icon={currency === c.code ? 'check-circle' : 'circle-outline'} color={currency === c.code ? colors.primary : colors.onSurfaceVariant} />}
                          />
                        ))}
                      </List.Section>
                    </Modal>
                  </Portal>
                  <Text style={{ color: colors.onBackground, fontWeight: '700', marginBottom: 6, marginLeft: 2 }}>Referral Code (Optional)</Text>
                  <TextInput
                    label="Referral code"
                    value={referralCode}
                    onChangeText={setReferralCode}
                    style={styles.input}
                    mode="flat"
                    underlineColor="transparent"
                    selectionColor={colors.primary}
                    theme={{ colors: { text: colors.onBackground, placeholder: colors.onSurfaceVariant } }}
                  />
                  {!otpStep ? (
                    <Button mode="contained" onPress={handleSendCode} loading={loading} style={styles.button} labelStyle={styles.buttonLabel}>Send Code</Button>
                  ) : (
                    <>
                      <Text style={{ color: colors.onBackground, fontWeight: '700', marginBottom: 6, marginLeft: 2 }}>Verification Code</Text>
                      <TextInput
                        label="Enter code"
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                        style={styles.input}
                        mode="flat"
                        underlineColor="transparent"
                        selectionColor={colors.primary}
                        theme={{ colors: { text: colors.onBackground, placeholder: colors.onSurfaceVariant } }}
                      />
                      <Button mode="contained" onPress={handleVerifyCode} loading={loading} style={styles.button} labelStyle={styles.buttonLabel}>Verify Code</Button>
                    </>
                  )}
                </View>
              )}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                <View style={styles.dividerLine} />
              </View>
              <Button
                icon={() => <MaterialCommunityIcons name="google" size={20} color={colors.onBackground} style={{ marginRight: 8 }} />}
                mode="outlined"
                onPress={() => {}}
                disabled={loading}
                style={styles.button}
                labelStyle={[styles.buttonLabel, { color: colors.onBackground }]}
              >
                Continue with Google
              </Button>
              <Button
                icon={() => <MaterialCommunityIcons name="facebook" size={20} color="#fff" style={{ marginRight: 8 }} />}
                mode="contained"
                buttonColor="#1877F2"
                textColor="#fff"
                onPress={() => {}}
                disabled={loading}
                style={[styles.button, { backgroundColor: '#1877F2', marginBottom: 8 }]}
                labelStyle={[styles.buttonLabel, { color: '#fff' }]}
              >
                Continue with Facebook
              </Button>
              <View style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={styles.bottomText}>Already have an account?{' '}
                  <TouchableOpacity onPress={() => router.push('/login')}><Text style={{ color: colors.primary, fontWeight: '700' }}>Log in</Text></TouchableOpacity>
                </Text>
              </View>
            </Card.Content>
          </Card>
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
        style={{ backgroundColor: snackbar.color || colors.primary }}
      >
        {snackbar.message}
      </Snackbar>
    </Surface>
  );
} 