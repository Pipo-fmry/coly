/** Lecture Gmail via l'API REST. Le corps des emails reste en mémoire (ADR 0006). */

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Filtre côté serveur : seuls les emails probablement liés à une commande ou un colis sont téléchargés. */
/**
 * Filtre côté serveur : seuls les emails probablement liés à une commande ou un colis sont listés (ADR 0013).
 * `since` (synchro incrémentale) prime sur `days` (première synchro).
 */
export function buildQuery(options: { days: number; since?: Date }): string {
  const keywords = [
    "commande",
    "expédié",
    "expédition",
    "colis",
    "livraison",
    "suivi",
    "retrait",
    "relais",
    "tracking",
    "shipped",
  ];
  const window = options.since
    ? `after:${Math.floor(options.since.getTime() / 1000)}`
    : `newer_than:${options.days}d`;
  const excluded = "-in:chats -category:promotions -category:social -category:forums";
  return `${window} ${excluded} {${keywords.map((k) => `subject:${k}`).join(" ")}}`;
}

export interface MailMessage {
  id: string;
  threadId: string;
  date: Date;
  from: string;
  subject: string;
  text: string;
  urls: string[];
}

interface Part {
  mimeType?: string;
  body?: { data?: string };
  parts?: Part[];
  headers?: { name: string; value: string }[];
}

const MAX_ATTEMPTS = 6;

/** Appel Gmail avec attente exponentielle sur les limites de débit (429, 403 « quota exceeded »). */
async function get<T>(token: string, path: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${API}${path}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (response.ok) return (await response.json()) as T;
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    const message = body.error?.message ?? "";
    const rateLimited =
      response.status === 429 || (response.status === 403 && /quota|rate limit/i.test(message));
    if (!rateLimited || attempt >= MAX_ATTEMPTS)
      throw new Error(`Gmail ${response.status} sur ${path.split("?")[0]} : ${message}`);
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

function collectBodies(part: Part, out: { html: string[]; plain: string[] }): void {
  const data = part.body?.data;
  if (data) {
    const decoded = Buffer.from(data, "base64url").toString("utf8");
    if (part.mimeType === "text/html") out.html.push(decoded);
    else if (part.mimeType === "text/plain") out.plain.push(decoded);
  }
  for (const child of part.parts ?? []) collectBodies(child, out);
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
};

function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractUrls(html: string, text: string): string[] {
  const hrefs = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1] ?? "");
  const bare = [...text.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0]);
  return [...new Set([...hrefs, ...bare].map((u) => u.replace(/&amp;/g, "&")))].filter((u) =>
    u.startsWith("http"),
  );
}

export async function listMessageIds(token: string, query: string, max: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(Math.min(100, max - ids.length)),
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await get<{ messages?: { id: string }[]; nextPageToken?: string }>(
      token,
      `/messages?${params}`,
    );
    ids.push(...(page.messages ?? []).map((m) => m.id));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids;
}

/** En-têtes seuls (expéditeur, sujet) : permet de décider sans lire le contenu (ADR 0013). */
export async function getMessageHeader(
  token: string,
  id: string,
): Promise<{ id: string; date: Date; from: string; subject: string }> {
  const message = await get<{ id: string; internalDate: string; payload: Part }>(
    token,
    `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
  );
  const header = (name: string) =>
    message.payload.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
  return {
    id: message.id,
    date: new Date(Number(message.internalDate)),
    from: header("from"),
    subject: header("subject"),
  };
}

export async function getMessage(token: string, id: string): Promise<MailMessage> {
  const message = await get<{ id: string; threadId: string; internalDate: string; payload: Part }>(
    token,
    `/messages/${id}?format=full`,
  );
  const header = (name: string) =>
    message.payload.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
  const bodies = { html: [] as string[], plain: [] as string[] };
  collectBodies(message.payload, bodies);
  const html = bodies.html.join("\n");
  const text = bodies.plain.length > 0 ? bodies.plain.join("\n") : htmlToText(html);
  return {
    id: message.id,
    threadId: message.threadId,
    date: new Date(Number(message.internalDate)),
    from: header("from"),
    subject: header("subject"),
    text,
    urls: extractUrls(html, text),
  };
}
