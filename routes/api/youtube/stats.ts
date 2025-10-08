import { HandlerContext } from "$fresh/server.ts";
import { OAuthHandler } from "../../../lib/oauth.ts";
import { YouTubeAPIClient } from "../../../lib/youtube-api.ts";

export const handler = async (
  req: Request,
  _ctx: HandlerContext,
): Promise<Response> => {
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
    const session = await oauthHandler.getStoredTokens(sessionId);
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize YouTube API client
    const youtubeClient = new YouTubeAPIClient(kv);

    if (req.method === "GET") {
      // Get usage statistics
      const usageStats = await youtubeClient.getUsageStats();
      
      return new Response(
        JSON.stringify({
          usageStats,
          quotaLimit: 10000, // YouTube API daily quota limit
          quotaRemaining: usageStats ? 10000 - usageStats.quotaUsed : 10000,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, no-cache",
          },
        }
      );
    } else if (req.method === "DELETE") {
      // Clear cache
      const url = new URL(req.url);
      const pattern = url.searchParams.get("pattern") || undefined;
      
      await youtubeClient.clearCache(pattern);
      
      return new Response(
        JSON.stringify({
          message: "Cache cleared successfully",
          pattern: pattern || "all",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response("Method not allowed", { status: 405 });
    }
  } catch (error) {
    console.error("Stats API error:", error);

    const apiError = error as any;
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        message: apiError.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};