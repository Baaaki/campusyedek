import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Platform-specific base URL
// Android emulator: 10.0.2.2 (localhost proxy)
// iOS simulator: localhost works directly
// Physical device: Use your computer's local IP (e.g., 192.168.1.x)
const getBaseURL = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2/api';
    }
    if (Platform.OS === 'ios') {
      return 'http://localhost/api';
    }
    // For physical devices, replace with your local IP
    return 'http://192.168.1.100/api';
  }
  // Production URL
  return 'https://api.mydreamcampus.com/api';
};

export const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add JWT token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('jwt_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token from SecureStore:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - Clear token and redirect to login
      await SecureStore.deleteItemAsync('jwt_token');
      // You can add navigation logic here if needed
    }
    return Promise.reject(error);
  }
);

export default api;
