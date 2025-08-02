import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet, { useBottomSheetModal } from '@gorhom/bottom-sheet';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { EmailAuthProvider, deleteUser, reauthenticateWithCredential, signOut, updateEmail, updatePassword, updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { Bell, Lock, LogOut, Mail, Palette, Settings, Shield, Star, Trash2, User } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Linking, Platform, RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Avatar, Dialog, Divider, List, Modal, Portal, Snackbar, Surface, Switch, Text, useTheme } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernButton } from '../../components/ui/ModernButton';
import { ModernCard } from '../../components/ui/ModernCard';
import { ModernInput } from '../../components/ui/ModernInput';
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

  // Use BottomSheetModal with proper context
  const bottomSheetModalRef = useRef<BottomSheet>(null);
  const { present, dismiss } = useBottomSheetModal();
  const editProfileSheetRef = useRef<BottomSheet>(null);

  // Initialize BottomSheetModal
  useEffect(() => {
    if (bottomSheetModalRef.current) {
      present(bottomSheetModalRef.current);
    }
    return () => {
      dismiss();
    };
  }, [present, dismiss]);

  // Open/close helpers for edit profile bottom sheet
  const openEditProfile = () => {
    setEditProfileOpen(true);
    setTimeout(() => {
      editProfileSheetRef.current?.expand?.();
    }, 10);
  };
  const closeEditProfile = () => {
    setEditProfileOpen(false);
    editProfileSheetRef.current?.close?.();
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchUserProfile();
    setRefreshing(false);
  }, [refetchUserProfile]);

  // Profile photo upload with compression
  const handlePickAvatar = async () => {
    setAvatarLoading(true);
    try {
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
        const newUrl = await updateUserProfilePhoto(authUser.uid, uri);
        await refetchUserProfile();
        setSnackbar({ visible: true, message: 'Profile photo updated!', error: false });
      } else {
        setSnackbar({ visible: true, message: 'Image selection cancelled', error: true });
      }
    } catch (e: any) {
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
      closeEditProfile();
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
      if (!authUser?.uid) throw new Error('No authenticated user found');
      if (!userProfile) throw new Error('User profile not loaded');
      await cancelUserSubscription(authUser.uid);
      await refetchUserProfile();
      setSnackbar({ visible: true, message: 'Subscription canceled. You are now on the Free plan.', error: false });
      setManageSubscriptionOpen(false);
    } catch (e: any) {
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

  // Themed background for header
  const headerBg = dark
    ? { backgroundColor: colors.primary, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }
    : { backgroundColor: colors.primary, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 };

  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header Section */}
      <View style={{
        ...headerBg,
        paddingTop: insets.top + 20,
        paddingBottom: 80,
        paddingHorizontal: 20,
        shadowColor: colors.primary,
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 }}>Profile</Text>
          <TouchableOpacity onPress={openEditProfile} style={{
            backgroundColor: 'rgba(255,255,255,0.18)',
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
              backgroundColor: colors.primary,
              borderWidth: 4,
              borderColor: colors.background,
              shadowColor: colors.primary,
              shadowOpacity: 0.12,
              shadowRadius: 8,
              elevation: 4,
            }}
          />
          <TouchableOpacity 
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              backgroundColor: colors.background,
              borderRadius: 20,
              width: 40,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: colors.primary,
              shadowOpacity: 0.10,
              shadowRadius: 4,
              elevation: 2,
            }}
            onPress={handlePickAvatar}
            disabled={avatarLoading}
          >
            {avatarLoading ? (
              <ActivityIndicator size={20} color={colors.primary} />
            ) : (
              <MaterialCommunityIcons name="camera" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        </Animated.View>
        
        <Animated.View entering={FadeInUp.delay(400)} style={{ alignItems: 'center' }}>
          <Text style={{ 
            fontWeight: '700', 
            fontSize: 24, 
            color: colors.onBackground,
            marginBottom: 4,
          }}>
            {userProfile.displayName}
          </Text>
          <Text style={{ 
            color: colors.onSurfaceVariant, 
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
                ? colors.primaryContainer 
                : colors.surface,
              borderWidth: userProfile.subscription?.plan === 'premium' ? 2 : 0,
              borderColor: userProfile.subscription?.plan === 'premium' 
                ? colors.primary 
                : 'transparent',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                backgroundColor: colors.secondaryContainer,
                borderRadius: 12,
                padding: 8,
                marginRight: 12,
              }}>
                <Star size={24} color={colors.secondary} />
              </View>
              <Text style={{ 
                fontWeight: '700', 
                fontSize: 20, 
                color: colors.onSurface 
              }}>
                Subscription
              </Text>
            </View>
            
            <View style={{ marginBottom: 16 }}>
              <Text style={{ 
                color: colors.onSurfaceVariant, 
                fontSize: 14, 
                marginBottom: 4 
              }}>
                Your Plan
              </Text>
              <Text style={{ 
                fontWeight: '700', 
                fontSize: 18, 
                color: colors.onSurface,
                marginBottom: 4,
              }}>
                {userProfile.subscription?.planId?.replace('_', ' ') || 'Free'}
              </Text>
              {userProfile.subscription?.planId !== 'free' && userProfile.subscription?.currentPeriodEnd && (
                <Text style={{ 
                  color: colors.onSurfaceVariant, 
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
                backgroundColor: colors.background,
                padding: 16,
                borderRadius: 12,
                marginTop: 16,
              }}>
                <Text style={{ 
                  fontWeight: '600', 
                  fontSize: 14, 
                  color: colors.onSurface,
                  marginBottom: 8,
                }}>
                  Upgrade to unlock:
                </Text>
                <Text style={{ 
                  color: colors.onSurfaceVariant, 
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
                backgroundColor: colors.primaryContainer,
                borderRadius: 12,
                padding: 8,
                marginRight: 12,
              }}>
                <User size={24} color={colors.primary} />
              </View>
              <Text style={{ 
                fontWeight: '700', 
                fontSize: 20, 
                color: colors.onSurface 
              }}>
                Account Details
              </Text>
            </View>
            
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>Display Name</Text>
                <Text style={{ fontWeight: '600', fontSize: 15, color: colors.onSurface }}>
                  {userProfile.displayName}
                </Text>
              </View>
              <Divider style={{ backgroundColor: colors.outlineVariant }} />
            </View>
            
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>Default Currency</Text>
                <Text style={{ fontWeight: '600', fontSize: 15, color: colors.onSurface }}>
                  {userProfile.defaultCurrency}
                </Text>
              </View>
              <Divider style={{ backgroundColor: colors.outlineVariant }} />
            </View>
            
            <ModernButton
              title="Edit Details"
              onPress={() => setEditProfileOpen(true)}
              variant="outline"
              fullWidth
              icon={<Settings size={18} color={colors.primary} />}
            />
          </ModernCard>
        </Animated.View>

        {/* Appearance Card */}
        <Animated.View entering={FadeInDown.delay(400)}>
          <ModernCard style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                backgroundColor: colors.secondaryContainer,
                borderRadius: 12,
                padding: 8,
                marginRight: 12,
              }}>
                <Palette size={24} color={colors.secondary} />
              </View>
              <Text style={{ 
                fontWeight: '700', 
                fontSize: 20, 
                color: colors.onSurface 
              }}>
                Appearance
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 15 }}>Dark Mode</Text>
              <Switch 
                value={theme === 'dark'} 
                onValueChange={handleThemeToggle}
                trackColor={{ 
                  false: colors.outlineVariant, 
                  true: colors.primary 
                }}
                thumbColor={theme === 'dark' ? colors.primary : '#fff'}
              />
            </View>
            
            <Text style={{ 
              color: colors.onSurfaceVariant, 
              fontSize: 13, 
              marginBottom: 16 
            }}>
              Current: {theme.charAt(0).toUpperCase() + theme.slice(1)}
            </Text>
            
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-around', 
              backgroundColor: colors.background,
              borderRadius: 16,
              padding: 8,
            }}>
              <TouchableOpacity
                style={{
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 12,
                  minWidth: 80,
                  backgroundColor: theme === 'system' ? colors.primaryContainer : 'transparent',
                }}
                onPress={() => handleThemeModeChange('system')}
              >
                <MaterialCommunityIcons
                  name="theme-light-dark"
                  size={24}
                  color={theme === 'system' ? colors.primary : colors.onSurfaceVariant}
                />
                <Text style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: theme === 'system' ? '600' : '500',
                  color: theme === 'system' ? colors.primary : colors.onSurfaceVariant,
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
                  backgroundColor: theme === 'light' ? colors.primaryContainer : 'transparent',
                }}
                onPress={() => handleThemeModeChange('light')}
              >
                <MaterialCommunityIcons
                  name="white-balance-sunny"
                  size={24}
                  color={theme === 'light' ? colors.primary : colors.onSurfaceVariant}
                />
                <Text style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: theme === 'light' ? '600' : '500',
                  color: theme === 'light' ? colors.primary : colors.onSurfaceVariant,
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
                  backgroundColor: theme === 'dark' ? colors.primaryContainer : 'transparent',
                }}
                onPress={() => handleThemeModeChange('dark')}
              >
                <MaterialCommunityIcons
                  name="weather-night"
                  size={24}
                  color={theme === 'dark' ? colors.primary : colors.onSurfaceVariant}
                />
                <Text style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: theme === 'dark' ? '600' : '500',
                  color: theme === 'dark' ? colors.primary : colors.onSurfaceVariant,
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
                backgroundColor: colors.secondaryContainer,
                borderRadius: 12,
                padding: 8,
                marginRight: 12,
              }}>
                <Bell size={24} color={colors.secondary} />
              </View>
              <Text style={{ 
                fontWeight: '700', 
                fontSize: 20, 
                color: colors.onSurface 
              }}>
                Notifications
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 15 }}>Push Notifications</Text>
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
              color: colors.onSurfaceVariant, 
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
                backgroundColor: colors.errorContainer,
                borderRadius: 12,
                padding: 8,
                marginRight: 12,
              }}>
                <Shield size={24} color={colors.error} />
              </View>
              <Text style={{ 
                fontWeight: '700', 
                fontSize: 20, 
                color: colors.onSurface 
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
              icon={<Lock size={18} color={colors.primary} />}
            />
            
            <ModernButton
              title="Change Email"
              onPress={() => setChangeEmailOpen(true)}
              variant="outline"
              fullWidth
              style={{ marginBottom: 16 }}
              icon={<Mail size={18} color={colors.primary} />}
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
              icon={<LogOut size={18} color={colors.primary} />}
            />
          </ModernCard>
        </Animated.View>
        
        {/* App Info & Support Card */}
        <Animated.View entering={FadeInDown.delay(700)}>
          <ModernCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                backgroundColor: colors.background,
                borderRadius: 12,
                padding: 8,
                marginRight: 12,
              }}>
                <MaterialCommunityIcons name="information" size={24} color={colors.onSurfaceVariant} />
              </View>
              <Text style={{ 
                fontWeight: '700', 
                fontSize: 20, 
                color: colors.onSurface 
              }}>
                App Info & Support
              </Text>
            </View>
            
            <View style={{ marginBottom: 16 }}>
              <Text style={{ 
                color: colors.onSurfaceVariant, 
                fontSize: 14 
              }}>
                Version: <Text style={{ 
                  fontWeight: '600', 
                  color: colors.onSurface 
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
      
      {/* --- Edit Profile Bottom Sheet --- */}
      <Portal>
        <BottomSheet
          ref={editProfileSheetRef}
          index={editProfileOpen ? 0 : -1}
          snapPoints={['48%']}
          enablePanDownToClose
          onClose={closeEditProfile}
          backgroundStyle={{
            backgroundColor: dark ? colors.elevation.level2 : colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
          handleIndicatorStyle={{
            backgroundColor: colors.outlineVariant,
            width: 60,
            height: 5,
            borderRadius: 3,
            marginTop: 8,
            marginBottom: 12,
            alignSelf: 'center',
          }}
          style={{ zIndex: 100 }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text
                style={{
                  fontWeight: 'bold',
                  fontSize: 22,
                  color: colors.primary,
                  textAlign: 'center',
                  marginBottom: 18,
                }}
              >
                Edit Profile
              </Text>
              <ModernInput
                label="Display Name"
                value={displayName}
                onChangeText={setDisplayName}
                style={{
                  marginBottom: 18,
                  backgroundColor: dark ? colors.elevation.level1 : colors.background,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.outline,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 17,
                }}
                inputStyle={{
                  fontSize: 17,
                  color: colors.onBackground,
                }}
                autoFocus
                placeholder="Enter your name"
                placeholderTextColor={colors.onSurfaceVariant}
                returnKeyType="done"
                blurOnSubmit
              />

              <Text
                style={{
                  marginBottom: 8,
                  fontSize: 15,
                  fontWeight: '600',
                  color: colors.onSurfaceVariant,
                }}
              >
                Default Currency
              </Text>
              <TouchableOpacity
                onPress={() => setCurrencyModal(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.outline,
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 8,
                  backgroundColor: dark ? colors.elevation.level1 : colors.background,
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: colors.onBackground, fontSize: 16, fontWeight: '500' }}>
                  {SUPPORTED_CURRENCIES.find(c => c.code === currency)?.code} - {SUPPORTED_CURRENCIES.find(c => c.code === currency)?.name}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.onSurfaceVariant} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
              <Portal>
                <Modal
                  visible={currencyModal}
                  onDismiss={() => setCurrencyModal(false)}
                  contentContainerStyle={{
                    backgroundColor: dark ? colors.elevation.level2 : colors.background,
                    margin: 24,
                    borderRadius: 16,
                    padding: 0,
                  }}
                >
                  <List.Section>
                    {SUPPORTED_CURRENCIES.map(c => (
                      <List.Item
                        key={c.code}
                        title={`${c.code} - ${c.name}`}
                        onPress={() => {
                          setCurrency(c.code);
                          setCurrencyModal(false);
                        }}
                        left={props => (
                          <List.Icon
                            {...props}
                            icon={currency === c.code ? 'check-circle' : 'circle-outline'}
                            color={currency === c.code ? colors.primary : colors.onSurfaceVariant}
                          />
                        )}
                        titleStyle={{
                          color: colors.onBackground,
                          fontWeight: currency === c.code ? 'bold' : 'normal',
                          fontSize: 16,
                        }}
                        style={{
                          backgroundColor: currency === c.code
                            ? (dark ? colors.primaryContainer : colors.primary + '22')
                            : 'transparent',
                          borderRadius: 8,
                          marginHorizontal: 8,
                          marginVertical: 2,
                        }}
                      />
                    ))}
                  </List.Section>
                </Modal>
              </Portal>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 }}>
                <ModernButton
                  title="Cancel"
                  onPress={closeEditProfile}
                  variant="ghost"
                  style={{
                    borderRadius: 10,
                    minWidth: 100,
                  }}
                  textStyle={{
                    fontWeight: 'bold',
                    color: colors.onSurfaceVariant,
                  }}
                />
                <ModernButton
                  title="Save"
                  onPress={handleSaveProfile}
                  loading={editLoading}
                  variant="primary"
                  style={{
                    borderRadius: 10,
                    minWidth: 100,
                  }}
                  textStyle={{
                    fontWeight: 'bold',
                  }}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </BottomSheet>
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
          backgroundColor: snackbar.error ? colors.error : colors.primary,
          borderRadius: 12,
          margin: 16,
        }}
      >
        {snackbar.message}
      </Snackbar>
    </Surface>
  );
}