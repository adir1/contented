import { HandlerContext } from "$fresh/server.ts";
import { OAuthHandler } from "../../../lib/oauth.ts";

export const handler = async (
  req: Request,
  _ctx: HandlerContext,
): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Initialize Deno KV
    const kv = await Deno.openKv();

    // Get OAuth configuration (needed for OAuthHandler initialization)
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

    if (sessionId) {
      // Delete the session
      await oauthHandler.deleteSession(sessionId);
    }

    // Create response and clear session cookie
    const response = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });

    oauthHandler.clearSessionCookie(response);

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return new Response(JSON.stringify({ error: "Logout failed" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};
