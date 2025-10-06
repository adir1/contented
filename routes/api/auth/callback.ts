import { HandlerContext } from "$fresh/server.ts";
import { OAuthHandler } from "../../../lib/oauth.ts";

export const handler = async (
  req: Request,
  _ctx: HandlerContext,
): Promise<Response> => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      console.error("OAuth error:", error);
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/?error=oauth_error",
        },
      });
    }

    if (!code || !state) {
      return new Response("Missing authorization code or state", {
        status: 400,
      });
    }

    // Initialize Deno KV
    const kv = await Deno.openKv();

    // Verify state to prevent CSRF attacks
    const stateResult = await kv.get(["oauth_states", state]);
    const stateData = stateResult.value as
      | { createdAt: Date; used: boolean }
      | null;

    if (!stateData || stateData.used) {
      return new Response("Invalid or expired state", { status: 400 });
    }

    // Mark state as used
    await kv.set(["oauth_states", state], {
      ...stateData,
      used: true,
    });

    // Get OAuth configuration
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const redirectUri = Deno.env.get("OAUTH_REDIRECT_URI") ||
      `${url.origin}/api/auth/callback`;

    if (!clientId || !clientSecret) {
      return new Response("OAuth configuration missing", { status: 500 });
    }

    const oauthHandler = new OAuthHandler(
      kv,
      clientId,
      clientSecret,
      redirectUri,
    );

    // Exchange code for tokens
    const tokens = await oauthHandler.exchangeCodeForTokens(code);

    // Get user info from Google to create a user ID
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          "Authorization": `Bearer ${tokens.access_token}`,
        },
      },
    );

    if (!userInfoResponse.ok) {
      throw new Error("Failed to fetch user info");
    }

    const userInfo = await userInfoResponse.json();
    const userId = userInfo.id;

    // Store tokens and create session
    const sessionId = await oauthHandler.storeTokens(userId, tokens);

    // Create response with session cookie
    const response = new Response(null, {
      status: 302,
      headers: {
        "Location": "/?auth=success",
      },
    });

    oauthHandler.setSessionCookie(response, sessionId);

    return response;
  } catch (error) {
    console.error("Callback error:", error);
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/?error=auth_failed",
      },
    });
  }
};
