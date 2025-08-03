import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeMode } from '../hooks/useThemeMode';
import cameraService, { ReceiptData } from '../lib/camera/CameraService';

interface CameraComponentProps {
  onPhotoTaken: (receiptData: ReceiptData) => void;
  onClose: () => void;
}

export default function CameraComponent({ onPhotoTaken, onClose }: CameraComponentProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { paperTheme } = useThemeMode();
  const { colors } = paperTheme;

  const takePicture = async () => {
    try {
      setIsProcessing(true);
      
      // Simulate camera processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create a simulated receipt data
      const receiptData: ReceiptData = {
        id: Date.now().toString(),
        imageUri: 'simulated-receipt.jpg',
        amount: Math.random() * 100 + 10,
        merchant: 'Sample Store',
        date: new Date(),
        category: 'Food & Dining',
        items: ['Item 1', 'Item 2'],
        confidence: 0.85,
        createdAt: new Date()
      };
      
      onPhotoTaken(receiptData);
    } catch (error) {
      Alert.alert('Error', 'Failed to process receipt');
      console.error('Camera error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.cameraSimulation}>
        <View style={styles.cameraHeader}>
          <Button
            mode="contained"
            onPress={onClose}
            style={styles.closeButton}
            icon="close"
          >
            Close
          </Button>
        </View>

        <View style={styles.cameraContent}>
          <MaterialCommunityIcons 
            name="camera" 
            size={80} 
            color={colors.primary} 
            style={styles.cameraIcon}
          />
          <Text style={[styles.cameraText, { color: colors.onSurface }]}>
            Camera Simulation
          </Text>
          <Text style={[styles.cameraSubtext, { color: colors.onSurfaceVariant }]}>
            Point your camera at a receipt
          </Text>
        </View>

        <View style={styles.cameraFooter}>
          <Button
            mode="contained"
            onPress={takePicture}
            disabled={isProcessing}
            style={styles.captureButton}
            icon={isProcessing ? 'loading' : 'camera'}
          >
            {isProcessing ? 'Processing...' : 'Scan Receipt'}
          </Button>
        </View>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraSimulation: {
    flex: 1,
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 40,
  },
  closeButton: {
    alignSelf: 'flex-start',
  },
  cameraContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  cameraIcon: {
    marginBottom: 20,
  },
  cameraText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  cameraSubtext: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
  },
  cameraFooter: {
    padding: 20,
    alignItems: 'center',
  },
  captureButton: {
    paddingHorizontal: 30,
    paddingVertical: 10,
    minWidth: 200,
  },
}); 