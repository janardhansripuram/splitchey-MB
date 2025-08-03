import { Share } from 'react-native';
import { format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ShareData {
  title: string;
  message: string;
  url?: string;
  imageUrl?: string;
}

export interface ExpenseShareData {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  notes?: string;
  location?: string;
  receiptUrl?: string;
}

export interface ShareSettings {
  includeReceipt: boolean;
  includeLocation: boolean;
  includeNotes: boolean;
  shareFormat: 'simple' | 'detailed' | 'receipt';
  defaultMessage: string;
}

class ShareService {
  private static instance: ShareService;

  static getInstance(): ShareService {
    if (!ShareService.instance) {
      ShareService.instance = new ShareService();
    }
    return ShareService.instance;
  }

  async shareExpense(expense: ExpenseShareData): Promise<boolean> {
    try {
      const settings = await this.getSettings();
      const shareData = this.formatExpenseForSharing(expense, settings);
      
      const result = await Share.share({
        title: shareData.title,
        message: shareData.message,
        url: shareData.url,
      });

      return result.action !== Share.dismissedAction;
    } catch (error) {
      console.error('Failed to share expense:', error);
      return false;
    }
  }

  async shareExpenseList(expenses: ExpenseShareData[]): Promise<boolean> {
    try {
      const settings = await this.getSettings();
      const shareData = this.formatExpenseListForSharing(expenses, settings);
      
      const result = await Share.share({
        title: shareData.title,
        message: shareData.message,
        url: shareData.url,
      });

      return result.action !== Share.dismissedAction;
    } catch (error) {
      console.error('Failed to share expense list:', error);
      return false;
    }
  }

  async shareBudgetReport(budgetData: any): Promise<boolean> {
    try {
      const shareData = this.formatBudgetReportForSharing(budgetData);
      
      const result = await Share.share({
        title: shareData.title,
        message: shareData.message,
        url: shareData.url,
      });

      return result.action !== Share.dismissedAction;
    } catch (error) {
      console.error('Failed to share budget report:', error);
      return false;
    }
  }

  private formatExpenseForSharing(expense: ExpenseShareData, settings: ShareSettings): ShareData {
    const formattedDate = format(new Date(expense.date), 'MMM dd, yyyy');
    const formattedAmount = `${expense.currency} ${expense.amount.toFixed(2)}`;

    let message = '';

    switch (settings.shareFormat) {
      case 'simple':
        message = `${expense.description}\n${formattedAmount}\n${formattedDate}`;
        break;
      
      case 'detailed':
        message = `💰 Expense: ${expense.description}\n`;
        message += `💵 Amount: ${formattedAmount}\n`;
        message += `📂 Category: ${expense.category}\n`;
        message += `📅 Date: ${formattedDate}`;
        
        if (settings.includeNotes && expense.notes) {
          message += `\n📝 Notes: ${expense.notes}`;
        }
        
        if (settings.includeLocation && expense.location) {
          message += `\n📍 Location: ${expense.location}`;
        }
        break;
      
      case 'receipt':
        message = `🧾 Receipt: ${expense.description}\n`;
        message += `💵 Total: ${formattedAmount}\n`;
        message += `📅 Date: ${formattedDate}`;
        
        if (expense.receiptUrl) {
          message += `\n📷 Receipt: ${expense.receiptUrl}`;
        }
        break;
    }

    return {
      title: 'ExpenseFlow - Expense Details',
      message,
      url: settings.shareFormat === 'receipt' && expense.receiptUrl ? expense.receiptUrl : undefined,
    };
  }

  private formatExpenseListForSharing(expenses: ExpenseShareData[], settings: ShareSettings): ShareData {
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const currency = expenses[0]?.currency || 'USD';
    const formattedTotal = `${currency} ${totalAmount.toFixed(2)}`;

    let message = `📊 Expense Summary\n\n`;
    message += `💰 Total: ${formattedTotal}\n`;
    message += `📅 Period: ${format(new Date(expenses[0]?.date || Date.now()), 'MMM dd')} - ${format(new Date(expenses[expenses.length - 1]?.date || Date.now()), 'MMM dd, yyyy')}\n`;
    message += `📝 Count: ${expenses.length} expenses\n\n`;

    // Group by category
    const categoryTotals: { [key: string]: number } = {};
    expenses.forEach(expense => {
      categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
    });

    message += `📂 Breakdown:\n`;
    Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, amount]) => {
        const percentage = ((amount / totalAmount) * 100).toFixed(1);
        message += `• ${category}: ${currency} ${amount.toFixed(2)} (${percentage}%)\n`;
      });

    if (settings.shareFormat === 'detailed') {
      message += `\n📋 Details:\n`;
      expenses.forEach(expense => {
        const formattedDate = format(new Date(expense.date), 'MMM dd');
        message += `• ${formattedDate}: ${expense.description} - ${currency} ${expense.amount.toFixed(2)}\n`;
      });
    }

    return {
      title: 'ExpenseFlow - Expense Summary',
      message,
    };
  }

  private formatBudgetReportForSharing(budgetData: any): ShareData {
    const { category, spent, budget, remaining, percentage } = budgetData;
    const currency = budgetData.currency || 'USD';

    let message = `📊 Budget Report\n\n`;
    message += `📂 Category: ${category}\n`;
    message += `💰 Budget: ${currency} ${budget.toFixed(2)}\n`;
    message += `💸 Spent: ${currency} ${spent.toFixed(2)}\n`;
    message += `💵 Remaining: ${currency} ${remaining.toFixed(2)}\n`;
    message += `📈 Usage: ${percentage.toFixed(1)}%\n\n`;

    if (percentage > 100) {
      message += `⚠️ You've exceeded your budget by ${currency} ${Math.abs(remaining).toFixed(2)}`;
    } else if (percentage > 80) {
      message += `⚠️ You're close to your budget limit`;
    } else {
      message += `✅ You're within your budget`;
    }

    return {
      title: 'ExpenseFlow - Budget Report',
      message,
    };
  }

  async shareToSpecificApp(app: 'whatsapp' | 'telegram' | 'email' | 'sms', data: ShareData): Promise<boolean> {
    try {
      let shareUrl = '';
      
      switch (app) {
        case 'whatsapp':
          shareUrl = `whatsapp://send?text=${encodeURIComponent(data.message)}`;
          break;
        case 'telegram':
          shareUrl = `telegram://msg?text=${encodeURIComponent(data.message)}`;
          break;
        case 'email':
          shareUrl = `mailto:?subject=${encodeURIComponent(data.title)}&body=${encodeURIComponent(data.message)}`;
          break;
        case 'sms':
          shareUrl = `sms:?body=${encodeURIComponent(data.message)}`;
          break;
      }

      // For now, use the general share API
      // In a real implementation, you'd use Linking.openURL(shareUrl)
      const result = await Share.share({
        title: data.title,
        message: data.message,
        url: data.url,
      });

      return result.action !== Share.dismissedAction;
    } catch (error) {
      console.error(`Failed to share to ${app}:`, error);
      return false;
    }
  }

  async getSettings(): Promise<ShareSettings> {
    try {
      const settings = await AsyncStorage.getItem('share_settings');
      if (settings) {
        return JSON.parse(settings);
      }
    } catch (error) {
      console.error('Failed to get share settings:', error);
    }

    // Default settings
    return {
      includeReceipt: true,
      includeLocation: true,
      includeNotes: true,
      shareFormat: 'detailed',
      defaultMessage: 'Check out this expense from ExpenseFlow!',
    };
  }

  async updateSettings(settings: Partial<ShareSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem('share_settings', JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Failed to update share settings:', error);
    }
  }

  // Generate shareable link for expense
  async generateExpenseLink(expenseId: string): Promise<string> {
    // In a real implementation, this would generate a deep link
    return `expenseflow://expense/${expenseId}`;
  }

  // Generate shareable link for expense list
  async generateExpenseListLink(expenseIds: string[]): Promise<string> {
    // In a real implementation, this would generate a deep link
    return `expenseflow://expenses?ids=${expenseIds.join(',')}`;
  }
}

export const shareService = ShareService.getInstance();
export default shareService; 