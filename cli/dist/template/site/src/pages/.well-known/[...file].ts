import type { APIRoute } from 'astro';
import { publicationUri } from '../../lib/standard-site';

/**
 * `/.well-known/site.standard.publication` — standard.site domain verification.
 */
export function getStaticPaths() {
  const uri = publicationUri();
  return uri ? [{ params: { file: 'site.standard.publication' }, props: { uri } }] : [];
}

export const GET: APIRoute = ({ props }) =>
  new Response(`${(props as { uri: string }).uri}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
