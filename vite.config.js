import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    base: './',

    build: {
        target: 'es2019',
        cssTarget: 'chrome61',
        sourcemap: true,
        outDir: 'dist',
        emptyOutDir: true,
        cssCodeSplit: false,
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
                entryFileNames: 'assets/main.js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name][extname]'
            }
        }
    },

    server: {
        host: '0.0.0.0'
    },

    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
});
