import esbuild from 'esbuild';
import builtins from 'builtin-modules';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const prod = process.argv.includes('production');

await esbuild.build({
  entryPoints: [path.join(dir, 'main.ts')],
  outfile: path.join(dir, 'main.js'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'es2018',
  external: ['obsidian', 'electron', ...builtins],
  sourcemap: prod ? false : 'inline',
  logLevel: 'info',
});
