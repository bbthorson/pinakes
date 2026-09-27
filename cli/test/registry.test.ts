/**
 * Alias collisions in the entity registry. A shared name across types must
 * resolve for each type; a shared name within a type is ambiguous and must be
 * reported, never settled by registry order.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, run, withUniverse } from './helpers.ts';

const CH1 = 'stories/01_book/chapters/01_one.md';

const chapterWith = ({ location, present }: { location: string; present: string[] }) => `---
chapter: 1
title: One
date: "2026-10-01"
location: ["${location}"]
pov: Emma
characters_present: [Emma, ${present.map((p) => `"${p}"`).join(', ')}]
---
Body.
`;

test('a character and a place may share a name', () => {
  // The place is registered after the character: under a single alias map it
  // overwrote the character, and "Paris" stopped resolving as a character.
  const registry = `characters:
  - { id: char.emma, type: character, displayName: Emma }
  - { id: char.paris, type: character, displayName: Paris }
places:
  - { id: place.paris, type: place, displayName: Paris }
`;
  withUniverse(
    { 'codex/entities.yaml': registry, [CH1]: chapterWith({ location: 'Paris', present: ['Paris'] }) },
    (root) => {
      const lint = run(root, 'lint');
      assert.equal(lint.status, 0, lint.output);
      assert.equal(run(root, 'compile').status, 0);
      const [scene] = readJson(root, 'records/book1/scenes.json');
      assert.deepEqual(scene.placeRefs, ['place.paris']);
      assert.deepEqual(scene.participants, ['char.emma', 'char.paris']);
    }
  );
});

test('an alias two characters claim is ambiguous and resolves to neither', () => {
  const registry = `characters:
  - { id: char.emma, type: character, displayName: Emma }
  - { id: char.sam, type: character, displayName: Sam, aliases: [the kid] }
  - { id: char.max, type: character, displayName: Max, aliases: [The Kid] }
places:
  - { id: place.bar, type: place, displayName: The Bar }
`;
  withUniverse(
    { 'codex/entities.yaml': registry, [CH1]: chapterWith({ location: 'The Bar', present: ['the kid'] }) },
    (root) => {
      const lint = run(root, 'lint');
      assert.equal(lint.status, 1);
      assert.match(lint.output, /entities\.yaml[\s\S]*\[ambiguous-alias\] 🔴 ERROR: Alias 'the kid' is claimed by more than one character: char\.sam, char\.max/);
      assert.match(lint.output, /Ambiguous reference to character 'the kid' in field 'characters_present': it could be char\.sam or char\.max/);

      const compile = run(root, 'compile');
      assert.equal(compile.status, 1);
      assert.match(compile.output, /\[ambiguous-alias\]/);
      const [scene] = readJson(root, 'records/book1/scenes.json');
      assert.deepEqual(scene.participants, ['char.emma']);
    }
  );
});

test('an ambiguous alias is not excused by non_entities.yaml', () => {
  const registry = `characters:
  - { id: char.emma, type: character, displayName: Emma }
  - { id: char.sam, type: character, displayName: Sam, aliases: [the kid] }
  - { id: char.max, type: character, displayName: Max, aliases: [the kid] }
places:
  - { id: place.bar, type: place, displayName: The Bar }
`;
  withUniverse(
    {
      'codex/entities.yaml': registry,
      'codex/non_entities.yaml': 'people:\n  - the kid\n',
      [CH1]: chapterWith({ location: 'The Bar', present: ['the kid'] }),
    },
    (root) => {
      const { status, output } = run(root, 'lint');
      assert.equal(status, 1);
      assert.match(output, /Ambiguous reference to character 'the kid'/);
    }
  );
});

test('an id registered twice is an error', () => {
  const registry = `characters:
  - { id: char.emma, type: character, displayName: Emma }
  - { id: char.emma, type: character, displayName: Emma Two }
places:
  - { id: place.bar, type: place, displayName: The Bar }
`;
  withUniverse({ 'codex/entities.yaml': registry }, (root) => {
    const { status, output } = run(root, 'lint');
    assert.equal(status, 1);
    assert.match(output, /\[duplicate-id\] 🔴 ERROR: Entity id 'char\.emma' is registered more than once/);
  });
});

test('an entity repeating its own name as an alias is not a conflict', () => {
  const registry = `characters:
  - { id: char.emma, type: character, displayName: Emma, aliases: [emma, EMMA, char.emma] }
places:
  - { id: place.bar, type: place, displayName: The Bar }
`;
  withUniverse({ 'codex/entities.yaml': registry }, (root) => {
    const { status, output } = run(root, 'lint');
    assert.equal(status, 0, output);
  });
});

test('a registry entry that fails validation is an error, not a silent skip', () => {
  // The entry was dropped with a console warning and lint passed, leaving
  // Sam unresolvable with nothing in the report to say why.
  const registry = `characters:
  - { id: char.emma, type: character, displayName: Emma }
  - { type: character, displayName: Sam }
places:
  - { id: place.bar, type: place, displayName: The Bar }
`;
  withUniverse({ 'codex/entities.yaml': registry }, (root) => {
    const lint = run(root, 'lint');
    assert.equal(lint.status, 1, lint.output);
    assert.match(
      lint.output,
      /entities\.yaml[\s\S]*\[invalid-registry-entry\] 🔴 ERROR: Entry 2 under 'characters' is not a valid entity \(id: /
    );
    assert.doesNotMatch(lint.output, /Warning: failed to parse registry item/);

    const compile = run(root, 'compile');
    assert.equal(compile.status, 1, compile.output);
    assert.match(compile.output, /\[invalid-registry-entry\]/);
  });
});
