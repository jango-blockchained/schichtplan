/**
 * Setup service for first-time application setup with passkey authentication
 */
import { api } from './api';
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';

export interface SetupStatus {
  setup_completed: boolean;
  admin_exists: boolean;
  needs_setup: boolean;
}

export interface PasskeyInitResponse {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    alg: number;
    type: string;
  }>;
  timeout: number;
  attestation: string;
  excludeCredentials: any[];
}

export interface PasskeyCompleteResponse {
  message: string;
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    setup_completed: boolean;
    has_passkey: boolean;
    remaining_recovery_codes: number;
  };
  recovery_codes: string[];
}

export interface AIKeysConfig {
  api_keys: {
    gemini?: string;
    openai?: string;
    anthropic?: string;
  };
  provider?: string;
  enabled?: boolean;
}

/**
 * Check the setup status of the application
 */
export async function checkSetupStatus(): Promise<SetupStatus> {
  const response = await api.get<SetupStatus>('/api/v2/setup/status');
  return response.data;
}

/**
 * Initialize passkey registration
 */
export async function initPasskeyRegistration(username: string, email: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const response = await api.post<PublicKeyCredentialCreationOptionsJSON>(
    '/api/v2/setup/init-passkey',
    { username, email }
  );
  return response.data;
}

/**
 * Complete passkey registration
 */
export async function completePasskeyRegistration(
  username: string,
  credential: RegistrationResponseJSON
): Promise<PasskeyCompleteResponse> {
  const response = await api.post<PasskeyCompleteResponse>(
    '/api/v2/setup/complete-passkey',
    { username, credential }
  );
  return response.data;
}

/**
 * Register a passkey for the admin user (full flow)
 */
export async function registerPasskey(username: string, email: string): Promise<PasskeyCompleteResponse> {
  // Step 1: Initialize registration
  const options = await initPasskeyRegistration(username, email);
  
  // Step 2: Use browser WebAuthn API to create credential
  const credential = await startRegistration(options);
  
  // Step 3: Complete registration on server
  return await completePasskeyRegistration(username, credential);
}

/**
 * Configure AI API keys (optional step)
 */
export async function configureAIKeys(config: AIKeysConfig): Promise<{ message: string; ai_enabled: boolean }> {
  const response = await api.post('/api/v2/setup/configure-ai', config);
  return response.data;
}

/**
 * Mark setup as complete
 */
export async function completeSetup(): Promise<{ message: string; user: any }> {
  const response = await api.post('/api/v2/setup/complete');
  return response.data;
}

/**
 * Initialize passkey login
 */
export async function initPasskeyLogin(username: string): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const response = await api.post<PublicKeyCredentialRequestOptionsJSON>(
    '/api/v2/auth/passkey/init-login',
    { username }
  );
  return response.data;
}

/**
 * Complete passkey login
 */
export async function completePasskeyLogin(
  username: string,
  credential: AuthenticationResponseJSON
): Promise<{ message: string; token: string; user: any }> {
  const response = await api.post(
    '/api/v2/auth/passkey/complete-login',
    { username, credential }
  );
  return response.data;
}

/**
 * Login with passkey (full flow)
 */
export async function loginWithPasskey(username: string): Promise<{ token: string; user: any }> {
  // Step 1: Initialize login
  const options = await initPasskeyLogin(username);
  
  // Step 2: Use browser WebAuthn API to get credential
  const credential = await startAuthentication(options);
  
  // Step 3: Complete login on server
  const result = await completePasskeyLogin(username, credential);
  
  // Store token in localStorage
  if (result.token) {
    localStorage.setItem('auth_token', result.token);
  }
  
  return result;
}

/**
 * Verify a recovery code for authentication
 */
export async function verifyRecoveryCode(
  username: string,
  recoveryCode: string
): Promise<{ message: string; token: string; user: any; remaining_recovery_codes: number }> {
  const response = await api.post('/api/v2/setup/recovery-code/verify', {
    username,
    recovery_code: recoveryCode,
  });
  
  // Store token in localStorage
  if (response.data.token) {
    localStorage.setItem('auth_token', response.data.token);
  }
  
  return response.data;
}

/**
 * Check if user needs to log in today
 */
export async function checkDailyLogin(): Promise<{ needs_login: boolean; last_login: string | null }> {
  const response = await api.get('/api/v2/auth/passkey/check-daily-login');
  return response.data;
}

/**
 * Logout user
 */
export function logout(): void {
  localStorage.removeItem('auth_token');
  window.location.href = '/login';
}
