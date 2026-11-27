/**
 * Native Cloudflare Workers AI adapter for Pinakes DecisionScorer.
 * Calls `env.AI.run(model, ...)` directly with zero external HTTP hop,
 * guarded by a daily KV call quota (`MAX_DAILY_CLEF_CALLS`).
 */
import {
  parseClefResponse,
  type DecisionQuestion,
  type DecisionScoreRequest,
  type DecisionScorer,
  type ScoredAnswer,
} from '@bbthorson/pinakes';
import type { AiBinding } from './types.ts';

export interface WorkersAiClefOptions {
  ai: AiBinding;
  model: string;
  kv?: KVNamespace;
  maxDailyCalls?: number;
}

function optionsFor(q: DecisionQuestion): string[] {
  if (q.type === 'binary') return q.options?.length ? q.options : ['yes', 'no'];
  if (q.type === 'scale') {
    const [lo, hi] = q.scale ?? [1, 10];
    const out: string[] = [];
    for (let i = lo; i <= hi; i++) out.push(String(i));
    return out;
  }
  return q.options ?? [];
}

export class WorkersAiClefScorer implements DecisionScorer {
  public readonly name: string;
  private readonly ai: AiBinding;
  private readonly model: string;
  private readonly kv?: KVNamespace;
  private readonly maxDailyCalls: number;

  constructor(options: WorkersAiClefOptions) {
    this.ai = options.ai;
    this.model = options.model;
    this.name = `workers-ai:${options.model}`;
    this.kv = options.kv;
    this.maxDailyCalls = options.maxDailyCalls ?? 500;
  }

  private async checkAndIncrementQuota(): Promise<void> {
    if (!this.kv || this.maxDailyCalls <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `clef_usage:${today}`;
    const raw = await this.kv.get(key);
    const count = raw ? parseInt(raw, 10) || 0 : 0;
    if (count >= this.maxDailyCalls) {
      throw new Error(
        `Daily Workers AI Clef quota reached (${count}/${this.maxDailyCalls} calls on ${today}).`
      );
    }
    await this.kv.put(key, String(count + 1), { expirationTtl: 60 * 60 * 48 });
  }

  async score(request: DecisionScoreRequest): Promise<ScoredAnswer[]> {
    if (request.questions.length === 0) return [];
    if (request.questions.length > 64) {
      throw new Error(`Clef supports at most 64 questions per pass; received ${request.questions.length}.`);
    }

    await this.checkAndIncrementQuota();

    const model = request.model ?? this.model;
    const payload = {
      context: request.context,
      questions: request.questions.map((q) => ({
        id: q.id,
        type: q.type === 'move-choice' ? 'enum' : q.type,
        question: q.prompt,
        options: optionsFor(q),
        ...(q.scale ? { scale: q.scale } : {}),
      })),
    };

    const result = await this.ai.run(model, payload);
    return parseClefResponse(result, request.questions);
  }
}
