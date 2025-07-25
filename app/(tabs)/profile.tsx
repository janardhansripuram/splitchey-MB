import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { EmailAuthProvider, deleteUser, reauthenticateWithCredential, signOut, updateEmail, updatePassword, updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { Bell, Lock, LogOut, Mail, Palette, Settings, Shield, Star, Trash2, User } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Dimensions, Linking, RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Avatar, Dialog, Divider, List, Modal, Portal, Snackbar, Surface, Switch, Text, useTheme } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernButton } from '../../components/ui/ModernButton';
import { ModernCard } from '../../components/ui/ModernCard';
import { ModernInput } from '../../components/ui/ModernInput';
import { DesignSystem } from '../../constants/DesignSystem';
import { useThemeMode } from '../../contexts/ThemeContext';
import { auth, db } from '../../firebase/config';
import { cancelUserSubscription, updateUserProfilePhoto, upgradeUserToPremium } from '../../firebase/firestore';
import { useAuth } from '../../hooks/useAuth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const insets = useSafeAreaInsets();

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

  return (
    <Surface style={{ flex: 1, backgroundColor: DesignSystem.colors.neutral[50] }}>
      {/* Header Section */}
      <View style={{
        background: `linear-gradient(135deg, ${DesignSystem.colors.primary[500]} 0%, ${DesignSystem.colors.primary[600]} 100%)`,
        backgroundColor: DesignSystem.colors.primary[500],
        paddingTop: insets.top + 20,
        paddingBottom: 80,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        ...DesignSystem.shadows.lg,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>Profile</Text>
          <TouchableOpacity onPress={() => setEditProfileOpen(true)} style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: 20,
            padding: 8,
          }}>
            <Settings size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Profile Section */}
      <View style={{ 
        marginTop: -60, 
        alignItems: 'center', 
        paddingHorizontal: 20, 
        paddingBottom: 30,
        zIndex: 10,
      }}>
        <Animated.View entering={FadeInUp.delay(200)} style={{ position: 'relative', marginBottom: 16 }}>
          <Avatar.Image 
            size={112} 
            source={{ uri: userProfile.photoURL }} 
            style={{
              backgroundColor: DesignSystem.colors.primary[500],
              borderWidth: 4,
              borderColor: '#fff',
              ...DesignSystem.shadows.lg,
            }}
          />
          <TouchableOpacity 
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              backgroundColor: '#fff',
              borderRadius: 20,
              width: 40,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
              ...DesignSystem.shadows.md,
            }}
            onPress={handlePickAvatar}
            disabled={avatarLoading}
          >
            {avatarLoading ? (
              <ActivityIndicator size={20} color={DesignSystem.colors.primary[500]} />
            ) : (
              <MaterialCommunityIcons name="camera" size={20} color={DesignSystem.colors.primary[500]} />
            )}
          </TouchableOpacity>
        </Animated.View>
        
        <Animated.View entering={FadeInUp.delay(400)} style={{ alignItems: 'center' }}>
          <Text style={{ 
            fontWeight: '700', 
            fontSize: 24, 
            color: DesignSystem.colors.neutral[900],
            marginBottom: 4,
          }}>
            {userProfile.displayName}
          </Text>
          <Text style={{ 
            color: DesignSystem.colors.neutral[600], 
            fontSize: 16,
          }}>
            {userProfile.email}
          </Text>
        </Animated.View>
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Subscription Card */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <ModernCard 
            variant={userProfile.subscription?.plan === 'premium' ? 'elevated' : 'default'}
            style={{
              marginBottom: 20,
              backgroundColor: userProfile.subscription?.plan === 'premium' 
                ? DesignSystem.colors.primary[50] 
                : '#fff',
              borderWidth: userProfile.subscription?.plan === 'premium' ? 2 : 0,
              borderColor: userProfile.subscription?.plan === 'premium' 
                ? DesignSystem.colors.primary[200] 
                : 'transparent',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                backgroundColor: DesignSystem.colors.warning[100],
                borderRadius: 12,
                padding: 8,
                marginRight: 12,
              }}>
                <Star size={24} color={DesignSystem.colors.warning[600]} />
              </View>
              <Text style={{ 
                fontWeight: '700', 
                fontSize: 20, 
                color: DesignSystem.colors.neutral[900] 
              }}>
                Subscription
              </Text>
            </View>
            
            <View style={{ marginBottom: 16 }}>
              <Text style={{ 
                color: DesignSystem.colors.neutral[600], 
                fontSize: 14, 
                marginBottom: 4 
              }}>
                Your Plan
              </Text>
              <Text style={{ 
                fontWeight: '700', 
                fontSize: 18, 
                color: DesignSystem.colors.neutral[900],
                marginBottom: 4,
              }}>
                {userProfile.subscription?.planId?.replace('_', ' ') || 'Free'}
              </Text>
              {userProfile.subscription?.planId !== 'free' && userProfile.subscription?.currentPeriodEnd && (
                <Text style={{ 
                  color: DesignSystem.colors.neutral[600], 
                  fontSize: 14 
                }}>
                  Renews on {format(new Date(userProfile.subscription.currentPeriodEnd), 'MMM dd, yyyy')}
                </Text>
              )}
            </View>
            
            {userProfile.subscription?.plan === 'free' ? (
              <ModernButton
                title="Upgrade to Premium"
                onPress={() => setUpgradeDialog(true)}
                variant="primary"
                fullWidth
                icon={<Star size={20} color="#fff" />}
              />
            ) : (
              <ModernButton
                title="Manage Subscription"
                onPress={() => setManageSubscriptionOpen(true)}
                variant="outline"
                fullWidth
              />
            )}
            
            {userProfile.subscription?.plan === 'free' && (
              <View style={{
                backgroundColor: DesignSystem.colors.neutral[50],
                padding: 16,
                borderRadius: 12,
                marginTop: 16,
              }}>
                <Text style={{ 
                  fontWeight: '600', 
                  fontSize: 14, 
                  color: DesignSystem.colors.neutral[900],
                  marginBottom: 8,
                }}>
                  Upgrade to unlock:
                </Text>
                <Text style={{ 
                  color: DesignSystem.colors.neutral[700], 
                  fontSize: 13, 
                  lineHeight: 20,
                }}>
                  • Unlimited Budgets & Savings Goals{'\n'}
                  • Unlimited AI-powered Receipt Scans{'\n'}
                  • Advanced Reporting & Insights
                </Text>
              </View>
            )}
          </ModernCard>
        </Animated.View>

        {/* Account Details Card */}
        <Animated.View entering={FadeInDown.delay(300)}>
          <ModernCard style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                backgroundColor: DesignSystem.colors.primary[100],
                borderRadius: 12,
                padding: 8,
                marginRight: 12,
              }}>
                <User size={24} color={DesignSystem.colors.primary[600]} />
              </View>
              <Text style={{ 
                fontWeight: '700', 
                fontSize: 20, 
                color: DesignSystem.colors.neutral[900] 
              }}>
                Account Details
              </Text>
            </View>
            
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: DesignSystem.colors.neutral[600], fontSize: 14 }}>Display Name</Text>
                <Text style={{ fontWeight: '600', fontSize: 15, color: DesignSystem.colors.neutral[900] }}>
                  {userProfile.displayName}
                </Text>
              </View>
              <Divider style={{ backgroundColor: DesignSystem.colors.neutral[200] }} />
            </View>
            
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: DesignSystem.colors.neutral[600], fontSize: 14 }}>Default Currency</Text>
                <Text style={{ fontWeight: '600', fontSize: 15, color: DesignSystem.colors.neutral[900] }}>
                  {userProfile.defaultCurrency}
                </Text>
              </View>
              <Divider style={{ backgroundColor: DesignSystem.colors.neutral[200] }} />
            </View>
            
            <ModernButton
              title="Edit Details"
              onPress={() => setEditProfileOpen(true)}
              variant="outline"
              fullWidth
              icon={<Settings size={18} color={DesignSystem.colors.primary[600]} />}
            />
          </ModernCard>
        </Animated.View>

        {/* Appearance Card */}
        <Animated.View entering={FadeInDown.delay(400)}>
          <ModernCard style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                backgroundColor: DesignSystem.colors.secondary[100],
                borderRadius: 12,
                padding: 8,
                marginRight: 12,
              }}>
                <Palette size={24} color={DesignSystem.colors.secondary[600]} />
              </View>
              <Text style={{ 
                fontWeight: '700', 
                fontSize: 20, 
                color: DesignSystem.colors.neutral[900] 
              }}>
                Appearance
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: DesignSystem.colors.neutral[600], fontSize: 15 }}>Dark Mode</Text>
              <Switch 
                value={theme === 'dark'} 
                onValueChange={handleThemeToggle}
                trackColor={{ 
                  false: DesignSystem.colors.neutral[300], 
                  true: DesignSystem.colors.primary[500] 
                }}
                thumbColor={theme === 'dark' ? '#fff' : '#fff'}
              />
            </View>
            
            <Text style={{ 
              color: DesignSystem.colors.neutral[500], 
              fontSize: 13, 
              marginBottom: 16 
            }}>
              Current: {theme.charAt(0).toUpperCase() + theme.slice(1)}
            </Text>
            
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-around', 
              backgroundColor: DesignSystem.colors.neutral[50],
              borderRadius: 16,
              padding: 8,
            }}>
              <TouchableOpacity
                style={{
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 12,
                  minWidth: 80,
                  backgroundColor: theme === 'system' ? DesignSystem.colors.primary[100] : 'transparent',
                }}
                onPress={() => handleThemeModeChange('system')}
              >
                <MaterialCommunityIcons
                  name="theme-light-dark"
                  size={24}
                  color={theme === 'system' ? DesignSystem.colors.primary[600] : DesignSystem.colors.neutral[500]}
                />
                <Text style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: theme === 'system' ? '600' : '500',
                  color: theme === 'system' ? DesignSystem.colors.primary[600] : DesignSystem.colors.neutral[600],
                }}>
                  System
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 12,
                  minWidth: 80,
                  backgroundColor: theme === 'light' ? DesignSystem.colors.primary[100] : 'transparent',
                }}
                onPress={() => handleThemeModeChange('light')}
              >
                <MaterialCommunityIcons
                  name="white-balance-sunny"
                  size={24}
                  color={theme === 'light' ? DesignSystem.colors.primary[600] : DesignSystem.colors.neutral[500]}
                />
                <Text style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: theme === 'light' ? '600' : '500',
                  color: theme === 'light' ? DesignSystem.colors.primary[600] : DesignSystem.colors.neutral[600],
                }}>
                  Light
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 12,
                  minWidth: 80,
                  backgroundColor: theme === 'dark' ? DesignSystem.colors.primary[100] : 'transparent',
                }}
                onPress={() => handleThemeModeChange('dark')}
              >
                <MaterialCommunityIcons
                  name="weather-night"
                  size={24}
                  color={theme === 'dark' ? DesignSystem.colors.primary[600] : DesignSystem.colors.neutral[500]}
                />
                <Text style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: theme === 'dark' ? '600' : '500',
                  color: theme === 'dark' ? DesignSystem.colors.primary[600] : DesignSystem.colors.neutral[600],
                }}>
                  Dark
                </Text>
              </TouchableOpacity>
            </View>
          </ModernCard>
        </Animated.View>
        
        {/* Notifications Card */}
        <Animated.View entering={FadeInDown.delay(500)}>
          <ModernCard style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                backgroundColor: DesignSystem.colors.warning[100],
                borderRadius: 12,
                padding: 8,
                marginRight: 12,
              }}>
                <Bell size={24} color={DesignSystem.colors.warning[600]} />
              </View>
              <Text style={{ 
                fontWeight: '700', 
                fontSize: 20, 
                color: DesignSystem.colors.neutral[900] 
              }}>
                Notifications
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: DesignSystem.colors.neutral[700], fontSize: 15 }}>Push Notifications</Text>
              <ModernButton
                title={notifEnabled ? 'Enabled' : 'Enable'}
                onPress={handleEnableNotif}
                loading={notifLoading}
                disabled={notifEnabled}
                variant={notifEnabled ? 'ghost' : 'outline'}
                size="sm"
              />
            </View>
            
            <Text style={{ 
              color: DesignSystem.colors.neutral[500], 
              fontSize: 13 
            }}>
              Status: {notifStatus.charAt(0).toUpperCase() + notifStatus.slice(1)}
            </Text>
          </ModernCard>
        </Animated.View>
        
        {/* Security Card */}
        <Animated.View entering={FadeInDown.delay(600)}>
          <ModernCard style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                backgroundColor: DesignSystem.colors.error[100],
                borderRadius: 12,
                padding: 8,
                marginRight: 12,
              }}>
                <Shield size={24} color={DesignSystem.colors.error[600]} />
              </View>
              <Text style={{ 
                fontWeight: '700', 
                fontSize: 20, 
                color: DesignSystem.colors.neutral[900] 
              }}>
                Security
              </Text>
            </View>
            
            <ModernButton
              title="Change Password"
              onPress={() => setChangePasswordOpen(true)}
              variant="outline"
              fullWidth
              style={{ marginBottom: 12 }}
              icon={<Lock size={18} color={DesignSystem.colors.primary[600]} />}
            />
            
            <ModernButton
              title="Change Email"
              onPress={() => setChangeEmailOpen(true)}
              variant="outline"
              fullWidth
              style={{ marginBottom: 16 }}
              icon={<Mail size={18} color={DesignSystem.colors.primary[600]} />}
            />
            
            <ModernButton
              title="Delete Account"
              onPress={() => setDeleteDialog(true)}
              variant="danger"
              fullWidth
              style={{ marginBottom: 12 }}
              icon={<Trash2 size={18} color="#fff" />}
            />
            
            <ModernButton
              title="Log Out"
              onPress={handleLogout}
              variant="outline"
              fullWidth
              icon={<LogOut size={18} color={DesignSystem.colors.primary[600]} />}
            />
          </ModernCard>
        </Animated.View>
        
        {/* App Info & Support Card */}
        <Animated.View entering={FadeInDown.delay(700)}>
          <ModernCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                backgroundColor: DesignSystem.colors.neutral[100],
                borderRadius: 12,
                padding: 8,
                marginRight: 12,
              }}>
                <MaterialCommunityIcons name="information" size={24} color={DesignSystem.colors.neutral[600]} />
              </View>
              <Text style={{ 
                fontWeight: '700', 
                fontSize: 20, 
                color: DesignSystem.colors.neutral[900] 
              }}>
                App Info & Support
              </Text>
            </View>
            
            <View style={{ marginBottom: 16 }}>
              <Text style={{ 
                color: DesignSystem.colors.neutral[600], 
                fontSize: 14 
              }}>
                Version: <Text style={{ 
                  fontWeight: '600', 
                  color: DesignSystem.colors.neutral[900] 
                }}>
                  {appVersion}
                </Text>
              </Text>
            </View>
            
            <ModernButton
              title="Contact Support"
              onPress={() => Linking.openURL('mailto:support@splitchey.com')}
              variant="ghost"
              fullWidth
              style={{ marginBottom: 8 }}
            />
            
            <ModernButton
              title="Privacy Policy"
              onPress={() => Linking.openURL('https://splitchey.com/privacy-policy')}
              variant="ghost"
              fullWidth
              style={{ marginBottom: 8 }}
            />
            
            <ModernButton
              title="Terms of Service"
              onPress={() => Linking.openURL('https://splitchey.com/terms-of-service')}
              variant="ghost"
              fullWidth
            />
          </ModernCard>
        </Animated.View>
      </ScrollView>
      
        {/* Edit Profile Dialog */}
        <Portal>
          <Dialog 
            visible={editProfileOpen} 
            onDismiss={() => setEditProfileOpen(false)}
            style={{ borderRadius: 20 }}
          >
            <Dialog.Title>Edit Profile</Dialog.Title>
            <Dialog.Content>
              <ModernInput
                label="Display Name"
                value={displayName}
                onChangeText={setDisplayName}
              />
              
              <Text style={{ 
                marginBottom: 6, 
                fontSize: 14, 
                fontWeight: '600',
                color: DesignSystem.colors.neutral[700] 
              }}>
                Default Currency
              </Text>
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
              <ModernButton
                title="Cancel"
                onPress={() => setEditProfileOpen(false)}
                variant="ghost"
              />
              <ModernButton
                title="Save"
                onPress={handleSaveProfile}
                loading={editLoading}
                variant="primary"
              />
            </Dialog.Actions>
          </Dialog>
        </Portal>
        
        {/* Change Password Dialog */}
        <Portal>
          <Dialog 
            visible={changePasswordOpen} 
            onDismiss={() => setChangePasswordOpen(false)}
            style={{ borderRadius: 20 }}
          >
            <Dialog.Title>Change Password</Dialog.Title>
            <Dialog.Content>
              <ModernInput
                label="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />
              <ModernInput
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <ModernInput
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </Dialog.Content>
            <Dialog.Actions>
              <ModernButton
                title="Cancel"
                onPress={() => setChangePasswordOpen(false)}
                variant="ghost"
              />
              <ModernButton
                title="Save"
                onPress={handleChangePassword}
                loading={passwordLoading}
                variant="primary"
              />
            </Dialog.Actions>
          </Dialog>
        </Portal>
        
        {/* Change Email Dialog */}
        <Portal>
          <Dialog 
            visible={changeEmailOpen} 
            onDismiss={() => setChangeEmailOpen(false)}
            style={{ borderRadius: 20 }}
          >
            <Dialog.Title>Change Email</Dialog.Title>
            <Dialog.Content>
              <ModernInput
                label="New Email"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
              />
              <ModernInput
                label="Current Password"
                value={emailPassword}
                onChangeText={setEmailPassword}
                secureTextEntry
              />
            </Dialog.Content>
            <Dialog.Actions>
              <ModernButton
                title="Cancel"
                onPress={() => setChangeEmailOpen(false)}
                variant="ghost"
              />
              <ModernButton
                title="Save"
                onPress={handleChangeEmail}
                loading={emailLoading}
                variant="primary"
              />
            </Dialog.Actions>
          </Dialog>
        </Portal>
        
        {/* Delete Account Dialog (real) */}
        <Portal>
          <Dialog 
            visible={deleteDialog} 
            onDismiss={() => setDeleteDialog(false)}
            style={{ borderRadius: 20 }}
          >
            <Dialog.Title>Delete Account</Dialog.Title>
            <Dialog.Content>
              <Text>Are you sure you want to delete your account? This action cannot be undone.</Text>
              <ModernInput
                label="Current Password"
                value={deletePassword}
                onChangeText={setDeletePassword}
                secureTextEntry
              />
            </Dialog.Content>
            <Dialog.Actions>
              <ModernButton
                title="Cancel"
                onPress={() => setDeleteDialog(false)}
                variant="ghost"
              />
              <ModernButton
                title="Delete"
                onPress={handleDeleteAccount}
                loading={deleteLoading}
                variant="danger"
              />
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Upgrade Dialog */}
        <Portal>
          <Dialog 
            visible={upgradeDialog} 
            onDismiss={() => setUpgradeDialog(false)}
            style={{ borderRadius: 20 }}
          >
            <Dialog.Title>Upgrade to Premium</Dialog.Title>
            <Dialog.Content style={{ paddingVertical: 16 }}>
              <Text style={{ marginBottom: 16 }}>Choose your plan:</Text>
              <ModernButton
                title="Monthly - $4.99/month"
                onPress={() => handleUpgradeToPremium('monthly')}
                loading={upgrading && upgradePeriod === 'monthly'}
                disabled={upgrading}
                variant="primary"
                fullWidth
                style={{ marginBottom: 12 }}
              />
              <ModernButton
                title="Yearly - $49.99/year (Save 17%)"
                onPress={() => handleUpgradeToPremium('yearly')}
                loading={upgrading && upgradePeriod === 'yearly'}
                disabled={upgrading}
                variant="secondary"
                fullWidth
              />
            </Dialog.Content>
            <Dialog.Actions style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
              <ModernButton
                title="Cancel"
                onPress={() => setUpgradeDialog(false)}
                disabled={upgrading}
                variant="ghost"
              />
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Manage Subscription Dialog */}
        <Portal>
          <Dialog 
            visible={manageSubscriptionOpen} 
            onDismiss={() => setManageSubscriptionOpen(false)}
            style={{ borderRadius: 20 }}
          >
            <Dialog.Title>Manage Your Subscription</Dialog.Title>
            <Dialog.Content style={{ paddingVertical: 16 }}>
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
            <Dialog.Actions style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
              <ModernButton
                title="Close"
                onPress={() => setManageSubscriptionOpen(false)}
                variant="ghost"
              />
              <ModernButton
                title="Cancel Subscription"
                onPress={handleCancelSubscription}
                loading={canceling}
                disabled={canceling}
                variant="danger"
              />
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <Snackbar
          visible={snackbar.visible}
          onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
          duration={3000}
          style={{ 
            backgroundColor: snackbar.error ? DesignSystem.colors.error[500] : DesignSystem.colors.primary[500],
            borderRadius: 12,
            margin: 16,
          }}
        >
          {snackbar.message}
        </Snackbar>
    </Surface>
  );
} 