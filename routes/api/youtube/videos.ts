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
    const channelId = url.searchParams.get("channelId");
    const channelIds = url.searchParams.get("channelIds")?.split(",");
    const maxResults = parseInt(url.searchParams.get("maxResults") || "25");
    const pageToken = url.searchParams.get("pageToken") || undefined;
    const publishedAfter = url.searchParams.get("publishedAfter") 
      ? new Date(url.searchParams.get("publishedAfter")!)
      : undefined;

    // Initialize YouTube API client
    const youtubeClient = new YouTubeAPIClient(kv);

    // Handle different request types
    if (channelIds && channelIds.length > 0) {
      // Batch request for multiple channels
      const batchResults = await youtubeClient.batchGetChannelVideos(
        session.accessToken,
        channelIds,
        maxResults,
        publishedAfter
      );

      // Convert Map to object for JSON serialization
      const results: Record<string, any> = {};
      for (const [channelId, videos] of batchResults) {
        results[channelId] = videos;
      }

      return new Response(
        JSON.stringify({
          type: "batch",
          results,
          channelCount: channelIds.length,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, max-age=600", // 10 minutes client cache
          },
        }
      );
    } else if (channelId) {
      // Single channel request
      const videos = await youtubeClient.getChannelVideos(
        session.accessToken,
        channelId,
        maxResults,
        pageToken,
        publishedAfter
      );

      return new Response(
        JSON.stringify(videos),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, max-age=600", // 10 minutes client cache
          },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          error: "Missing required parameter: channelId or channelIds",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Videos API error:", error);

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
        error: "Failed to fetch videos",
        message: apiError.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};