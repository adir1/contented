/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
/// <reference lib="es2022" />

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user: User | null;
  tokenExpiresAt?: Date;
  error?: string;
}

export class AuthManager {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Initiates the OAuth login flow by redirecting to the login endpoint
   */
  async initiateLogin(): Promise<void> {
    try {
      // Redirect to the login endpoint which will handle OAuth flow
      globalThis.location.href = `${this.baseUrl}/api/auth/login`;
    } catch (error) {
      console.error('Failed to initiate login:', error);
      throw new Error('Failed to initiate login');
    }
  }

  /**
   * Handles the OAuth callback (this is typically handled by the backend route)
   * This method is mainly for completeness of the interface
   */
  async handleCallback(_code: string): Promise<AuthToken> {
    try {
      // In our implementation, the callback is handled by the backend route
      // This method would be used if we were handling the callback on the frontend
      throw new Error('Callback handling is done by backend route /api/auth/callback');
    } catch (error) {
      console.error('Failed to handle callback:', error);
      throw new Error('Failed to handle OAuth callback');
    }
  }

  /**
   * Refreshes the access token (handled automatically by backend)
   */
  async refreshToken(): Promise<AuthToken> {
    try {
      // Token refresh is handled automatically by the backend when making authenticated requests
      // We can trigger a status check to force token refresh if needed
      const status = await this.getAuthStatus();
      if (!status.authenticated) {
        throw new Error('Not authenticated');
      }
      
      return {
        accessToken: '', // Backend doesn't expose tokens to frontend for security
        refreshToken: '',
        tokenExpiresAt: status.tokenExpiresAt || new Date(),
      };
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw new Error('Failed to refresh token');
    }
  }

  /**
   * Logs out the user by calling the logout endpoint
   */
  async logout(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Include cookies
      });

      if (!response.ok) {
        throw new Error(`Logout failed: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error('Logout was not successful');
      }
    } catch (error) {
      console.error('Failed to logout:', error);
      throw new Error('Failed to logout');
    }
  }

  /**
   * Checks if the user is currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const status = await this.getAuthStatus();
      return status.authenticated;
    } catch (error) {
      console.error('Failed to check authentication status:', error);
      return false;
    }
  }

  /**
   * Gets the current authentication status including user information
   */
  async getAuthStatus(): Promise<AuthStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/status`, {
        method: 'GET',
        credentials: 'include', // Include cookies
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        authenticated: result.authenticated || false,
        user: result.user || null,
        tokenExpiresAt: result.tokenExpiresAt ? new Date(result.tokenExpiresAt) : undefined,
        error: result.error,
      };
    } catch (error) {
      console.error('Failed to get auth status:', error);
      return {
        authenticated: false,
        user: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Gets the current user information if authenticated
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const status = await this.getAuthStatus();
      return status.user;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }
}