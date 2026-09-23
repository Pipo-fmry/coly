/** Lecture Gmail via l'API REST. Le corps des emails reste en mémoire (ADR 0006). */

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Filtre côté serveur : seuls les emails probablement liés à une commande ou un colis sont téléchargés. */
export function buildQuery(days: number): string {
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
  return `newer_than:${days}d -in:chats {${keywords.map((k) => `subject:${k}`).join(" ")}}`;
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

async function get<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Gmail ${response.status} sur ${path.split("?")[0]}`);
  return (await response.json()) as T;
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
