// Skylark Ridge — the entry program (Node 22, standard library only).
// It hands the game in: copies game/ and screenshots/ into the output
// directory and writes dossier.json with buildDossier from the kit's
// vendor/makefun-game.ts. It runs twice in the grader and both runs must
// write the same bytes; copying files and building the dossier from their
// contents is deterministic, so they do.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));

// The grader sets MAKEFUN_OUTPUT_DIR; outside it, /output is the stand-in.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : '/output';

function copyTree(name: string): void {
  const from = join(repoRoot, name);
  const to = join(outputDir, name);
  if (!existsSync(from)) {
    throw new Error(`main.ts: ${name}/ is missing from the repository`);
  }
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyTree('game');
copyTree('screenshots');

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
