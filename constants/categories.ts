import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface Category {
  label: string;
  value: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color?: string;
  description?: string;
}

export const EXPENSE_CATEGORIES: Category[] = [
  { 
    label: 'Food & Dining', 
    value: 'Food', 
    icon: 'food',
    description: 'Restaurants, cafes, and food delivery'
  },
  { 
    label: 'Transportation', 
    value: 'Transport', 
    icon: 'car',
    description: 'Fuel, public transport, and ride-sharing'
  },
  { 
    label: 'Shopping', 
    value: 'Shopping', 
    icon: 'shopping',
    description: 'Clothing, electronics, and retail purchases'
  },
  { 
    label: 'Groceries', 
    value: 'Groceries', 
    icon: 'cart',
    description: 'Supermarket and grocery store purchases'
  },
  { 
    label: 'Bills & Utilities', 
    value: 'Bills', 
    icon: 'receipt',
    description: 'Electricity, water, internet, and phone bills'
  },
  { 
    label: 'Entertainment', 
    value: 'Entertainment', 
    icon: 'movie',
    description: 'Movies, games, and leisure activities'
  },
  { 
    label: 'Healthcare', 
    value: 'Healthcare', 
    icon: 'medical-bag',
    description: 'Medical expenses and healthcare'
  },
  { 
    label: 'Education', 
    value: 'Education', 
    icon: 'school',
    description: 'Tuition, books, and educational materials'
  },
  { 
    label: 'Home & Garden', 
    value: 'Home', 
    icon: 'home',
    description: 'Furniture, decor, and home improvement'
  },
  { 
    label: 'Travel', 
    value: 'Travel', 
    icon: 'airplane',
    description: 'Flights, hotels, and travel expenses'
  },
  { 
    label: 'Insurance', 
    value: 'Insurance', 
    icon: 'shield-check',
    description: 'Health, car, and property insurance'
  },
  { 
    label: 'Investment', 
    value: 'Investment', 
    icon: 'chart-line',
    description: 'Stocks, bonds, and investment fees'
  },
  { 
    label: 'Gifts & Donations', 
    value: 'Gifts', 
    icon: 'gift',
    description: 'Gifts, charity, and donations'
  },
  { 
    label: 'Personal Care', 
    value: 'PersonalCare', 
    icon: 'hair-dryer',
    description: 'Haircuts, beauty, and personal care'
  },
  { 
    label: 'Pets', 
    value: 'Pets', 
    icon: 'paw',
    description: 'Pet food, vet visits, and pet care'
  },
  { 
    label: 'Other', 
    value: 'Other', 
    icon: 'dots-horizontal',
    description: 'Miscellaneous expenses'
  },
];

export const INCOME_CATEGORIES: Category[] = [
  { 
    label: 'Salary', 
    value: 'Salary', 
    icon: 'cash',
    description: 'Regular employment income'
  },
  { 
    label: 'Freelance', 
    value: 'Freelance', 
    icon: 'laptop',
    description: 'Freelance and contract work'
  },
  { 
    label: 'Business', 
    value: 'Business', 
    icon: 'briefcase',
    description: 'Business and entrepreneurial income'
  },
  { 
    label: 'Investment', 
    value: 'Investment', 
    icon: 'chart-line',
    description: 'Dividends, interest, and investment returns'
  },
  { 
    label: 'Rental', 
    value: 'Rental', 
    icon: 'home',
    description: 'Rental property income'
  },
  { 
    label: 'Gifts', 
    value: 'Gifts', 
    icon: 'gift',
    description: 'Gifts and inheritance'
  },
  { 
    label: 'Refunds', 
    value: 'Refunds', 
    icon: 'cash-refund',
    description: 'Returns and refunds'
  },
  { 
    label: 'Other', 
    value: 'Other', 
    icon: 'dots-horizontal',
    description: 'Other income sources'
  },
];

// Helper function to get category by value
export const getCategoryByValue = (value: string, type: 'expense' | 'income' = 'expense'): Category | undefined => {
  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  return categories.find(cat => cat.value === value);
};

// Helper function to get all categories for a type
export const getCategories = (type: 'expense' | 'income' = 'expense'): Category[] => {
  return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
};

// Helper function to get category icon
export const getCategoryIcon = (value: string, type: 'expense' | 'income' = 'expense'): keyof typeof MaterialCommunityIcons.glyphMap => {
  const category = getCategoryByValue(value, type);
  return category?.icon || 'dots-horizontal';
};

// Helper function to get category label
export const getCategoryLabel = (value: string, type: 'expense' | 'income' = 'expense'): string => {
  const category = getCategoryByValue(value, type);
  return category?.label || 'Other';
}; 