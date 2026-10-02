/**
 * « Déconnecter Gmail et effacer mes données » : révoque l'autorisation chez Google, supprime tout le dossier
 * de l'utilisateur (token, état, profil) et ferme la session. Irréversible, confirmé côté client.
 */

import { config } from "@coly/worker/config";
import { revokeToken } from "@coly/worker/oauth";
import { deleteUserData, readRefreshToken } from "@coly/worker/users";
import { clearSessionCookie, getSession, isDemo, redirectWith, sameOrigin } from "../../../auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ error: "Origine refusée." }, { status: 403 });
  const session = await getSession();
  if (!session) return redirectWith("/connexion", [], 303);
  if (!isDemo(session)) {
    const token = await readRefreshToken(session.userId, config.encryptionKey());
    if (token) await revokeToken(token);
    await deleteUserData(session.userId);
  }
  return redirectWith("/connexion?info=efface", [clearSessionCookie()], 303);
}
