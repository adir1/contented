/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
/// <reference lib="es2022" />

import { signal, computed } from "@preact/signals";
import { AuthManager, type AuthStatus } from "./auth-manager.ts";

// Auth state signals
export const authStatus = signal<AuthStatus>({
  authenticated: false,
  user: null,
});

export const authLoading = signal<boolean>(false);
export const authError = signal<string | null>(null);

// Computed values
export const isAuthenticated = computed(() => authStatus.value.authenticated);
export const currentUser = computed(() => authStatus.value.user);
export const isTokenExpired = computed(() => {
  if (!authStatus.value.tokenExpiresAt) return false;
  return Date.now() > authStatus.value.tokenExpiresAt.getTime();
});

// Auth manager instance (removed unused variable)

/**
 * Auth state management class that handles authentication state using Preact Signals
 */
export class AuthStateManager {
  private authManager: AuthManager;
  private statusCheckInterval: number | null = null;

  constructor() {
    this.authManager = new AuthManager();
  }

  /**
   * Initialize auth state by checking current status
   */
  async initialize(): Promise<void> {
    try {
      authLoading.value = true;
      authError.value = null;
      
      const status = await this.authManager.getAuthStatus();
      authStatus.value = status;
      
      if (status.error) {
        authError.value = status.error;
      }

      // Start periodic status checks if authenticated
      if (status.authenticated) {
        this.startStatusChecks();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize auth';
      authError.value = errorMessage;
      console.error('Auth initialization error:', error);
    } finally {
      authLoading.value = false;
    }
  }

  /**
   * Initiate login flow
   */
  async login(): Promise<void> {
    try {
      authLoading.value = true;
      authError.value = null;
      
      await this.authManager.initiateLogin();
      // Note: This will redirect, so code after this won't execute
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      authError.value = errorMessage;
      console.error('Login error:', error);
      authLoading.value = false;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      authLoading.value = true;
      authError.value = null;
      
      await this.authManager.logout();
      
      // Update state to reflect logout
      authStatus.value = {
        authenticated: false,
        user: null,
      };
      
      // Stop status checks
      this.stopStatusChecks();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      authError.value = errorMessage;
      console.error('Logout error:', error);
    } finally {
      authLoading.value = false;
    }
  }

  /**
   * Refresh authentication status
   */
  async refreshStatus(): Promise<void> {
    try {
      const status = await this.authManager.getAuthStatus();
      authStatus.value = status;
      
      if (status.error) {
        authError.value = status.error;
      } else {
        authError.value = null;
      }

      // Start or stop status checks based on auth state
      if (status.authenticated) {
        this.startStatusChecks();
      } else {
        this.stopStatusChecks();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh status';
      authError.value = errorMessage;
      console.error('Status refresh error:', error);
    }
  }

  /**
   * Handle OAuth callback success (called after redirect back from OAuth)
   */
  async handleAuthSuccess(): Promise<void> {
    try {
      authLoading.value = true;
      authError.value = null;
      
      // Refresh status to get user info
      await this.refreshStatus();
      
      // Clear URL parameters
      const url = new URL(globalThis.location.href);
      url.searchParams.delete('auth');
      url.searchParams.delete('error');
      globalThis.history.replaceState({}, document.title, url.toString());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to handle auth success';
      authError.value = errorMessage;
      console.error('Auth success handling error:', error);
    } finally {
      authLoading.value = false;
    }
  }

  /**
   * Handle OAuth callback error
   */
  handleAuthError(error: string): void {
    authError.value = error;
    authStatus.value = {
      authenticated: false,
      user: null,
      error,
    };
    
    // Clear URL parameters
    const url = new URL(globalThis.location.href);
    url.searchParams.delete('auth');
    url.searchParams.delete('error');
    globalThis.history.replaceState({}, document.title, url.toString());
  }

  /**
   * Clear any auth errors
   */
  clearError(): void {
    authError.value = null;
  }

  /**
   * Start periodic status checks to handle token expiration
   */
  private startStatusChecks(): void {
    if (this.statusCheckInterval) {
      return; // Already running
    }

    // Check status every 5 minutes
    this.statusCheckInterval = setInterval(() => {
      this.refreshStatus().catch(error => {
        console.error('Periodic status check failed:', error);
      });
    }, 5 * 60 * 1000);
  }

  /**
   * Stop periodic status checks
   */
  private stopStatusChecks(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  /**
   * Cleanup method to stop intervals
   */
  cleanup(): void {
    this.stopStatusChecks();
  }
}

// Global auth state manager instance
export const authStateManager = new AuthStateManager();

// Utility functions for components
export const useAuthState = () => ({
  authStatus: authStatus.value,
  isAuthenticated: isAuthenticated.value,
  currentUser: currentUser.value,
  authLoading: authLoading.value,
  authError: authError.value,
  isTokenExpired: isTokenExpired.value,
});

export const useAuthActions = () => ({
  login: () => authStateManager.login(),
  logout: () => authStateManager.logout(),
  refreshStatus: () => authStateManager.refreshStatus(),
  clearError: () => authStateManager.clearError(),
  handleAuthSuccess: () => authStateManager.handleAuthSuccess(),
  handleAuthError: (error: string) => authStateManager.handleAuthError(error),
});