import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: projectRoot,
  encoding: 'utf8',
}).trim();

await writeFile(
  path.join(projectRoot, 'site', 'build.json'),
  JSON.stringify({ commit: commit }) + '\n',
  'utf8'
);
