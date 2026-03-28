import api from './api';
import * as SecureStore from 'expo-secure-store';
import type { LoginRequest, LoginResponse, ChangePasswordRequest, ChangePasswordResponse, User } from '@/types/auth.types';

const TOKEN_KEY = 'jwt_token';
const USER_KEY = 'user_data';

export const authService = {
  /**
   * Login user — backend returns access_token (not "token")
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', data);

    if (response.data.access_token) {
      await SecureStore.setItemAsync(TOKEN_KEY, response.data.access_token);
    }
    if (response.data.user) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.data.user));
    }

    return response.data;
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  },

  /**
   * Change password
   */
  async changePassword(data: ChangePasswordRequest): Promise<ChangePasswordResponse> {
    const response = await api.post<ChangePasswordResponse>('/auth/password/change', data);

    if (response.data.access_token) {
      await SecureStore.setItemAsync(TOKEN_KEY, response.data.access_token);
    }

    return response.data;
  },

  /**
   * Get stored user from SecureStore (no profile endpoint on backend)
   */
  async getStoredUser(): Promise<User | null> {
    try {
      const userData = await SecureStore.getItemAsync(USER_KEY);
      if (userData) {
        return JSON.parse(userData) as User;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Check if user is authenticated (has stored token)
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      return !!token;
    } catch {
      return false;
    }
  },

  /**
   * Get stored JWT token
   */
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Clear all auth data
   */
  async clearAuth(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  },
};

export default authService;
