/** Déconnexion de Coly : efface le cookie de session. Les données et l'autorisation Gmail restent. */

import { clearSessionCookie, redirectWith, sameOrigin } from "../../../auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ error: "Origine refusée." }, { status: 403 });
  return redirectWith("/connexion", [clearSessionCookie()], 303);
}
