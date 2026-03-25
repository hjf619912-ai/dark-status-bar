/**
 * 隔离仓库根目录的 postcss.config.js（webpack 用 autoprefixer 等），
 * 避免 Vite 构建 Dark 时向上解析到根配置并缺少 browserslist。
 * Tailwind 由 vite.config.ts 中的 @tailwindcss/vite 处理。
 * @type {import('postcss-load-config').Config}
 */
export default {
  plugins: [],
};
