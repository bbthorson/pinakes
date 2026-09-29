import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const chapters = defineCollection({
  loader: glob({ base: '../stories/_story_template/chapters', pattern: '[0-9]*.md' }),
  schema: z.object({
    title: z.string(),
    chapter: z.number().int(),
    meal: z.number().int().optional(),
    day: z.string().optional(),
    date: z.string().optional(),
    time: z.string().optional(),
    pov: z.string().optional(),
    publishDate: z.coerce.date().optional(),
  }),
});

const posts = defineCollection({
  loader: glob({ base: '../stories/_story_template/posts', pattern: '*.md' }),
  schema: z.object({
    author: z.string(),
    date: z.string(),
    time: z.string().optional(),
    chapter: z.union([z.number(), z.string()]).optional(),
    location: z.string().optional(),
    lane: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = {
  chapters,
  posts,
};
