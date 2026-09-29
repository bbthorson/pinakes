---
title: "Using Pinakes as a library"
---

The commands are also exported as functions, for editor plugins, sites, and
build scripts. They return what the CLI would print instead of printing it,
and they never exit the process.

```js
import { openUniverse, lint, compile, context, proseCheck, renderContextMarkdown } from '@bbthorson/pinakes';

const universe = openUniverse('./my-universe');   // reads pinakes.yaml and the registry once

const { ok, diagnostics } = lint(universe);        // ok === false exactly when `pinakes lint` exits 1
const { records } = compile(universe);             // in memory; nothing written
compile(universe, { write: true });                // what `pinakes compile` does, pruning included

const { bundle, errors } = context(universe, 'Jasper', '2026-10-11');
if (bundle) console.log(renderContextMarkdown(bundle));

const { tells } = proseCheck(universe, { report: 'tells' });
```

Every function also takes a root path in place of an opened universe.

* **`compile` does not write by default.** This is the one place the library
  differs from the CLI. Writing also prunes stale files from `paths.output`,
  and a caller that only wanted records shouldn't find its directory changed.
* **Bad input throws, findings are returned.** A missing or invalid
  `pinakes.yaml` throws, and so does a `proseCheck` whose `story` filter
  matches nothing. Continuity problems come back as `diagnostics`, and a
  character or date that `context` cannot use comes back in `errors`.

The package is ESM-only and ships TypeScript types.
