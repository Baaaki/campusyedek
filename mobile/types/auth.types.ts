export interface User {
  id: string;
  email: string;
  role: 'student' | 'staff' | 'admin';
  created_at?: string;
  updated_at?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role?: 'student' | 'staff';
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AuthError {
  message: string;
  code?: string;
}
