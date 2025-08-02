import { Search, X, Check, Globe } from 'lucide-react-native';
import React, { useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View, Dimensions } from 'react-native';
import { Modal, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';

interface Currency {
  code: string;
  name: string;
}

interface CurrencySelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (currencyCode: string) => void;
  selectedCurrency: string;
  currencies: Currency[];
}

export const CurrencySelectionModal: React.FC<CurrencySelectionModalProps> = ({
  visible,
  onClose,
  onSelect,
  selectedCurrency,
  currencies,
}) => {
  const [searchText, setSearchText] = useState('');
  const { colors } = useTheme();
  const { width } = Dimensions.get('window');

  // Fallback currencies if none provided
  const availableCurrencies = currencies && currencies.length > 0 ? currencies : [
    { code: "USD", name: "US Dollar" },
    { code: "EUR", name: "Euro" },
    { code: "GBP", name: "British Pound" },
    { code: "JPY", name: "Japanese Yen" },
    { code: "CAD", name: "Canadian Dollar" },
    { code: "AUD", name: "Australian Dollar" },
    { code: "INR", name: "Indian Rupee" },
    { code: "MYR", name: "Malaysian Ringgit" },
  ];

  const filteredCurrencies = availableCurrencies.filter(currency =>
    currency.name.toLowerCase().includes(searchText.toLowerCase()) ||
    currency.code.toLowerCase().includes(searchText.toLowerCase())
  );

  const getCurrencySymbol = (code: string) => {
    const currencyMap: { [key: string]: string } = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      CAD: 'CA$',
      AUD: 'A$',
      INR: '₹',
      MYR: 'RM',
    };
    return currencyMap[code] || code;
  };

  const renderCurrencyItem = ({ item }: { item: Currency }) => {
    const isSelected = item.code === selectedCurrency;
    
    return (
      <TouchableOpacity
        style={[
          styles.currencyItem,
          isSelected && styles.selectedCurrencyItem
        ]}
        onPress={() => {
          onSelect(item.code);
          onClose();
        }}
        activeOpacity={0.7}
      >
        <View style={styles.currencyLeft}>
          <LinearGradient
            colors={isSelected ? [colors.primary, colors.primaryContainer] : [colors.surfaceVariant, colors.surface]}
            style={styles.currencySymbol}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={[
              styles.currencySymbolText,
              isSelected && styles.selectedCurrencySymbolText
            ]}>
              {getCurrencySymbol(item.code)}
            </Text>
          </LinearGradient>
          <View style={styles.currencyInfo}>
            <Text style={[
              styles.currencyName,
              isSelected && styles.selectedCurrencyName
            ]}>
              {item.name}
            </Text>
            <Text style={styles.currencyCode}>
              {item.code}
            </Text>
          </View>
        </View>
        {isSelected && (
          <LinearGradient
            colors={[colors.primary, colors.primaryContainer]}
            style={styles.selectedIndicator}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Check size={16} color={colors.onPrimary} />
          </LinearGradient>
        )}
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    modalContent: {
      backgroundColor: colors.surface,
      margin: 16,
      borderRadius: 28,
      maxHeight: '95%',
      minHeight: 500,
      padding: 0,
      overflow: 'hidden',
      elevation: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      width: width - 32,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 28,
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
      backgroundColor: colors.surface,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.onSurface,
      letterSpacing: -0.5,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceVariant,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    searchContainer: {
      paddingHorizontal: 28,
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
      backgroundColor: colors.surface,
    },
    searchInput: {
      backgroundColor: colors.surfaceVariant,
      borderRadius: 20,
      fontSize: 16,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    currencyList: {
      flex: 1,
      minHeight: 300,
    },
    listHeader: {
      paddingHorizontal: 28,
      paddingVertical: 20,
      backgroundColor: colors.surfaceVariant,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.onSurface,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      marginLeft: 8,
    },
    currencyItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 20,
      paddingHorizontal: 28,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.outlineVariant,
      backgroundColor: colors.surface,
    },
    currencyLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    currencySymbol: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 20,
      elevation: 4,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    currencySymbolText: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.primary,
    },
    selectedCurrencySymbolText: {
      color: colors.onPrimary,
    },
    currencyInfo: {
      flex: 1,
    },
    currencyName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.onSurface,
      marginBottom: 4,
    },
    currencyCode: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      fontWeight: '600',
    },
    selectedIndicator: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    selectedCurrencyItem: {
      backgroundColor: colors.primaryContainer,
      borderLeftWidth: 6,
      borderLeftColor: colors.primary,
      elevation: 2,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    selectedCurrencyName: {
      color: colors.primary,
      fontWeight: '800',
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    emptyText: {
      fontSize: 16,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      fontWeight: '600',
    },
  });

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={styles.modalContent}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Select Currency</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            mode="outlined"
            placeholder="Search currencies..."
            value={searchText}
            onChangeText={setSearchText}
            style={styles.searchInput}
            contentStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
            left={<TextInput.Icon icon={() => <Search size={22} color={colors.onSurfaceVariant} />} />}
            outlineStyle={{ borderRadius: 20, borderWidth: 2 }}
            outlineColor={colors.outline}
            activeOutlineColor={colors.primary}
          />
        </View>

        <FlatList
          data={filteredCurrencies}
          keyExtractor={(item) => item.code}
          style={styles.currencyList}
          renderItem={renderCurrencyItem}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Globe size={20} color={colors.primary} />
              <Text style={styles.headerTitle}>Available Currencies</Text>
              <Text style={styles.headerSubtitle}>
                ({filteredCurrencies.length})
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No currencies found matching "{searchText}"
              </Text>
            </View>
          }
        />
      </Modal>
    </Portal>
  );
};