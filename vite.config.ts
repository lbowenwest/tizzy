import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/*.test.ts'],
    environment: 'node',
  },
  server: {
    // Opt-in tunnel hosts for device testing, e.g. DEV_ALLOWED_HOSTS=.ngrok-free.app
    allowedHosts: process.env.DEV_ALLOWED_HOSTS?.split(',').filter(Boolean),
  }
});
