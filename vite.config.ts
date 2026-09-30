/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Identifiant unique par build. Il entre dans l'adresse du service worker
    // (`sw.js?v=...`) : c'est ce qui force le navigateur à en installer un
    // nouveau, et donc à repartir d'un cache propre, à chaque mise à jour.
    __BUILD_ID__: JSON.stringify(String(Date.now())),
  },
  test: {
    // Les fichiers de `domain/` sont du TypeScript pur : pas besoin de simuler
    // un navigateur pour les tester, ils tournent directement dans Node.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
