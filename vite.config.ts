import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: parseInt(env.PORT || '3000', 10),
        host: mode === 'development' ? 'localhost' : '0.0.0.0',
        proxy: {
          '/api': {
            target: `http://localhost:${env.BACKEND_PORT || '8000'}`,
            changeOrigin: true,
            timeout: 300000,  // 5 мин — Writer агент может работать долго
          },
        },
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
        'process.env.SUPABASE_KEY': JSON.stringify(env.SUPABASE_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
