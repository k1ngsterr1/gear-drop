import 'server-only';

export function fetchStore(path: string, init?: RequestInit) {
  const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:4000';
  return fetch(new URL(path, apiUrl), { ...init, cache: 'no-store', signal: AbortSignal.timeout(8000) });
}

export async function readStore<T>(path: string, schema: { parse(value: unknown): T }): Promise<T | null> {
  const response = await fetchStore(path);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Store API returned ${response.status}.`);
  return schema.parse(await response.json());
}
