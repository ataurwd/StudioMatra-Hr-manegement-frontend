import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import { Scanner } from '@tailwindcss/oxide';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const currentDir = fileURLToPath(new URL('.', import.meta.url));

// Polyfill / fallback for Scanner.prototype.scan:
// On environments where native binaries are restricted (e.g. Windows Application Control policy),
// @tailwindcss/oxide falls back to WASI wasm where Rust filesystem traversal cannot read Windows drive paths.
// In that scenario, Scanner.scanFiles(...) works perfectly when files are provided via Node fs.
if (Scanner && Scanner.prototype) {
  const originalScan = Scanner.prototype.scan;
  Scanner.prototype.scan = function () {
    const originalResult = originalScan ? originalScan.call(this) : [];
    if (originalResult && originalResult.length > 0) {
      return originalResult;
    }

    const scannedPaths = new Set<string>();
    const fileInputs: Array<{ content: string; extension: string }> = [];

    function walkDirectory(dir: string) {
      if (!fs.existsSync(dir)) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name.startsWith('.')
          ) {
            continue;
          }
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDirectory(fullPath);
          } else if (/\.(html|js|ts|jsx|tsx|vue|svelte|astro|mdx?)$/.test(entry.name)) {
            if (!scannedPaths.has(fullPath)) {
              scannedPaths.add(fullPath);
              try {
                fileInputs.push({
                  content: fs.readFileSync(fullPath, 'utf8'),
                  extension: path.extname(entry.name).slice(1),
                });
              } catch {}
            }
          }
        }
      } catch {}
    }

    walkDirectory(path.resolve(currentDir, 'src'));
    walkDirectory(currentDir);

    if (fileInputs.length > 0) {
      return this.scanFiles(fileInputs);
    }
    return originalResult || [];
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': currentDir,
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
