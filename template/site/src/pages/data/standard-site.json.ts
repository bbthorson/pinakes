import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE_CONFIG, publicationUri, documentUri } from '../../lib/standard-site';

/**
 * `/data/standard-site.json` — standard.site diagnostics
 */
export const GET: APIRoute = async () => {
  const chapters = await getCollection('chapters');
  
  const documents = chapters.map((c) => ({
    uri: documentUri('book1', c.data.chapter, c.data.publishDate),
    record: {
      $type: 'site.standard.document',
      site: publicationUri(),
      path: `/books/book1/read/${c.data.chapter}`,
      title: c.data.title,
      description: SITE_CONFIG.description,
      publishedAt: c.data.publishDate ? c.data.publishDate.toISOString() : undefined,
    },
  }));

  return new Response(
    JSON.stringify(
      {
        identity: { handle: SITE_CONFIG.handle, did: SITE_CONFIG.did },
        publication: {
          uri: publicationUri(),
          record: {
            $type: 'site.standard.publication',
            name: SITE_CONFIG.name,
            description: SITE_CONFIG.description,
          },
        },
        documents,
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
