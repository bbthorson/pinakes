/**
 * The collections must satisfy Keystatic's own types, with no cast.
 *
 * Two declarations once kept them from it, each hiding the next: collection
 * paths typed `string` where Keystatic wants a glob, and `extraFields` typed
 * `Record<string, unknown>`, which put an `unknown` index on every schema. A
 * consumer could only use the collections behind a cast. This file fails
 * `tsc -p test` if either comes back. It imports Keystatic's types only, so
 * nothing of Keystatic loads when the tests run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { config } from '@keystatic/core';
import { createPinakesCollections } from '@bbthorson/pinakes/keystatic';

type Collections = NonNullable<Parameters<typeof config>[0]['collections']>;

const fields = new Proxy({}, { get: () => () => ({}) });

test("createPinakesCollections fits Keystatic's config without a cast", () => {
  const plain: Collections = createPinakesCollections(fields, { storyDir: 'stories/one' });
  const extended: Collections = createPinakesCollections(fields, {
    storyDir: 'stories/one',
    extraFields: { chapters: { clues: {} } },
  });
  assert.ok(plain.chapters && extended.chapters);
});
