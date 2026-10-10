/** Anything with a `Headers`-style `get(name)` */
interface HeaderSource {
  get: (name: string) => string | null;
}

// IPv4 / IPv6 characters only — the value is copied into an outgoing header,
// so anything else (whitespace, CR/LF) is dropped rather than forwarded
const ADDRESS_PATTERN = /^[0-9a-fA-F.:]{2,45}$/;

/**
 * The browser's address as the edge reported it. Every backend call is made by
 * this server, so without forwarding it the API's per-IP rate limits would see
 * one address for all users. Cloudflare's header wins (prod sits behind the
 * tunnel); X-Forwarded-For's first entry is the original client.
 */
export const clientIpFrom = (headers: HeaderSource): string | undefined => {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
    headers.get("x-real-ip"),
  ];
  for (const candidate of candidates) {
    const address = candidate?.trim();
    if (address && ADDRESS_PATTERN.test(address)) return address;
  }
  return undefined;
};
