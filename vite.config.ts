/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Les fichiers de `domain/` sont du TypeScript pur : pas besoin de simuler
    // un navigateur pour les tester, ils tournent directement dans Node.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
