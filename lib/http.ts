// psanw full app/lib/http.ts
export async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function sendJSON<TReq, TRes>(
  url: string,
  body: TReq,
  init?: Omit<RequestInit, "body" | "headers">
): Promise<TRes> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<TRes>;
}
