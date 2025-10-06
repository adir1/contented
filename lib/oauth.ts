/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
/// <reference lib="es2022" />

import { getCookies, setCookie } from "$std/http/cookie.ts";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface UserSession {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  createdAt: Date;
  lastAccessed: Date;
}

export class OAuthHandler {
  private kv: any; // Using any for Deno.Kv to avoid type issues
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(
    kv: any,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ) {
    this.kv = kv;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  generateAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      access_type: "offline",
      prompt: "consent",
    });

    if (state) {
      params.set("state", state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OAuth token exchange failed: ${error}`);
    }

    return await response.json();
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const tokenData = await response.json();

    // If no new refresh token is provided, keep the existing one
    if (!tokenData.refresh_token) {
      tokenData.refresh_token = refreshToken;
    }

    return tokenData;
  }

  async storeTokens(userId: string, tokens: TokenResponse): Promise<string> {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const session: UserSession = {
      id: sessionId,
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: expiresAt,
      createdAt: new Date(),
      lastAccessed: new Date(),
    };

    await this.kv.set(["sessions", sessionId], session);

    // Also store by userId for easy lookup
    await this.kv.set(["user_sessions", userId], sessionId);

    return sessionId;
  }

  async getStoredTokens(sessionId: string): Promise<UserSession | null> {
    const result = await this.kv.get(["sessions", sessionId]);

    if (!result.value) {
      return null;
    }

    // Update last accessed time
    const session = result.value;
    session.lastAccessed = new Date();
    await this.kv.set(["sessions", sessionId], session);

    return session;
  }

  async getUserSession(userId: string): Promise<UserSession | null> {
    const sessionIdResult = await this.kv.get(["user_sessions", userId]);

    if (!sessionIdResult.value) {
      return null;
    }

    return await this.getStoredTokens(sessionIdResult.value);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getStoredTokens(sessionId);

    if (session) {
      await this.kv.delete(["sessions", sessionId]);
      await this.kv.delete(["user_sessions", session.userId]);
    }
  }

  isTokenExpired(session: UserSession): boolean {
    // Add 5 minute buffer to account for clock skew
    const bufferTime = 5 * 60 * 1000;
    return Date.now() > (session.tokenExpiresAt.getTime() - bufferTime);
  }

  async ensureValidToken(session: UserSession): Promise<UserSession> {
    if (this.isTokenExpired(session)) {
      try {
        const newTokens = await this.refreshAccessToken(session.refreshToken);

        // Update session with new tokens
        const updatedSession: UserSession = {
          ...session,
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
          lastAccessed: new Date(),
        };

        await this.kv.set(["sessions", session.id], updatedSession);
        return updatedSession;
      } catch (error) {
        // If refresh fails, delete the invalid session
        await this.deleteSession(session.id);
        const errorMessage = error instanceof Error
          ? error.message
          : String(error);
        throw new Error(`Token refresh failed: ${errorMessage}`);
      }
    }

    return session;
  }

  generateState(): string {
    return crypto.randomUUID();
  }

  setSessionCookie(response: Response, sessionId: string): void {
    setCookie(response.headers, {
      name: "session_id",
      value: sessionId,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });
  }

  getSessionFromCookies(request: Request): string | null {
    const cookies = getCookies(request.headers);
    return cookies.session_id || null;
  }

  clearSessionCookie(response: Response): void {
    setCookie(response.headers, {
      name: "session_id",
      value: "",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 0,
      path: "/",
    });
  }
}
