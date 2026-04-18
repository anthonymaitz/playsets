#!/usr/bin/env node
import { readdirSync, writeFileSync, statSync } from 'fs'
import { join, extname, basename } from 'path'

const SPRITES_DIR = 'apps/client/public/assets/sprites'
const OUT = `${SPRITES_DIR}/manifest.json`

function labelFromFilename(filename) {
  return basename(filename, extname(filename))
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const categories = []
for (const entry of readdirSync(SPRITES_DIR)) {
  const full = join(SPRITES_DIR, entry)
  if (!statSync(full).isDirectory() || entry === '.' || entry === '..') continue
  const sprites = readdirSync(full)
    .filter((f) => ['.png', '.webp', '.svg'].includes(extname(f).toLowerCase()))
    .map((f) => ({
      id: `${entry}/${basename(f, extname(f))}`,
      label: labelFromFilename(f),
      path: `/assets/sprites/${entry}/${f}`,
    }))
  if (sprites.length > 0) {
    categories.push({ id: entry, label: labelFromFilename(entry), sprites })
  }
}

writeFileSync(OUT, JSON.stringify({ categories }, null, 2))
console.log(`Wrote ${categories.length} categories to ${OUT}`)
