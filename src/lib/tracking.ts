/**
 * Public tracking links for a cargo item.
 *
 * The route is deliberately terse (`/t/<code>` rather than `/tracking/<code>`)
 * because the whole URL is encoded into a QR that has to survive being printed
 * at 35×25 mm — shorter payload, fewer modules, better scans.
 */
export function trackingPath(code: string): string {
  return `/t/${code}`;
}

/**
 * Absolute URL to encode into the QR. `origin` should be the browser origin the
 * label is generated from; `NEXT_PUBLIC_APP_URL` overrides it for deployments
 * where staff use an internal hostname that a carrier's phone cannot resolve.
 */
export function trackingUrl(code: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}${trackingPath(code)}`;
}
