import React from 'react';
import { Button, Dialog, Text, useTheme } from 'react-native-paper';
import { SplitExpense, SplitParticipant } from '../constants/types';

interface ApprovalModalProps {
  visible: boolean;
  onDismiss: () => void;
  split: SplitExpense | null;
  participant: SplitParticipant | null;
  isProcessing: string | boolean | null;
  onApprove: (splitId: string, participantId: string) => void;
  onReject: (splitId: string, participantId: string) => void;
}

export default function ApprovalModal({
  visible,
  onDismiss,
  split,
  participant,
  isProcessing,
  onApprove,
  onReject
}: ApprovalModalProps) {
  const { colors } = useTheme();

  if (!split || !participant) return null;

  const processingId = `${split.id}-${participant.userId}`;

  return (
    <Dialog visible={visible} onDismiss={onDismiss} style={{ borderRadius: 20 }}>
      <Dialog.Title style={{ 
        fontWeight: 'bold', 
        fontSize: 22, 
        textAlign: 'center', 
        marginBottom: 8, 
        color: colors.primary 
      }}>
        Approve Manual Settlement?
      </Dialog.Title>
      <Dialog.Content style={{ paddingHorizontal: 24, paddingTop: 0 }}>
        <Text style={{ 
          color: colors.onSurfaceVariant, 
          fontSize: 16, 
          marginBottom: 20,
          textAlign: 'center',
          lineHeight: 22
        }}>
          {participant.displayName || 'A participant'} has claimed they paid you{' '}
          <Text style={{ fontWeight: 'bold', color: colors.primary, fontSize: 18 }}>
            {split.currency} {participant.amountOwed}
          </Text>
          {' '}outside the app. Do you approve this settlement?
        </Text>
      </Dialog.Content>
      <Dialog.Actions style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        paddingHorizontal: 24, 
        paddingBottom: 24 
      }}>
        <Button 
          mode="outlined" 
          onPress={() => {
            onReject(split.id!, participant.userId);
            onDismiss();
          }}
          disabled={!!isProcessing}
          loading={isProcessing === processingId}
          style={{ 
            borderRadius: 16,
            borderColor: colors.error,
            borderWidth: 2,
            flex: 1,
            marginRight: 8
          }}
          contentStyle={{ paddingVertical: 12 }}
          labelStyle={{ fontSize: 16, fontWeight: '600' }}
          textColor={colors.error}
        >
          {isProcessing === processingId ? 'Rejecting...' : 'Reject'}
        </Button>
        <Button 
          mode="contained" 
          onPress={() => {
            onApprove(split.id!, participant.userId);
            onDismiss();
          }}
          disabled={!!isProcessing}
          loading={isProcessing === processingId}
          style={{ 
            borderRadius: 16,
            backgroundColor: colors.primary,
            elevation: 2,
            flex: 1,
            marginLeft: 8
          }}
          contentStyle={{ paddingVertical: 12 }}
          labelStyle={{ fontSize: 16, fontWeight: '600' }}
        >
          {isProcessing === processingId ? 'Approving...' : 'Approve'}
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
} 