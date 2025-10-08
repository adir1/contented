import { HandlerContext } from "$fresh/server.ts";
import { OAuthHandler } from "../../../lib/oauth.ts";
import { YouTubeAPIClient } from "../../../lib/youtube-api.ts";

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
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const redirectUri = Deno.env.get("OAUTH_REDIRECT_URI") ||
      `${new URL(req.url).origin}/api/auth/callback`;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "OAuth configuration missing" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const oauthHandler = new OAuthHandler(
      kv,
      clientId,
      clientSecret,
      redirectUri,
    );

    // Get session from cookies
    const sessionId = oauthHandler.getSessionFromCookies(req);
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get and validate session
    let session = await oauthHandler.getStoredTokens(sessionId);
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Ensure token is valid (refresh if needed)
    try {
      session = await oauthHandler.ensureValidToken(session);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Token refresh failed" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const maxResults = parseInt(url.searchParams.get("maxResults") || "50");
    const pageToken = url.searchParams.get("pageToken") || undefined;

    // Initialize YouTube API client
    const youtubeClient = new YouTubeAPIClient(kv);

    // Get subscriptions
    const subscriptions = await youtubeClient.getSubscriptions(
      session.accessToken,
      maxResults,
      pageToken
    );

    return new Response(
      JSON.stringify(subscriptions),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=300", // 5 minutes client cache
        },
      }
    );
  } catch (error) {
    console.error("Subscriptions API error:", error);

    // Handle specific YouTube API errors
    const apiError = error as any;
    if (apiError.quotaExceeded) {
      return new Response(
        JSON.stringify({
          error: "YouTube API quota exceeded",
          code: "quota_exceeded",
          retryAfter: "24h",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "86400", // 24 hours in seconds
          },
        }
      );
    }

    if (apiError.status === 403) {
      return new Response(
        JSON.stringify({
          error: "YouTube API access forbidden",
          code: "access_forbidden",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Failed to fetch subscriptions",
        message: apiError.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};