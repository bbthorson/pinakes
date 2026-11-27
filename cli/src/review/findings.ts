/**
 * Standardized editorial ReviewFinding schema, multi-lens convergence
 * detection, and precedence-ordered merging.
 *
 * Precedence order (highest to lowest):
 * 1. `firewall`      — held-secret firewall & compiled reader surfaces
 * 2. `continuity`    — continuity / canon accuracy / POV lock
 * 3. `arc-fair-play` — arc / setup-to-payoff / fair-play provenance
 * 4. `craft`         — prose craft / AI tells / seam polish
 */
import { z } from 'zod';
import { TEMPORAL_LENSES, type TemporalLens } from './slices.js';

export type ReviewLens = TemporalLens | 'probabilistic-lint';
export type FindingSeverity = 'blocker' | 'warn' | 'note';
export type FindingCategory = 'firewall' | 'continuity' | 'arc-fair-play' | 'craft';

export const ReviewFindingSchema = z.object({
  lens: z.enum([...TEMPORAL_LENSES, 'probabilistic-lint']),
  severity: z.enum(['blocker', 'warn', 'note']),
  category: z.enum(['firewall', 'continuity', 'arc-fair-play', 'craft']).optional(),
  lineRef: z.string().min(1),
  issue: z.string().min(1),
  fix: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
});

export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;

export interface MergedReviewFinding extends ReviewFinding {
  category: FindingCategory;
  /** True when 2+ distinct lenses independently flagged overlapping lines. */
  convergent: boolean;
  /** All distinct lenses that converged on this line span. */
  convergentLenses: ReviewLens[];
}

export interface ConvergenceCluster {
  lineSpan: string;
  lenses: ReviewLens[];
  findings: MergedReviewFinding[];
}

export interface MergedReviewReport {
  findings: MergedReviewFinding[];
  convergences: ConvergenceCluster[];
  counts: {
    total: number;
    blocker: number;
    warn: number;
    note: number;
    convergentClusters: number;
  };
}

const CATEGORY_RANK: Record<FindingCategory, number> = {
  firewall: 0,
  continuity: 1,
  'arc-fair-play': 2,
  craft: 3,
};

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  blocker: 0,
  warn: 1,
  note: 2,
};

/** Default precedence category inferred from the lens when not explicitly set. */
export function defaultCategoryForLens(lens: ReviewLens): FindingCategory {
  switch (lens) {
    case 'backward-long':
    case 'forward-long':
      return 'firewall';
    case 'backward-mid':
      return 'continuity';
    case 'forward-short':
    case 'forward-mid':
      return 'arc-fair-play';
    case 'backward-short':
    case 'probabilistic-lint':
      return 'craft';
  }
}

export function parseLineSpan(lineRef: string): { start: number; end: number } | null {
  const m = lineRef.match(/L?(\d+)(?:\s*[-–—]\s*L?(\d+))?/i);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  const b = m[2] ? parseInt(m[2], 10) : a;
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

function spansOverlap(a: { start: number; end: number } | null, b: { start: number; end: number } | null): boolean {
  if (!a || !b) return false;
  return a.start <= b.end && b.start <= a.end;
}

export function mergeReviewFindings(rawFindings: ReviewFinding[]): MergedReviewReport {
  // 1. Deduplicate exact (lens, lineRef, issue) duplicates.
  const deduped: (ReviewFinding & { category: FindingCategory; span: { start: number; end: number } | null })[] = [];
  const seen = new Set<string>();
  for (const f of rawFindings) {
    const key = `${f.lens}::${f.lineRef.trim().toLowerCase()}::${f.issue.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      ...f,
      category: f.category ?? defaultCategoryForLens(f.lens),
      span: parseLineSpan(f.lineRef),
    });
  }

  // 2. Detect multi-lens convergence (2+ distinct lenses flagging overlapping lines).
  const merged: MergedReviewFinding[] = deduped.map((item) => {
    const lenses = new Set<ReviewLens>([item.lens]);
    if (item.span) {
      for (const other of deduped) {
        if (other.lens !== item.lens && spansOverlap(item.span, other.span)) {
          lenses.add(other.lens);
        }
      }
    }
    const lensList = [...lenses];
    const { span: _span, ...rest } = item;
    return {
      ...rest,
      convergent: lensList.length >= 2,
      convergentLenses: lensList,
    };
  });

  // 3. Sort by precedence: category > severity > convergent > line number.
  merged.sort((a, b) => {
    const catDiff = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
    if (catDiff !== 0) return catDiff;
    const sevDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sevDiff !== 0) return sevDiff;
    if (a.convergent !== b.convergent) return a.convergent ? -1 : 1;
    const sa = parseLineSpan(a.lineRef)?.start ?? Number.MAX_SAFE_INTEGER;
    const sb = parseLineSpan(b.lineRef)?.start ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.lens.localeCompare(b.lens);
  });

  // 4. Build convergence clusters for summary display.
  const clusters: { start: number; end: number; findings: MergedReviewFinding[] }[] = [];
  for (const f of merged) {
    if (!f.convergent) continue;
    const span = parseLineSpan(f.lineRef);
    if (!span) continue;
    const existing = clusters.find((c) => spansOverlap(c, span));
    if (existing) {
      existing.start = Math.min(existing.start, span.start);
      existing.end = Math.max(existing.end, span.end);
      existing.findings.push(f);
    } else {
      clusters.push({ start: span.start, end: span.end, findings: [f] });
    }
  }

  const convergences: ConvergenceCluster[] = clusters
    .map((c) => ({
      lineSpan: c.start === c.end ? `L${c.start}` : `L${c.start}-L${c.end}`,
      lenses: [...new Set(c.findings.map((f) => f.lens))],
      findings: c.findings,
    }))
    .filter((c) => c.lenses.length >= 2);

  return {
    findings: merged,
    convergences,
    counts: {
      total: merged.length,
      blocker: merged.filter((f) => f.severity === 'blocker').length,
      warn: merged.filter((f) => f.severity === 'warn').length,
      note: merged.filter((f) => f.severity === 'note').length,
      convergentClusters: convergences.length,
    },
  };
}

export function renderMergedFindingsMarkdown(report: MergedReviewReport): string {
  const out: string[] = [
    '# Six-Lens Review Board Report',
    '',
    `Total findings: **${report.counts.total}** (${report.counts.blocker} blocker, ${report.counts.warn} warn, ${report.counts.note} note) | Multi-lens convergences: **${report.counts.convergentClusters}**`,
    '',
  ];

  if (report.convergences.length > 0) {
    out.push('## Multi-Lens Convergence Highlights', '');
    for (const c of report.convergences) {
      out.push(`- **${c.lineSpan}** flagged independently by ${c.lenses.map((l) => `\`${l}\``).join(', ')}`);
    }
    out.push('');
  }

  if (report.findings.length === 0) {
    out.push('_No findings._', '');
    return out.join('\n');
  }

  out.push('## Findings (Precedence Order: Firewall > Continuity > Arc/Fair-Play > Craft)', '');
  for (const f of report.findings) {
    const conv = f.convergent ? ` **[CONVERGENT: ${f.convergentLenses.join(', ')}]**` : '';
    const conf = f.confidence !== undefined ? ` (p=${f.confidence.toFixed(2)})` : '';
    out.push(`- **[${f.severity.toUpperCase()}]** \`${f.category}\` | \`${f.lens}\` | \`${f.lineRef}\`${conf}${conv}`);
    out.push(`  - **Issue:** ${f.issue}`);
    out.push(`  - **Fix:** ${f.fix}`);
  }
  out.push('');
  return out.join('\n');
}
