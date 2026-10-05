/**
 * Protection CSRF de toutes les routes `/api` : une requête mutante dont l'origine diffère de l'hôte est
 * refusée avant d'atteindre le code applicatif. Les GET (dont le flux OAuth) ne sont pas concernés.
 */

import { type NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function proxy(request: NextRequest): NextResponse {
  const origin = request.headers.get("origin");
  if (!SAFE_METHODS.has(request.method) && origin !== null) {
    if (URL.parse(origin)?.host !== request.headers.get("host"))
      return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
