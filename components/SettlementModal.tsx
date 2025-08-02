import React from 'react';
import { View } from 'react-native';
import { Button, Dialog, Text, useTheme } from 'react-native-paper';
import { SplitExpense, SplitParticipant } from '../constants/types';

interface SettlementModalProps {
  visible: boolean;
  onDismiss: () => void;
  split: SplitExpense | null;
  participant: SplitParticipant | null;
  isProcessing: boolean;
  onSettleWithWallet: (splitId: string) => void;
  onRequestManualSettlement: (splitId: string) => void;
}

export default function SettlementModal({
  visible,
  onDismiss,
  split,
  participant,
  isProcessing,
  onSettleWithWallet,
  onRequestManualSettlement
}: SettlementModalProps) {
  const { colors } = useTheme();

  if (!split || !participant) return null;

  const payerName = split.participants.find(p => p.userId === split.paidBy)?.displayName || 'the payer';

  return (
    <Dialog visible={visible} onDismiss={onDismiss} style={{ borderRadius: 20 }}>
      <Dialog.Title style={{ 
        fontWeight: 'bold', 
        fontSize: 22, 
        textAlign: 'center', 
        marginBottom: 8, 
        color: colors.primary 
      }}>
        Settle Your Debt
      </Dialog.Title>
      <Dialog.Content style={{ paddingHorizontal: 24, paddingTop: 0 }}>
        <Text style={{ 
          color: colors.onSurfaceVariant, 
          fontSize: 16, 
          marginBottom: 20,
          textAlign: 'center',
          lineHeight: 22
        }}>
          Choose how you want to settle your debt of{' '}
          <Text style={{ fontWeight: 'bold', color: colors.primary, fontSize: 18 }}>
            {split.currency} {participant.amountOwed}
          </Text>
          {' '}with{' '}
          <Text style={{ fontWeight: '600', color: colors.onSurface }}>
            {payerName}
          </Text>
        </Text>
        
        <View style={{ gap: 16 }}>
          <Button 
            mode="contained" 
            onPress={() => {
              onSettleWithWallet(split.id!);
              onDismiss();
            }}
            disabled={isProcessing}
            style={{ 
              borderRadius: 16, 
              backgroundColor: colors.primary,
              elevation: 2
            }}
            contentStyle={{ paddingVertical: 12 }}
            labelStyle={{ fontSize: 16, fontWeight: '600' }}
            icon="wallet"
          >
            {isProcessing ? 'Processing...' : 'Pay with Wallet'}
          </Button>
          
          <Button 
            mode="outlined" 
            onPress={() => {
              onRequestManualSettlement(split.id!);
              onDismiss();
            }}
            disabled={isProcessing}
            loading={isProcessing}
            style={{ 
              borderRadius: 16, 
              borderColor: colors.outline,
              borderWidth: 2,
              elevation: 1
            }}
            contentStyle={{ paddingVertical: 12 }}
            labelStyle={{ fontSize: 16, fontWeight: '600' }}
            icon="handshake"
          >
            {isProcessing ? 'Processing...' : 'I Paid Manually'}
          </Button>
          
          <View style={{ 
            backgroundColor: colors.elevation.level1, 
            borderRadius: 12, 
            padding: 16,
            marginTop: 8
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ 
                backgroundColor: colors.primary + '20', 
                borderRadius: 8, 
                padding: 6, 
                marginRight: 10 
              }}>
                <Text style={{ color: colors.primary, fontSize: 16 }}>💡</Text>
              </View>
              <Text style={{ 
                fontWeight: '600', 
                fontSize: 14, 
                color: colors.onSurface 
              }}>
                What's the difference?
              </Text>
            </View>
            <Text style={{ 
              color: colors.onSurfaceVariant, 
              fontSize: 13, 
              lineHeight: 18 
            }}>
              <Text style={{ fontWeight: '600' }}>Pay with Wallet:</Text> Instant settlement using your wallet funds.{'\n'}
              <Text style={{ fontWeight: '600' }}>I Paid Manually:</Text> Notify the payer to confirm they received your payment outside the app.
            </Text>
          </View>
        </View>
      </Dialog.Content>
      <Dialog.Actions style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Button 
          mode="text" 
          onPress={onDismiss}
          style={{ borderRadius: 12 }}
          labelStyle={{ fontSize: 16, fontWeight: '600' }}
        >
          Cancel
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
} 