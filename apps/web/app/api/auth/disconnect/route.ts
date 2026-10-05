/**
 * « Déconnecter Gmail et effacer mes données » : révoque l'autorisation chez Google, supprime tout le dossier
 * de l'utilisateur (token, état, profil) et ferme la session. Irréversible, confirmé côté client.
 */

import { config } from "@coly/worker/config";
import { revokeToken } from "@coly/worker/oauth";
import { deleteUserData, readRefreshToken } from "@coly/worker/users";
import { clearSessionCookie, getSession, redirectTo } from "../../../auth";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const session = await getSession();
  if (!session) return redirectTo("/connexion", 303);
  const token = await readRefreshToken(session.userId, config.encryptionKey());
  await Promise.all([token && revokeToken(token), deleteUserData(session.userId)]);
  return clearSessionCookie(redirectTo("/connexion?info=efface", 303));
}
