import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  timestamp: number;
}

export interface LocationSettings {
  enabled: boolean;
  autoTagExpenses: boolean;
  saveLocationHistory: boolean;
  accuracy: 'low' | 'balanced' | 'high';
  backgroundLocation: boolean;
}

export interface LocationHistory {
  id: string;
  location: LocationData;
  expenseId?: string;
  category?: string;
  timestamp: number;
}

class LocationService {
  private static instance: LocationService;
  private isInitialized = false;
  private locationSubscription?: Location.LocationSubscription;

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return false;
      }

      // Request background location permissions if needed
      const settings = await this.getSettings();
      if (settings.backgroundLocation) {
        const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus.status !== 'granted') {
          console.log('Background location permission denied');
        }
      }

      this.isInitialized = true;
      console.log('Location service initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize location service:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: await this.getAccuracyLevel(),
        timeInterval: 5000,
        distanceInterval: 10,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };

      // Get address from coordinates
      const address = await this.reverseGeocode(locationData);
      if (address) {
        locationData.address = address;
      }

      return locationData;
    } catch (error) {
      console.error('Failed to get current location:', error);
      return null;
    }
  }

  private async getAccuracyLevel(): Promise<Location.Accuracy> {
    const settings = await this.getSettings();
    switch (settings.accuracy) {
      case 'low':
        return Location.Accuracy.Low;
      case 'high':
        return Location.Accuracy.High;
      default:
        return Location.Accuracy.Balanced;
    }
  }

  async reverseGeocode(location: LocationData): Promise<string | null> {
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: location.latitude,
        longitude: location.longitude,
      });

      if (results.length > 0) {
        const result = results[0];
        const addressParts = [
          result.street,
          result.city,
          result.region,
          result.country,
        ].filter(Boolean);

        return addressParts.join(', ');
      }

      return null;
    } catch (error) {
      console.error('Failed to reverse geocode:', error);
      return null;
    }
  }

  async startLocationTracking(): Promise<void> {
    try {
      const settings = await this.getSettings();
      if (!settings.enabled) return;

      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: await this.getAccuracyLevel(),
          timeInterval: 30000, // 30 seconds
          distanceInterval: 100, // 100 meters
        },
        (location) => {
          this.handleLocationUpdate(location);
        }
      );

      console.log('Location tracking started');
    } catch (error) {
      console.error('Failed to start location tracking:', error);
    }
  }

  async stopLocationTracking(): Promise<void> {
    try {
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = undefined;
        console.log('Location tracking stopped');
      }
    } catch (error) {
      console.error('Failed to stop location tracking:', error);
    }
  }

  private async handleLocationUpdate(location: Location.LocationObject): Promise<void> {
    try {
      const settings = await this.getSettings();
      if (!settings.saveLocationHistory) return;

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };

      // Get address
      const address = await this.reverseGeocode(locationData);
      if (address) {
        locationData.address = address;
      }

      // Save to history
      await this.saveLocationHistory(locationData);
    } catch (error) {
      console.error('Failed to handle location update:', error);
    }
  }

  async autoTagExpenseWithLocation(expenseId: string, category?: string): Promise<LocationData | null> {
    try {
      const settings = await this.getSettings();
      if (!settings.autoTagExpenses) return null;

      const location = await this.getCurrentLocation();
      if (!location) return null;

      // Save location with expense
      await this.saveLocationHistory(location, expenseId, category);

      return location;
    } catch (error) {
      console.error('Failed to auto-tag expense with location:', error);
      return null;
    }
  }

  async saveLocationHistory(
    location: LocationData,
    expenseId?: string,
    category?: string
  ): Promise<void> {
    try {
      const history = await this.getLocationHistory();
      const locationHistory: LocationHistory = {
        id: `location_${Date.now()}`,
        location,
        expenseId,
        category,
        timestamp: Date.now(),
      };

      history.push(locationHistory);
      
      // Keep only last 1000 locations
      if (history.length > 1000) {
        history.splice(0, history.length - 1000);
      }

      await AsyncStorage.setItem('location_history', JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save location history:', error);
    }
  }

  async getLocationHistory(): Promise<LocationHistory[]> {
    try {
      const history = await AsyncStorage.getItem('location_history');
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Failed to get location history:', error);
      return [];
    }
  }

  async getSettings(): Promise<LocationSettings> {
    try {
      const settings = await AsyncStorage.getItem('location_settings');
      if (settings) {
        return JSON.parse(settings);
      }
    } catch (error) {
      console.error('Failed to get location settings:', error);
    }

    // Default settings
    return {
      enabled: false,
      autoTagExpenses: true,
      saveLocationHistory: true,
      accuracy: 'balanced',
      backgroundLocation: false,
    };
  }

  async updateSettings(settings: Partial<LocationSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem('location_settings', JSON.stringify(updatedSettings));

      // Restart location tracking if settings changed
      if (settings.enabled !== undefined) {
        if (settings.enabled) {
          await this.startLocationTracking();
        } else {
          await this.stopLocationTracking();
        }
      }
    } catch (error) {
      console.error('Failed to update location settings:', error);
    }
  }

  async clearLocationHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem('location_history');
    } catch (error) {
      console.error('Failed to clear location history:', error);
    }
  }

  async getNearbyPlaces(location: LocationData, radius: number = 1000): Promise<any[]> {
    try {
      // This would integrate with a places API (Google Places, Foursquare, etc.)
      // For now, return mock data
      return [
        {
          name: 'Starbucks',
          category: 'Food & Dining',
          distance: 150,
        },
        {
          name: 'Walmart',
          category: 'Shopping',
          distance: 500,
        },
        {
          name: 'Gas Station',
          category: 'Transportation',
          distance: 800,
        },
      ];
    } catch (error) {
      console.error('Failed to get nearby places:', error);
      return [];
    }
  }

  async suggestCategoryFromLocation(location: LocationData): Promise<string | null> {
    try {
      const nearbyPlaces = await this.getNearbyPlaces(location);
      if (nearbyPlaces.length > 0) {
        // Return the category of the closest place
        return nearbyPlaces[0].category;
      }
      return null;
    } catch (error) {
      console.error('Failed to suggest category from location:', error);
      return null;
    }
  }
}

export const locationService = LocationService.getInstance();
export default locationService; 