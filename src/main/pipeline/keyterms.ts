/**
 * keyterms.ts
 * Domain glossary sent to Deepgram as `keyterm` prompts.
 *
 * Nova-3 biases recognition toward these terms at inference time, which fixes the
 * error class that hurts the edit most: proper nouns and figures rendered as
 * unrelated everyday words. Real examples from processed videos —
 *   "Em medida"    → "A Nvidia"
 *   "ICP clientes" → "S&P 500"
 *   "Pan AI"       → "OpenAI"
 * A garbled name is not just a typo in the subtitles: the EDL model reads the
 * phrase as noise and cuts real content (this cut a whole opening once), and
 * retake matching weakens because two takes of the same line end up with
 * different words.
 *
 * Scope: general finance/tech news vocabulary, since that is what the ASR mangles
 * and what these videos are about. Keyterms only bias — a term that never occurs
 * costs nothing but a few tokens — so a broad list is safe. Deepgram caps the
 * request at 500 tokens; this list is far below that, leaving room to grow.
 *
 * Add terms freely as new ones show up mangled in transcripts. The proper
 * long-term home is a per-user list in settings, so speakers in other domains get
 * their own vocabulary instead of this one.
 */

export const KEYTERMS: readonly string[] = [
  // ── Companies & products ────────────────────────────────────────────────
  'Nvidia', 'OpenAI', 'Anthropic', 'SpaceX', 'Tesla', 'Uber', 'Palantir',
  'Coinbase', 'Mastercard', 'Visa', 'Broadcom', 'Microsoft', 'Apple', 'Amazon',
  'Alphabet', 'Meta', 'TSMC', 'AMD', 'Intel', 'Shell', 'Starlink',

  // ── Markets & instruments ───────────────────────────────────────────────
  'S&P 500', 'Nasdaq', 'Dow Jones', 'Wall Street', 'IPO', 'ETF',
  'obrigações', 'dívida pública', 'taxa de juro', 'Euribor', 'yield',
  'dividendos', 'capitalização bolsista', 'volatilidade',

  // ── Crypto ──────────────────────────────────────────────────────────────
  'Bitcoin', 'Ethereum', 'stablecoin', 'Tether', 'USDT', 'criptomoedas',

  // ── Institutions ────────────────────────────────────────────────────────
  'Reserva Federal', 'Banco Central Europeu', 'IGCP', 'FMI', 'OPEP',

  // ── People ──────────────────────────────────────────────────────────────
  'Elon Musk', 'Sam Altman', 'Donald Trump', 'Warren Buffett', 'Jerome Powell',

  // ── Places that recur in market news ────────────────────────────────────
  'Irão', 'Estreito de Ormuz', 'Taiwan', 'Malásia',

  // ── Tech terms the ASR tends to anglicise badly ─────────────────────────
  'inteligência artificial', 'data center', 'chips', 'semicondutores',
]

/** Deepgram caps keyterms at 500 tokens per request; stay well clear of it. */
export const MAX_KEYTERMS = 200
