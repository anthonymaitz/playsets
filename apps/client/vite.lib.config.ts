import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/board-element.ts',
      name: 'PlaysetsBoardElement',
      fileName: 'playsets-board',
      formats: ['es'],
    },
    outDir: 'dist',
    minify: false,
  },
})