import { TEMPORAL_LENSES, renderReviewSliceMarkdown } from '../review/slices.js';
import { renderMarkdown } from '../context/bundle.js';
import { renderCharacterBriefPrompt } from '../probabilistic/brief.js';
import { renderNarratorBundleMarkdown } from '../probabilistic/compose.js';
import { filterLedgerBeforeChapter, renderFirstAppearancesMarkdown } from '../compiler/first-appearances.js';
import { renderMergedFindingsMarkdown } from '../review/findings.js';
import { lint, context, proseCheck, firstAppearances, briefBundles, sampleBrief, composeNarrator, reviewSlices, reviewPrepass, } from '../index.js';
const SCENE_TOOLS = [
    {
        name: 'pinakes_context',
        description: 'Assemble what a character can see as of a story date (Long, Mid, Short, History tiers, looking strictly backward). Supports series codex files and book-scoped guest character stubs.',
        inputSchema: {
            type: 'object',
            properties: {
                character: { type: 'string', description: 'Character registry name or id' },
                asOf: { type: 'string', description: 'Story date, YYYY-MM-DD' },
                story: { type: 'string', description: 'Optional story directory or book key for guest stubs' },
                format: { type: 'string', enum: ['markdown', 'json'], default: 'markdown' },
            },
            required: ['character', 'asOf'],
        },
    },
    {
        name: 'pinakes_brief',
        description: 'Assemble Scene-Mode 3-Move Character Brief prompt bundles for one or more characters. Enforces the information firewall in code (fullState: false, backward-only).',
        inputSchema: {
            type: 'object',
            properties: {
                story: { type: 'string', description: 'Story directory name or book key' },
                chapter: { type: ['number', 'string'], description: 'Target chapter number' },
                asOf: { type: 'string', description: 'Story date, YYYY-MM-DD' },
                characters: { type: 'array', items: { type: 'string' }, description: 'Characters present in the scene' },
                sceneSetup: { type: 'string', description: 'Immediate observable scene setup (no future beats or author secrets)' },
                beatType: { type: 'string', description: 'Optional beat type for briefRouting (e.g. banter, plot-pivot)' },
                format: { type: 'string', enum: ['markdown', 'json'], default: 'markdown' },
            },
            required: ['story', 'chapter', 'asOf', 'characters'],
        },
    },
    {
        name: 'pinakes_sample',
        description: 'Score a 3-Move Character Brief (with Clef or provided rawProbs), apply pre-sampling doNotReveal/heldSecrets masks, plausibility floor, and temperature, and draw deterministically via SHA-256.',
        inputSchema: {
            type: 'object',
            properties: {
                brief: { type: 'object', description: '3-Move Character Brief JSON object' },
                rawProbs: {
                    type: 'object',
                    properties: { A: { type: 'number' }, B: { type: 'number' }, C: { type: 'number' } },
                    description: 'Optional manual raw probabilities; if omitted, uses the configured DecisionScorer',
                },
                sceneSetup: { type: 'string' },
                floor: { type: 'number' },
                temperature: { type: 'number' },
                beatType: { type: 'string' },
                reroll: { type: ['string', 'number'] },
            },
            required: ['brief'],
        },
    },
    {
        name: 'pinakes_compose',
        description: 'Assemble a POV-locked Single Narrator Pen Handoff bundle from winning character moves. Structurally strips notice, holdBack, and tactic from all non-POV characters.',
        inputSchema: {
            type: 'object',
            properties: {
                povCharacter: { type: 'string', description: 'POV character (receives full interiority)' },
                sceneSetup: { type: 'string' },
                winningMoves: {
                    type: 'array',
                    description: 'Array of { character, move } objects',
                    items: { type: 'object' },
                },
                writingGuidePath: { type: 'string' },
                book: { type: 'string' },
                chapter: { type: ['number', 'string'] },
                asOf: { type: 'string' },
                format: { type: 'string', enum: ['markdown', 'json'], default: 'markdown' },
            },
            required: ['povCharacter', 'winningMoves'],
        },
    },
];
const AUTHOR_TOOLS = [
    {
        name: 'pinakes_lint',
        description: 'Run all deterministic continuity, entity-resolution, date, co-presence, stretch, and affect checks.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'pinakes_prose_check',
        description: 'Run mechanical prose triage (AI-tells counts, verbatim hard-signal hits, and chapter closers).',
        inputSchema: {
            type: 'object',
            properties: {
                story: { type: 'string', description: 'Optional story substring filter' },
                report: { type: 'string', enum: ['tells', 'closers', 'all'], default: 'all' },
            },
        },
    },
    {
        name: 'pinakes_first_appearances',
        description: 'Return the deterministic First-Appearance Entity Ledger (firstPresent, firstReferenced, firstNamedOnPage), optionally filtered strictly before a target (book, chapter).',
        inputSchema: {
            type: 'object',
            properties: {
                book: { type: 'string' },
                beforeChapter: { type: ['number', 'string'] },
                format: { type: 'string', enum: ['markdown', 'json'], default: 'markdown' },
            },
        },
    },
    {
        name: 'pinakes_review_slice',
        description: 'Assemble deterministic Author-Mode temporal review slices for one or all 6 lenses (backward-short, backward-mid, backward-long, forward-short, forward-mid, forward-long).',
        inputSchema: {
            type: 'object',
            properties: {
                story: { type: 'string' },
                chapter: { type: ['number', 'string'] },
                lens: { type: 'string', enum: [...TEMPORAL_LENSES, 'all'], default: 'all' },
                format: { type: 'string', enum: ['markdown', 'json'], default: 'markdown' },
            },
            required: ['story', 'chapter'],
        },
    },
    {
        name: 'pinakes_review_prepass',
        description: 'Run the batched Clef-flash -> Clef 27B probabilistic lint pre-pass (held secrets, POV slip, tone ceiling, clue telegraphing, ambiguous prose-check & craftVocabulary triage).',
        inputSchema: {
            type: 'object',
            properties: {
                story: { type: 'string' },
                chapter: { type: ['number', 'string'] },
                plantedClues: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            description: { type: 'string' },
                            lineRef: { type: 'string' },
                        },
                        required: ['id', 'description'],
                    },
                },
                format: { type: 'string', enum: ['markdown', 'json'], default: 'markdown' },
            },
            required: ['story', 'chapter'],
        },
    },
];
function okText(text) {
    return { content: [{ type: 'text', text }] };
}
function errText(message) {
    return { content: [{ type: 'text', text: message }], isError: true };
}
export class PinakesMcpServer {
    mode;
    version;
    getUniverse;
    getScorer;
    extraTools;
    constructor(options) {
        this.mode = options.mode;
        this.version = options.version ?? '1.0.2';
        this.getUniverse = options.getUniverse;
        this.getScorer = options.getScorer;
        this.extraTools = new Map((options.extraTools ?? []).map((t) => [t.definition.name, t]));
    }
    listTools() {
        const base = this.mode === 'author' ? [...SCENE_TOOLS, ...AUTHOR_TOOLS] : [...SCENE_TOOLS];
        const extras = [...this.extraTools.values()].map((t) => t.definition);
        return [...base, ...extras];
    }
    async callTool(name, args = {}) {
        const allowed = new Set(this.listTools().map((t) => t.name));
        if (!allowed.has(name)) {
            return errText(`Tool '${name}' is not available in '${this.mode}' mode (enforced by Pinakes MCP firewall).`);
        }
        const extra = this.extraTools.get(name);
        if (extra) {
            return extra.handler(args);
        }
        try {
            const universe = await this.getUniverse();
            if (name === 'pinakes_context') {
                // Scene mode hard-locks fullState to false.
                const fullState = this.mode === 'author' ? Boolean(args.fullState) : false;
                const res = context(universe, String(args.character), String(args.asOf), {
                    fullState,
                    story: args.story ? String(args.story) : undefined,
                });
                if (!res.bundle)
                    return errText(res.errors.join('\n'));
                return okText(args.format === 'json' ? JSON.stringify(res.bundle, null, 2) : renderMarkdown(res.bundle));
            }
            if (name === 'pinakes_brief') {
                const res = briefBundles(universe, {
                    story: String(args.story),
                    chapter: args.chapter,
                    asOf: String(args.asOf),
                    characters: Array.isArray(args.characters) ? args.characters.map(String) : [],
                    sceneSetup: String(args.sceneSetup ?? ''),
                    beatType: args.beatType ? String(args.beatType) : undefined,
                });
                if (res.errors.length > 0)
                    return errText(res.errors.join('\n'));
                return okText(args.format === 'json'
                    ? JSON.stringify(res.bundles, null, 2)
                    : res.bundles.map(renderCharacterBriefPrompt).join('\n---\n\n'));
            }
            if (name === 'pinakes_sample') {
                const outcome = await sampleBrief(universe, args.brief, {
                    rawProbs: args.rawProbs,
                    scorer: this.getScorer?.('deep'),
                    sceneSetup: args.sceneSetup ? String(args.sceneSetup) : '',
                    floor: args.floor !== undefined ? Number(args.floor) : undefined,
                    temperature: args.temperature !== undefined ? Number(args.temperature) : undefined,
                    beatType: args.beatType ? String(args.beatType) : undefined,
                    reroll: args.reroll,
                });
                if (!outcome.ok || !outcome.log)
                    return errText(outcome.error ?? 'Sampling failed.');
                return okText(JSON.stringify(outcome.log, null, 2));
            }
            if (name === 'pinakes_compose') {
                const res = composeNarrator(universe, {
                    povCharacter: String(args.povCharacter),
                    sceneSetup: String(args.sceneSetup ?? ''),
                    winningMoves: Array.isArray(args.winningMoves) ? args.winningMoves : [],
                    writingGuidePath: args.writingGuidePath ? String(args.writingGuidePath) : undefined,
                    book: args.book ? String(args.book) : undefined,
                    chapter: args.chapter,
                    asOf: args.asOf ? String(args.asOf) : undefined,
                });
                if (!res.bundle || res.errors.length > 0)
                    return errText(res.errors.join('\n'));
                return okText(args.format === 'json'
                    ? JSON.stringify(res.bundle, null, 2)
                    : renderNarratorBundleMarkdown(res.bundle));
            }
            if (name === 'pinakes_lint') {
                const res = lint(universe);
                return okText(JSON.stringify(res, null, 2));
            }
            if (name === 'pinakes_prose_check') {
                const reports = proseCheck(universe, {
                    story: args.story ? String(args.story) : undefined,
                    report: args.report ?? 'all',
                });
                return okText(Object.values(reports).join('\n\n'));
            }
            if (name === 'pinakes_first_appearances') {
                const full = firstAppearances(universe);
                const filtered = args.book && args.beforeChapter !== undefined
                    ? filterLedgerBeforeChapter(full, String(args.book), args.beforeChapter)
                    : full;
                return okText(args.format === 'json'
                    ? JSON.stringify(filtered, null, 2)
                    : renderFirstAppearancesMarkdown(filtered));
            }
            if (name === 'pinakes_review_slice') {
                const lenses = !args.lens || args.lens === 'all' ? [...TEMPORAL_LENSES] : [args.lens];
                const res = reviewSlices(universe, {
                    story: String(args.story),
                    chapter: args.chapter,
                    lenses,
                });
                if (res.errors.length > 0)
                    return errText(res.errors.join('\n'));
                return okText(args.format === 'json'
                    ? JSON.stringify(res.slices, null, 2)
                    : res.slices.map(renderReviewSliceMarkdown).join('\n---\n\n'));
            }
            if (name === 'pinakes_review_prepass') {
                const res = await reviewPrepass(universe, {
                    story: String(args.story),
                    chapter: args.chapter,
                    flashScorer: this.getScorer?.('flash'),
                    deepScorer: this.getScorer?.('deep'),
                    plantedClues: Array.isArray(args.plantedClues) ? args.plantedClues : undefined,
                });
                if (!res.result || res.errors.length > 0)
                    return errText(res.errors.join('\n'));
                return okText(args.format === 'json'
                    ? JSON.stringify(res.result, null, 2)
                    : renderMergedFindingsMarkdown(res.result.merged));
            }
            return errText(`Unknown tool '${name}'.`);
        }
        catch (e) {
            return errText(`Error executing ${name}: ${e?.message ?? String(e)}`);
        }
    }
    /**
     * Handles one MCP JSON-RPC 2.0 message. Returns `null` for notifications
     * (messages without an `id`), or a JSON-RPC response object.
     */
    async handleJsonRpc(msg) {
        const isNotification = msg.id === undefined;
        const id = msg.id ?? null;
        if (msg.method === 'notifications/initialized' || msg.method === 'notifications/cancelled') {
            return null;
        }
        if (msg.method === 'initialize') {
            const protocolVersion = typeof msg.params?.protocolVersion === 'string' ? msg.params.protocolVersion : '2024-11-05';
            return {
                jsonrpc: '2.0',
                id,
                result: {
                    protocolVersion,
                    capabilities: { tools: {} },
                    serverInfo: {
                        name: `pinakes-mcp-${this.mode}`,
                        version: this.version,
                    },
                },
            };
        }
        if (msg.method === 'ping') {
            return { jsonrpc: '2.0', id, result: {} };
        }
        if (msg.method === 'tools/list') {
            return { jsonrpc: '2.0', id, result: { tools: this.listTools() } };
        }
        if (msg.method === 'tools/call') {
            const toolName = String(msg.params?.name ?? '');
            const toolArgs = (msg.params?.arguments ?? {});
            const result = await this.callTool(toolName, toolArgs);
            return { jsonrpc: '2.0', id, result };
        }
        if (isNotification)
            return null;
        return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${msg.method}` },
        };
    }
}
