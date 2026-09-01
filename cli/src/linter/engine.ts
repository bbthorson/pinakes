import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { Registry } from '../registry/entities.js';
import { Config } from '../config.js';

export interface Diagnostic {
  file: string;
  line?: number;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ChapterData {
  filePath: string;
  relativeFilePath: string;
  frontmatter: any;
  frontmatterText: string;
  chapterNum: string | number;
  title: string;
  dates: string[]; // ISO dates found in frontmatter 'date'
  locationNames: string[];
  charactersPresent: string[];
  charactersReferenced: string[];
  pov: string | null;
  registers: Record<string, string>;
  beatPurpose: string | null;
}

export class LinterEngine {
  private config: Config;
  private registry: Registry;
  private projectRoot: string;

  constructor(projectRoot: string, config: Config, registry: Registry) {
    this.projectRoot = projectRoot;
    this.config = config;
    this.registry = registry;
  }

  // Parses the frontmatter between the first two '---' fences
  public parseFrontmatter(content: string): { data: any; text: string; lineOffset: number } {
    const lines = content.split(/\r?\n/);
    if (lines.length === 0 || lines[0].trim() !== '---') {
      return { data: {}, text: '', lineOffset: 0 };
    }

    const fmLines: string[] = [];
    let closingIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        closingIndex = i;
        break;
      }
      fmLines.push(lines[i]);
    }

    if (closingIndex === -1) {
      return { data: {}, text: '', lineOffset: 0 };
    }

    const fmText = fmLines.join('\n');
    try {
      const data = YAML.parse(fmText) || {};
      return { data, text: fmText, lineOffset: 1 };
    } catch (e) {
      return { data: null, text: fmText, lineOffset: 1 };
    }
  }

  // Scan stories and load metadata
  public loadChapters(storyDir: string): ChapterData[] {
    const chaptersPath = path.join(storyDir, 'chapters');
    if (!fs.existsSync(chaptersPath)) return [];

    const files = fs.readdirSync(chaptersPath)
      .filter(f => f.endsWith('.md') && !f.startsWith('_') && !f.startsWith('00_'))
      .sort();

    const chapters: ChapterData[] = [];

    for (const file of files) {
      const filePath = path.join(chaptersPath, file);
      const relativeFilePath = path.relative(this.projectRoot, filePath);
      const content = fs.readFileSync(filePath, 'utf-8');

      const { data, text } = this.parseFrontmatter(content);
      if (data === null) {
        // Handle malformed frontmatter elsewhere as diagnostic
        continue;
      }

      if (!data.chapter) continue;

      // Extract ISO dates via regex
      const dateString = String(data.date || '');
      const dates = dateString.match(/\d{4}-\d{2}-\d{2}/g) || [];

      // Locations
      let locationNames: string[] = [];
      if (typeof data.location === 'string') {
        locationNames = [data.location];
      } else if (Array.isArray(data.location)) {
        locationNames = data.location.map((l: any) => String(l));
      }

      // Characters Present & Referenced
      const charactersPresent = Array.isArray(data.characters_present) 
        ? data.characters_present.map((c: any) => String(c)) 
        : [];
      
      const charactersReferenced = Array.isArray(data.characters_referenced)
        ? data.characters_referenced.map((c: any) => String(c))
        : [];

      // Registers
      const registers: Record<string, string> = {};
      if (data.registers && typeof data.registers === 'object') {
        for (const [k, v] of Object.entries(data.registers)) {
          registers[k] = String(v);
        }
      }

      chapters.push({
        filePath,
        relativeFilePath,
        frontmatter: data,
        frontmatterText: text,
        chapterNum: isNaN(Number(data.chapter)) ? data.chapter : Number(data.chapter),
        title: data.title || '',
        dates,
        locationNames,
        charactersPresent,
        charactersReferenced,
        pov: data.pov ? String(data.pov) : null,
        registers,
        beatPurpose: data.beat_purpose || null,
      });
    }

    return chapters;
  }

  // Get active stories (non-templates)
  public getStories(): string[] {
    const storiesPath = path.join(this.projectRoot, this.config.paths.stories);
    if (!fs.existsSync(storiesPath)) return [];

    return fs.readdirSync(storiesPath)
      .map(name => path.join(storiesPath, name))
      .filter(p => fs.statSync(p).isDirectory() && !path.basename(p).startsWith('_') && !path.basename(p).startsWith('.'));
  }

  // Perform linting
  public lint(): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const stories = this.getStories();

    for (const storyDir of stories) {
      const chapters = this.loadChapters(storyDir);
      if (chapters.length === 0) continue;

      // 1. Built-in: Entity Resolution checks
      if (this.config.rules['unresolved-entities'] !== 'off') {
        const severity = this.config.rules['unresolved-entities'] as 'error' | 'warning';
        for (const ch of chapters) {
          // POV check
          if (ch.pov) {
            this.checkEntity(ch.pov, 'character', ch, 'pov', severity, diagnostics);
          }

          // Location check
          for (const loc of ch.locationNames) {
            this.checkEntity(loc, 'place', ch, 'location', severity, diagnostics);
          }

          // Present check
          for (const char of ch.charactersPresent) {
            this.checkEntity(char, 'character', ch, 'characters_present', severity, diagnostics);
          }

          // Referenced check
          for (const char of ch.charactersReferenced) {
            this.checkEntity(char, 'character', ch, 'characters_referenced', severity, diagnostics);
          }

          // Registers check
          for (const char of Object.keys(ch.registers)) {
            this.checkEntity(char, 'character', ch, 'registers keys', severity, diagnostics);
          }
        }
      }

      // 2. Built-in: Sequential dates check
      if (this.config.rules['non-sequential-dates'] !== 'off') {
        const severity = this.config.rules['non-sequential-dates'] as 'error' | 'warning';
        
        // Sort chapters sequentially by their chapter identifier if numeric
        const sortedChapters = [...chapters].sort((a, b) => {
          const aNum = typeof a.chapterNum === 'number' ? a.chapterNum : 0;
          const bNum = typeof b.chapterNum === 'number' ? b.chapterNum : 0;
          return aNum - bNum;
        });

        let lastStartDate: string | null = null;
        let lastChapterFile = '';

        for (const ch of sortedChapters) {
          if (ch.dates.length === 0) {
            diagnostics.push({
              file: ch.relativeFilePath,
              rule: 'missing-date',
              severity: 'error',
              message: `Chapter missing valid ISO date in frontmatter \`date\` field`,
            });
            continue;
          }

          const chStartDate = ch.dates[0];
          if (lastStartDate && chStartDate < lastStartDate) {
            diagnostics.push({
              file: ch.relativeFilePath,
              rule: 'non-sequential-dates',
              severity,
              message: `Chapter date (${chStartDate}) is out of sequence. It occurs before previous chapter ${lastChapterFile} date (${lastStartDate}).`,
            });
          }
          lastStartDate = chStartDate; // update to start date of this chapter
          lastChapterFile = path.basename(ch.filePath);
        }
      }

      // 3. Built-in: Co-presence conflicts check (same character in different locations on same date range)
      if (this.config.rules['co-presence-conflict'] !== 'off') {
        const severity = this.config.rules['co-presence-conflict'] as 'error' | 'warning';
        
        // Match characters present in each chapter against other chapters occurring on overlapping dates.
        // Chapters are compared by their RESOLVED place ids: a chapter whose location entries
        // resolve to no registry place (a distributed montage, transit, or unlocated chapter)
        // pins its characters to no particular place, so it cannot co-presence-conflict (#12).
        // Resolving also makes alias spellings of the same place compare equal.
        const resolvedPlaceIds = (fmLocation: unknown): string[] => {
          const locs = fmLocation ? (Array.isArray(fmLocation) ? fmLocation : [fmLocation]) : [];
          return locs
            .map((l: unknown) => this.registry.resolve(String(l), 'place')?.id)
            .filter((id): id is string => Boolean(id));
        };

        for (let i = 0; i < chapters.length; i++) {
          const chA = chapters[i];
          if (chA.dates.length === 0) continue;

          const placeIdsA = resolvedPlaceIds(chA.frontmatter.location);
          if (placeIdsA.length === 0) continue;

          const startA = chA.dates[0];
          const endA = chA.dates[chA.dates.length - 1];

          for (let j = i + 1; j < chapters.length; j++) {
            const chB = chapters[j];
            if (chB.dates.length === 0) continue;

            const startB = chB.dates[0];
            const endB = chB.dates[chB.dates.length - 1];

            // Overlap check
            const overlaps = (startA <= endB) && (startB <= endA);
            if (overlaps) {
              const placeIdsB = resolvedPlaceIds(chB.frontmatter.location);

              // Only trigger if both chapters resolve to places and share none of them
              const hasSharedLocation = placeIdsA.some((id: string) => placeIdsB.includes(id));
              if (!hasSharedLocation && placeIdsB.length > 0) {
                // Resolve character IDs for both
                const idsA = chA.charactersPresent.map(c => this.registry.resolve(c, 'character')?.id).filter(Boolean);
                const idsB = chB.charactersPresent.map(c => this.registry.resolve(c, 'character')?.id).filter(Boolean);

                const overlapsChars = idsA.filter(id => idsB.includes(id));
                for (const charId of overlapsChars) {
                  const displayName = this.registry.allEntities.find(e => e.id === charId)?.displayName || charId;
                  diagnostics.push({
                    file: chA.relativeFilePath,
                    rule: 'co-presence-conflict',
                    severity,
                    message: `Co-presence conflict: Character '${displayName}' is present in Chapter ${chA.chapterNum} and Chapter ${chB.chapterNum} (${chB.relativeFilePath}) at the same time in different locations.`,
                  });
                }
              }
            }
          }
        }
      }
    }

    return diagnostics;
  }

  private checkEntity(
    name: string,
    type: 'character' | 'place',
    ch: ChapterData,
    field: string,
    severity: 'error' | 'warning',
    diagnostics: Diagnostic[]
  ) {
    const norm = this.registry.normalize(name);
    if (!norm) return;

    const resolved = this.registry.resolve(norm, type);
    if (resolved) return;

    if (this.registry.isNonEntity(norm)) return;

    // Line number search in frontmatter
    let line: number | undefined;
    const fmLineOffset = 2; // starts after the opening ---
    const lines = ch.frontmatterText.split(/\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(name)) {
        line = i + fmLineOffset;
        break;
      }
    }

    diagnostics.push({
      file: ch.relativeFilePath,
      line,
      rule: 'unresolved-entities',
      severity,
      message: `Unresolved reference to ${type} '${norm}' in field '${field}'`,
    });
  }
}
