import { defineConfig } from 'vitest/config';

// Seuls les tests de l'application (src/) tournent ici. Les tests de mobile/sync (Rasmata) sont écrits pour Jest.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
