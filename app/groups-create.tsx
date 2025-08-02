import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import { Divider, Modal, Portal, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CreateGroupFormContent from '../components/CreateGroupFormContent';
import GroupMembersPickerModal from '../components/GroupMembersPickerModal';
import { ModernInput } from '../components/ui/ModernInput';
import { UserProfile } from '../constants/types'; // Import UserProfile type
import { createGroup, getFriends, uploadGroupImage } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';

interface CreateGroupModalProps {
  isVisible: boolean;
  onClose: () => void;
  onGroupCreated: () => void;
}

export default function CreateGroupModal({ isVisible, onClose, onGroupCreated }: CreateGroupModalProps) {
  console.log('CreateGroupModal: isVisible', isVisible); // Debug log
  const { authUser, userProfile } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<UserProfile[]>([]); // Change to UserProfile[]
  const [friends, setFriends] = useState<any[]>([]);
  const [membersModalVisible, setMembersModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groupImage, setGroupImage] = useState<string | null>(null);
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (authUser) {
      getFriends(authUser.uid).then(setFriends);
    }
  }, [authUser]);

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setGroupImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!groupName) {
      Alert.alert('Error', 'Please enter a group name.');
      return;
    }
    if (!authUser || !userProfile) {
      Alert.alert('Error', 'User not authenticated.');
      return;
    }

    setLoading(true);
    try {
      // Ensure creator is always part of the members list
      const allMembers = userProfile ? [...members, userProfile] : [...members];
      const uniqueMembers = Array.from(new Set(allMembers.map(m => m.uid)))
        .map(uid => allMembers.find(m => m.uid === uid)!); // Find the full profile for each unique UID

      let uploadedImageUrl = null;
      if (groupImage) {
        uploadedImageUrl = await uploadGroupImage(authUser.uid, groupImage);
      }
      await createGroup(authUser, groupName, uniqueMembers, uploadedImageUrl);
      Alert.alert('Success', 'Group created successfully!');
      onGroupCreated();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create group.');
    }
    setLoading(false);
  };

  return (
    <Portal>
      <Modal
        visible={isVisible}
        onDismiss={onClose}
        contentContainerStyle={{
          backgroundColor: colors.elevation.level2,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingBottom: insets.bottom,
          paddingTop: 12,
          minHeight: 540,
          maxHeight: '90%',
        }}
        style={{
          justifyContent: 'flex-end',
          margin: 0,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <View style={{
            width: 44, height: 5, borderRadius: 3, backgroundColor: colors.outlineVariant || '#ccc', marginTop: 8, marginBottom: 8,
          }} />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary, marginBottom: 12, textAlign: 'center' }}>
            Create Group
          </Text>
          <Divider style={{ marginBottom: 16 }} />
          <CreateGroupFormContent
            groupName={groupName}
            setGroupName={setGroupName}
            groupImage={groupImage}
            setGroupImage={setGroupImage}
            handlePickImage={handlePickImage}
            handleSubmit={handleSubmit}
            loading={loading}
            onCancel={onClose}
            onGroupCreated={onGroupCreated}
          >
            <TouchableOpacity onPress={() => setMembersModalVisible(true)} activeOpacity={1}>
              <ModernInput
                label="Members"
                value={members.length > 0 ? `${members.length} selected` : ''}
                onChangeText={() => {}} // Add a no-op onChangeText
                editable={false}
                style={{ marginBottom: 18 }}
                placeholder="Select group members"
                rightIcon={<MaterialCommunityIcons name="chevron-down" size={20} color={colors.onSurfaceVariant} />}
                onRightIconPress={() => setMembersModalVisible(true)}
              />
            </TouchableOpacity>
          </CreateGroupFormContent>
          <GroupMembersPickerModal
            isVisible={membersModalVisible}
            onClose={() => setMembersModalVisible(false)}
            friends={friends}
            selectedMembers={members.map(m => m.uid)} // Pass only UIDs
            onSelectMembers={(selectedUids: string[]) => {
              // Map selected UIDs back to UserProfile objects
              const selectedProfiles = friends.filter(f => selectedUids.includes(f.uid));
              setMembers(selectedProfiles);
            }}
          />
        </ScrollView>
      </Modal>
    </Portal>
  );
}