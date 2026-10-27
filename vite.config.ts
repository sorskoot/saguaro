import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: './',
    test: {
        globals: true,
        environment: 'jsdom',
        css: { include: /TimerPictureInPicture\.css/ },
        setupFiles: ['./src/test/setup.ts'],
    },
});
