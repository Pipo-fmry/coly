/** Déconnexion de Coly : efface le cookie de session. Les données et l'autorisation Gmail restent. */

import { clearSessionCookie, redirectTo } from "../../../auth";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  return clearSessionCookie(redirectTo("/connexion", 303));
}
