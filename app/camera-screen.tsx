import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text, Surface, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeMode } from '../hooks/useThemeMode';
import CameraComponent from '../components/CameraComponent';
import cameraService, { ReceiptData } from '../lib/camera/CameraService';

export default function CameraScreen() {
  const [showCamera, setShowCamera] = useState(false);
  const [receiptHistory, setReceiptHistory] = useState<ReceiptData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { paperTheme } = useThemeMode();
  const { colors } = paperTheme;

  React.useEffect(() => {
    loadReceiptHistory();
  }, []);

  const loadReceiptHistory = async () => {
    try {
      const history = await cameraService.getReceiptHistory();
      setReceiptHistory(history);
    } catch (error) {
      console.error('Failed to load receipt history:', error);
    }
  };

  const handlePhotoTaken = async (receiptData: ReceiptData) => {
    setShowCamera(false);
    
    Alert.alert(
      'Receipt Scanned!',
      `Amount: $${receiptData.amount?.toFixed(2)}\nMerchant: ${receiptData.merchant}\nCategory: ${receiptData.category}`,
      [
        {
          text: 'Add as Expense',
          onPress: () => {
            // Navigate to add expense with pre-filled data
            router.push({
              pathname: '/expenses-add',
              params: {
                amount: receiptData.amount?.toString() || '',
                description: receiptData.merchant || '',
                category: receiptData.category || '',
                fromCamera: 'true'
              }
            });
          }
        },
        {
          text: 'View History',
          onPress: () => {
            // Could navigate to a receipt history screen
            console.log('View receipt history');
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleClearHistory = async () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all receipt history?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await cameraService.clearReceiptHistory();
              setReceiptHistory([]);
              Alert.alert('Success', 'Receipt history cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear history');
            }
          }
        }
      ]
    );
  };

  if (showCamera) {
    return (
      <CameraComponent
        onPhotoTaken={handlePhotoTaken}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <Surface style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onBackground }]}>
          Receipt Scanner
        </Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
          Scan receipts to automatically extract expense data
        </Text>
      </View>

      <View style={styles.content}>
        <Card style={styles.scanCard}>
          <Card.Content>
            <MaterialCommunityIcons 
              name="camera" 
              size={48} 
              color={colors.primary} 
              style={styles.cameraIcon}
            />
            <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
              Scan Receipt
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.onSurfaceVariant }]}>
              Take a photo of your receipt to automatically extract expense details
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button
              mode="contained"
              onPress={() => setShowCamera(true)}
              style={styles.scanButton}
              icon="camera"
            >
              Start Scanning
            </Button>
          </Card.Actions>
        </Card>

        {receiptHistory.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <Text style={[styles.historyTitle, { color: colors.onSurface }]}>
                Recent Scans
              </Text>
              <Button
                mode="text"
                onPress={handleClearHistory}
                textColor={colors.error}
              >
                Clear
              </Button>
            </View>
            
            {receiptHistory.slice(0, 5).map((receipt) => (
              <Card key={receipt.id} style={styles.receiptCard}>
                <Card.Content>
                  <View style={styles.receiptInfo}>
                    <Text style={[styles.receiptAmount, { color: colors.onSurface }]}>
                      ${receipt.amount?.toFixed(2)}
                    </Text>
                    <Text style={[styles.receiptMerchant, { color: colors.onSurfaceVariant }]}>
                      {receipt.merchant}
                    </Text>
                    <Text style={[styles.receiptCategory, { color: colors.onSurfaceVariant }]}>
                      {receipt.category}
                    </Text>
                    <Text style={[styles.receiptDate, { color: colors.onSurfaceVariant }]}>
                      {receipt.date?.toLocaleDateString()}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scanCard: {
    marginBottom: 20,
  },
  cameraIcon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  scanButton: {
    flex: 1,
    marginTop: 8,
  },
  historySection: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  receiptCard: {
    marginBottom: 8,
  },
  receiptInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  receiptMerchant: {
    fontSize: 14,
    flex: 1,
    marginLeft: 12,
  },
  receiptCategory: {
    fontSize: 12,
    color: '#666',
  },
  receiptDate: {
    fontSize: 12,
    color: '#666',
  },
}); 