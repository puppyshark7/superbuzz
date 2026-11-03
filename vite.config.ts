import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import formsPlugin from '@tailwindcss/forms/plugin';

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
});
