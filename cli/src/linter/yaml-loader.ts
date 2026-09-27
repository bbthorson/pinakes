import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import YAML from 'yaml';
import { z } from 'zod';
import { Diagnostic, ChapterData } from './engine.js';

export const CustomRuleSchema = z.object({
  name: z.string(),
  description: z.string(),
  severity: z.union([z.literal('error'), z.literal('warning')]).default('error'),
  selector: z.union([z.literal('chapter'), z.literal('stateEvent')]).default('chapter'),
  validate: z.object({
    field: z.string(),
    pattern: z.string().optional(),
    required: z.boolean().optional(),
  }),
});

export type CustomRule = z.infer<typeof CustomRuleSchema>;

export class YamlRulesLoader {
  private rules: CustomRule[] = [];
  private projectRoot: string;

  constructor(projectRoot: string, rulesGlob?: string) {
    this.projectRoot = projectRoot;
    if (rulesGlob) {
      this.loadRules(rulesGlob);
    }
  }

  private loadRules(rulesGlob: string) {
    const searchPath = path.resolve(this.projectRoot, rulesGlob);
    const files = globSync(searchPath);

    for (const file of files) {
      if (!fs.existsSync(file)) continue;
      // A rule that fails to load is a check that silently stops running, so
      // it fails the lint rather than warning past it.
      try {
        const raw = fs.readFileSync(file, 'utf-8');
        const parsed = YAML.parse(raw);
        const validated = CustomRuleSchema.parse(parsed);
        if (validated.validate.pattern) new RegExp(validated.validate.pattern);
        this.rules.push(validated);
      } catch (e: any) {
        throw new Error(`failed to load custom rule ${path.relative(this.projectRoot, file)}: ${e.message}`);
      }
    }
  }

  public runCustomRules(chapters: ChapterData[]): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const rule of this.rules) {
      const regex = rule.validate.pattern ? new RegExp(rule.validate.pattern) : null;
      const field = rule.validate.field;

      for (const ch of chapters) {
        // Handle selector: chapter
        if (rule.selector === 'chapter') {
          const val = ch.frontmatter[field];

          // 1. Required check
          if (rule.validate.required && (val === undefined || val === null || val === '')) {
            diagnostics.push({
              file: ch.relativeFilePath,
              rule: rule.name,
              severity: rule.severity,
              message: `${rule.description}: Field '${field}' is required but missing or empty.`,
            });
            continue;
          }

          // 2. Pattern check
          if (val !== undefined && val !== null && regex) {
            if (Array.isArray(val)) {
              for (const item of val) {
                if (!regex.test(String(item))) {
                  diagnostics.push({
                    file: ch.relativeFilePath,
                    rule: rule.name,
                    severity: rule.severity,
                    message: `${rule.description}: Item '${item}' in field '${field}' does not match pattern /${rule.validate.pattern}/`,
                  });
                }
              }
            } else if (typeof val === 'object') {
              for (const [k, v] of Object.entries(val)) {
                if (!regex.test(String(v))) {
                  diagnostics.push({
                    file: ch.relativeFilePath,
                    rule: rule.name,
                    severity: rule.severity,
                    message: `${rule.description}: Entry '${k}: ${v}' in field '${field}' does not match pattern /${rule.validate.pattern}/`,
                  });
                }
              }
            } else {
              if (!regex.test(String(val))) {
                diagnostics.push({
                  file: ch.relativeFilePath,
                  rule: rule.name,
                  severity: rule.severity,
                  message: `${rule.description}: Value '${val}' in field '${field}' does not match pattern /${rule.validate.pattern}/`,
                });
              }
            }
          }
        }

        // Handle selector: stateEvent (checks the registers keys and values)
        if (rule.selector === 'stateEvent') {
          if (field === 'register') {
            for (const [char, val] of Object.entries(ch.registers)) {
              // Registers usually contain transitions like "private -> under-pressure"
              // Split and check the base state
              const baseRegister = val.split(/->|→/)[0].trim();
              if (regex && !regex.test(baseRegister)) {
                diagnostics.push({
                  file: ch.relativeFilePath,
                  rule: rule.name,
                  severity: rule.severity,
                  message: `${rule.description}: Character '${char}' register state '${baseRegister}' does not match pattern /${rule.validate.pattern}/`,
                });
              }
            }
          }
        }
      }
    }

    return diagnostics;
  }
}
