/**
 * Shared Pinakes MCP (Model Context Protocol) tool registry and JSON-RPC 2.0
 * handler.
 *
 * Designed to run identically on:
 * - Local stdio (`pinakes mcp --mode scene|author`)
 * - Hosted Cloudflare Workers (Streamable HTTP `/mcp/scene` and `/mcp/author`)
 *
 * Firewall enforcement at the protocol boundary:
 * - `mode: 'scene'` exposes ONLY backward-looking, POV-safe tools
 *   (`pinakes_context` locked to `fullState: false`, `pinakes_brief`,
 *   `pinakes_sample`, `pinakes_compose`). It literally cannot call Author-Mode
 *   editorial tools or inspect `interiority/` / future chapters.
 * - `mode: 'author'` exposes the full editorial and canon suite.
 */
import type { Universe } from '../index.js';
import type { DecisionScorer } from '../probabilistic/scorer.js';
export type McpMode = 'scene' | 'author';
export interface McpToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
export interface McpToolCallResult {
    content: {
        type: 'text';
        text: string;
    }[];
    isError?: boolean;
}
export interface McpExtraTool {
    definition: McpToolDefinition;
    handler: (args: Record<string, any>) => Promise<McpToolCallResult>;
}
export interface PinakesMcpServerOptions {
    mode: McpMode;
    version?: string;
    /** Loads or returns the active Universe (local disk or MemoryFS snapshot). */
    getUniverse: () => Promise<Universe> | Universe;
    /** Optional scorer provider (e.g. Cloudflare Workers AI binding or mock). */
    getScorer?: (tier: 'flash' | 'deep') => DecisionScorer | undefined;
    /** Optional host-specific tools (e.g. `pinakes_sync` on Cloudflare Workers). */
    extraTools?: McpExtraTool[];
}
export interface JsonRpcRequest {
    jsonrpc?: string;
    id?: string | number | null;
    method: string;
    params?: Record<string, any>;
}
export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: string | number | null;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}
export declare class PinakesMcpServer {
    private readonly mode;
    private readonly version;
    private readonly getUniverse;
    private readonly getScorer?;
    private readonly extraTools;
    constructor(options: PinakesMcpServerOptions);
    listTools(): McpToolDefinition[];
    callTool(name: string, args?: Record<string, any>): Promise<McpToolCallResult>;
    /**
     * Handles one MCP JSON-RPC 2.0 message. Returns `null` for notifications
     * (messages without an `id`), or a JSON-RPC response object.
     */
    handleJsonRpc(msg: JsonRpcRequest): Promise<JsonRpcResponse | null>;
}
