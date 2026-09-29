/**
 * standard.site helper utilities for Pinakes fiction reader.
 * 
 * Provides AT-URI resolution for:
 *   1. `/.well-known/site.standard.publication`
 *   2. `<link rel="site.standard.document" href="...">`
 */

export interface StandardSiteConfig {
  did?: string;
  handle?: string;
  publicationAt?: string;
  name?: string;
  description?: string;
}

// Default config; author can override in pinakes.yaml or environment
export const SITE_CONFIG: StandardSiteConfig = {
  did: process.env.ATPROTO_DID || '',
  handle: process.env.ATPROTO_HANDLE || '',
  publicationAt: process.env.PUBLICATION_AT || '2026-10-01T00:00:00Z',
  name: 'Fiction Universe',
  description: 'A Pinakes fiction universe published via standard.site',
};

export function publicationUri(): string | null {
  if (!SITE_CONFIG.did) return null;
  return `at://${SITE_CONFIG.did}/site.standard.publication/self`;
}

export function documentUri(bookSlug: string, chapter: number | string): string | null {
  if (!SITE_CONFIG.did) return null;
  return `at://${SITE_CONFIG.did}/site.standard.document/${bookSlug}-${chapter}`;
}
