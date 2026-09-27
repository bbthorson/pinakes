<script setup lang="ts">
/**
 * A reader-facing surface built only from compiled records: it fetches
 * records.json and nothing else, the way any consumer of a universe's
 * records would. Everything story-bound is filtered by its `chapterRef`, the
 * reveal gate, against the reader's position.
 *
 * It shows a state event's `register` and `registerExpr`, never its `state`:
 * the full annotation is written by an author who knows the whole book and
 * routinely says what the character doesn't know (`pinakes context` withholds
 * it by default for the same reason).
 */
import { computed, onMounted, ref, watch } from 'vue';
import { withBase } from 'vitepress';

type Rec = Record<string, any>;
interface Data {
  source: { name: string; nsid: string; sequenceName: string; repo: string; commit: string | null; pinakes: string };
  records: Rec[];
}

const data = ref<Data | null>(null);
const error = ref<string | null>(null);
const readThrough = ref(6);
const view = ref<'timeline' | 'characters' | 'feed' | 'items'>('timeline');
const selected = ref<string | null>(null);

onMounted(async () => {
  try {
    const res = await fetch(withBase('/demo/records.json'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data.value = await res.json();
  } catch (e: any) {
    error.value = `Could not load records.json (${e.message}).`;
  }
});

const ofType = (suffix: string) => computed(() => (data.value?.records ?? []).filter((r) => r.$type.endsWith(`.${suffix}`)));
const scenes = ofType('scene');
const events = ofType('character.stateEvent');
const posts = ofType('character.post');
const custody = ofType('custodyEvent');
const profiles = ofType('character.profile');
const places = ofType('place');
const items = ofType('item');

/** `book1#ch12` → 12. Chapter 0 is before the book opens. */
const chapterOf = (ref: string | undefined) => {
  const m = /#ch(\d+)$/.exec(ref ?? '');
  return m ? Number(m[1]) : Infinity; // an unparseable gate stays closed
};
const revealed = (ref: string | undefined) => chapterOf(ref) <= readThrough.value;

const chapterCount = computed(() => scenes.value.length);
const sortedScenes = computed(() => [...scenes.value].sort((a, b) => chapterOf(a.chapterRefs[0]) - chapterOf(b.chapterRefs[0])));
const shownScenes = computed(() => sortedScenes.value.filter((s) => revealed(s.chapterRefs[0])));
const shownEvents = computed(() => events.value.filter((e) => revealed(e.chapterRef)));
const shownPosts = computed(() =>
  posts.value
    .filter((p) => revealed(p.chapterRef))
    .sort((a, b) => `${a.storyDate} ${a.storyTime ?? ''}`.localeCompare(`${b.storyDate} ${b.storyTime ?? ''}`))
);
const shownCustody = computed(() => custody.value.filter((c) => revealed(c.chapterRef)));

const byId = computed(() => new Map((data.value?.records ?? []).map((r) => [r.id, r])));
const profileOf = computed(() => new Map(profiles.value.map((p) => [p.subject, p])));
const name = (id: string) => profileOf.value.get(id)?.displayName ?? byId.value.get(id)?.name ?? byId.value.get(id)?.displayName ?? id;
const placeName = (id: string) => places.value.find((p) => p.id === id)?.name ?? id;

/**
 * Profiles are series records with no gate of their own, so a character is
 * listed only once something revealed names them. Listing all thirteen on
 * chapter one would announce who is coming.
 */
const knownCharacters = computed(() => {
  const seen = new Set<string>();
  for (const s of shownScenes.value) for (const id of [s.pov, ...(s.participants ?? []), ...(s.referenced ?? [])]) if (id) seen.add(id);
  for (const p of shownPosts.value) seen.add(p.author);
  return profiles.value.filter((p) => seen.has(p.subject));
});

watch(knownCharacters, (list) => {
  if (!list.some((p) => p.subject === selected.value)) selected.value = list[0]?.subject ?? null;
});

const registerAt = computed(() => {
  const at = new Map<string, Rec>();
  for (const e of shownEvents.value) at.set(`${e.subject}#${chapterOf(e.chapterRef)}`, e);
  return at;
});
const chapters = computed(() => shownScenes.value.map((s) => chapterOf(s.chapterRefs[0])));
const selectedProfile = computed(() => profileOf.value.get(selected.value ?? ''));
const selectedPosts = computed(() => shownPosts.value.filter((p) => p.author === selected.value));

const knownItems = computed(() =>
  items.value
    .filter((i) => revealed(i.firstAppearance))
    .map((i) => ({ item: i, chain: shownCustody.value.filter((c) => c.item === i.id) }))
);

const sequences = computed(() => {
  const groups = new Map<number, Rec[]>();
  for (const s of shownScenes.value) {
    const k = s.sequence ?? 0;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  return [...groups.entries()];
});

const registerClass = (register: string | undefined) =>
  ['public', 'private', 'under-pressure'].includes(register ?? '') ? `reg-${register}` : 'reg-other';
const dates = (r: Rec) => (r.storyDateEnd && r.storyDateEnd !== r.storyDate ? `${r.storyDate} – ${r.storyDateEnd}` : r.storyDate);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/**
 * Post bodies are Markdown hard-wrapped in their source files, so a single
 * newline is a space and a blank line is a paragraph break, as Markdown reads it.
 */
const paragraphs = (text: string) =>
  text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
const postChapter = (p: Rec) => (chapterOf(p.chapterRef) === 0 ? 'before the book' : `ch. ${chapterOf(p.chapterRef)}`);
</script>

<template>
  <div class="rb">
    <p v-if="error" class="rb-error">{{ error }}</p>
    <p v-else-if="!data" class="rb-muted">Loading records…</p>

    <template v-else>
      <div class="rb-position">
        <label for="rb-read">
          <template v-if="readThrough === 0">I haven't <strong>started</strong> the book yet</template>
          <template v-else>
            I've read through <strong>chapter {{ readThrough }}</strong><span class="rb-muted"> of {{ chapterCount }}</span>
          </template>
        </label>
        <input id="rb-read" v-model.number="readThrough" type="range" min="0" :max="chapterCount" step="1" />
        <p class="rb-muted rb-small">
          Everything below is filtered by each record's <code>chapterRef</code>.
          {{ chapterCount - shownScenes.length }} chapters, {{ posts.length - shownPosts.length }} posts and
          {{ events.length - shownEvents.length }} register changes are still hidden.
        </p>
      </div>

      <div class="rb-tabs" role="tablist">
        <button
          v-for="v in (['timeline', 'characters', 'feed', 'items'] as const)"
          :key="v"
          role="tab"
          :aria-selected="view === v"
          :class="{ active: view === v }"
          @click="view = v"
        >
          {{ capitalize(v) }}
        </button>
      </div>

      <!-- Timeline: scenes grouped by the universe's sequence (meals, here). -->
      <section v-if="view === 'timeline'">
        <p v-if="!shownScenes.length" class="rb-muted">Move the slider to start reading.</p>
        <div v-for="[seq, group] in sequences" :key="seq" class="rb-seq">
          <h3>{{ capitalize(data.source.sequenceName) }} {{ seq }}</h3>
          <article v-for="s in group" :key="s.id" class="rb-card">
            <header>
              <span class="rb-ch">Ch. {{ chapterOf(s.chapterRefs[0]) }}</span>
              <strong>{{ s.title }}</strong>
              <span class="rb-muted rb-small">{{ dates(s) }}</span>
            </header>
            <p v-if="s.primaryEvent" class="rb-event">{{ s.primaryEvent }}</p>
            <p class="rb-small rb-meta">
              <span v-if="s.pov">POV {{ name(s.pov) }}</span>
              <span v-if="s.placeRefs?.length"> · {{ s.placeRefs.map(placeName).join(', ') }}</span>
            </p>
            <p class="rb-chips">
              <span v-for="id in s.participants" :key="id" class="rb-chip">{{ name(id) }}</span>
              <span v-for="id in s.referenced ?? []" :key="id" class="rb-chip rb-chip-ref" title="referenced, not present">{{ name(id) }}</span>
            </p>
            <p v-for="c in shownCustody.filter((c) => c.sceneRef === s.id)" :key="c.id" class="rb-small rb-custody">
              🫙 {{ name(c.item) }}: {{ c.fromHolder ? `${name(c.fromHolder)} → ` : '' }}{{ name(c.holder) }}
            </p>
          </article>
        </div>
      </section>

      <!-- Characters: profile, register over the chapters read, and their posts. -->
      <section v-else-if="view === 'characters'" class="rb-chars">
        <p v-if="!knownCharacters.length" class="rb-muted">No one has appeared yet.</p>
        <template v-else>
          <nav class="rb-char-list">
            <button
              v-for="p in knownCharacters"
              :key="p.subject"
              :class="{ active: selected === p.subject }"
              @click="selected = p.subject"
            >
              {{ p.displayName }}
            </button>
          </nav>
          <div v-if="selectedProfile" class="rb-char">
            <h3>
              {{ selectedProfile.displayName }}
              <span v-if="selectedProfile.handle" class="rb-muted rb-small">@{{ selectedProfile.handle }}</span>
            </h3>
            <p>{{ selectedProfile.description ?? selectedProfile.oneLine }}</p>

            <h4>Register, chapter by chapter</h4>
            <div class="rb-strip">
              <div
                v-for="ch in chapters"
                :key="ch"
                class="rb-cell"
                :class="registerClass(registerAt.get(`${selected}#${ch}`)?.register)"
                :data-empty="!registerAt.get(`${selected}#${ch}`)"
                :title="
                  registerAt.get(`${selected}#${ch}`)
                    ? `Ch. ${ch}: ${registerAt.get(`${selected}#${ch}`)!.registerExpr ?? registerAt.get(`${selected}#${ch}`)!.register}`
                    : `Ch. ${ch}: not on the page`
                "
              >
                {{ ch }}
              </div>
            </div>
            <p class="rb-legend rb-small">
              <span class="rb-key reg-public" /> public <span class="rb-key reg-private" /> private
              <span class="rb-key reg-under-pressure" /> under pressure <span class="rb-key reg-empty" /> not on the page
            </p>

            <h4>Posts ({{ selectedPosts.length }})</h4>
            <p v-if="!selectedPosts.length" class="rb-muted">None yet.</p>
            <article v-for="p in selectedPosts" :key="p.id" class="rb-post">
              <p class="rb-small rb-muted">{{ p.storyDate }} {{ p.storyTime }} · {{ postChapter(p) }}</p>
              <p v-for="(para, i) in paragraphs(p.text)" :key="i" class="rb-text">{{ para }}</p>
            </article>
          </div>
        </template>
      </section>

      <!-- Feed: every revealed post, in story time. -->
      <section v-else-if="view === 'feed'">
        <p v-if="!shownPosts.length" class="rb-muted">No posts yet.</p>
        <article v-for="p in shownPosts" :key="p.id" class="rb-post">
          <p class="rb-small">
            <strong>{{ name(p.author) }}</strong>
            <span v-if="profileOf.get(p.author)?.handle" class="rb-muted"> @{{ profileOf.get(p.author).handle }}</span>
            <span class="rb-muted"> · {{ p.storyDate }} {{ p.storyTime }} · {{ postChapter(p) }}</span>
          </p>
          <p v-if="p.inReplyTo && byId.get(p.inReplyTo)" class="rb-small rb-muted">↳ replying to {{ name(byId.get(p.inReplyTo).author) }}</p>
          <p v-for="(para, i) in paragraphs(p.text)" :key="i" class="rb-text">{{ para }}</p>
        </article>
      </section>

      <!-- Items: custody chains. -->
      <section v-else>
        <p v-if="!knownItems.length" class="rb-muted">No tracked items yet.</p>
        <div v-for="{ item, chain } in knownItems" :key="item.id" class="rb-card">
          <header><strong>{{ item.displayName }}</strong></header>
          <ol class="rb-chain">
            <li v-for="c in chain" :key="c.id">
              <span class="rb-small rb-muted">Ch. {{ chapterOf(c.chapterRef) }} · {{ c.storyDate }}</span><br />
              {{ c.fromHolder ? `${name(c.fromHolder)} → ` : '' }}<strong>{{ name(c.holder) }}</strong>
              <span v-if="c.event" class="rb-muted"> — {{ c.event }}</span>
            </li>
          </ol>
        </div>
      </section>

      <p class="rb-source rb-small rb-muted">
        {{ data.records.length }} records from
        <a :href="data.source.commit ? `${data.source.repo}/tree/${data.source.commit}` : data.source.repo">{{ data.source.name }}</a
        ><template v-if="data.source.commit"> at <code>{{ data.source.commit.slice(0, 7) }}</code></template>, compiled by pinakes
        {{ data.source.pinakes }}. This page reads <a :href="withBase('/demo/records.json')">records.json</a> and nothing else.
      </p>
    </template>
  </div>
</template>

<style scoped>
.rb { margin-top: 1.5rem; }
.rb-muted { color: var(--vp-c-text-2); }
.rb-small { font-size: 0.85rem; }
.rb-error { color: var(--vp-c-danger-1); }
.rb p { margin: 0.25rem 0; }

.rb-position {
  padding: 0.75rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}
/* Sticky only where there's room: on a phone it would cover half the screen. */
@media (min-width: 960px) {
  .rb-position { position: sticky; top: calc(var(--vp-nav-height) + 0.5rem); z-index: 5; }
}
.rb-position input { width: 100%; accent-color: var(--vp-c-brand-1); margin: 0.5rem 0 0.25rem; }

.rb-tabs { display: flex; gap: 0.25rem; margin: 1rem 0; border-bottom: 1px solid var(--vp-c-divider); flex-wrap: wrap; }
.rb-tabs button {
  padding: 0.4rem 0.8rem;
  border-bottom: 2px solid transparent;
  color: var(--vp-c-text-2);
  font-weight: 500;
}
.rb-tabs button.active { color: var(--vp-c-brand-1); border-bottom-color: var(--vp-c-brand-1); }

.rb-seq h3 { margin: 1.5rem 0 0.5rem; }
.rb-card, .rb-post {
  padding: 0.75rem 1rem;
  margin: 0.5rem 0;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}
.rb-card header { display: flex; gap: 0.5rem; align-items: baseline; flex-wrap: wrap; }
.rb-ch { font-variant-numeric: tabular-nums; color: var(--vp-c-text-2); font-size: 0.85rem; }
.rb-event { margin-top: 0.4rem !important; }
.rb-meta { color: var(--vp-c-text-2); }
.rb-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.rb-chip { padding: 0 0.5rem; border-radius: 999px; font-size: 0.8rem; background: var(--vp-c-default-soft); }
.rb-chip-ref { background: transparent; border: 1px dashed var(--vp-c-divider); color: var(--vp-c-text-2); }
.rb-custody { margin-top: 0.4rem !important; }
.rb-text + .rb-text { margin-top: 0.6rem !important; }

.rb-chars { display: grid; grid-template-columns: minmax(9rem, 12rem) 1fr; gap: 1.5rem; }
@media (max-width: 640px) { .rb-chars { grid-template-columns: 1fr; } }
.rb-char-list { display: flex; flex-direction: column; gap: 0.15rem; }
@media (max-width: 640px) { .rb-char-list { flex-direction: row; flex-wrap: wrap; } }
.rb-char-list button { text-align: left; padding: 0.3rem 0.6rem; border-radius: 6px; color: var(--vp-c-text-2); }
.rb-char-list button.active { background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
.rb-char h3 { margin-top: 0; }
.rb-char h4 { margin: 1.25rem 0 0.5rem; }

.rb-strip { display: flex; flex-wrap: wrap; gap: 3px; }
.rb-cell {
  width: 1.9rem; height: 1.9rem;
  display: grid; place-items: center;
  border-radius: 4px;
  font-size: 0.7rem; font-variant-numeric: tabular-nums;
  color: var(--vp-c-white);
}
.rb-cell[data-empty='true'] { background: transparent; border: 1px dashed var(--vp-c-divider); color: var(--vp-c-text-3); }
.reg-public { background: var(--vp-c-green-2); }
.reg-private { background: var(--vp-c-indigo-2); }
.reg-under-pressure { background: var(--vp-c-red-2); }
.reg-other { background: var(--vp-c-gray-2); }
.reg-empty { border: 1px dashed var(--vp-c-divider); }
.rb-legend { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.5rem !important; color: var(--vp-c-text-2); }
.rb-key { display: inline-block; width: 0.8rem; height: 0.8rem; border-radius: 2px; margin-left: 0.5rem; }

.rb-chain { padding-left: 1.2rem; margin: 0.5rem 0 0; }
.rb-chain li { margin: 0.4rem 0; }
.rb-source { margin-top: 2rem !important; padding-top: 1rem; border-top: 1px solid var(--vp-c-divider); }
</style>
