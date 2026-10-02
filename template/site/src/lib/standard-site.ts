/**
 * standard.site helper utilities for Pinakes fiction reader.
 *
 * Provides AT-URI resolution for:
 *   1. `/.well-known/site.standard.publication`
 *   2. `<link rel="site.standard.document" href="...">`
 *
 * Both lexicons key their records by TID (`key: "tid"` in site.standard.*'s
 * published schemas), so a name like `self` is not a valid record key. Each
 * rkey here is a TID derived from the record's own time and a fixed seed, so
 * whatever writes the records computes the same AT-URI the site renders,
 * without either telling the other.
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

const B32 = '234567abcdefghijklmnopqrstuvwxyz';

/**
 * A TID: 13 base32-sortable characters over a 64-bit value whose top bit is 0,
 * then 53 bits of microseconds, then a 10-bit clock id. Deterministic: the clock
 * id is a hash of `seed`, so the same record always gets the same rkey, and two
 * records at the same moment stay apart.
 */
export function tid(micros: number, seed: string): string {
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  let v = (BigInt(Math.floor(micros)) << 10n) | BigInt(h % 1024);
  let s = '';
  for (let i = 0; i < 13; i += 1) {
    s = B32[Number(v & 31n)] + s;
    v >>= 5n;
  }
  return s;
}

export function publicationUri(): string | null {
  if (!SITE_CONFIG.did || !SITE_CONFIG.publicationAt) return null;
  const rkey = tid(Date.parse(SITE_CONFIG.publicationAt) * 1000, 'site.standard.publication');
  return `at://${SITE_CONFIG.did}/site.standard.publication/${rkey}`;
}

/** A chapter's document AT-URI, from its publish time; null without one, as a
 *  chapter with no publish time has no record to point at. */
export function documentUri(bookSlug: string, chapter: number | string, publishDate?: Date): string | null {
  if (!SITE_CONFIG.did || !publishDate) return null;
  const rkey = tid(publishDate.getTime() * 1000, `site.standard.document:${bookSlug}:${chapter}`);
  return `at://${SITE_CONFIG.did}/site.standard.document/${rkey}`;
}
