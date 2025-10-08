/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
/// <reference lib="es2022" />

import type { JSX } from "preact";
import { useAuthState } from "../lib/auth-state.ts";
import LoginButton from "./LoginButton.tsx";
import LogoutButton from "./LogoutButton.tsx";
import UserProfile from "./UserProfile.tsx";
import AuthError from "./AuthError.tsx";

interface AuthStatusProps {
  className?: string;
  showUserProfile?: boolean;
  showTokenExpiry?: boolean;
}

export default function AuthStatus({ 
  className, 
  showUserProfile = true,
  showTokenExpiry = false 
}: AuthStatusProps) {
  const { 
    isAuthenticated, 
    currentUser, 
    authLoading, 
    authError,
    isTokenExpired,
    authStatus 
  } = useAuthState();

  const defaultClassName = "space-y-4";
  const statusClassName = className || defaultClassName;

  return (
    <div className={statusClassName}>
      {/* Error Display */}
      <AuthError />

      {/* Loading State */}
      {authLoading && (
        <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
          <svg className="animate-spin h-5 w-5 text-blue-600 mr-2" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-blue-800">Loading...</span>
        </div>
      )}

      {/* Authentication Status */}
      {!authLoading && (
        <div className="space-y-4">
          {isAuthenticated ? (
            <div className="space-y-4">
              {/* User Profile */}
              {showUserProfile && <UserProfile />}
              
              {/* Token Expiry Warning */}
              {showTokenExpiry && isTokenExpired && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm text-yellow-800">
                      Your session will expire soon. Please refresh the page if needed.
                    </span>
                  </div>
                </div>
              )}

              {/* Token Expiry Info */}
              {showTokenExpiry && authStatus.tokenExpiresAt && (
                <div className="text-xs text-gray-500">
                  Token expires: {authStatus.tokenExpiresAt.toLocaleString()}
                </div>
              )}

              {/* Logout Button */}
              <LogoutButton />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Not Authenticated Message */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-700">
                  Please sign in to access your YouTube subscriptions and content.
                </p>
              </div>
              
              {/* Login Button */}
              <LoginButton />
            </div>
          )}
        </div>
      )}
    </div>
  );
}