/**
 * A character's account, as its registry entry gives it: a DID and a handle.
 *
 * The two are one identity on atproto (the DID document names the handle, and
 * the handle resolves back to the DID), so they live together on the entry
 * beside the id they belong to, and are checked the same way.
 *
 * Pinakes carries both onto the profile record and checks their syntax; it
 * never mints, registers or resolves either. Resolving needs the network, and
 * `lint` and `compile` stay offline and deterministic: whether the handle
 * resolves to the DID the registry names is a check for publish time, the one
 * step that goes to the network.
 *
 * The compiler and the linter both read the fields through `readAccountField`,
 * so the value a profile carries is always the value `lint` checked.
 */
import { isAtprotoDid } from '@atproto/did';

export type AccountFieldName = 'did' | 'handle';

export const ACCOUNT_FIELDS: readonly AccountFieldName[] = ['did', 'handle'];

export type AccountField =
  | { kind: 'absent' }
  | { kind: 'valid'; value: string }
  | { kind: 'invalid'; value: unknown; reason: string };

/**
 * A handle here is the account's first DNS label, without the domain
 * (`emmacooks` for `emmacooks.supperclubsecrets.com`): the universe's domain is
 * a publishing decision, kept out of every compiled record.
 */
const HANDLE_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function readAccountField(entry: Record<string, unknown> | undefined, name: AccountFieldName): AccountField {
  const value = entry?.[name];
  if (value === undefined || value === null || value === '') return { kind: 'absent' };
  // A list, a map or a number is a mistake, not an absence: skipping it would
  // publish the profile without it and say nothing.
  if (typeof value !== 'string') {
    return { kind: 'invalid', value, reason: 'it is not a string (quote it in YAML)' };
  }
  return name === 'did' ? checkDid(value) : checkHandle(value);
}

function checkDid(value: string): AccountField {
  const did = value.trim();
  if (isAtprotoDid(did)) return { kind: 'valid', value: did };
  const reason = /^did:(plc|web):/.test(did)
    ? did.startsWith('did:plc:')
      ? 'a did:plc is `did:plc:` and 24 lower-case base32 characters'
      : 'a did:web names a bare hostname, with no path, and no port except on localhost'
    : 'atproto accepts only did:plc and did:web';
  return { kind: 'invalid', value, reason };
}

function checkHandle(value: string): AccountField {
  // Authors type handles the way they read them, so a leading `@` is not part
  // of the handle.
  const handle = value.trim().replace(/^@/, '');
  if (HANDLE_LABEL.test(handle)) return { kind: 'valid', value: handle };
  const reason = handle.includes('.')
    ? 'a handle here is the first label only, without the domain: `emmacooks`, not `emmacooks.example.com`'
    : 'a handle is letters, digits and hyphens, at most 63, not starting or ending with a hyphen';
  return { kind: 'invalid', value, reason };
}
