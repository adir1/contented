/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
/// <reference lib="es2022" />

import { OAuthHandler, UserSession } from "./oauth.ts";

export interface AuthenticatedRequest extends Request {
  session?: UserSession;
  user?: {
    id: string;
    email: string;
    name: string;
    picture: string;
  };
}

export async function requireAuth(
  req: Request,
  handler: (req: AuthenticatedRequest) => Promise<Response>,
): Promise<Response> {
  try {
    // Initialize Deno KV
    const kv = await Deno.openKv();

    // Get OAuth configuration
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
    const redirectUri = Deno.env.get("OAUTH_REDIRECT_URI") || "";

    const oauthHandler = new OAuthHandler(
      kv,
      clientId,
      clientSecret,
      redirectUri,
    );

    // Get session ID from cookies
    const sessionId = oauthHandler.getSessionFromCookies(req);

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Get session from storage
    const session = await oauthHandler.getStoredTokens(sessionId);

    if (!session) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    try {
      // Ensure token is valid (refresh if needed)
      const validSession = await oauthHandler.ensureValidToken(session);

      // Get user info
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            "Authorization": `Bearer ${validSession.accessToken}`,
          },
        },
      );

      if (!userInfoResponse.ok) {
        throw new Error("Failed to fetch user info");
      }

      const userInfo = await userInfoResponse.json();

      // Create authenticated request object
      const authReq = req as AuthenticatedRequest;
      authReq.session = validSession;
      authReq.user = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      };

      // Call the protected handler
      return await handler(authReq);
    } catch (error) {
      console.error("Token validation error:", error);
      return new Response(
        JSON.stringify({ error: "Token validation failed" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

export async function optionalAuth(
  req: Request,
  handler: (req: AuthenticatedRequest) => Promise<Response>,
): Promise<Response> {
  try {
    // Initialize Deno KV
    const kv = await Deno.openKv();

    // Get OAuth configuration
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
    const redirectUri = Deno.env.get("OAUTH_REDIRECT_URI") || "";

    const oauthHandler = new OAuthHandler(
      kv,
      clientId,
      clientSecret,
      redirectUri,
    );

    // Get session ID from cookies
    const sessionId = oauthHandler.getSessionFromCookies(req);
    const authReq = req as AuthenticatedRequest;

    if (sessionId) {
      try {
        // Get session from storage
        const session = await oauthHandler.getStoredTokens(sessionId);

        if (session) {
          // Ensure token is valid (refresh if needed)
          const validSession = await oauthHandler.ensureValidToken(session);

          // Get user info
          const userInfoResponse = await fetch(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            {
              headers: {
                "Authorization": `Bearer ${validSession.accessToken}`,
              },
            },
          );

          if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json();
            authReq.session = validSession;
            authReq.user = {
              id: userInfo.id,
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture,
            };
          }
        }
      } catch (error) {
        // Silently fail for optional auth
        console.warn("Optional auth failed:", error);
      }
    }

    // Call handler regardless of auth status
    return await handler(authReq);
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    // Still call handler even if middleware fails
    return await handler(req as AuthenticatedRequest);
  }
}
