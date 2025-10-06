import { HandlerContext } from "$fresh/server.ts";
import {
  AuthenticatedRequest,
  requireAuth,
} from "../../../lib/auth-middleware.ts";

export const handler = async (
  req: Request,
  _ctx: HandlerContext,
): Promise<Response> => {
  return await requireAuth(req, async (authReq: AuthenticatedRequest) => {
    return new Response(
      JSON.stringify({
        message: "This is a protected route",
        user: authReq.user,
        sessionId: authReq.session?.id,
        tokenExpiresAt: authReq.session?.tokenExpiresAt,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  });
};
