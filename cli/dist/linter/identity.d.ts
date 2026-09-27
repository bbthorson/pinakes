export type DidField = {
    kind: 'absent';
} | {
    kind: 'valid';
    did: string;
} | {
    kind: 'invalid';
    value: unknown;
    reason: string;
};
export declare function readDid(entry: {
    did?: unknown;
} | undefined): DidField;
