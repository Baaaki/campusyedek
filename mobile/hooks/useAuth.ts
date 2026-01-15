import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/authService';
import type { LoginRequest, RegisterRequest, User } from '@/types/auth.types';

/**
 * Login mutation hook
 */
export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequest) => authService.login(data),
    onSuccess: (data) => {
      // Cache user data
      queryClient.setQueryData(['user'], data.user);
    },
    onError: (error: any) => {
      console.error('Login error:', error.response?.data || error.message);
    },
  });
};

/**
 * Register mutation hook
 */
export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegisterRequest) => authService.register(data),
    onSuccess: (data) => {
      // Cache user data
      queryClient.setQueryData(['user'], data.user);
    },
    onError: (error: any) => {
      console.error('Register error:', error.response?.data || error.message);
    },
  });
};

/**
 * Logout mutation hook
 */
export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
    },
    onError: (error: any) => {
      console.error('Logout error:', error.response?.data || error.message);
    },
  });
};

/**
 * Get user profile query hook
 */
export const useProfile = (enabled: boolean = true) => {
  return useQuery<User>({
    queryKey: ['user'],
    queryFn: () => authService.getProfile(),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
};

/**
 * Check if user is authenticated
 */
export const useIsAuthenticated = () => {
  return useQuery({
    queryKey: ['isAuthenticated'],
    queryFn: () => authService.isAuthenticated(),
    staleTime: Infinity,
  });
};
