import { spawnSync } from 'node:child_process';
import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const result = spawnSync(process.execPath, [nextBin, 'build'], {
  cwd: projectRoot,
  env: { ...process.env, NEXT_DIST_DIR: '.next-node' },
  stdio: 'inherit',
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const outputRoot = path.join(projectRoot, '.next-node');
const standaloneRoot = path.join(outputRoot, 'standalone');
const copies = [
  ['site', path.join(standaloneRoot, 'site')],
  ['assets', path.join(standaloneRoot, 'assets')],
  [path.join('.next-node', 'static'), path.join(standaloneRoot, '.next-node', 'static')],
];

for (const [source, target] of copies) {
  if (!path.resolve(target).startsWith(path.resolve(standaloneRoot) + path.sep)) {
    throw new Error('Refusing to write outside standalone output: ' + target);
  }
  await rm(target, { recursive: true, force: true });
  await cp(path.join(projectRoot, source), target, { recursive: true });
}
