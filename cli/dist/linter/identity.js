/**
 * A character's DID, as its codex frontmatter gives it.
 *
 * Pinakes carries a DID onto the profile record and checks its syntax; it
 * never mints or resolves one. Resolving needs the network, and `lint` and
 * `compile` stay offline and deterministic: whether the DID's document agrees
 * with the codex is the publishing layer's check, since that layer owns the
 * accounts.
 *
 * The compiler and the linter both read the field through `readDid`, so the
 * value a profile carries is always the value `lint` checked.
 */
import { isAtprotoDid } from '@atproto/did';
export function readDid(frontmatter) {
    const value = frontmatter?.did;
    if (value === undefined || value === null || value === '')
        return { kind: 'absent' };
    // A list or a map is a mistake, not an absence: skipping it would publish
    // the profile with no DID and say nothing.
    if (typeof value !== 'string') {
        return { kind: 'invalid', value, reason: 'it is not a string' };
    }
    const did = value.trim();
    if (isAtprotoDid(did))
        return { kind: 'valid', did };
    const reason = /^did:(plc|web):/.test(did)
        ? did.startsWith('did:plc:')
            ? 'a did:plc is `did:plc:` and 24 lower-case base32 characters'
            : 'a did:web names a bare hostname, with no path, and no port except on localhost'
        : 'atproto accepts only did:plc and did:web';
    return { kind: 'invalid', value, reason };
}
