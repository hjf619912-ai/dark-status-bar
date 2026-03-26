import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const cdnBase = env.VITE_CDN_BASE || '';
  return {
    base: cdnBase ? cdnBase.replace(/\/?$/, '/') : './', // 设为 CDN 地址时生成绝对路径，可用 $.load() 一行加载
    build: {
      outDir: path.resolve(__dirname, '../../dist/Dark'),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/index.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith('.css')) {
              return 'assets/index.css';
            }
            return 'assets/[name][extname]';
          },
        },
      },
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // Phosphor 图标字体（本地打包，避免 unpkg 被拦截）
        '@phosphor-icons': path.resolve(__dirname, 'node_modules/@phosphor-icons/web/src'),
      },
    },
    server: {
      cors: true, // 启用CORS
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
