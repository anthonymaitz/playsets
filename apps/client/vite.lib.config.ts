import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
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
