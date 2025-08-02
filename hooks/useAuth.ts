import { useContext } from 'react';
import { AuthContext } from '../firebase/AuthProvider';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.error('AuthContext is undefined. This usually means the AuthProvider is not properly wrapping the component.');
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 