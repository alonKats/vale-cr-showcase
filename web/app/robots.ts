import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-static';

/* The AI crawlers, named. Two honest notes before the list:
 *
 * 1. THIS CHANGES NOTHING TODAY. `User-agent: *  Allow: /` already permits every
 *    one of these, and none of them was ever blocked. Naming them is not a fix
 *    and should not be reported as one.
 *
 * 2. It is still worth the bytes, for one reason: the day someone tightens `*`
 *    — to shed crawl load, to block a scraper, to add a Disallow — the AI
 *    surfaces would go dark silently, and nothing in the repo would record that
 *    they were ever wanted. An explicit rule makes that a visible diff instead
 *    of an invisible consequence. Same failure class as the R2 cutover that a
 *    cron undid without logging anything (2026-08-09).
 *
 * Both retrieval bots (which produce citations, i.e. traffic) and training bots
 * (which produce model familiarity, i.e. being the site an LLM names unprompted)
 * are allowed. We publish retailer prices we read in public and a method we
 * document; there is no asset here that withholding protects, and for a brand
 * nobody has heard of, presence in both is upside. */
const AI_AGENTS = [
  // OpenAI — OAI-SearchBot builds the ChatGPT search index (citations),
  // ChatGPT-User is a user-initiated fetch, GPTBot is training.
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  // Anthropic
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  // Perplexity
  'PerplexityBot',
  'Perplexity-User',
  // Google's AI surfaces. Distinct from Googlebot: absence of this token is
  // read as consent, so declaring it is a statement, not a permission grant.
  'Google-Extended',
  // Apple, Meta, Amazon, Common Crawl (which feeds many downstream models)
  'Applebot',
  'Applebot-Extended',
  'meta-externalagent',
  'Amazonbot',
  'CCBot',
];

export default function robots(): MetadataRoute.Robots {
  // /buscar's own state lives in query strings that produce no new content — a
  // crawler following them would find the same products under an unbounded
  // number of URLs. The canonical on /buscar says the same thing; this says it
  // before the crawl budget is spent. It applies to the AI crawlers too: an
  // answer engine that indexes 400 permutations of one result set learns
  // nothing and costs us the same budget.
  const disallow = ['/buscar?'];

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      { userAgent: AI_AGENTS, allow: '/', disallow },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
