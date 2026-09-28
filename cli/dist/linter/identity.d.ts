export type AccountFieldName = 'did' | 'handle';
export declare const ACCOUNT_FIELDS: readonly AccountFieldName[];
export type AccountField = {
    kind: 'absent';
} | {
    kind: 'valid';
    value: string;
} | {
    kind: 'invalid';
    value: unknown;
    reason: string;
};
export declare function readAccountField(entry: Record<string, unknown> | undefined, name: AccountFieldName): AccountField;
