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

    // Get OAuth configuration from environment variables
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const redirectUri = Deno.env.get("OAUTH_REDIRECT_URI") ||
      `${new URL(req.url).origin}/api/auth/callback`;

    if (!clientId || !clientSecret) {
      return new Response("OAuth configuration missing", { status: 500 });
    }

    const oauthHandler = new OAuthHandler(
      kv,
      clientId,
      clientSecret,
      redirectUri,
    );

    // Generate state for CSRF protection
    const state = oauthHandler.generateState();

    // Store state in KV for verification
    await kv.set(["oauth_states", state], {
      createdAt: new Date(),
      used: false,
    }, { expireIn: 10 * 60 * 1000 }); // 10 minutes

    // Generate authorization URL
    const authUrl = oauthHandler.generateAuthUrl(state);

    // Redirect to Google OAuth
    return new Response(null, {
      status: 302,
      headers: {
        "Location": authUrl,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return new Response("Internal server error", { status: 500 });
  }
};
