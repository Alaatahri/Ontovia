// Service HTTP commun : toute la communication front-end ↔ back-end passe par cette fonction.

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type PydanticError = { loc: (string | number)[]; msg: string };

function formatDetail(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return (detail as PydanticError[])
      .map((e) => `${e.loc.filter((l) => l !== "body").join(".")} : ${e.msg}`)
      .join(" · ");
  }
  return null;
}

// Listes de référence (sélecteurs des formulaires) et exemples NLP : mises en cache dans le navigateur
// et invalidées dès qu'une écriture (POST/PUT/DELETE) a lieu.
const CACHEABLE = ["/references", "/nlp/exemples", "/referentiels"];
const cache = new Map<string, Promise<unknown>>();
// POST qui ne modifient pas le graphe (analyses, questions, raisonnement) : ils ne vident pas le cache.
const READ_ONLY_POSTS = ["/nlp/", "/chat", "/sparql", "/ia/", "/prescriptions/verifier-risques", "/ontologie/raisonner", "/ontologie/ouvrir-protege"];

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? "GET";
  if (method === "GET" && CACHEABLE.includes(path)) {
    if (!cache.has(path)) {
      const pending = request<T>(path, options);
      cache.set(path, pending);
      pending.catch(() => cache.delete(path));
    }
    return cache.get(path) as Promise<T>;
  }
  if (method !== "GET" && !READ_ONLY_POSTS.some((p) => path.startsWith(p))) cache.clear();
  return request<T>(path, options);
}

async function request<T>(path: string, options: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Le back-end est-il démarré ?", 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(formatDetail(data?.detail) ?? `Erreur ${res.status}`, res.status);
  return data as T;
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  });
  const s = search.toString();
  return s ? `?${s}` : "";
}

/** Réponse en flux NDJSON (une ligne JSON par événement) : utilisée par le chat IA pour afficher le texte au fil de l'eau. */
export async function streamNdjson<E>(path: string, body: unknown, onEvent: (e: E) => void, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    throw new ApiError("Impossible de joindre le serveur. Le back-end est-il démarré ?", 0);
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new ApiError(formatDetail(data?.detail) ?? `Erreur ${res.status}`, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.filter((l) => l.trim()).forEach((l) => onEvent(JSON.parse(l) as E));
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as E);
}
