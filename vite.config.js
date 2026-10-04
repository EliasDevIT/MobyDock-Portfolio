import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'
import { PROFILE } from './src/data/profile.ts'

/** Titre de la page (index.html, %SITE_TITLE%) : « domaine — nom », tiré du profil. */
const siteTitle = {
  name: 'site-title',
  transformIndexHtml: (html) => html.replace('%SITE_TITLE%', `${PROFILE.domain} — ${PROFILE.name}`),
}

export default defineConfig({
  plugins: [glsl(), siteTitle],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Three.js seul pèse ~600 kB minifié : chunk dédié, mis en cache indépendamment du code applicatif
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
})
