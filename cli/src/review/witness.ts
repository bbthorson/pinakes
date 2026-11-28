/**
 * Witness / off-page knowledge check for `pinakes review --prepass`.
 *
 * Uses compiled `characters_present` (`scene.participants`) from prior chapters
 * in the same book to flag when a character in Chapter N recounts or quotes a
 * specific on-page beat from Chapter N-1 (or earlier) where that character was
 * NOT in `characters_present` and no message/handoff scene or cue bridges them.
 *
 * Findings are emitted as advisory warnings (`severity: 'warn'`) in the
 * `backward-short` lens.
 */
import type { ReviewFinding } from './findings.js';

export interface PriorChapterWitnessInfo {
  chapterNum: number | string;
  title: string;
  /** Canonical character IDs from compiled `characters_present` (`scene.participants`). */
  participants: string[];
  body: string;
  beatPurpose?: string | null;
}

export interface TargetCharacterSurface {
  id: string;
  displayName: string;
  /** Surface forms (displayName + aliases) used to detect attribution in prose. */
  names: string[];
}

export interface WitnessCheckInput {
  targetChapterNum: number | string;
  targetBody: string;
  targetPovId?: string | null;
  targetCharacters: TargetCharacterSurface[];
  /** Prior chapters in the same book, ordered chronologically up to Chapter N-1. */
  priorChapters: PriorChapterWitnessInfo[];
}

const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'almost', 'alone', 'along', 'already', 'also', 'always',
  'among', 'another', 'around', 'asked', 'away', 'back', 'because', 'been', 'before', 'behind',
  'being', 'below', 'between', 'both', 'came', 'cannot', 'come', 'could', 'didn', 'does', 'doing',
  'done', 'dont', 'down', 'during', 'each', 'either', 'else', 'enough', 'even', 'ever', 'every',
  'everything', 'eyes', 'face', 'felt', 'find', 'first', 'from', 'gave', 'getting', 'give', 'going',
  'gone', 'good', 'great', 'hand', 'hands', 'have', 'having', 'head', 'hear', 'heard', 'here',
  'herself', 'himself', 'into', 'itself', 'just', 'keep', 'kept', 'knew', 'know', 'last', 'later',
  'left', 'like', 'little', 'long', 'look', 'looked', 'looking', 'made', 'make', 'making', 'many',
  'maybe', 'mean', 'might', 'moment', 'more', 'most', 'much', 'must', 'myself', 'need', 'never',
  'next', 'night', 'nothing', 'once', 'only', 'open', 'other', 'over', 'part', 'place', 'point',
  'really', 'right', 'room', 'said', 'same', 'says', 'seem', 'seemed', 'seen', 'should', 'side',
  'since', 'small', 'some', 'someone', 'something', 'soon', 'still', 'stood', 'such', 'sure',
  'take', 'taken', 'talk', 'tell', 'than', 'that', 'their', 'them', 'themselves', 'then', 'there',
  'these', 'they', 'thing', 'things', 'think', 'this', 'those', 'though', 'thought', 'three',
  'through', 'time', 'today', 'together', 'told', 'took', 'toward', 'turn', 'turned', 'under',
  'until', 'upon', 'very', 'voice', 'wait', 'walked', 'want', 'wanted', 'wasn', 'watch', 'water',
  'well', 'went', 'were', 'weren', 'what', 'when', 'where', 'which', 'while', 'white', 'whole',
  'will', 'with', 'without', 'word', 'words', 'work', 'would', 'year', 'years', 'your', 'yourself',
]);

const HANDOFF_CUE_RE =
  /\b(texted|text message|messaged|message from|called|phone call|voicemail|emailed|email from|group chat|filled (?:me|him|her|them|us) in|caught (?:me|him|her|them|us) up|told (?:me|him|her|them|us)|heard from|word got|passed along|handoff|briefed|wrote to|note from|letter from|dm'?d|sent (?:a |me |him |her )?(?:text|message|note|photo|screenshot))\b/i;

const RECOUNT_OR_SPEECH_RE =
  /\b(said|asked|replied|whispered|quoted|recalled|remembered|mentioned|told|brought up|repeated|added|muttered|snapped|murmured|recounted|pointed out|observed|reminded|echoed|earlier|last night|yesterday)\b/i;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter(Boolean);
}

function contentTokens(text: string, extraStop: Set<string>): Set<string> {
  const tokens = new Set<string>();
  for (const w of normalizeWords(text)) {
    if (w.length < 4) continue;
    if (STOPWORDS.has(w) || extraStop.has(w)) continue;
    tokens.add(w);
  }
  return tokens;
}

interface ExtractedQuote {
  raw: string;
  words: string[];
  normalized: string;
}

interface ExtractedBeat {
  raw: string;
  tokens: Set<string>;
}

function extractQuotes(body: string): ExtractedQuote[] {
  const out: ExtractedQuote[] = [];
  const re = /["“]([^"”\n]{12,})["”]/g;
  for (const m of body.matchAll(re)) {
    const raw = m[1].trim();
    const words = normalizeWords(raw);
    if (words.length >= 4) {
      out.push({ raw, words, normalized: words.join(' ') });
    }
  }
  return out;
}

function extractBeats(body: string, beatPurpose: string | null | undefined, nameStop: Set<string>): ExtractedBeat[] {
  const out: ExtractedBeat[] = [];
  const candidates: string[] = [];
  if (beatPurpose && beatPurpose.trim()) candidates.push(beatPurpose.trim());
  for (const sentence of body.split(/(?<=[.!?])\s+|\r?\n+/)) {
    const trimmed = sentence.trim();
    if (trimmed.length >= 20) candidates.push(trimmed);
  }
  for (const raw of candidates) {
    const tokens = contentTokens(raw, nameStop);
    if (tokens.size >= 3) {
      out.push({ raw, tokens });
    }
  }
  return out;
}

function buildNameRegex(names: string[]): RegExp | null {
  const clean = names.map((n) => n.trim()).filter((n) => n.length >= 2);
  if (clean.length === 0) return null;
  clean.sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${clean.map(escapeRegex).join('|')})(?![\\p{L}\\p{N}_])`, 'iu');
}

function quoteOverlap(targetNormalized: string, quote: ExtractedQuote): boolean {
  if (targetNormalized.includes(quote.normalized)) return true;
  // Also match any distinctive 4-word contiguous n-gram from the prior quote.
  if (quote.words.length >= 4) {
    for (let i = 0; i <= quote.words.length - 4; i++) {
      const gram = quote.words.slice(i, i + 4).join(' ');
      if (gram.length >= 16 && targetNormalized.includes(gram)) return true;
    }
  }
  return false;
}

function tokenOverlapCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const tok of a) {
    if (b.has(tok)) n++;
  }
  return n;
}

interface LineEntry {
  lineNum: number;
  text: string;
  normalized: string;
  tokens: Set<string>;
}

/**
 * Flags characters in Chapter N who recount or quote a specific on-page beat
 * from an earlier chapter where they were not in `characters_present` and no
 * intervening message/handoff scene bridges them.
 */
export function detectWitnessKnowledgeIssues(input: WitnessCheckInput): ReviewFinding[] {
  if (input.priorChapters.length === 0 || input.targetCharacters.length === 0) return [];

  const nameStop = new Set<string>();
  const charRegexes = new Map<string, RegExp | null>();
  for (const c of input.targetCharacters) {
    charRegexes.set(c.id, buildNameRegex(c.names));
    for (const n of c.names) {
      for (const w of normalizeWords(n)) nameStop.add(w);
    }
  }

  const lines: LineEntry[] = input.targetBody.split(/\r?\n/).map((text, i) => ({
    lineNum: i + 1,
    text,
    normalized: normalizeWords(text).join(' '),
    tokens: contentTokens(text, nameStop),
  }));

  const findings: ReviewFinding[] = [];

  for (let pIdx = 0; pIdx < input.priorChapters.length; pIdx++) {
    const prior = input.priorChapters[pIdx];
    const priorWitnessSet = new Set(prior.participants);
    const priorQuotes = extractQuotes(prior.body);
    const priorBeats = extractBeats(prior.body, prior.beatPurpose, nameStop);
    if (priorQuotes.length === 0 && priorBeats.length === 0) continue;

    // Intervening chapters strictly between `prior` and Chapter N
    const intervening = input.priorChapters.slice(pIdx + 1);

    for (const char of input.targetCharacters) {
      // Character WAS present in the prior chapter — valid witness.
      if (priorWitnessSet.has(char.id)) continue;

      // Check intervening chapters for a co-presence or message/handoff bridge.
      const bridgedByPriorChapter = intervening.some((m) => {
        if (!m.participants.includes(char.id)) return false;
        const sharedWithWitness = m.participants.some((pid) => priorWitnessSet.has(pid));
        if (sharedWithWitness) return true;
        return HANDOFF_CUE_RE.test(m.beatPurpose ?? '') || HANDOFF_CUE_RE.test(m.body);
      });
      if (bridgedByPriorChapter) continue;

      const charRe = charRegexes.get(char.id);
      const witnessRegexes = input.targetCharacters
        .filter((other) => other.id !== char.id && priorWitnessSet.has(other.id))
        .map((other) => charRegexes.get(other.id))
        .filter((re): re is RegExp => Boolean(re));

      let bridgedInTarget = false;
      const witnessIntroducedLines: LineEntry[] = [];
      let reportedForPair = false;

      for (const entry of lines) {
        if (!entry.text.trim()) continue;

        // Track if a handoff/message cue appears in Chapter N before or on this line.
        if (HANDOFF_CUE_RE.test(entry.text)) {
          bridgedInTarget = true;
        }

        const mentionsChar = charRe ? charRe.test(entry.text) : false;
        const mentionsWitness = witnessRegexes.some((re) => re.test(entry.text));

        // If a witness from `prior` speaks or recounts on an earlier line in Chapter N,
        // remember their lines so `char` repeating it afterward is treated as bridged.
        if (mentionsWitness && !mentionsChar) {
          witnessIntroducedLines.push(entry);
          continue;
        }

        if (bridgedInTarget || reportedForPair) continue;

        const attributedToChar =
          mentionsChar ||
          (input.targetPovId === char.id && !mentionsWitness && !witnessRegexes.some((re) => re.test(entry.text)));
        if (!attributedToChar) continue;

        // 1. Direct quote echo from prior chapter
        let matchedSnippet: string | null = null;
        for (const q of priorQuotes) {
          if (!quoteOverlap(entry.normalized, q)) continue;
          const alreadySpokenByWitness = witnessIntroducedLines.some((wl) => quoteOverlap(wl.normalized, q));
          if (!alreadySpokenByWitness) {
            matchedSnippet = q.raw.length > 80 ? q.raw.slice(0, 77) + '...' : q.raw;
            break;
          }
        }

        // 2. Specific on-page beat recounting (requires dialogue or recounting verb + >= 3 shared distinctive tokens)
        if (!matchedSnippet && (/["“]/.test(entry.text) || RECOUNT_OR_SPEECH_RE.test(entry.text))) {
          for (const beat of priorBeats) {
            if (tokenOverlapCount(entry.tokens, beat.tokens) >= 3) {
              const alreadySpokenByWitness = witnessIntroducedLines.some(
                (wl) => tokenOverlapCount(wl.tokens, beat.tokens) >= 3
              );
              if (!alreadySpokenByWitness) {
                matchedSnippet = beat.raw.length > 80 ? beat.raw.slice(0, 77) + '...' : beat.raw;
                break;
              }
            }
          }
        }

        if (matchedSnippet) {
          reportedForPair = true;
          findings.push({
            lens: 'backward-short',
            severity: 'warn',
            category: 'continuity',
            lineRef: `L${entry.lineNum}`,
            issue: `Off-page knowledge check: ${char.displayName} appears to recount or quote a beat from Ch ${prior.chapterNum} ("${matchedSnippet}"), but ${char.displayName} was not in Ch ${prior.chapterNum}'s characters_present and no message/handoff bridge was detected.`,
            fix: `Add a brief message/handoff bridge (e.g., text, call, or witness recounting), attribute the line to a character present in Ch ${prior.chapterNum}, or add ${char.displayName} to Ch ${prior.chapterNum}'s characters_present if they were on-page.`,
          });
        }
      }
    }
  }

  return findings;
}
