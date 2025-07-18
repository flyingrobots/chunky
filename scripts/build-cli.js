#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

await esbuild.build({
  entryPoints: ['cli/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/cli/chunky.js',
  banner: {
    js: '#!/usr/bin/env node'
  },
  alias: {
    '@chunky': './src/index.ts',
    '@chunky/ChunkOptions': './src/ChunkOptions.ts',
    '@chunky/StatsTracker': './src/StatsTracker.ts',
    '@chunky/errors': './src/errors.ts',
  },
  external: [
    // Don't bundle these - they should be installed
    'commander',
    'chalk', 
    'ora',
    'cli-progress',
    'zod'
  ],
  minify: true,
  sourcemap: true,
  define: {
    '__VERSION__': JSON.stringify(packageJson.version)
  }
});

console.log('✅ CLI built successfully!');