/**
 * The starter site's standard.site AT-URIs (template/site/src/lib/standard-site.ts).
 *
 * site.standard.publication and site.standard.document both key records by TID,
 * so the rkeys the site renders (in its well-known file and each chapter's
 * link tag) must be TIDs, and the same ones on every build: whatever writes the
 * records derives them the same way.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ATPROTO_DID = 'did:plc:abcdefghijklmnopqrstuvwx';
process.env.PUBLICATION_AT = '2026-10-01T10:00:00-04:00';
const site = await import('../../template/site/src/lib/standard-site.ts');

const TID = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;
const rkey = (uri: string | null) => uri?.split('/').pop() ?? '';

test('the publication and document rkeys are TIDs, stable across builds', () => {
  const pub = site.publicationUri();
  assert.match(rkey(pub), TID, `${pub} does not end in a TID`);
  assert.equal(site.publicationUri(), pub);

  const at = new Date('2026-10-04T22:30:00-04:00');
  const ch1 = site.documentUri('book1', 1, at);
  const ch2 = site.documentUri('book1', 2, at);
  assert.match(rkey(ch1), TID, `${ch1} does not end in a TID`);
  assert.equal(site.documentUri('book1', 1, at), ch1);
  assert.notEqual(ch1, ch2, 'two chapters served at the same moment keep distinct rkeys');
});

test('a chapter with no publish time has no document URI', () => {
  assert.equal(site.documentUri('book1', 1), null);
});
