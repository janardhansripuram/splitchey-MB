import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Platform, TouchableOpacity, Linking, RefreshControl } from 'react-native';
import { Surface, Text, Card, Button, Avatar, useTheme, Dialog, Portal, TextInput, Snackbar, Switch, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import * as ImagePicker from 'expo-image-picker';
import { updateProfile, signOut, updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { getUserProfile, createUserProfile, updateUserProfilePhoto, upgradeUserToPremium, cancelUserSubscription } from '../../firebase/firestore';
import * as Notifications from 'expo-notifications';
import { Modal, List } from 'react-native-paper';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { db } from '../../firebase/config';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { useThemeMode } from '../../contexts/ThemeContext';
import { format } from 'date-fns';

const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  // Add more as needed
];

// Local updateUserProfile implementation
const updateUserProfile = async (uid: string, updates: { displayName?: string; defaultCurrency?: string }) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, updates);
};

export default function ProfileScreen() {
  const { authUser, userProfile, loading, refetchUserProfile } = useAuth();
  const { colors, dark } = useTheme();
  const { theme, setTheme } = useThemeMode();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [currency, setCurrency] = useState(userProfile?.defaultCurrency || 'USD');
  const [editLoading, setEditLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '', error: false });
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false); // Placeholder for push status
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifStatus, setNotifStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [currencyModal, setCurrencyModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [appVersion] = useState('1.0.0'); // Replace with real version if available
  const [upgradeDialog, setUpgradeDialog] = useState(false);
  const [manageSubscriptionOpen, setManageSubscriptionOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradePeriod, setUpgradePeriod] = useState<'monthly' | 'yearly' | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchUserProfile();
    setRefreshing(false);
  }, [refetchUserProfile]);

  // Profile photo upload with compression
  const handlePickAvatar = async () => {
    setAvatarLoading(true);
    try {
      console.log('[Avatar] Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        allowsEditing: true, 
        aspect: [1, 1], 
        quality: 0.7,
        base64: false,
      });
      
      if (!result.canceled && result.assets && result.assets[0].uri) {
        const uri = result.assets[0].uri;
        if (!uri) {
          setSnackbar({ visible: true, message: 'Failed to process image', error: true });
          setAvatarLoading(false);
          return;
        }
        console.log('[Avatar] Uploading to Firebase Storage with URI:', uri);
        const newUrl = await updateUserProfilePhoto(authUser.uid, uri);
        console.log('[Avatar] Firebase Storage upload complete:', newUrl);
        // Add cache-busting param
        const cacheBustedUrl = newUrl + '?t=' + Date.now();
        // Refetch user profile
        await refetchUserProfile();
        setSnackbar({ visible: true, message: 'Profile photo updated!', error: false });
      } else {
        setSnackbar({ visible: true, message: 'Image selection cancelled', error: true });
      }
    } catch (e: any) {
      console.error('[Avatar] Failed to update photo:', e);
      setSnackbar({ visible: true, message: 'Failed to update photo: ' + (e.message || e), error: true });
    }
    setAvatarLoading(false);
  };

  // Edit profile
  const handleSaveProfile = async () => {
    setEditLoading(true);
    try {
      await updateUserProfile(authUser.uid, { displayName, defaultCurrency: currency });
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName });
      }
      await refetchUserProfile();
      setSnackbar({ visible: true, message: 'Profile updated!', error: false });
      setEditProfileOpen(false);
    } catch (e) {
      setSnackbar({ visible: true, message: 'Failed to update profile', error: true });
    }
    setEditLoading(false);
  };

  // Change password
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setSnackbar({ visible: true, message: 'Passwords do not match', error: true });
      return;
    }
    setPasswordLoading(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setSnackbar({ visible: true, message: 'Password updated!', error: false });
        setChangePasswordOpen(false);
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      }
    } catch (e) {
      setSnackbar({ visible: true, message: 'Failed to update password', error: true });
    }
    setPasswordLoading(false);
  };

  // Change email logic
  const handleChangeEmail = async () => {
    setEmailLoading(true);
    try {
      if (auth.currentUser && newEmail && emailPassword) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email || '', emailPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updateEmail(auth.currentUser, newEmail);
        await refetchUserProfile();
        setSnackbar({ visible: true, message: 'Email updated!', error: false });
        setChangeEmailOpen(false);
        setNewEmail(''); setEmailPassword('');
      }
    } catch (e) {
      setSnackbar({ visible: true, message: 'Failed to update email', error: true });
    }
    setEmailLoading(false);
  };

  // Real delete account logic
  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      if (auth.currentUser && deletePassword) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email || '', deletePassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await deleteUser(auth.currentUser);
        setSnackbar({ visible: true, message: 'Account deleted', error: false });
        setDeleteDialog(false);
      }
    } catch (e) {
      setSnackbar({ visible: true, message: 'Failed to delete account', error: true });
    }
    setDeleteLoading(false);
  };

  // Subscription management
  const handleUpgradeToPremium = async (period: 'monthly' | 'yearly') => {
    setUpgrading(true);
    setUpgradePeriod(period);
    try {
      await upgradeUserToPremium(authUser.uid, period);
      await refetchUserProfile();
      setSnackbar({ visible: true, message: `Upgraded to Premium ${period} plan!`, error: false });
      setUpgradeDialog(false);
    } catch (e: any) {
      setSnackbar({ visible: true, message: 'Failed to upgrade subscription', error: true });
    }
    setUpgrading(false);
    setUpgradePeriod(null);
  };

  const handleCancelSubscription = async () => {
    setCanceling(true);
    try {
      
      // Validate user exists
      if (!authUser?.uid) {
        throw new Error('No authenticated user found');
      }
      
      // Validate user profile exists
      if (!userProfile) {
        throw new Error('User profile not loaded');
      }
      
      await cancelUserSubscription(authUser.uid);
      await refetchUserProfile();
      setSnackbar({ visible: true, message: 'Subscription canceled. You are now on the Free plan.', error: false });
      setManageSubscriptionOpen(false);
    } catch (e: any) {
      
      // Provide more specific error messages
      let errorMessage = 'Failed to cancel subscription';
      if (e.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please check your account status.';
      } else if (e.code === 'unavailable') {
        errorMessage = 'Service temporarily unavailable. Please try again.';
      } else if (e.message) {
        errorMessage = `Error: ${e.message}`;
      }
      
      setSnackbar({ visible: true, message: errorMessage, error: true });
    }
    setCanceling(false);
  };

  // Theme toggle logic
  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  const handleThemeModeChange = (mode: 'system' | 'light' | 'dark') => {
    setTheme(mode);
  };

  // Upgrade to Premium logic
  const handleUpgrade = () => {
    setUpgradeDialog(true);
    // If you have a payment flow, call it here
    // e.g., router.push('/upgrade')
  };

  // Push notification enable (placeholder)
  const handleEnableNotif = async () => {
    setNotifLoading(true);
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifStatus(status);
    setNotifEnabled(status === 'granted');
    setNotifLoading(false);
    setSnackbar({ visible: true, message: status === 'granted' ? 'Push notifications enabled!' : 'Permission denied.', error: status !== 'granted' });
  };

  // Logout
  const handleLogout = async () => {
    await signOut(auth);
  };

  // Real push notification permission logic
  const checkNotifPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotifStatus(status);
    setNotifEnabled(status === 'granted');
  };
  React.useEffect(() => { checkNotifPermission(); }, []);

  if (loading || !userProfile) {
    return <Surface style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator size="large" /></Surface>;
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerSection: { 
      backgroundColor: colors.primary, 
      height: 200, 
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerWave: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 50,
      backgroundColor: colors.background,
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
    },
    profileSection: {
      marginTop: -106, // Half of avatar height (112/2)
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 30,
    },
    avatarContainer: {
      position: 'relative',
      marginBottom: 16,
      zIndex: 10,
    },
    avatar: { 
      backgroundColor: colors.primary, 
      width: 112, 
      height: 112,
      borderRadius: 56,
      borderWidth: 4,
      borderColor: colors.background,
    },
    cameraButton: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      backgroundColor: colors.background,
      borderRadius: 16,
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    profileName: { 
      fontWeight: 'bold', 
      fontSize: 24, 
      color: colors.onBackground,
      marginBottom: 4,
    },
    profileEmail: { 
      color: colors.onSurfaceVariant, 
      fontSize: 16,
    },
    card: { borderRadius: 18, marginBottom: 18, backgroundColor: dark ? colors.elevation.level2 : '#fafbfc', padding: 0, elevation: 4 },
    cardContent: { padding: 20 },
    avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontWeight: 'bold', fontSize: 18, color: colors.onBackground, marginBottom: 6 },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    label: { color: colors.onSurfaceVariant, fontSize: 15 },
    value: { fontWeight: 'bold', fontSize: 15, color: colors.onBackground },
    fullButton: { borderRadius: 10, marginTop: 10, height: 48, justifyContent: 'center', backgroundColor: colors.primary },
    fullButtonLabel: { fontWeight: 'bold', fontSize: 17, color: colors.onPrimary },
    cancelButton: { borderRadius: 10, marginTop: 10, height: 48, justifyContent: 'center', borderColor: colors.error },
    cancelButtonLabel: { fontWeight: 'bold', fontSize: 17, color: colors.error },
    themeSelector: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingHorizontal: 8 },
    themeOption: { alignItems: 'center', padding: 16, borderRadius: 12, minWidth: 80, backgroundColor: colors.elevation?.level1 || colors.surface },
    themeOptionActive: { backgroundColor: colors.primaryContainer, borderWidth: 2, borderColor: colors.primary },
    themeLabel: { marginTop: 8, fontSize: 12, fontWeight: '500', color: colors.onSurfaceVariant },
    themeLabelActive: { color: colors.primary, fontWeight: 'bold' },
    subscriptionCard: {
      backgroundColor: colors.primaryContainer,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    subscriptionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    subscriptionTitle: {
      fontWeight: 'bold',
      fontSize: 18,
      color: colors.onBackground,
      marginLeft: 8,
    },
    subscriptionDetails: {
      marginBottom: 16,
    },
    subscriptionPlan: {
      fontWeight: 'bold',
      fontSize: 16,
      color: colors.onBackground,
      marginBottom: 4,
    },
    subscriptionDate: {
      color: colors.onSurfaceVariant,
      fontSize: 14,
    },
    subscriptionFeatures: {
      backgroundColor: colors.elevation?.level1 || colors.surface,
      padding: 16,
      borderRadius: 8,
      marginTop: 12,
    },
    featureTitle: {
      fontWeight: 'bold',
      fontSize: 14,
      color: colors.onBackground,
      marginBottom: 8,
    },
    featureList: {
      color: colors.onSurfaceVariant,
      fontSize: 13,
      lineHeight: 18,
    },
    dialogContent: {
      paddingVertical: 16,
    },
    dialogActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
    },
  });

  return (
    <ScrollView style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.headerWave} />
      </View>
      
      {/* Profile Section */}
      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          <Avatar.Image 
            size={112} 
            source={{ uri: userProfile.photoURL }} 
            style={styles.avatar}
          />
          <TouchableOpacity 
            style={styles.cameraButton} 
            onPress={handlePickAvatar}
            disabled={avatarLoading}
          >
            {avatarLoading ? (
              <ActivityIndicator size={16} color={colors.primary} />
            ) : (
              <MaterialCommunityIcons name="camera" size={16} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.profileName}>{userProfile.displayName}</Text>
        <Text style={styles.profileEmail}>{userProfile.email}</Text>
      </View>

      <View style={{ padding: 20 }}>
        {/* Subscription Card */}
        <Card style={[styles.card, userProfile.subscription?.plan === 'premium' && styles.subscriptionCard]}>
          <View style={styles.cardContent}>
            <View style={styles.subscriptionHeader}>
              <MaterialCommunityIcons name="star" size={24} color="#fbbf24" />
              <Text style={styles.subscriptionTitle}>Subscription</Text>
            </View>
            <View style={styles.subscriptionDetails}>
              <Text style={styles.label}>Your Plan</Text>
              <Text style={styles.subscriptionPlan}>
                {userProfile.subscription?.planId?.replace('_', ' ') || 'Free'}
              </Text>
              {userProfile.subscription?.planId !== 'free' && userProfile.subscription?.currentPeriodEnd && (
                <Text style={styles.subscriptionDate}>
                  Renews on {format(new Date(userProfile.subscription.currentPeriodEnd), 'MMM dd, yyyy')}
                </Text>
              )}
            </View>
            
            {userProfile.subscription?.plan === 'free' ? (
              <Button 
                mode="contained" 
                style={styles.fullButton} 
                labelStyle={styles.fullButtonLabel}
                onPress={() => setUpgradeDialog(true)}
              >
                Upgrade to Premium
              </Button>
            ) : (
              <Button 
                mode="outlined" 
                style={styles.fullButton} 
                labelStyle={styles.fullButtonLabel}
                onPress={() => setManageSubscriptionOpen(true)}
              >
                Manage Subscription
              </Button>
            )}
            
            {userProfile.subscription?.plan === 'free' && (
              <View style={styles.subscriptionFeatures}>
                <Text style={styles.featureTitle}>Upgrade to unlock:</Text>
                <Text style={styles.featureList}>
                  • Unlimited Budgets & Savings Goals{'\n'}
                  • Unlimited AI-powered Receipt Scans{'\n'}
                  • Advanced Reporting & Insights
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Account Details Card */}
        <Card style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Account Details</Text>
            <View style={styles.sectionRow}>
              <Text style={styles.label}>Display Name</Text>
              <Text style={styles.value}>{userProfile.displayName}</Text>
            </View>
            <View style={styles.sectionRow}>
              <Text style={styles.label}>Default Currency</Text>
              <Text style={styles.value}>{userProfile.defaultCurrency}</Text>
            </View>
            <Button mode="outlined" style={styles.fullButton} labelStyle={styles.fullButtonLabel} onPress={() => setEditProfileOpen(true)}>Edit Details</Button>
          </View>
        </Card>

        {/* Appearance Card */}
        <Card style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Appearance</Text>
            <View style={styles.sectionRow}>
              <Text style={styles.label}>Theme</Text>
              <Switch value={theme === 'dark'} onValueChange={handleThemeToggle} />
            </View>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, marginTop: 4 }}>Current: {theme.charAt(0).toUpperCase() + theme.slice(1)}</Text>
            <View style={styles.themeSelector}>
              <TouchableOpacity
                style={[styles.themeOption, theme === 'system' && styles.themeOptionActive]}
                onPress={() => handleThemeModeChange('system')}
              >
                <MaterialCommunityIcons
                  name="theme-light-dark"
                  size={24}
                  color={theme === 'system' ? colors.primary : colors.onSurfaceVariant}
                />
                <Text style={[styles.themeLabel, theme === 'system' && styles.themeLabelActive]}>System</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themeOption, theme === 'light' && styles.themeOptionActive]}
                onPress={() => handleThemeModeChange('light')}
              >
                <MaterialCommunityIcons
                  name="white-balance-sunny"
                  size={24}
                  color={theme === 'light' ? colors.primary : colors.onSurfaceVariant}
                />
                <Text style={[styles.themeLabel, theme === 'light' && styles.themeLabelActive]}>Light</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themeOption, theme === 'dark' && styles.themeOptionActive]}
                onPress={() => handleThemeModeChange('dark')}
              >
                <MaterialCommunityIcons
                  name="weather-night"
                  size={24}
                  color={theme === 'dark' ? colors.primary : colors.onSurfaceVariant}
                />
                <Text style={[styles.themeLabel, theme === 'dark' && styles.themeLabelActive]}>Dark</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
        {/* Notifications Card */}
        <Card style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <View style={styles.sectionRow}>
              <Text style={styles.label}>Push Notifications</Text>
              <Button mode="outlined" onPress={handleEnableNotif} loading={notifLoading} disabled={notifEnabled} style={{ borderRadius: 8 }}>{notifEnabled ? 'Enabled' : 'Enable'}</Button>
            </View>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, marginTop: 4 }}>Status: {notifStatus.charAt(0).toUpperCase() + notifStatus.slice(1)}</Text>
          </View>
        </Card>
        {/* Security Card */}
        <Card style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Security</Text>
            <Button mode="outlined" style={styles.fullButton} labelStyle={styles.fullButtonLabel} onPress={() => setChangePasswordOpen(true)}>Change Password</Button>
            <Button mode="outlined" style={styles.fullButton} labelStyle={styles.fullButtonLabel} onPress={() => setChangeEmailOpen(true)}>Change Email</Button>
            <Button mode="outlined" style={[styles.cancelButton, { marginTop: 16 }]} labelStyle={styles.cancelButtonLabel} onPress={() => setDeleteDialog(true)}>Delete Account</Button>
            <Button mode="outlined" style={[styles.cancelButton, { marginTop: 16 }]} labelStyle={styles.cancelButtonLabel} onPress={handleLogout}>Log Out</Button>
          </View>
        </Card>
        {/* App Info & Support Card */}
        <Card style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>App Info & Support</Text>
            <Text style={styles.label}>Version: <Text style={styles.value}>{appVersion}</Text></Text>
            <Button mode="text" onPress={() => Linking.openURL('mailto:support@splitchey.com')} style={{ marginTop: 8 }}>Contact Support</Button>
            <Button mode="text" onPress={() => Linking.openURL('https://splitchey.com/privacy-policy')} style={{ marginTop: 2 }}>Privacy Policy</Button>
            <Button mode="text" onPress={() => Linking.openURL('https://splitchey.com/terms-of-service')} style={{ marginTop: 2 }}>Terms of Service</Button>
          </View>
        </Card>
        {/* Edit Profile Dialog */}
        <Portal>
          <Dialog visible={editProfileOpen} onDismiss={() => setEditProfileOpen(false)}>
            <Dialog.Title>Edit Profile</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="Display Name"
                value={displayName}
                onChangeText={setDisplayName}
                style={{ marginBottom: 14 }}
                mode="outlined"
              />
              <Text style={{ marginBottom: 6 }}>Default Currency</Text>
              <TouchableOpacity onPress={() => setCurrencyModal(true)} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.outline, borderRadius: 8, padding: 12, marginBottom: 8, backgroundColor: colors.elevation.level1 }}>
                <Text style={{ color: colors.onBackground, fontSize: 16 }}>{SUPPORTED_CURRENCIES.find(c => c.code === currency)?.code} - {SUPPORTED_CURRENCIES.find(c => c.code === currency)?.name}</Text>
                <Ionicons name="chevron-down" size={20} color={colors.onSurfaceVariant} style={{ marginLeft: 'auto' }} />
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
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setEditProfileOpen(false)}>Cancel</Button>
              <Button loading={editLoading} onPress={handleSaveProfile}>Save</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        {/* Change Password Dialog */}
        <Portal>
          <Dialog visible={changePasswordOpen} onDismiss={() => setChangePasswordOpen(false)}>
            <Dialog.Title>Change Password</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                style={{ marginBottom: 10 }}
                mode="outlined"
              />
              <TextInput
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                style={{ marginBottom: 10 }}
                mode="outlined"
              />
              <TextInput
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                style={{ marginBottom: 10 }}
                mode="outlined"
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setChangePasswordOpen(false)}>Cancel</Button>
              <Button loading={passwordLoading} onPress={handleChangePassword}>Save</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        {/* Change Email Dialog */}
        <Portal>
          <Dialog visible={changeEmailOpen} onDismiss={() => setChangeEmailOpen(false)}>
            <Dialog.Title>Change Email</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="New Email"
                value={newEmail}
                onChangeText={setNewEmail}
                style={{ marginBottom: 10 }}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                label="Current Password"
                value={emailPassword}
                onChangeText={setEmailPassword}
                secureTextEntry
                style={{ marginBottom: 10 }}
                mode="outlined"
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setChangeEmailOpen(false)}>Cancel</Button>
              <Button loading={emailLoading} onPress={handleChangeEmail}>Save</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        {/* Delete Account Dialog (real) */}
        <Portal>
          <Dialog visible={deleteDialog} onDismiss={() => setDeleteDialog(false)}>
            <Dialog.Title>Delete Account</Dialog.Title>
            <Dialog.Content>
              <Text>Are you sure you want to delete your account? This action cannot be undone.</Text>
              <TextInput
                label="Current Password"
                value={deletePassword}
                onChangeText={setDeletePassword}
                secureTextEntry
                style={{ marginTop: 10 }}
                mode="outlined"
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setDeleteDialog(false)}>Cancel</Button>
              <Button loading={deleteLoading} onPress={handleDeleteAccount}>Delete</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Upgrade Dialog */}
        <Portal>
          <Dialog visible={upgradeDialog} onDismiss={() => setUpgradeDialog(false)}>
            <Dialog.Title>Upgrade to Premium</Dialog.Title>
            <Dialog.Content style={styles.dialogContent}>
              <Text style={{ marginBottom: 16 }}>Choose your plan:</Text>
              <Button 
                mode="contained" 
                style={{ marginBottom: 8 }} 
                onPress={() => handleUpgradeToPremium('monthly')}
                loading={upgrading && upgradePeriod === 'monthly'}
                disabled={upgrading}
              >
                {upgrading && upgradePeriod === 'monthly' ? 'Upgrading...' : 'Monthly - $4.99/month'}
              </Button>
              <Button 
                mode="contained" 
                style={{ marginBottom: 8 }} 
                onPress={() => handleUpgradeToPremium('yearly')}
                loading={upgrading && upgradePeriod === 'yearly'}
                disabled={upgrading}
              >
                {upgrading && upgradePeriod === 'yearly' ? 'Upgrading...' : 'Yearly - $49.99/year (Save 17%)'}
              </Button>
            </Dialog.Content>
            <Dialog.Actions style={styles.dialogActions}>
              <Button onPress={() => setUpgradeDialog(false)} disabled={upgrading}>Cancel</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Manage Subscription Dialog */}
        <Portal>
          <Dialog visible={manageSubscriptionOpen} onDismiss={() => setManageSubscriptionOpen(false)}>
            <Dialog.Title>Manage Your Subscription</Dialog.Title>
            <Dialog.Content style={styles.dialogContent}>
              <Text style={{ marginBottom: 16 }}>
                You are currently on the{' '}
                <Text style={{ fontWeight: 'bold' }}>
                  {userProfile.subscription?.planId?.replace('_', ' ')}
                </Text>{' '}
                plan.
              </Text>
              {userProfile.subscription?.currentPeriodEnd && (
                <Text style={{ marginBottom: 16 }}>
                  Your subscription will automatically renew on{' '}
                  <Text style={{ fontWeight: 'bold' }}>
                    {format(new Date(userProfile.subscription.currentPeriodEnd), 'PPP')}
                  </Text>
                  .
                </Text>
              )}
              <Text style={{ marginBottom: 16, color: colors.onSurfaceVariant, fontSize: 14 }}>
                This will cancel your Premium subscription at the end of the current billing period. You will be downgraded to the Free plan.
              </Text>
            </Dialog.Content>
            <Dialog.Actions style={styles.dialogActions}>
              <Button onPress={() => setManageSubscriptionOpen(false)}>Close</Button>
              <Button 
                mode="contained" 
                buttonColor={colors.error}
                onPress={handleCancelSubscription}
                loading={canceling}
                disabled={canceling}
              >
                {canceling ? 'Canceling...' : 'Cancel Subscription'}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <Snackbar
          visible={snackbar.visible}
          onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
          duration={3000}
          style={{ backgroundColor: snackbar.error ? colors.error : colors.primary }}
        >
          {snackbar.message}
        </Snackbar>
      </View>
    </ScrollView>
  );
} 