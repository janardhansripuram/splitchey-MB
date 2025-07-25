import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { ActivityIndicator, Avatar, Card, Divider, Surface, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GroupButton from '../../components/ui/GroupButton';
import { acceptGroupInvitation, getGroupInvitationsForUser, getGroupsForUser } from '../../firebase/firestore';
import { useAuth } from '../../hooks/useAuth';

export default function GroupsScreen() {
  const { authUser, userProfile, loading } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [invites, setInvites] = useState<any[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fetchData = useCallback(async () => {
    if (!authUser) return;
    setIsLoading(true);
    try {
      const groupsList = await getGroupsForUser(authUser.uid);
      setGroups(groupsList);
    } catch (e) {
      // Handle error
    }
    setIsLoading(false);
  }, [authUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  useEffect(() => {
    if (!loading && authUser) {
      fetchData();
    }
  }, [authUser, loading, fetchData]);

  useEffect(() => {
    const fetchInvites = async () => {
      if (!userProfile?.email) return;
      setInvitesLoading(true);
      try {
        const invitesList = await getGroupInvitationsForUser(userProfile.email);
        setInvites(invitesList);
      } catch (e) {
        // Handle error
      }
      setInvitesLoading(false);
    };
    if (userProfile?.email) {
      fetchInvites();
    }
  }, [userProfile]);

  const handleAcceptInvite = async (invite: any) => {
    if (!userProfile) return;
    try {
      await acceptGroupInvitation(invite, userProfile);
      Alert.alert('Success', 'You have joined the group!');
      // Refresh invites and groups
      if (userProfile.email) {
        setInvitesLoading(true);
        const invitesList = await getGroupInvitationsForUser(userProfile.email);
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
        <GroupButton icon="plus" style={{ marginBottom: 20, alignSelf: 'flex-start' }} onPress={() => router.push('/groups-create')}>
          Create New Group
        </GroupButton>
        {/* Incoming Group Invitations */}
        <Card style={{ marginBottom: 24, backgroundColor: colors.elevation.level1, borderRadius: 16, elevation: 2 }}>
          <Card.Title title="Incoming Group Invitations" left={props => <Avatar.Icon {...props} icon="email" />} />
          <Divider />
          <Card.Content>
            {invitesLoading ? <ActivityIndicator /> : (
              invites.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 24 }}>
                  <Avatar.Icon icon="email-outline" size={48} style={{ marginBottom: 8, backgroundColor: colors.elevation.level2 }} />
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
                      <GroupButton onPress={() => handleAcceptInvite(invite)}>
                        Accept Invitation
                      </GroupButton>
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
              <Text style={{ color: colors.outline }}>No groups found.</Text>
            ) : (
              groups.map(group => (
                <Card key={group.id} style={{ width: '100%', marginBottom: 16, backgroundColor: colors.elevation.level1, borderRadius: 16, elevation: 2 }}>
                  <Card.Content>
                    <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 4 }}>{group.name}</Text>
                    <Text style={{ color: colors.outline, marginBottom: 4 }}>{group.memberIds?.length || 0} members</Text>
                    <GroupButton onPress={() => router.push(`/groups-detail?groupId=${group.id}`)} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                      View Details
                    </GroupButton>
                  </Card.Content>
                </Card>
              ))
            )
          )}
        </View>
      </ScrollView>
    </Surface>
  );
} 