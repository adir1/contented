/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
/// <reference lib="es2022" />

import type { JSX } from "preact";
import { useAuthState } from "../lib/auth-state.ts";

interface UserProfileProps {
  className?: string;
  showEmail?: boolean;
  showPicture?: boolean;
}

export default function UserProfile({ 
  className, 
  showEmail = true, 
  showPicture = true 
}: UserProfileProps) {
  const { currentUser, isAuthenticated } = useAuthState();

  if (!isAuthenticated || !currentUser) {
    return null;
  }

  const defaultClassName = "flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border";
  const profileClassName = className || defaultClassName;

  return (
    <div className={profileClassName}>
      {showPicture && currentUser.picture && (
        <img
          src={currentUser.picture}
          alt={`${currentUser.name}'s profile`}
          className="w-10 h-10 rounded-full"
        />
      )}
      <div className="flex flex-col">
        <span className="font-medium text-gray-900">
          {currentUser.name}
        </span>
        {showEmail && (
          <span className="text-sm text-gray-600">
            {currentUser.email}
          </span>
        )}
      </div>
    </div>
  );
}