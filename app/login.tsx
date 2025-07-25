import React, { useState, useRef } from 'react';
import { View, Image, KeyboardAvoidingView, Platform, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, Surface, Card, useTheme, Snackbar, Divider } from 'react-native-paper';
import { signInWithEmailAndPassword, signInWithPhoneNumber, signInWithCredential, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useRouter } from 'expo-router';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { makeRedirectUri } from 'expo-auth-session';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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
    input: {
      marginBottom: 14,
      backgroundColor: dark ? colors.elevation.level1 : '#fff',
      borderRadius: 8,
      width: CARD_WIDTH - 48,
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
              <Text style={{ fontWeight: '700', fontSize: 22, textAlign: 'center', marginBottom: 4, color: colors.onBackground }}>Welcome Back</Text>
              <Text style={{ color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20, fontSize: 15 }}>Log in to access your dashboard.</Text>
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
                  <Button mode="contained" onPress={handleLogin} loading={loading} style={styles.button} labelStyle={styles.buttonLabel}>Log In</Button>
                </View>
              )}
              {/* Phone Tab */}
              {tab === 'phone' && (
                <View style={{ width: '100%' }}>
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
                onPress={() => promptAsync()}
                disabled={!request || loading}
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
                onPress={() => fbPromptAsync()}
                disabled={!fbRequest || loading}
                style={[styles.button, { backgroundColor: '#1877F2', marginBottom: 8 }]}
                labelStyle={[styles.buttonLabel, { color: '#fff' }]}
              >
                Continue with Facebook
              </Button>
              <View style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={styles.bottomText}>Don't have an account?{' '}
                  <TouchableOpacity onPress={() => router.push('/signup')}><Text style={{ color: colors.primary, fontWeight: '700' }}>Sign up</Text></TouchableOpacity>
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