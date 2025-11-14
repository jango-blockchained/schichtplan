/**
 * Authentication service for user login, registration, and profile management
 */

import { api } from './api/instance';

export interface LoginCredentials {
  username: string;
  password: string;
  expiration_hours?: number;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role: string;
  employee_id?: number;
  is_active?: boolean;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  employee_id?: number;
  permissions: string[];
  last_login?: string;
  created_at?: string;
  updated_at?: string;
  setup_completed: boolean;
  has_passkey: boolean;
  remaining_recovery_codes: number;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: UserProfile;
  permissions: string[];
}

/**
 * Login with username and password
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/v2/auth/login', credentials);
  
  // Store token and user profile
  localStorage.setItem('auth_token', response.data.token);
  localStorage.setItem('user_profile', JSON.stringify(response.data.user));
  
  return response.data;
}

/**
 * Register a new user (admin only)
 */
export async function register(userData: RegisterData): Promise<{ message: string; user: UserProfile }> {
  const response = await api.post('/api/v2/auth/register', userData);
  return response.data;
}

/**
 * Get current user profile
 */
export async function getUserProfile(): Promise<{ user: UserProfile; permissions: string[] }> {
  const response = await api.get('/api/v2/auth/profile');
  
  // Update stored profile
  localStorage.setItem('user_profile', JSON.stringify(response.data.user));
  
  return response.data;
}

/**
 * Change password for current user
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const response = await api.post('/api/v2/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return response.data;
}

/**
 * Logout current user
 */
export function logout(): void {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_profile');
  localStorage.removeItem('E2E_TEST_MODE');
  
  // Redirect to login page
  window.location.href = '/login';
}

/**
 * Get stored user profile from localStorage
 */
export function getStoredUserProfile(): UserProfile | null {
  const profile = localStorage.getItem('user_profile');
  if (!profile) return null;
  
  try {
    return JSON.parse(profile);
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem('auth_token');
  const isE2EMode = localStorage.getItem('E2E_TEST_MODE') === 'true';
  return !!token || isE2EMode;
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(permission: string): boolean {
  const profile = getStoredUserProfile();
  return profile?.permissions.includes(permission) ?? false;
}

/**
 * Check if user has a specific role
 */
export function hasRole(role: string): boolean {
  const profile = getStoredUserProfile();
  return profile?.role === role;
}

/**
 * Enable development mode (bypasses authentication)
 * This should only be used for development and testing
 */
export function enableDevMode(): void {
  localStorage.setItem('E2E_TEST_MODE', 'true');
  console.warn('Development mode enabled - authentication bypassed');
}

/**
 * Disable development mode
 */
export function disableDevMode(): void {
  localStorage.removeItem('E2E_TEST_MODE');
}
