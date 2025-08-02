import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Avatar, Card, Divider, Surface, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernButton } from '../../components/ui/ModernButton';
import { acceptGroupInvitation, getGroupInvitationsForUser, getGroupsForUser } from '../../firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import CreateGroupBottomSheet from '../groups-create'; // Import the new bottom sheet component

export default function GroupsScreen() {
  const { authUser, userProfile, loading } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [invites, setInvites] = useState<any[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateGroupSheetOpen, setIsCreateGroupSheetOpen] = useState(false); // New state for bottom sheet
  console.log('GroupsScreen: isCreateGroupSheetOpen', isCreateGroupSheetOpen); // Debug log
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fetchData = useCallback(async () => {
    if (!authUser || !userProfile) return; // Ensure userProfile is also available
    setIsLoading(true);
    try {
      const groupsList = await getGroupsForUser(authUser.uid);
      setGroups(groupsList);
      console.log('GroupsScreen: fetchData - groupsList', groupsList); // Debug log
    } catch (e) {
      console.error("Error fetching groups:", e);
      // Handle error
    } finally {
      setIsLoading(false);
    }
  }, [authUser, userProfile]); // Add userProfile to dependencies

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    // Also refresh invites on pull-to-refresh
    if (userProfile?.email || userProfile?.phoneNumber) {
      setInvitesLoading(true);
      try {
        const invitesList = await getGroupInvitationsForUser(userProfile.email, userProfile.phoneNumber);
        setInvites(invitesList);
      } catch (e) {
        console.error("Error refreshing invites:", e);
      } finally {
        setInvitesLoading(false);
      }
    }
    setRefreshing(false);
  }, [fetchData, userProfile]); // Add userProfile to dependencies

  useEffect(() => {
    if (!loading && authUser && userProfile) { // Ensure userProfile is loaded
      fetchData();
    }
  }, [authUser, loading, userProfile, fetchData]); // Add userProfile to dependencies

  useEffect(() => {
    const fetchInvites = async () => {
      if (!userProfile?.email && !userProfile?.phoneNumber) {
        setInvites([]); // Clear invites if neither email nor phone is available
        setInvitesLoading(false);
        return;
      }
      setInvitesLoading(true);
      try {
        const invitesList = await getGroupInvitationsForUser(userProfile.email, userProfile.phoneNumber);
        setInvites(invitesList);
      } catch (e) {
        console.error("Error fetching invites:", e);
        // Handle error
      } finally {
        setInvitesLoading(false);
      }
    };
    // Only fetch invites if userProfile and either email or phone number are available
    if (userProfile && (userProfile.email || userProfile.phoneNumber)) {
      fetchInvites();
    } else if (!loading) {
      // If userProfile or neither email nor phone is available after loading, ensure loading state is false
      setInvitesLoading(false);
    }
  }, [userProfile, loading]); // Add loading to dependencies

  const handleAcceptInvite = async (invite: any) => {
    if (!userProfile) return;
    try {
      await acceptGroupInvitation(invite, userProfile);
      Alert.alert('Success', 'You have joined the group!');
      // Refresh invites and groups
      if (userProfile.email) {
        setInvitesLoading(true);
        const invitesList = await getGroupInvitationsForUser(userProfile.email, userProfile.phoneNumber);
        setInvites(invitesList);
        setInvitesLoading(false);
      }
      if (authUser) {
        setIsLoading(true);
        const groupsList = await getGroupsForUser(authUser.uid);
        setGroups(groupsList);
        setIsLoading(false);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to accept invitation.');
    }
  };

  return (
    <Surface style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Create New Group Button */}
        <ModernButton icon="plus" style={{ marginBottom: 20, alignSelf: 'flex-start' }} onPress={() => setIsCreateGroupSheetOpen(true)} title="Create New Group" />
        {/* Incoming Group Invitations */}
        <Card style={{ marginBottom: 24, backgroundColor: colors.elevation.level1, borderRadius: 16, elevation: 2 }}>
          <Card.Title title="Incoming Group Invitations" left={props => <Avatar.Icon {...props} icon="email" />} />
          <Divider />
          <Card.Content>
            {invitesLoading ? <ActivityIndicator /> : (
              invites.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 24 }}>
                  <Avatar.Icon icon="inbox-multiple-outline" size={48} style={{ marginBottom: 8, backgroundColor: colors.elevation.level2 }} color={colors.outline} />
                  <Text style={{ color: colors.outline, textAlign: 'center', fontWeight: 'bold', marginBottom: 4 }}>No incoming group invitations.</Text>
                  <Text style={{ color: colors.outline, textAlign: 'center' }}>When someone invites you to a group, it will appear here.</Text>
                </View>
              ) : (
                invites.map(invite => (
                  <Card key={invite.id} style={{ marginBottom: 12, backgroundColor: colors.elevation.level2 }}>
                    <Card.Content>
                      <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>{invite.groupName}</Text>
                      <Text>Invited by: {invite.inviterDisplayName}</Text>
                      <Text style={{ color: colors.outline, marginBottom: 8 }}>{new Date(invite.createdAt).toLocaleString()}</Text>
                      <ModernButton onPress={() => handleAcceptInvite(invite)} title="Accept Invitation" />
                    </Card.Content>
                  </Card>
                ))
              )
            )}
          </Card.Content>
        </Card>
        {/* Your Groups */}
        <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginBottom: 8 }}>Your Groups</Text>
        <Text style={{ color: colors.outline, marginBottom: 16 }}>List of groups you are a member of.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {isLoading ? <ActivityIndicator /> : (
            groups.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 24, width: '100%' }}>
                <Avatar.Icon icon="account-group-outline" size={48} style={{ marginBottom: 8, backgroundColor: colors.elevation.level2 }} color={colors.outline} />
                <Text style={{ color: colors.outline, textAlign: 'center', fontWeight: 'bold', marginBottom: 4 }}>No groups found.</Text>
                <Text style={{ color: colors.outline, textAlign: 'center', marginBottom: 16 }}>You haven't joined or created any groups yet.</Text>
                <ModernButton onPress={() => setIsCreateGroupSheetOpen(true)} title="Create Your First Group" />
              </View>
            ) : (
              groups.map(group => (
                <TouchableOpacity
                  key={group.id}
                  onPress={() => router.push(`/groups-detail?groupId=${group.id}`)}
                  style={{ width: '100%', marginBottom: 16 }}
                  activeOpacity={1}
                >
                  <Card
                    style={{ borderRadius: 16, elevation: 2, overflow: 'hidden' }}
                  >
                    {group.imageUrl && (
                      <Card.Cover source={{ uri: group.imageUrl }} style={{ height: 120 }} />
                    )}
                    <Card.Content style={{ padding: 16 }}>
                      <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 8 }}>{group.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                        {group.memberDetails && group.memberDetails.slice(0, 5).map((member: any) => ( // Display up to 5 members
                          <Avatar.Image
                            key={member.uid}
                            size={32}
                            source={{ uri: member.profilePictureUrl || `https://ui-avatars.com/api/?name=${member.displayName || member.email}&background=random&color=ffffff` }}
                            style={{ marginRight: -8, borderWidth: 1, borderColor: colors.background }}
                          />
                        ))}
                        {group.memberIds?.length > 5 && ( // Show +X more if count exceeds 5
                          <Text style={{ marginLeft: 12, color: colors.outline }}>
                            +{group.memberIds.length - 5} more
                          </Text>
                        )}
                      </View>
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              ))
            )
          )}
        </View>
      </ScrollView>
      {/* Add the CreateGroupBottomSheet component */}
      <CreateGroupBottomSheet
        isVisible={isCreateGroupSheetOpen}
        onClose={() => {
          console.log('CreateGroupBottomSheet: onClose called'); // Debug log
          setIsCreateGroupSheetOpen(false);
        }}
        onGroupCreated={() => {
          console.log('CreateGroupBottomSheet: onGroupCreated called'); // Debug log
          fetchData(); // Refresh groups
          if (userProfile?.email || userProfile?.phoneNumber) {
            // Also refresh invites
            setInvitesLoading(true);
            getGroupInvitationsForUser(userProfile.email, userProfile.phoneNumber)
              .then(setInvites)
              .finally(() => setInvitesLoading(false));
          }
        }}
      />
    </Surface>
  );
}