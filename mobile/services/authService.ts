import api from './api';
import * as SecureStore from 'expo-secure-store';
import type { LoginRequest, RegisterRequest, AuthResponse, User } from '@/types/auth.types';

export const authService = {
  /**
   * Login user
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', data);

    // Store JWT token in secure storage
    if (response.data.token) {
      await SecureStore.setItemAsync('jwt_token', response.data.token);
    }

    return response.data;
  },

  /**
   * Register new user
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data);

    // Store JWT token in secure storage
    if (response.data.token) {
      await SecureStore.setItemAsync('jwt_token', response.data.token);
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
      // Always clear local token
      await SecureStore.deleteItemAsync('jwt_token');
    }
  },

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    const response = await api.get<User>('/auth/profile');
    return response.data;
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await SecureStore.getItemAsync('jwt_token');
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
      return await SecureStore.getItemAsync('jwt_token');
    } catch {
      return null;
    }
  },
};

export default authService;
