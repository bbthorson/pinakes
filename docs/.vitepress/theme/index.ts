import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import RecordBrowser from './RecordBrowser.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('RecordBrowser', RecordBrowser);
  },
} satisfies Theme;
