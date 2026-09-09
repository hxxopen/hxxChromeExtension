import { defineConfig, type Plugin } from 'vite';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

function copyExtensionAssets(): Plugin {
  return {
    name: 'copy-extension-assets',
    closeBundle() {
      const dist = resolve(__dirname, 'dist');
      copyFileSync(resolve(__dirname, 'manifest.json'), resolve(dist, 'manifest.json'));
      const iconSrc = resolve(__dirname, 'icons');
      const iconDest = resolve(dist, 'icons');
      if (existsSync(iconSrc)) {
        mkdirSync(iconDest, { recursive: true });
        for (const file of readdirSync(iconSrc)) {
          copyFileSync(resolve(iconSrc, file), resolve(iconDest, file));
        }
      }
      mkdirSync(dirname(resolve(dist, 'content.js')), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [copyExtensionAssets()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/content.ts'),
      name: 'HxxTranslateContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
