// Token radar entry, radar-9 (Node 22, standard library only).
//
// A sealed snapshot goes in, a ranked board comes out. The scorer reads
// /input/snapshot.json (or --input <file|dir>), scores every rankable
// pre-token protocol with the model in lib/model.ts, and writes the board,
// the dashboard's data, the dashboard itself, the screenshots and the
// dossier to /output (or MAKEFUN_OUTPUT_DIR outside the grader).
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// Nothing here is allowed to depend on the clock or on chance: every sort
// carries a slug tie-break, the bootstrap refits run on a fixed seed, and
// no timestamp or random value enters any file — two runs on the same
// snapshot write the same bytes, which the gate then checks.

import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, fnv1a, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

// The scorer refuses its own bad output before the gate ever sees it.
const CAPS = {
  dashboardBytes: 65_536,
  shotBytes: 524_288,
  shotLong: 1440,
  shotShort: 800,
  shotCount: 4,
  shotName: /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/,
  dashboardFiles: 400,
  dashboardBytesTotal: 4_194_304,
};

class Fail extends Error {}
// Helpers throw Fail instead of exiting: the top-level catch is the only
// place that decides the exit code, so a helper never ends the run halfway
// through a write.

/** Pull --name value / --name=value pairs out of argv into a plain object. */
function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq > 2) flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    else if (i + 1 < argv.length) flags[arg.slice(2)] = argv[++i];
  }
  return flags;
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Work out where the snapshot lives and where the output goes. */
async function locate(flags, env) {
  const given = flags.input ?? '/input';
  const snapshotPath = given.endsWith('.json') ? given : join(given, 'snapshot.json');
  if (!(await pathExists(snapshotPath))) {
    throw new Fail(`no snapshot at ${snapshotPath}: pass --input <snapshot.json|directory> or mount the sealed /input`);
  }
  return { snapshotPath, outDir: flags.output ?? env.MAKEFUN_OUTPUT_DIR ?? '/output' };
}

/** Width and height out of a PNG or JPEG header; null when the bytes are neither. */
function shotSize(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) return null;
      const marker = buf[off + 1];
      const span = buf.readUInt16BE(off + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      }
      off += 2 + span;
    }
  }
  return null;
}

/** One screenshot, checked the way the gate checks it. */
async function guardShot(path, name) {
  const buf = await readFile(path);
  if (buf.length > CAPS.shotBytes) {
    throw new Fail(`screenshots/${name} is ${buf.length} bytes: the gate caps one at ${CAPS.shotBytes}`);
  }
  const dims = shotSize(buf);
  if (dims === null) throw new Fail(`screenshots/${name} is not a whole PNG or JPEG`);
  const long = Math.max(dims.width, dims.height);
  const short = Math.min(dims.width, dims.height);
  if (long > CAPS.shotLong || short < CAPS.shotShort) {
    throw new Fail(`screenshots/${name} is ${dims.width}x${dims.height}: the long side caps at ${CAPS.shotLong} and the short side floors at ${CAPS.shotShort}`);
  }
}

/** Mirror a flat directory (files only, no dotfiles, sorted) into a fresh one. */
async function mirrorFlat(from, to) {
  if (!(await pathExists(from))) return [];
  await mkdir(to, { recursive: true });
  const entries = (await readdir(from, { withFileTypes: true }))
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const entry of entries) await cp(join(from, entry.name), join(to, entry.name));
  return entries.map((e) => e.name);
}

/** Score the snapshot; board.json and data.js carry the result. */
async function scoreSnapshot(snapshot, outDir) {
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) throw new Fail(`the model wrote a board the gate refuses: ${issue}`);
  // The dashboard recomputes this over the board it renders and shows whether it matches.
  radar.checksum = fnv1a(JSON.stringify({ rows: board }));
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
  await writeFile(join(outDir, 'data.js'), dataScript(radar));
  return { board, radar };
}

/** Dashboard plus screenshots, each checked before it is trusted. */
async function copySite(outDir) {
  const dashboardFiles = await mirrorFlat(join(ROOT, 'dashboard'), join(outDir, 'dashboard'));
  if (dashboardFiles.length === 0) throw new Fail('dashboard/ is empty: the page is the entry');
  const shots = await mirrorFlat(join(ROOT, 'screenshots'), join(outDir, 'screenshots'));
  // Three are required (board, detail, filtered); a fourth, the model tab,
  // is double insurance — the gate only checks the images are legal, never
  // their content, so the shots are viewed by eye before this runs.
  if (shots.length < 3) {
    throw new Fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
  }
  for (const name of shots) {
    if (!CAPS.shotName.test(name)) {
      throw new Fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
    }
    await guardShot(join(outDir, 'screenshots', name), name);
  }
  return { dashboardFiles, shots };
}

/** Dossier last, so it covers everything written above it. */
async function sealDossier(outDir) {
  await writeFile(
    join(outDir, 'dossier.json'),
    buildDossier(outDir, {
      text_max_bytes: CAPS.dashboardBytes,
      screenshots: { max: CAPS.shotCount, max_bytes: CAPS.shotBytes },
      dashboard: { max_files: CAPS.dashboardFiles, max_bytes: CAPS.dashboardBytesTotal },
    }),
  );
}

async function main(argv, env) {
  const { snapshotPath, outDir } = await locate(parseFlags(argv), env);
  const snapshot = parseSnapshot(await readFile(snapshotPath, 'utf8'));
  const { board, radar } = await scoreSnapshot(snapshot, outDir);
  const { dashboardFiles, shots } = await copySite(outDir);
  await sealDossier(outDir);
  process.stdout.write(
    `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
      `token radar: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, ${join(outDir, 'dashboard')} (${dashboardFiles.length} files), ${join(outDir, 'screenshots')} (${shots.length} images) and ${join(outDir, 'dossier.json')}\n`,
  );
}

main(process.argv.slice(2), process.env).catch((err) => {
  process.stderr.write(`token radar: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
