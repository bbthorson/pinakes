import { isConstraintActive } from './brief.js';
function normalizeProbs(probs) {
    const entries = Object.entries(probs).map(([k, v]) => [k, Math.max(0, Number(v) || 0)]);
    const sum = entries.reduce((acc, [, v]) => acc + v, 0);
    const out = {};
    if (sum <= 0) {
        const u = entries.length ? 1 / entries.length : 0;
        for (const [k] of entries)
            out[k] = u;
        return out;
    }
    for (const [k, v] of entries)
        out[k] = v / sum;
    return out;
}
function topOf(probs) {
    let topLabel;
    let topProbability = -1;
    for (const [k, v] of Object.entries(probs)) {
        if (v > topProbability) {
            topProbability = v;
            topLabel = k;
        }
    }
    return topLabel !== undefined ? { topLabel, topProbability } : {};
}
function optionsFor(q) {
    if (q.type === 'binary')
        return q.options?.length ? q.options : ['yes', 'no'];
    if (q.type === 'scale') {
        const [lo, hi] = q.scale ?? [1, 10];
        const out = [];
        for (let i = lo; i <= hi; i++)
            out.push(String(i));
        return out;
    }
    return q.options ?? [];
}
function expectedScaleValue(probs) {
    let acc = 0;
    let total = 0;
    for (const [k, p] of Object.entries(probs)) {
        const n = Number(k);
        if (Number.isFinite(n)) {
            acc += n * p;
            total += p;
        }
    }
    return total > 0 ? acc / total : undefined;
}
/**
 * Parses a Clef / Workers AI / Jev-API response into `ScoredAnswer[]`.
 * Accepts:
 * - `{ result: { answers: [...] } }` (Workers AI envelope)
 * - `{ answers: [...] }` (direct Jev-API)
 * - `{ result: [...] }` or raw array `[...]`
 */
export function parseClefResponse(payload, questions) {
    const container = payload?.result ?? payload;
    const rawList = Array.isArray(container)
        ? container
        : Array.isArray(container?.answers)
            ? container.answers
            : Array.isArray(container?.results)
                ? container.results
                : [];
    return questions.map((q, idx) => {
        const opts = optionsFor(q);
        const hit = rawList.find((a) => a?.id === q.id) ?? rawList[idx];
        let probs = {};
        if (hit && typeof hit.probabilities === 'object' && hit.probabilities !== null) {
            for (const opt of opts) {
                probs[opt] = Number(hit.probabilities[opt] ?? hit.probabilities[opt.toLowerCase()] ?? 0);
            }
            // Preserve any keys present if opts was empty
            if (opts.length === 0) {
                for (const [k, v] of Object.entries(hit.probabilities))
                    probs[k] = Number(v) || 0;
            }
        }
        else if (hit && typeof hit.probability === 'number' && q.type === 'binary') {
            const pYes = Math.max(0, Math.min(1, hit.probability));
            probs = { [opts[0] ?? 'yes']: pYes, [opts[1] ?? 'no']: 1 - pYes };
        }
        else if (hit && Array.isArray(hit.scores) && hit.scores.length === opts.length) {
            opts.forEach((opt, i) => {
                probs[opt] = Number(hit.scores[i]) || 0;
            });
        }
        else {
            // Uniform fallback when an answer is missing
            for (const opt of opts)
                probs[opt] = 1;
        }
        const normalized = normalizeProbs(probs);
        const expectedValue = typeof hit?.expectedValue === 'number'
            ? hit.expectedValue
            : q.type === 'scale'
                ? expectedScaleValue(normalized)
                : undefined;
        return {
            id: q.id,
            probabilities: normalized,
            ...(expectedValue !== undefined ? { expectedValue } : {}),
            ...topOf(normalized),
            raw: hit,
        };
    });
}
/**
 * First-class Cloudflare Clef / Jev-API decision-model adapter.
 * Supports `@cf/cloudflare/clef`, `@cf/cloudflare/clef-flash`, or any
 * Jev-API-compatible self-hosted endpoint.
 */
export class CloudflareClefScorer {
    name;
    model;
    endpoint;
    accountId;
    apiToken;
    fetchImpl;
    constructor(options = {}) {
        this.model = options.model ?? '@cf/cloudflare/clef';
        this.name = `clef:${this.model}`;
        this.endpoint = options.endpoint;
        this.accountId = options.accountId;
        this.apiToken = options.apiToken;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }
    async score(request) {
        if (request.questions.length === 0)
            return [];
        if (request.questions.length > 64) {
            throw new Error(`Clef supports at most 64 questions per pass; received ${request.questions.length}.`);
        }
        const model = request.model ?? this.model;
        const url = this.endpoint ??
            (this.accountId
                ? `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${model}`
                : undefined);
        if (!url) {
            throw new Error('CloudflareClefScorer requires either `endpoint` or `accountId` (e.g. CLOUDFLARE_ACCOUNT_ID).');
        }
        const headers = { 'Content-Type': 'application/json' };
        if (this.apiToken)
            headers['Authorization'] = `Bearer ${this.apiToken}`;
        const body = {
            context: request.context,
            questions: request.questions.map((q) => ({
                id: q.id,
                type: q.type === 'move-choice' ? 'enum' : q.type,
                question: q.prompt,
                options: optionsFor(q),
                ...(q.scale ? { scale: q.scale } : {}),
            })),
        };
        const res = await this.fetchImpl(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Clef scorer HTTP ${res.status}: ${text.slice(0, 300)}`);
        }
        const json = await res.json();
        return parseClefResponse(json, request.questions);
    }
}
/**
 * Deterministic local/offline scorer for tests and credential-free runs.
 * Returns fixture probabilities if supplied for a question id, otherwise a
 * clean deterministic distribution.
 */
export class MockDecisionScorer {
    name;
    fixtures;
    constructor(fixtures = {}, name = 'mock') {
        this.fixtures = fixtures;
        this.name = name;
    }
    async score(request) {
        return request.questions.map((q) => {
            const opts = optionsFor(q);
            const fix = this.fixtures[q.id];
            let probs = {};
            if (fix) {
                probs = normalizeProbs(fix);
            }
            else if (q.type === 'move-choice') {
                probs = normalizeProbs({ A: 0.5, B: 0.3, C: 0.2 });
            }
            else if (q.type === 'binary') {
                probs = normalizeProbs({ [opts[0] ?? 'yes']: 0.1, [opts[1] ?? 'no']: 0.9 });
            }
            else if (q.type === 'scale') {
                const [lo, hi] = q.scale ?? [1, 10];
                const mid = Math.round((lo + hi) / 2);
                for (const opt of opts)
                    probs[opt] = Number(opt) === mid ? 0.7 : 0.3 / Math.max(1, opts.length - 1);
                probs = normalizeProbs(probs);
            }
            else {
                for (const opt of opts)
                    probs[opt] = 1;
                probs = normalizeProbs(probs);
            }
            const expectedValue = q.type === 'scale' ? expectedScaleValue(probs) : undefined;
            return {
                id: q.id,
                probabilities: probs,
                ...(expectedValue !== undefined ? { expectedValue } : {}),
                ...topOf(probs),
            };
        });
    }
}
/**
 * Generic OpenAI-compatible chat-completions JSON fallback scorer for local
 * workflows without Workers AI credentials.
 */
export class GenericLlmScorer {
    name;
    endpoint;
    model;
    apiKey;
    fetchImpl;
    constructor(options) {
        this.endpoint = options.endpoint;
        this.model = options.model;
        this.name = `llm:${options.model}`;
        this.apiKey = options.apiKey;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }
    async score(request) {
        if (request.questions.length === 0)
            return [];
        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey)
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        const systemPrompt = 'You are a calibrated probability scorer. Respond ONLY with a JSON object of the form ' +
            '{"answers":[{"id":"<questionId>","probabilities":{"<option>":0.5,...}}]}. Probabilities per question must sum to 1.';
        const userPrompt = JSON.stringify({
            context: request.context,
            questions: request.questions.map((q) => ({
                id: q.id,
                type: q.type,
                prompt: q.prompt,
                options: optionsFor(q),
            })),
        });
        const res = await this.fetchImpl(this.endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: request.model ?? this.model,
                temperature: 0,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
            }),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`GenericLlmScorer HTTP ${res.status}: ${text.slice(0, 300)}`);
        }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content ?? '{}';
        const parsed = typeof content === 'string' ? JSON.parse(content) : content;
        return parseClefResponse(parsed, request.questions);
    }
}
export function createDecisionScorer(config, override) {
    const cfg = config.probabilistic.scorer;
    const prov = override?.provider ?? cfg.provider;
    if (prov === 'mock') {
        return new MockDecisionScorer(override?.mockFixtures);
    }
    if (prov === 'llm') {
        const endpoint = cfg.llmEndpoint ?? 'https://api.openai.com/v1/chat/completions';
        const model = override?.model ?? cfg.llmModel ?? 'gpt-4o-mini';
        const apiKey = process.env[cfg.llmApiKeyEnv];
        return new GenericLlmScorer({ endpoint, model, apiKey, fetchImpl: override?.fetchImpl });
    }
    const model = override?.model ?? (prov === 'clef-flash' ? cfg.flashModel : cfg.model);
    const accountId = process.env[cfg.accountIdEnv];
    const apiToken = process.env[cfg.apiTokenEnv];
    return new CloudflareClefScorer({
        model,
        endpoint: cfg.endpoint,
        accountId,
        apiToken,
        fetchImpl: override?.fetchImpl,
    });
}
/**
 * Scores a 3-Move Character Brief (returning `[pA, pB, pC]`) and evaluates
 * `doNotReveal` binary semantic constraint gates in a single batched pass.
 */
export async function scoreBriefWithScorer(scorer, brief, params) {
    const leakThreshold = params.leakThreshold ?? 0.5;
    const activeRules = (params.constraints ?? []).filter((r) => isConstraintActive(r, { book: brief.book, chapter: brief.chapter, asOf: brief.asOf }));
    const movesBlock = brief.moves
        .map((m) => `Move ${m.id}:\n  tactic: ${m.tactic}\n  notice: ${m.notice}\n  say: ${m.say}\n  holdBack: ${m.holdBack}\n  physicalTell: ${m.physicalTell}`)
        .join('\n\n');
    const context = [
        params.contextMarkdown.trim(),
        '',
        '## Scene Setup',
        params.sceneSetup.trim(),
        '',
        '## Candidate Moves',
        movesBlock,
    ].join('\n');
    const questions = [
        {
            id: 'move_choice',
            type: 'move-choice',
            prompt: `Given ${brief.character}'s character state, affect basin, and the scene setup, which candidate move (A, B, or C) is most organically in-character right now?`,
            options: ['A', 'B', 'C'],
        },
    ];
    // Add binary semantic constraint gates for each (move, active rule) pair within the 64-question budget.
    for (const move of brief.moves) {
        for (const rule of activeRules) {
            if (questions.length >= 64)
                break;
            questions.push({
                id: `mask:${move.id}:${rule.id}`,
                type: 'binary',
                prompt: `Does Move ${move.id}'s dialogue, tactic, or physical tell reveal or prematurely hint at the held beat "${rule.id}" (${rule.description})?`,
                options: ['yes', 'no'],
            });
        }
    }
    const answers = await scorer.score({ context, questions });
    const moveAns = answers.find((a) => a.id === 'move_choice');
    const rawProbs = {
        A: moveAns?.probabilities?.A ?? 1 / 3,
        B: moveAns?.probabilities?.B ?? 1 / 3,
        C: moveAns?.probabilities?.C ?? 1 / 3,
    };
    const semanticMask = {};
    for (const move of brief.moves) {
        const reasons = [];
        for (const rule of activeRules) {
            const ans = answers.find((a) => a.id === `mask:${move.id}:${rule.id}`);
            const pLeak = ans?.probabilities?.yes ?? 0;
            if (pLeak >= leakThreshold) {
                reasons.push(`[${rule.id}] semantic leak gate p=${pLeak.toFixed(2)} >= ${leakThreshold} (${rule.description})`);
            }
        }
        if (reasons.length > 0) {
            semanticMask[move.id] = { moveId: move.id, masked: true, reasons };
        }
    }
    return { rawProbs, semanticMask, answers };
}
