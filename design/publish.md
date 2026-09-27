---
title: Publishing — from compiled records to the network
status: proposal
date: 2026-09-27
driver: Supper Club Secrets, Book 1 (live Oct 1 – Oct 31, 2026)
---

# Publishing: from compiled records to the network

## Decisions

The proposal as a whole isn't accepted yet. As each open question in §12 is
settled, it's recorded here with its date. The doc's `status` moves to `accepted`
once the rest is.

- **2026-09-27. Rich content is `at.markpub.markdown`** (§12.1). Chapters are
  already markdown. Every document also carries plain `textContent`.
- **2026-09-27. One `site.standard.publication` per book** (§12.3). Each book
  gets its own cover, logline and theme. A document's `site` therefore
  identifies its book, and the chapter extension needn't repeat it.
- **2026-09-27. No lock gate. `publishDate` is the lock** (§12.5). A chapter
  becomes a document on its `publishDate`, the same moment the site serves it,
  and never before. A chapter edited after it drops is updated in place with
  `updatedAt` set, on the understanding that its earlier text may persist in
  caches. There's no separate `status: locked` field.
- **2026-09-27. Located places may carry a Foursquare id** (§12.7) as a
  `location.fsq` entry, for real public venues only. The record stays keyed by
  its story id.
- **2026-09-27. Key management is out of scope** (§12.8). Pinakes reads and
  checks DIDs. Creating accounts, rotation keys and PLC operations stay with the
  author.

## 1. The gap

The README describes two layers. The inward layer is the codex and prose,
linted. The outward layer is "a public, time-series stream of records projected
onto reader-facing surfaces", with characters as DIDs that own their history.
Pinakes builds the inward layer and stops at `records/`. Every step from
`records/` to the network happens downstream.

Supper Club Secrets is the one universe running that outward layer live, and it
has written about 2,200 lines of its own to do it:

| Downstream file | What it does | Generic? |
| --- | --- | --- |
| `tools/publish_records.mjs` | Horizon publish of scenes, places, profiles, state events and posts to the project repo and each character's repo | Yes, apart from its hard-coded cast and release table |
| `tools/lib/posting.mjs` | XRPC client with a request budget, TIDs, facets, grapheme counts, working out which posts are due, reply threading, threadgates, write-only-what-changed | Mostly. The lane rule and announcements are universe-specific |
| `tools/lib/standard_site.mjs` | `site.standard.publication` and one `site.standard.document` per chapter, written once each page is live | Yes, apart from the theme colours and path template |
| `feed/src/index.js` | A feed generator returning every post by the cast accounts | Yes |
| `tools/publish_feed.mjs`, `tools/set_profile.mjs` | Register the feed; set each account's profile | Yes |
| `poster/src/index.js` | Cron shell: the clock, the secrets, the on/off switches | No. This is the host |

Nearly all of it is Pinakes' own outward layer, written against Pinakes' own
records, kept in sync with Pinakes' generated lexicons by hand. It has already
drifted:

- **Published records fail their own lexicons.** `scene`, `place`,
  `character.profile` and others list `sourceFile` as required. The publish step
  strips it, because it is repo-internal and leaks filenames. So every published
  record is invalid against the lexicon `compile` generated for it.
- **References don't resolve on the network.** Records point at each other
  with local ids (`char.emma`, `scene.book1.ch1`). On a PDS those should be
  AT-URIs (`at://did:plc:…/com.supperclubsecrets.scene/scene.book1.ch1`), which
  only the publish step knows how to form.
- **Lane is a tag.** The public/club split is the most dangerous fact about a
  post, and it rides in `tags` as `lane-public`/`lane-club`. Pinakes has no field
  for it, and hand edits to the generated lexicons are wiped on the next compile.
- **The release calendar is written down twice.** Chapter `publishDate` is the
  authority. `publish_records.mjs` still carries a fallback table of drop times.

The proposal is to move the generic part upstream as `pinakes publish` plus a
runtime-neutral library. The universe keeps only its host (the Worker, cron and
secrets) and its own editorial rules.

## 2. Principles carried over

Each of these is already true downstream and has already caught a real problem.
They become Pinakes' contract.

1. **Dry run is the default.** Nothing writes without `--execute` (CLI) or
   `apply()` (library). A plan is printable, diffable and reviewable before it
   touches a permanent identity.
2. **Publish to a horizon, not from a delta.** Every run asks "what should be
   visible at this instant?" and makes the repos match. Re-running is always
   safe. A missed run or a half-finished one heals itself.
3. **Deterministic record keys.** Every rkey derives from the record's story
   coordinate, or from its own time plus a fixed seed where a lexicon requires a
   TID. Two processes that never talk (a site build and a cron) compute the same
   AT-URI. Record ids are permanent, which already holds for compile.
4. **Write only what's missing or changed.** List what the repo already has and
   compare in canonical form. Sign in only when there is a write to make. (Bluesky
   allows about 300 sign-ins per account per day, and a five-minute cron that
   signed in every run would use 288.)
5. **Three clocks, never conflated.**
   - *Release*: whether a thing exists yet. Chapter `publishDate`, post
     `publishDate` or clock time.
   - *Horizon*: how far into story time the released chapters reach. It is
     derived from release and never read off the wall clock.
   - *Reveal*: whether a particular reader has reached it. This belongs to the
     surface. A repo has no reveal gate, which is why the release gate has to be
     strict.
6. **Fail closed.** An unknown record type is refused (allowlist, not denylist).
   A resolved DID that disagrees with the registry aborts the whole run. A post
   whose lane is missing, doubled or misspelled is withheld. A subject with no
   account is reported, never dropped silently.
7. **A request budget.** Every network call spends from a caller-set budget, and
   running out stops the run cleanly with the oldest work done first. The CLI
   passes Infinity. A Cloudflare Worker passes about 45.
8. **No dependencies on the publish path.** Four or five XRPC calls and `fetch`
   are all it needs. Code that signs records under permanent identities is a bad
   place to inherit a supply chain. It also has to run inside a Worker.

## 3. Where the line falls

| Pinakes owns | The universe owns |
| --- | --- |
| Turning compiled records into their published shape (§4) | Which fields a universe additionally withholds (`publish.strip`) |
| The horizon, release and allowlist logic (§5) | The editorial rules: what a character may post, quiet weeks, lane policy |
| Routing: which record goes to which repo | Which characters have accounts (registry `did`/`handle`) |
| standard.site publication and documents for chapters (§7) | The site itself, its theme colours and its path template |
| Posts as `app.bsky.feed.post`, with threading and facets (§9) | Announcements and other house-account copy |
| A feed-generator handler (§10) | Hosting: Worker, cron, secrets, kill switches |
| Profile and feed registration records | Account creation and credentials, which only the author handles |

The rule of thumb is the same one already in force for lint. Pinakes judges
structure and continuity that any universe would want. A universe's own repo
lints what's specific to it, like SCS's `lint_posts.mjs` grapheme cap and
never-on-the-hour rule.

## 4. The published shape is its own lexicon

Today `compile` emits one shape and generates one lexicon for it. That shape
serves two readers with different needs:

- **The repo** (the site build, lint, `context`) wants provenance (`sourceFile`)
  and local ids.
- **The network** wants no provenance, AT-URI references and only reader-safe
  fields.

Proposal: `compile` keeps emitting the internal shape to `records/`, unchanged.
Publishing projects each record into a **wire shape**:

- `sourceFile` is dropped, and so is any field named in `publish.strip`. SCS strips
  `beat` and `primaryEvent` from scenes, `oneLine` from profiles and `description`
  from places.
- Local ids become AT-URIs by routing (§5): `char.emma` →
  `at://<emma's DID>/<nsid>.character.profile/profile.emma`. A reference to a
  record that isn't published *yet* stays unresolved. The field is omitted
  rather than pointing forward, because a forward pointer leaks the future.
- The generated lexicons in `records/lexicons/` describe the wire shape, since
  those are what other people validate against. `sourceFile` stops being required.
  Reference fields become `format: at-uri`. The internal shape is documented,
  not published as a lexicon.

That fixes the invalid-records problem at its root. It also turns `publish.strip`
into something `compile` can check: stripping a field the wire lexicon requires
is a compile error, not a surprise on the network.

## 5. `pinakes publish`

```sh
pinakes publish -r .                                  # plan at now, print it, write nothing
pinakes publish -r . --at 2026-10-18                  # plan as if it were the end of that day
pinakes publish -r . --at 2026-10-18T08:00:00-04:00   # an exact instant (e.g. the morning of a drop)
pinakes publish -r . --only records,posts,site        # restrict the lanes
pinakes publish -r . --execute                        # write (reads passwords from env)
```

A bare date means the end of that day in the universe's time zone, so it falls
after any evening drop. SCS learned this the hard way: a drop is a moment, not
a day.

**Library** (`@bbthorson/pinakes/publish`, no `fs`, no `process.env`):

```ts
const plan = planPublish(bundle, { at: Date, lanes?: Lane[] });
// → { writes: Write[], held: Held[], skipped: Skipped[], horizon: string | null }
//   Write   = { repo: Did, collection: Nsid, rkey: string, record: object, reason: string }
//   Held    = { id, until: 'release' | 'horizon' | 'profile' | 'live', detail }
//   Skipped = { id, why }   // no account, lane invalid, never on-page …

const result = await applyPublish(plan, {
  password: (acct) => string,   // the host supplies secrets
  budget: 45,                   // Infinity for the CLI
  isLive?: (path) => Promise<boolean>,  // §7 — the host checks its own site
  log?: (line) => void,
});
// → { written, unchanged, waiting, budgetExhausted }
```

`bundle` is the output of a build step: compiled records, the account map and the
publish config, serialized to one JSON file (`pinakes publish --bundle out.json`).
A Worker imports that at build time, which replaces SCS's `poster/scripts/bundle.mjs`
and `feed/scripts/cast.mjs`. `planPublish` is pure, so a host can call it with
no network and show the result. That's how a dashboard or CI summary would render
"what goes out on Sunday".

**Routing:**

| Record | Repo |
| --- | --- |
| `character.profile`, `character.stateEvent`, `character.post` | The subject's own DID. This is what makes a character the author of their own history |
| `scene`, `place`, `item`, `custodyEvent`, standard.site records, feed generator | The project DID |
| `character.stretch` | **Never.** Stretches are authoring state. `publish` refuses them outright, whatever the config says |

**Gates, in order:**

1. *Allowlist.* The type must be publishable.
2. *Release.* A chapter-derived record waits for its sequence's drop, taken from
   chapter `publishDate`. A sequence drops when its last chapter does. No fallback
   table exists: a chapter with no `publishDate` means its records don't publish,
   and the plan says so.
3. *Horizon.* A dated record waits until its `storyDate` is within the horizon.
   A standing record (profile, place) inherits the date of the first released
   scene that references it. A profile always goes before that character's
   first post.
4. *Account.* A subject with no DID is skipped and reported.

**Config** (`pinakes.yaml`):

```yaml
publish:
  timeZone: America/New_York
  pds: https://bsky.social
  project: { did: "did:plc:…", handle: supperclubsecrets.com }
  # Accounts come from the registry: `did:` and `handle:` on an entity.
  strip:
    scene: [beat, primaryEvent]
    character.profile: [oneLine]
    place: [description]
  site:            # §7
    url: https://supperclubsecrets.com
    documentPath: "/books/{book}/read/{chapter}"
```

DIDs move from codex frontmatter into `entities.yaml`, beside the id they
belong to. The registry is already the identity layer. `did` lives there as a
fact about the entity, and the DID guard (resolved DID must equal registry DID)
checks it.

## 6. What "everything visible is on atproto" means

The goal is that every surface a reader sees is a rendering of records that
exist on the network. The site, the Bluesky feeds and any future reader app would
all be views over the same published set. The site doesn't have to fetch from a
PDS to get there. It can keep reading `records/` at build time, because the wire
shape is a pure function of `records/` and the same gates. What changes is the
**invariant**:

> Anything a reader can see on a surface is either a published record or
> derived from one. A surface that shows something no record carries has a gap.

That turns a vague aspiration into something checkable. It also exposes the
current gaps in SCS:

- **Chapter prose.** This lives only on the site. §7 closes it.
- **Place copy.** The site shows `blurbPublic`, `namePublic` and `hoursPublic`
  from codex frontmatter, and the compiler emits none of them. Places publish as
  a name and tags. Proposal: `compile` carries `*Public` frontmatter into the
  record as the reader-facing fields (`name`, `summary`, `hours`), and the
  author-facing `description` stays internal.
- **Character copy.** Same pattern: `personaPublic` and the like are read by the
  site from codex files, not from records.
- **Book metadata.** The logline, title and cover exist only on the site. They
  belong on the `site.standard.publication` record (§7).

A useful follow-on check would be `pinakes lint --surfaces`, which takes a list of
fields a surface reads and fails on any that no wire lexicon carries. That's
worth it only once a second surface exists.

## 7. Chapters as `site.standard.document`

Each served chapter becomes a `site.standard.document` in the project repo, under
one `site.standard.publication` per book (decided, §12.3). **The
document carries the chapter's text**, not just metadata.

This reverses a decision SCS made on purpose. Its `site/src/lib/standard-site.ts`
turns `includeTextContent` off, with the reasoning that full text "would publish
the book as public records and make the canon horizon a website-only courtesy."
Here's how that reasoning holds up:

- *The canon horizon.* A document is written only after its chapter drops and
  its page is live. The network never gets a chapter before the site does, so the
  release gate is intact. What's lost is the **reveal** gate for late readers:
  someone starting in November can reach Chapter 25's record directly. But they can
  already reach Chapter 25's page directly. The site's reveal gate works by
  courtesy too, since every served chapter is a public URL. So this adds no
  new exposure. It moves existing exposure somewhere a reader might stumble on it.
- *Descriptions still never summarize.* A chapter's `description` stays the
  book's logline, never a chapter summary. A summary is a spoiler wherever it's
  syndicated, and it shows up in cards and discovery feeds that a full text
  doesn't.
- *Held secrets.* Published prose is exactly the prose the site already serves,
  so no held material is newly exposed. The strip rules in §4 don't apply to
  prose, because the prose is the reader surface.

**What's new, and has to be accepted with eyes open:**

- **Permanence.** A record can be updated or deleted by rkey, but relays and
  indexers may keep what they saw. A revised chapter's old text should be treated
  as public forever. `publishDate` is the lock (decided, §12.5): the document
  appears when the chapter drops, and a later edit is an update with `updatedAt`
  set.
- **Rights.** Full text in an open data layer is trivially copyable. The
  author should decide the license before the first document goes out (§12.4).
  `site.standard.publication` has no license field, so it has to go somewhere
  else.
- **Size.** The lexicon puts no cap on `textContent`, but PDSes cap record size.
  A 4,000-word chapter is about 25 KB, so there's plenty of room. A compile
  warning on unusually large chapters is enough.

**The record:**

```jsonc
{
  "$type": "site.standard.document",
  "site": "at://<project>/site.standard.publication/<rkey>",
  "path": "/books/book1/read/7",
  "title": "Loose Lips",
  "description": "<the book's logline>",
  "publishedAt": "<chapter publishDate>",
  "updatedAt": "<last revision, if any>",
  "tags": ["fiction", "mystery", "book1"],
  "textContent": "<the whole chapter, plain text>",
  "content": { "$type": "<rich format>", … },        // §12, open
  "coverImage": <blob>,
  "contributors": [{ "did": "<author's DID>", "role": "author" }],
  "bskyPostRef": <strongRef to the drop announcement>,
  "<nsid>.chapter": {                                // an extension object (§12)
    "book": "book1", "chapter": 7, "sequence": 2,
    "sceneRefs": ["at://…/com.supperclubsecrets.scene/scene.book1.ch7"]
  }
}
```

What the lexicon gives us, as published (read from standard.site's own
`com.atproto.lexicon.schema` records, not its docs):

- `textContent` has **no length limit** and is defined as the document's
  plain text, with no markdown. This is the field that carries the prose.
- `content` is an **open union**. The standard leaves the rich format to each
  platform. A survey of 449 live documents found six formats in use
  (`pub.leaflet.content`, `blog.pckt.content`, `app.offprint.content`,
  `at.markpub.markdown` and two others). Most readers outside those platforms
  render `textContent` and ignore `content`. So `textContent` is the one that
  reaches readers, and `content` is an enhancement (§12).
- `bskyPostRef` is a strongRef to a Bluesky post, which the standard names
  as the place comments happen. The obvious target is the house account's "Now
  serving" post for that course, so a chapter's discussion thread sits one hop
  from its text.
- `contributors` carries the author's DID. `updatedAt` marks a revision.
- `site.standard.graph.subscription` lets a reader subscribe to the
  publication. That's the atproto-native version of "follow the book", and it
  needs nothing from us beyond the publication record.

Both the scene record and the document point at each other: the scene's
`chapterRefs` resolve to the document's AT-URI at publish time. The story graph
and the prose join up on the network, not only in the repo.

**Liveness stays with the host.** "Is this page answering 200 yet" is a fact
about the site, not the universe. `applyPublish` takes an `isLive(path)` callback
and holds any document or publication whose page isn't up. The Pinakes CLI can
offer `--check-live <url>` for manual runs.

**What the site owes the standard** stays downstream: the
`/.well-known/site.standard.publication` file and each page's
`<link rel="site.standard.document">` tag. Pinakes exports the rkey/AT-URI
functions so the site computes the same URIs the publisher writes, with nothing
passed between them.

## 8. Places and `community.lexicon.location`

The Lexicon Community's `community.lexicon.location.*` namespace has four defs,
and all four are **objects to embed, not records**:

| Def | Required | Optional |
| --- | --- | --- |
| `location.address` | `country` (ISO 3166, 2 letters preferred) | `postalCode`, `region`, `locality`, `street`, `name` |
| `location.geo` | `latitude`, `longitude` (both **strings**, WGS84) | `altitude`, `name` |
| `location.hthree` | `value` (an H3 cell) | `name` |
| `location.fsq` | `fsq_place_id` | `latitude`, `longitude`, `name` |

`community.lexicon.calendar.event` embeds them as `locations`, an array of
unions of those four plus a `#uri`. The namespace is run by a steering committee
(volunteers, developers and Bluesky PBC), with its canonical repo now on
Tangled. Its best-known consumer, Smoke Signal, shut down in July 2026, so
adoption is thinner than it was. Even so, the location defs are the only
shared vocabulary for "where" on atproto, and using them costs nothing.

Proposal: `<nsid>.place` gains an optional `locations` field, shaped exactly like
`calendar.event`'s (an array of that same union), embedded in the place record.
Matching the shape means anything that already reads event locations reads ours.
It doesn't replace the record. A place is still a story entity with its own id,
status and first appearance. The locations are only its coordinates in the real
world.

The hard part is not the schema. Fiction puts invented places in real
neighbourhoods, and SCS's codex shows all three cases:

| Kind | Example | What to publish |
| --- | --- | --- |
| Real public venue | McGolrick Park Farmers Market, NYPL Rose Reading Room | Address and geo, and optionally the Foursquare id. It's a real, public place and the precision helps a reader |
| Invented business on a real street | Sofia's cheese shop, The Coffee Hole on Bedford Ave | Locality only (neighbourhood, city). A street address would pin a fictional shop onto someone's real storefront |
| A character's home | Emma's apartment (Williamsburg), Jasper's (Chelsea) | Locality only, never geo. A precise point for a fictional residence lands on a real person's front door |

The source is a `location:` block in the location file's frontmatter, which
`compile` turns into the record's `locations` array. It's gated by a required
`precision`:

```yaml
# codex/locations/mcgolrick-market.md frontmatter
location:
  precision: exact        # exact | locality
  address: { name: "McGolrick Park", street: "Russell St & Nassau Ave",
             locality: Brooklyn, region: NY, country: US }
  geo: { latitude: "40.7247", longitude: "-73.9437" }

# codex/locations/emmas-apartment.md
location:
  precision: locality
  address: { locality: Brooklyn, region: NY, country: US, name: Williamsburg }
```

`compile` enforces it and fails closed. Each of these is a compile error:
`precision: locality` with a `street`, `postalCode`, `geo`, `hthree` or `fsq`
present; a `location` with no `precision`; an address with no `country`. (Geo
coordinates are strings in the lexicon, and the compiler emits them as strings.) The lint
belongs in Pinakes because it protects real people and applies to every universe.

A related question: should each dinner be a `community.lexicon.calendar.event`?
Each of SCS's four meals is a dated gathering at a place, with a guest list. That
could be modelled as an event (`startsAt`, `endsAt`, `locations`), and each
character's attendance as a `calendar.rsvp` from their own repo. It's a real fit,
and a rather charming one. But it's a universe choice, not a Pinakes type, and its
main consumer is gone, so it's listed in §12 rather than proposed.

## 9. Posts

Pinakes compiles `<nsid>.character.post` today and publishes nothing. The generic
half of SCS's `posting.mjs` moves up:

- **Two outputs per post.** The `<nsid>.character.post` record (the canon, in
  the character's repo, with the reveal gate intact) and an `app.bsky.feed.post`
  (the thing people see in Bluesky). The Bluesky post's rkey is a TID derived from
  the post's story time plus a fixed seed, so edits update in place.
- **Due-ness.** Due at the post's clock time (`storyTime`, which must be a
  real `HH:MM`) in the universe's time zone, and not before `publishDate` if set.
  A post with no clock time is refused, not posted at midnight.
- **Threading.** `replyTo` names another post id. A reply waits for its parent to
  exist and is reported as `waiting`, not failed.
- **Facets.** Mentions resolve to cast DIDs, and links become link facets.
- **Threadgate.** Optionally, replies are limited to a list the project account
  owns (SCS limits them to the cast). It's config, not code.
- **`lane` becomes a first-class field.** It's an enum with no default
  (`public` | `club`, or whatever the universe names them), required on every
  post. Only `public` reaches the network. A missing, doubled or unknown lane
  is a compile error. This replaces the `lane-*` tag convention.

The universe keeps its own editorial rules, like SCS's 300-grapheme cap,
never-on-the-hour and quiet weeks. Those stay in its own lints. Pinakes provides
the `graphemes()` helper so both sides count the same way.

## 10. The feed generator

`createFeedHandler({ host, publisher, cast, appview })` returns a `fetch`
handler that serves `/.well-known/did.json`,
`app.bsky.feed.describeFeedGenerator` and `app.bsky.feed.getFeedSkeleton`, with the
rules SCS uses: top-level posts by the cast, replies only between cast members,
no reposts. It's stateless and reads each author's feed from the public AppView.
The `cast` list comes from the same bundle as publishing, so the feed can't follow
a different set of DIDs from the one the publisher writes to. The feed-generator
record itself is one more planned write in the project repo.

## 11. Hosting, and SCS's three Workers

With §5–§10 upstream, a host is small:

```js
import bundle from './publish-bundle.json';
import { planPublish, applyPublish, createFeedHandler } from '@bbthorson/pinakes/publish';

export default {
  fetch: createFeedHandler(bundle.feed),          // public: the feed
  async scheduled(c, env) {                       // cron: publishing
    const plan = planPublish(bundle, { at: new Date(c.scheduledTime) });
    await applyPublish(plan, { password: (a) => env[a.secret], budget: 45, isLive });
  },
};
```

That makes SCS's question about one Worker or three easier to answer, but it
doesn't settle it: the passwords would sit in the same runtime as a public
`fetch`. SCS decides that separately (see its `protocol/ARCHITECTURE.md`). The
recommendation there is to merge the site and the feed and keep the cron host
unreachable. Pinakes' only job is to keep both halves thin enough that it doesn't
matter much either way.

**Migration for SCS:** not before Book 1's run ends on Oct 31. Then:

1. Ship `pinakes publish` with a dry-run plan that matches SCS's
   `publish_records.mjs` output byte for byte on the same `--at`. This parity
   test is the acceptance gate.
2. Move DIDs into `entities.yaml`, and lane from tags into a field.
3. Swap the poster's internals for `planPublish`/`applyPublish`. Delete
   `publish_records.mjs` and most of `posting.mjs`.
4. Turn on chapter text in documents only after the author has decided the
   license (§12.4).

## 12. Open questions

1. ~~**Rich content format.**~~ Decided: `at.markpub.markdown`. What's left is
   implementation: check its schema, and strip what the site strips (the leading
   chapter heading) so the two render the same prose.
2. **Where chapter metadata lives on the document.** The fields considered
   are the reader-safe ones from chapter frontmatter: `chapter` (number),
   `sequence` (the meal), `storyDate`/`storyDateEnd` and `sceneRefs`. Everything
   else stays off: `beat`, `beat_purpose`, `clues`, `threads`, `registers`, and the
   annotated `pov` and cast lines, which carry author notes. Who was present and
   where it happened are already on the scene record, which the document points
   to. The proposal is a small extension object under the universe's NSID on the
   document itself, rather than a separate record. It's four fields, and a
   separate record would be one more thing to keep in step.
3. ~~**One publication per universe or per book?**~~ Decided: per book.
4. **License.** The leaning is **CC BY-NC-ND 4.0**: share it with credit, but
   no commercial use and no derivative works. That's not final. Neither
   standard.site lexicon has a license field, so it would be carried in three
   places:
   - an extension field under the universe's NSID on the publication
     (`license: { id: "CC-BY-NC-ND-4.0", url }`, as an SPDX id) for machines;
   - one closing line in the publication's `description` for people, since
     that's what readers display;
   - `<link rel="license">` on the site.

   It's Pinakes config (`publish.license`, an SPDX id), so the three places can't
   disagree. The choice itself stays with the author.
5. ~~**Lock gate.**~~ Decided: `publishDate` is the lock.
6. **Meals as calendar events** (§8). The idea is liked, but its use on a
   reader surface is unclear. Candidate uses are listed below, and the question is
   whether any of them earns the build.
   - *The invitation.* Each meal is an event record, published when the host
     would have sent it in-story. On the site it's the course card: date, place,
     host.
   - *Characters RSVP.* Each regular's `calendar.rsvp` comes from their own
     repo. On the site that's a guest list that fills in over the week. It carries
     plot risk: an absence can be a spoiler (someone skipping the Family Meal),
     so RSVPs need the same gates as posts. They're written at story time, only
     on a public-register day, and never ahead of their date.
   - *Readers RSVP.* A reader's own account RSVPs to the Sunday drop, from the
     site or any calendar app that reads the lexicon. That's a native "remind me"
     and a count of who's coming to dinner. It's the one use aimed at readers
     rather than the story, and the one most likely to justify the build.
   - Against: Smoke Signal, the main app that read these, is gone, so almost all
     the value would be on our own site.
7. ~~**External place ids.**~~ Decided: an optional `location.fsq` entry for
   real public venues. The record stays keyed by its story id.
8. ~~**DID custody.**~~ Decided: out of scope.
