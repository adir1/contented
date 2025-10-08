/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
/// <reference lib="es2022" />

import type { JSX } from "preact";
import { useAuthActions, useAuthState } from "../lib/auth-state.ts";

interface LoginButtonProps {
  className?: string;
  children?: JSX.Element | string;
}

export default function LoginButton({ className, children }: LoginButtonProps) {
  const { authLoading } = useAuthState();
  const { login } = useAuthActions();

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const defaultClassName = "px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium";
  const buttonClassName = className || defaultClassName;

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={authLoading}
      className={buttonClassName}
    >
      {authLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
          Signing in...
        </span>
      ) : (
        children || "Sign in with Google"
      )}
    </button>
  );
}