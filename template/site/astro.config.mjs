import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

// Only load Keystatic UI in local dev or when explicitly requested
const enableKeystatic = process.argv.includes('dev') || process.env.ENABLE_KEYSTATIC === 'true';

export default defineConfig({
  output: 'static',
  integrations: [
    react(),
    ...(enableKeystatic ? [keystatic()] : []),
  ],
});
