/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
/// <reference lib="es2022" />

import { useEffect } from "preact/hooks";
import { authStateManager } from "../lib/auth-state.ts";
import AuthStatus from "../components/AuthStatus.tsx";

interface AuthManagerProps {
  className?: string;
  showUserProfile?: boolean;
  showTokenExpiry?: boolean;
}

export default function AuthManager({ 
  className,
  showUserProfile = true,
  showTokenExpiry = false 
}: AuthManagerProps) {
  
  useEffect(() => {
    // Initialize auth state when component mounts
    const initializeAuth = async () => {
      try {
        // Check URL parameters for auth callback handling
        const urlParams = new URLSearchParams(window.location.search);
        const authSuccess = urlParams.get('auth');
        const authError = urlParams.get('error');

        if (authSuccess === 'success') {
          // Handle successful OAuth callback
          await authStateManager.handleAuthSuccess();
        } else if (authError) {
          // Handle OAuth error
          authStateManager.handleAuthError(authError);
        } else {
          // Normal initialization
          await authStateManager.initialize();
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      }
    };

    initializeAuth();

    // Cleanup on unmount
    return () => {
      authStateManager.cleanup();
    };
  }, []);

  return (
    <AuthStatus 
      className={className}
      showUserProfile={showUserProfile}
      showTokenExpiry={showTokenExpiry}
    />
  );
}