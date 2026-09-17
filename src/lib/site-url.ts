/**
 * Returns the public URL used in links sent by the authentication provider.
 *
 * `NEXT_PUBLIC_SITE_URL` is available to client components because Next.js
 * inlines public environment variables at build time. Falling back to the
 * browser origin keeps local development working when it is not configured.
 */
export function getSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  return window.location.origin;
}
