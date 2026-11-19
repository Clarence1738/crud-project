import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hookTimeout: 60_000,
    server: { deps: { inline: [/devextreme/] } },
  },
});
