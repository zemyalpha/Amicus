// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
// Static output deploys directly to Cloudflare Pages without an adapter
export default defineConfig({
  output: 'static',
  vite: {
    plugins: [tailwindcss()]
  }
});
