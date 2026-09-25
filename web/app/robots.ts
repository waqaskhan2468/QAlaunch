import { MetadataRoute } from 'next'

/** Paths that should never be indexed by anything: private, transactional, or
 *  per-user. Shared by the wildcard rule and every named agent below. */
const DISALLOW = ['/api/', '/scan/', '/checkout/', '/admin']

/**
 * AI answer-engine crawlers, allowed explicitly.
 *
 * The wildcard rule already permits them, but several of these agents treat an
 * explicit entry as the stronger signal, and Google-Extended in particular is
 * opt-out by convention — naming it makes the intent unambiguous rather than
 * inherited. Being cited by an answer engine does not require ranking in
 * Google's top 10, so this is visibility a low-authority site can actually win.
 */
const AI_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-User',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'meta-externalagent',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      ...AI_AGENTS.map((userAgent) => ({ userAgent, allow: '/', disallow: DISALLOW })),
    ],
    sitemap: 'https://getqalaunch.com/sitemap.xml',
  }
}
