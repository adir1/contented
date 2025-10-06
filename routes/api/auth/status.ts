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
        JSON.stringify({
          authenticated: false,
          user: null,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Get session from storage
    const session = await oauthHandler.getStoredTokens(sessionId);

    if (!session) {
      // Session not found, clear cookie
      const response = new Response(
        JSON.stringify({
          authenticated: false,
          user: null,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      oauthHandler.clearSessionCookie(response);
      return response;
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

      return new Response(
        JSON.stringify({
          authenticated: true,
          user: {
            id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
          },
          tokenExpiresAt: validSession.tokenExpiresAt,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    } catch (error) {
      // Token refresh failed or user info fetch failed
      console.error("Auth status error:", error);

      const response = new Response(
        JSON.stringify({
          authenticated: false,
          user: null,
          error: "Token validation failed",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      oauthHandler.clearSessionCookie(response);
      return response;
    }
  } catch (error) {
    console.error("Status check error:", error);
    return new Response(
      JSON.stringify({
        authenticated: false,
        user: null,
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
