// Token radar entry, radar-8 (Node 22, standard library only).
//
// One sealed snapshot in, one ranked board out. The scorer reads
// /input/snapshot.json (or --input <file|dir>), scores every rankable
// pre-token protocol with the model in lib/model.ts, and writes the board,
// the dashboard's data, the dashboard itself, the screenshots and the
// dossier to /output (or MAKEFUN_OUTPUT_DIR outside the grader).
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// Determinism is a property of the outputs, not a hope: every sort has a
// slug tie-break, the bootstrap uses a fixed seed, and no clock or random
// value enters any file — two runs on the same snapshot write the same bytes.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, fnv1a, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** Caps the scorer enforces itself, so a bad output fails here instead of at the gate. */
const LIMITS = {
  dashboardTextBytes: 65_536,
  shotMaxBytes: 524_288,
  shotLongSide: 1440,
  shotShortSide: 800,
  shotsMax: 4,
  shotName: /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/,
};

/** Abort with the message on stderr and a non-zero exit. */
function die(message) {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(1);
}

/** The value after --name, in either --name value or --name=value form. */
function readCli(argv, name, fallback) {
  const at = argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < argv.length) return argv[at + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq === undefined ? fallback : eq.slice(name.length + 3);
}

/** Resolve the snapshot file and the output directory from argv + env. */
function resolvePaths(argv, env) {
  const inputArg = readCli(argv, 'input', '/input');
  const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
  if (!existsSync(inputFile)) {
    die(`no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input`);
  }
  return { inputFile, outDir: readCli(argv, 'output', env.MAKEFUN_OUTPUT_DIR ?? '/output') };
}

/** Pixel size from a PNG or JPEG header; null when the file is neither whole nor readable. */
function imageDimensions(path) {
  const buf = readFileSync(path);
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

/** Refuse a screenshot the gate would refuse, naming the row it breaks. */
function assertShot(path, name) {
  const size = statSync(path).size;
  if (size > LIMITS.shotMaxBytes) {
    die(`screenshots/${name} is ${size} bytes: the gate caps one at ${LIMITS.shotMaxBytes}`);
  }
  const dims = imageDimensions(path);
  if (dims === null) die(`screenshots/${name} is not a whole PNG or JPEG`);
  if (Math.max(dims.width, dims.height) > LIMITS.shotLongSide || Math.min(dims.width, dims.height) < LIMITS.shotShortSide) {
    die(`screenshots/${name} is ${dims.width}x${dims.height}: the long side caps at ${LIMITS.shotLongSide} and the short side floors at ${LIMITS.shotShortSide}`);
  }
}

/** Copy a directory's files (flat, no dotfiles, no subdirectories) into a fresh directory. Returns the copied names, sorted. */
function copyFlatDir(from, to) {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied = [];
  for (const entry of readdirSync(from, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (entry.name.startsWith('.') || !entry.isFile()) continue;
    copyFileSync(join(from, entry.name), join(to, entry.name));
    copied.push(entry.name);
  }
  return copied;
}

/** Score the snapshot and write board.json + data.js. Returns the board and radar data. */
function writeBoardAndData(snapshot, outDir) {
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) die(`the model wrote a board the gate refuses: ${issue}`);
  // The dashboard recomputes this over the board it renders and shows whether it matches.
  radar.checksum = fnv1a(JSON.stringify({ rows: board }));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
  writeFileSync(join(outDir, 'data.js'), dataScript(radar));
  return { board, radar };
}

/** Copy the dashboard and the screenshots into the output, refusing anything the gate would refuse. */
function writeDashboardAndShots(outDir) {
  const dashboardFiles = copyFlatDir(join(here, 'dashboard'), join(outDir, 'dashboard'));
  if (dashboardFiles.length === 0) die('dashboard/ is empty: the page is the entry');
  const shots = copyFlatDir(join(here, 'screenshots'), join(outDir, 'screenshots'));
  // Three are required (board, detail, filtered); a fourth, the model tab,
  // is double insurance — the gate only checks the images are legal, never
  // their content, so the shots are viewed by eye before this runs.
  if (shots.length < 3) {
    die(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
  }
  for (const name of shots) {
    if (!LIMITS.shotName.test(name)) {
      die(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
    }
    assertShot(join(outDir, 'screenshots', name), name);
  }
  return { dashboardFiles, shots };
}

/** The whole run: score, copy, dossier last so it covers everything above it. */
function run(argv, env) {
  const { inputFile, outDir } = resolvePaths(argv, env);
  const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
  const { board, radar } = writeBoardAndData(snapshot, outDir);
  const { dashboardFiles, shots } = writeDashboardAndShots(outDir);
  // The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
  writeFileSync(
    join(outDir, 'dossier.json'),
    buildDossier(outDir, {
      text_max_bytes: LIMITS.dashboardTextBytes,
      screenshots: { max: LIMITS.shotsMax, max_bytes: LIMITS.shotMaxBytes },
      dashboard: { max_files: 400, max_bytes: 4_194_304 },
    }),
  );
  process.stdout.write(
    `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
      `token radar: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, ${join(outDir, 'dashboard')} (${dashboardFiles.length} files), ${join(outDir, 'screenshots')} (${shots.length} images) and ${join(outDir, 'dossier.json')}\n`,
  );
}

run(process.argv, process.env);
