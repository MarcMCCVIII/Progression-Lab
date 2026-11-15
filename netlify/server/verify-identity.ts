// Identity validates signature, expiry, and account status. Never decode a JWT to establish ownership.
export async function verifyIdentity(
  request: Request,
  identityUrl: string | undefined,
  fetcher = fetch,
): Promise<string | null> {
  const session = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("nf_jwt="))
    ?.slice(7);
  if (!session) return null;
  if (!identityUrl) throw new Error("Identity is unavailable");
  const verified = await fetcher(`${identityUrl}/user`, {
    headers: { Authorization: `Bearer ${decodeURIComponent(session)}` },
    signal: AbortSignal.timeout(10000),
  });
  if (verified.status === 401 || verified.status === 403) return null;
  if (!verified.ok) throw new Error("Identity is unavailable");
  const user = await verified.json();
  return typeof user.id === "string" && user.confirmed_at ? user.id : null;
}
