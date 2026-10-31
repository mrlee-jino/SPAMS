/** Next.js may synthesize request.url with its bind address behind a proxy.
 * Compare Origin to the browser-facing Host, never to an arbitrary forwarded host.
 */
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    ["cross-site", "same-site"].includes(
      request.headers.get("sec-fetch-site") ?? "",
    )
  )
    return false;
  try {
    const url = new URL(origin);
    const host = request.headers.get("host") ?? new URL(request.url).host;
    const forwardedProtocol = request.headers.get("x-forwarded-proto");
    const protocol =
      forwardedProtocol === "https" || forwardedProtocol === "http"
        ? forwardedProtocol + ":"
        : new URL(request.url).protocol;
    return (
      url.origin === origin && url.host === host && url.protocol === protocol
    );
  } catch {
    return false;
  }
}
