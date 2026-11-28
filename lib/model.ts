// Token radar model "radar-4": a snapshot in, a ranked board out.
//
// The board ranks every pre-token protocol the snapshot can rank: the 40 on
// the watchlist plus every other pre-token protocol below the floor that is not
// a centralised exchange and not a versioned pool of another protocol (198 rows
// on this snapshot). Nothing is ranked by name: the same function scores every
// row from the snapshot's own figures only.
//
// radar-6 replaces radar-5's odds and its default deposit. The value curve
// is unchanged: every extra value term tried in R5–R7 (quadratic,
// interactions, robust and age-weighted fits, weighted regressions) failed at
// least one held-out test, so the size curve alone still stands — the
// snapshot is exhausted on the value side, and the note says so instead of
// forcing a fit. The odds drop the category token rate: it is a marginal,
// era-confounded average (Risk Curators average 193 days listed, CDP 936),
// its coefficient carries a 1.58-logit swing on the top pair, and its
// forward-looking value is nil — the walk-forward Brier moves within noise
// without it, while the mixed-era 5-fold costs 0.009. The default deposit
// is a flat $5,000, a retail cheque the verdict can be read against, instead
// of a slice of TVL. The numbers below are computed from the snapshot at run
// time — this file states the rules, the snapshot supplies the coefficients.
//
//   value if it launches = TVL x fitted multiple(TVL)
//     fitted multiple comes from ln(mcap) = a + b x ln(TVL / $100M), OLS on
//     the 92 traded protocols that survive the watchlist's own cleaning and
//     carry a usable market cap. On this snapshot a = 16.371, b = 0.394:
//     a $100M protocol's token is worth about 13% of its TVL, and the share
//     falls as TVL grows. The multiple is clamped to 0.01..1.00 as a sanity
//     bound; on this snapshot the fitted multiples run 0.017..0.790, so the
//     clamp binds nowhere.
//   token odds = logistic(1, ln(age), ln(TVL / $100M), ln(chains),
//     7-day growth x ln(TVL)), fitted on the 383 dated, clean protocols:
//     the share like this one that record a token. No category token rate:
//     the rate is a marginal average over protocols of very different ages,
//     so it measures the category's age as much as its behaviour, and one
//     feature swinging 1.58 logit on the top pair makes the board fragile.
//     The fit is scored by Brier against the base rate, held out four ways
//     (5-fold, walk-forward, leave-one-category-out, leave-one-chain-out),
//     and by 5-fold AUC.
//   implied value = value if it launches x token odds.
//   range = the fitted value x the leave-one-out residual quantiles
//     (P25..P75, P10..P90), taken per category where the category has
//     enough priced peers and from the global band otherwise: the printed
//     range is honest about a typical miss of about x3.3, not a pretence of
//     precision, and its coverage is validated held out per category.
//
// The farm verdict prices one plan, it does not promise a payout:
//   modelled drop = implied x (deposit / TVL) x drop share (default 7%)
//   net = drop - gas fees; net/hour = net / hands-on hours.
//   FARM when the net beats both a 4% T-bill on the deposit and $25 an hour
//   of the farmer's time; MARGINAL when the net is positive but below one of
//   those bars; SKIP when the net is negative. Gas is a planning estimate per
//   transaction on the protocol's first chain, not a quote.
//   Every row is priced at four deposits — $1,000, $5,000, $25,000 and the
//   flat $5,000 default — under the same two bars, which never move: a big
//   cheque beats the T-bill on rows a small one cannot, and the counts per
//   tier are the honest answer to "worth farming at what size". The default
//   is $5,000 because it is the middle tier and the size a retail farmer can
//   fund: $1,000 rarely clears the $25-an-hour bar after fees, $25,000 is
//   beyond a retail cheque, and a fixed cheque makes the verdict a property
//   of the protocol, not of the deposit formula.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted value curve: ln(mcap) = a + b x ln(TVL / $100M), OLS on the traded peers. */
export interface ValueFit {
  a: number;
  b: number;
  n_peers: number;
  flat_multiple: number;
  loo_miss: number;
  wf_miss: number;
  flat_loo_miss: number;
  flat_wf_miss: number;
  residual_q10: number;
  residual_q25: number;
  residual_q75: number;
  residual_q90: number;
  range_p2575: number;
  range_p1090: number;
  /** Leave-one-category-out and leave-one-chain-out median miss of the size curve. */
  loco_miss: number;
  locho_miss: number;
  /** Share of priced caps inside their own category's leave-one-out band
   *  (P25–P75, stated 50%; P10–P90, stated 80%), and how many categories
   *  carry their own band. */
  range_cat_p2575: number;
  range_cat_p1090: number;
  range_cat_n: number;
}

/** One rung of a term ladder: what was tried, what it missed held-out, whether it was kept. */
export interface LadderRow {
  term: string;
  loo: number | null;
  wf: number | null;
  fold5: number | null;
  base: number | null;
  kept: boolean;
  note: string;
}

/** The fitted token-odds model: logistic on ln(age), ln(TVL / $100M), ln(chains) and 7-day growth x ln(TVL). No category token rate: it is dropped by policy (see the odds ladder), not by the tests. */
export interface OddsFit {
  beta: number[];
  terms: number[];
  n_peers: number;
  base_rate: number;
  brier_fold5: number;
  brier_base_fold5: number;
  brier_wf: number;
  brier_base_wf: number;
  auc_fold5: number;
  cat_rate_k: number;
  /** The category-rate diagnostic: the shrink strength the sweep would have
   *  kept, and the held-out Brier with the rate added to the final kept set
   *  against the final kept set alone. */
  cat_rate_diagnostic: { k: number; with_fold5: number; with_wf: number; without_fold5: number; without_wf: number };
  /** Leave-one-category-out and leave-one-chain-out Brier of the kept odds model. */
  loco_brier: number;
  locho_brier: number;
}

/** One accounting group: every snapshot protocol sits in exactly one. */
export interface AccountGroup {
  label: string;
  count: number;
}

/** The farm verdict at one fixed deposit, under the stated drop share and horizon: the same two bars as the default verdict, which never move. */
export interface TierVerdict {
  deposit_usd: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  drop_usd: number;
  net_usd: number;
  net_per_hour: number;
  tbill_usd: number;
  share_of_tvl: number;
}

/** The farm economics at the default deposit, drop share and horizon. */
export interface Verdict {
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  deposit_usd: number;
  drop_usd: number;
  fees_usd: number;
  net_usd: number;
  net_per_hour: number;
  hands_on_minutes: number;
  tbill_usd: number;
}

/** One priced peer, for the detail view's nearest-peers table. */
export interface PeerRef {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
  multiple: number;
  fitted_multiple: number;
}

/** One farm step: the action, what it costs in dollars, and how long it takes in minutes. */
export interface FarmStep {
  text: string;
  cost_usd: number;
  minutes: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  value_if_launches_usd: number;
  fitted_multiple: number;
  token_odds: number;
  range_lo_usd: number;
  range_hi_usd: number;
  range_p10_usd: number;
  range_p90_usd: number;
  rank_lo: number;
  rank_hi: number;
  verdict: Verdict;
  tier_verdicts: TierVerdict[];
  peers: PeerRef[];
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  fitted_multiple: number;
}

/** Everything the dashboard needs: the board, the fit, the evidence, and the ledger. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  farm_count: number;
  marginal_count: number;
  skip_count: number;
  tier_counts: { deposit_usd: number; farm: number; marginal: number; skip: number }[];
  farm_any_tier_count: number;
  watchlist: string[];
  value_fit: ValueFit;
  value_ladder: LadderRow[];
  odds_fit: OddsFit;
  odds_ladder: LadderRow[];
  odds_cat_sweep: { k: number; fold5: number; wf: number }[];
  accounting: AccountGroup[];
  checksum: string;
  rows: BoardRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-6';

/** How many live-token protocols the Live view carries: every priced comp, not a top slice. */
export const LIVE_ROWS = 92;

/** The fixed deposits every row is priced at, beside its default 0.02% of TVL: the same formula and the same two bars at each size. */
export const TIER_DEPOSITS = [1000, 5000, 25000] as const;

/** The farm plan's stated assumptions: default deposit, drop share, horizon, the two bars a verdict must beat. */
export const FARM = {
  drop_share: 0.07,
  horizon_weeks: 12,
  tbill_rate: 0.04,
  hour_bar_usd: 25,
} as const;

/** The default deposit for a farm plan: a flat $5,000, the middle tier.
 *  A fixed cheque makes the verdict a property of the protocol — its
 *  implied value and odds — instead of a property of the deposit formula:
 *  $1,000 rarely clears the $25-an-hour bar after fees, $25,000 is beyond
 *  a retail cheque, and $5,000 is the size a retail farmer can fund. The
 *  board still prices $1,000 and $25,000 beside it, under the same bars. */
export const DEFAULT_DEPOSIT_USD = 5000;

/** Gas per transaction, in dollars, by first chain: planning estimates, not quotes. */
export const GAS_USD: Record<string, number> = {
  Ethereum: 3.0,
  Base: 0.1,
  Arbitrum: 0.1,
  Optimism: 0.1,
  Polygon: 0.1,
  Solana: 0.02,
  BSC: 0.2,
  Tron: 1.0,
  Avalanche: 0.5,
};

export const GAS_DEFAULT_USD = 0.1;
/** The fitted multiple's sanity bound: the clamp binds nowhere on this snapshot. */
export const MULTIPLE_MIN = 0.01;
export const MULTIPLE_MAX = 1.0;
/** Category effects are shrunk by k pseudo-observations and need minN peers to count. */
export const CAT_SHRINK_K = 64;
export const CAT_MIN_N = 5;
/** The category token rate's shrink strength: pseudo-observations pulling the
 *  rate toward one half. The odds ladder sweeps it and keeps the strength
 *  that wins both held-out tests; the chosen value is stored on the fit. */
let CAT_RATE_K = 5;
/** The shrink strengths the odds ladder tries for the category token rate. */
export const CAT_RATE_K_SWEEP = [5, 15, 30, 60, 120] as const;
/** Set the category-rate shrink strength (the ladder sets it while sweeping). */
export function setCategoryRateK(k: number): void {
  CAT_RATE_K = k;
}
/** The category-rate shrink strength in force. */
export function getCategoryRateK(): number {
  return CAT_RATE_K;
}
/** A term is kept only when it beats the current best by more than this
 *  relative margin on the walk-forward test, without making the other
 *  held-out test worse. The walk-forward test is the forward-looking one —
 *  it predicts the newest protocols, which is what the board does — so a
 *  term that does not improve it does not help the board, however much it
 *  helps the mixed-era test. And the margin matters: the walk-forward median
 *  over ~35–46 peers moves in steps far larger than float dust, so a smaller
 *  difference is no improvement at all — it is the median not moving. */
const KEEP_MARGIN = 0.999;
/** Whether `next` beats `prev` by more than the keep margin. */
function beats(next: number, prev: number): boolean {
  return next < prev * KEEP_MARGIN;
}
/** Whether a candidate (walk-forward miss, other-test miss) is kept against
 *  the current best: forward better by more than the margin, the other test
 *  no worse. Requiring both tests to clear the margin would discard real
 *  signal — a term can carry genuine forward signal while the other test's
 *  measurement sits inside noise — but nothing is kept that makes either
 *  test worse. */
function keeps(next: [number, number], prev: [number, number]): boolean {
  return beats(next[0], prev[0]) && next[1] <= prev[1];
}
/** Bootstrap refits for the rank ranges: a fixed seed, so two runs agree byte for byte. */
export const BOOTSTRAP_REFITS = 200;
export const BOOTSTRAP_SEED = 20261114;

const DAY_MS = 86_400_000;
const ln = Math.log;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Whole days from `listedAt` to `asOf`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/**
 * The watchlist's own exclusion, applied to every early row too: a wrapped,
 * staked or bridged product of a token that already trades is not a token
 * still to come. Without it the board's top rows would be WBTC, Binance
 * staked ETH and the like — products of tokens that already trade, ranked as
 * if they were launches. The categories, the whole words and the exchange
 * prefixes are the watchlist rule's, word for word.
 */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is clean of the watchlist rule's exclusions (no claim about its token). */
export function isClean(p: SnapshotProtocol): boolean {
  return (
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool, not a wrapped, staked or bridged product of a token that already trades. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && isClean(p);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The median of a sorted array's values, or the middle value's neighbour: deterministic. Callers must sort first. */
function median(sorted: number[]): number {
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** The median of any array's values: sorts a copy, so unsorted input is safe. */
function medianOf(values: number[]): number {
  return median([...values].sort((a, b) => a - b));
}

/** OLS on ln(mcap) = a + b x ln(TVL / $100M). */
export function olsFit(peers: SnapshotProtocol[]): { a: number; b: number } {
  const xs = peers.map((p) => ln(p.tvl_usd / 1e8));
  const ys = peers.map((p) => ln(p.mcap_usd!));
  const n = peers.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  return { a: my - b * mx, b };
}

/** The fitted multiple at a TVL: exp(a + b x ln(TVL / $100M)) / TVL, clamped to the sanity bound. */
export function fittedMultiple(tvlUsd: number, fit: { a: number; b: number }): number {
  const value = Math.exp(fit.a + fit.b * ln(Math.max(1, tvlUsd) / 1e8));
  return clamp(value / Math.max(1, tvlUsd), MULTIPLE_MIN, MULTIPLE_MAX);
}

/** The median miss multiple of a predictor: exp(median |ln(real) - ln(predicted)|). */
function missMultiple(peers: SnapshotProtocol[], predict: (p: SnapshotProtocol) => number): number {
  const errs = peers.map((p) => Math.abs(ln(p.mcap_usd!) - ln(Math.max(1, predict(p))))).sort((x, y) => x - y);
  return Math.exp(median(errs));
}

/** Leave-one-out median miss multiple of a predictor built by `fitFn` on the other peers. */
function looMiss(peers: SnapshotProtocol[], fitFn: (train: SnapshotProtocol[]) => (p: SnapshotProtocol) => number): number {
  const errs: number[] = [];
  for (let i = 0; i < peers.length; i++) {
    const rest = peers.filter((_, j) => j !== i);
    const predict = fitFn(rest);
    errs.push(Math.abs(ln(peers[i]!.mcap_usd!) - ln(Math.max(1, predict(peers[i]!)))));
  }
  errs.sort((a, b) => a - b);
  return Math.exp(median(errs));
}

/** A 3-regressor OLS fit (intercept, ln TVL, one extra term) by normal equations. */
function olsFit2(peers: SnapshotProtocol[], term: (p: SnapshotProtocol) => number): ((p: SnapshotProtocol) => number) | null {
  const X = peers.map((p) => [1, ln(p.tvl_usd / 1e8), term(p)]);
  const y = peers.map((p) => ln(p.mcap_usd!));
  const XtX = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const XtY = [0, 0, 0];
  for (let i = 0; i < peers.length; i++) {
    for (let r = 0; r < 3; r++) {
      XtY[r]! += X[i]![r]! * y[i]!;
      for (let c = 0; c < 3; c++) XtX[r]![c]! += X[i]![r]! * X[i]![c]!;
    }
  }
  const M = XtX.map((row, i) => [...row, XtY[i]!]);
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    const d = M[c]![c]!;
    if (Math.abs(d) < 1e-12) return null;
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / d;
      for (let k = c; k < 4; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  const coef = [M[0]![3]! / M[0]![0]!, M[1]![3]! / M[1]![1]!, M[2]![3]! / M[2]![2]!];
  if (!coef.every(Number.isFinite)) return null;
  return (p: SnapshotProtocol) => Math.exp(coef[0]! + coef[1]! * ln(p.tvl_usd / 1e8) + coef[2]! * term(p));
}

/** Weighted least squares on ln(mcap) = a + b x ln(TVL / $100M). */
function wlsFit(peers: SnapshotProtocol[], weights: number[]): { a: number; b: number } {
  const xs = peers.map((p) => ln(p.tvl_usd / 1e8));
  const ys = peers.map((p) => ln(p.mcap_usd!));
  const sw = weights.reduce((s, v) => s + v, 0);
  const mx = xs.reduce((s, v, i) => s + v * weights[i]!, 0) / sw;
  const my = ys.reduce((s, v, i) => s + v * weights[i]!, 0) / sw;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += weights[i]! * (xs[i]! - mx) * (ys[i]! - my);
    sxx += weights[i]! * (xs[i]! - mx) ** 2;
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  return { a: my - b * mx, b };
}

/** Least absolute deviations on the log curve, by iteratively reweighted least
 *  squares: it fits the conditional median, which is what the median-miss
 *  metric scores — the OLS mean fit is not the metric's own optimum. */
function ladFit(peers: SnapshotProtocol[]): { a: number; b: number } {
  let { a, b } = olsFit(peers);
  for (let it = 0; it < 60; it++) {
    const w = peers.map((p) => 1 / Math.max(Math.abs(ln(p.mcap_usd!) - (a + b * ln(p.tvl_usd / 1e8))), 0.05));
    const f = wlsFit(peers, w);
    const da = Math.abs(f.a - a);
    const db = Math.abs(f.b - b);
    a = f.a;
    b = f.b;
    if (da < 1e-9 && db < 1e-9) break;
  }
  return { a, b };
}

/** Theil–Sen on the log curve: the median pairwise slope, robust to a few
 *  wild caps the OLS mean chases. */
function theilSenFit(peers: SnapshotProtocol[]): { a: number; b: number } {
  const slopes: number[] = [];
  for (let i = 0; i < peers.length; i++) {
    for (let j = i + 1; j < peers.length; j++) {
      const dx = ln(peers[j]!.tvl_usd / 1e8) - ln(peers[i]!.tvl_usd / 1e8);
      if (Math.abs(dx) > 1e-9) slopes.push((ln(peers[j]!.mcap_usd!) - ln(peers[i]!.mcap_usd!)) / dx);
    }
  }
  const b = medianOf(slopes);
  const a = medianOf(peers.map((p) => ln(p.mcap_usd!) - b * ln(p.tvl_usd / 1e8)));
  return { a, b };
}

/** OLS after dropping the peers whose residual is more than 2.5 robust
 *  sigmas from the median residual, refitted once. The rule is stated so a
 *  reader can repeat it. */
function trimmedFit(peers: SnapshotProtocol[]): { a: number; b: number; dropped: number } {
  const f0 = olsFit(peers);
  const res = peers.map((p) => ln(p.mcap_usd!) - (f0.a + f0.b * ln(p.tvl_usd / 1e8)));
  const med = medianOf(res);
  const mad = medianOf(res.map((v) => Math.abs(v - med))) || 1;
  const sigma = 1.4826 * mad;
  const keep = peers.filter((_, i) => Math.abs(res[i]! - med) <= 2.5 * sigma);
  const f = olsFit(keep);
  return { ...f, dropped: peers.length - keep.length };
}

/** Category effects on log value: mean residual per category, shrunk by k pseudo-observations, only for categories with minN peers. */
function categoryEffects(peers: SnapshotProtocol[], predict0: (p: SnapshotProtocol) => number, k: number = CAT_SHRINK_K): Map<string, number> {
  const res = new Map<string, number[]>();
  for (const p of peers) {
    const r = ln(p.mcap_usd!) - ln(Math.max(1, predict0(p)));
    const key = p.category ?? 'Unknown';
    if (!res.has(key)) res.set(key, []);
    res.get(key)!.push(r);
  }
  const eff = new Map<string, number>();
  for (const [key, rs] of res) {
    if (rs.length < CAT_MIN_N) continue;
    const mean = rs.reduce((s, v) => s + v, 0) / rs.length;
    eff.set(key, mean * (rs.length / (rs.length + k)));
  }
  return eff;
}

/** The size curve plus shrunk category intercepts: the curve first, then each
 *  category's mean residual, pulled toward zero by k pseudo-observations. */
function catInterceptPredict(trainPeers: SnapshotProtocol[], k: number): (p: SnapshotProtocol) => number {
  const f = olsFit(trainPeers);
  const p0 = (p: SnapshotProtocol) => Math.exp(f.a + f.b * ln(p.tvl_usd / 1e8));
  const eff = categoryEffects(trainPeers, p0, k);
  return (p: SnapshotProtocol) => p0(p) * Math.exp(eff.get(p.category ?? 'Unknown') ?? 0);
}

/** A fixed-seed PRNG, so bootstrap refits agree byte for byte between runs. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a, 32-bit, hex: the dashboard recomputes it over the board it renders. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The sigmoid, clamped so a far-out row cannot overflow it. */
function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
}

/** The Brier score of (outcome, probability) pairs: lower is better. */
function brier(pairs: [number, number][]): number {
  return pairs.reduce((s, [y, p]) => s + (y - p) ** 2, 0) / Math.max(1, pairs.length);
}

/** The odds features, in ladder order. A rejected term stays out: the kept list, not a position, decides what the model uses. A feature may take `ctx`, the training peers it is fitted on: the category token rate is computed from that set only, so a held-out protocol never rates itself. */
export const ODDS_FEATURES: { name: string; fn: (p: SnapshotProtocol, asOf: string, ctx?: SnapshotProtocol[]) => number }[] = [
  { name: 'age, ln days listed', fn: (p, asOf) => ln(Math.max(1, ageDays(asOf, p.listed_at) ?? 365)) },
  { name: 'size, ln TVL', fn: (p) => ln(Math.max(1, p.tvl_usd) / 1e8) },
  { name: '7-day TVL growth', fn: (p) => clamp(finite(p.change_7d, 0), -50, 150) / 100 },
  { name: 'chain count, ln', fn: (p) => ln(Math.max(1, p.chains.length)) },
  {
    name: 'category token rate, shrunk',
    fn: (p, _asOf, ctx) => {
      const train = ctx ?? [];
      const base = train.length > 0 ? train.filter((q) => !isPreToken(q)).length / train.length : 0.5;
      const same = train.filter((q) => q.category === p.category);
      if (same.length < 3) return base;
      const rate = same.filter((q) => !isPreToken(q)).length / same.length;
      return (rate * same.length + 0.5 * CAT_RATE_K) / (same.length + CAT_RATE_K);
    },
  },
  { name: '7-day growth × size', fn: (p) => (clamp(finite(p.change_7d, 0), -50, 150) / 100) * ln(Math.max(1, p.tvl_usd) / 1e8) },
];

/** A protocol's token odds under fitted coefficients `beta` and the kept feature list `terms` (indices into ODDS_FEATURES). `ctx` is the peer set the category rate is read from: the full dated peers when scoring the board. */
export function tokenOdds(p: SnapshotProtocol, asOf: string, beta: number[], terms: number[], ctx?: SnapshotProtocol[]): number {
  const x = [1, ...terms.map((i) => ODDS_FEATURES[i]!.fn(p, asOf, ctx))];
  return sigmoid(x.reduce((s, v, i) => s + v * beta[i]!, 0));
}

/** The value ladder: flat baseline, then the size curve, then each candidate term in turn. A term is kept only when it improves the walk-forward miss by more than the keep margin without making the leave-one-out miss worse. */
function valueLadder(peers: SnapshotProtocol[], dated: SnapshotProtocol[], asOf: string): { ladder: LadderRow[]; fit: { a: number; b: number } } {
  const half = Math.floor(dated.length / 2);
  const train = dated.slice(0, half);
  const test = dated.slice(half);
  // The flat baseline is fitted on the training peers only: a held-out number
  // must not peek at the peer it scores, not even through a median.
  const flatLoo = looMiss(peers, (rest) => {
    const m = median(rest.map((q) => q.mcap_usd! / q.tvl_usd).sort((a, b) => a - b));
    return (p: SnapshotProtocol) => p.tvl_usd * m;
  });
  const flatTrainMult = median(train.map((q) => q.mcap_usd! / q.tvl_usd).sort((a, b) => a - b));
  const flatWf = missMultiple(test, (p: SnapshotProtocol) => p.tvl_usd * flatTrainMult);
  const ladder: LadderRow[] = [
    { term: 'flat median multiple', loo: flatLoo, wf: flatWf, fold5: null, base: null, kept: false, note: 'baseline' },
  ];
  const sizeFit = olsFit(peers);
  const sizePred = (p: SnapshotProtocol) => Math.exp(sizeFit.a + sizeFit.b * ln(p.tvl_usd / 1e8));
  const sizeLoo = looMiss(peers, (rest) => {
    const f = olsFit(rest);
    return (p: SnapshotProtocol) => Math.exp(f.a + f.b * ln(p.tvl_usd / 1e8));
  });
  const trainFit = olsFit(train);
  const sizeWf = missMultiple(test, (p: SnapshotProtocol) => Math.exp(trainFit.a + trainFit.b * ln(p.tvl_usd / 1e8)));
  ladder.push({
    term: 'size curve, ln TVL',
    loo: sizeLoo,
    wf: sizeWf,
    fold5: null,
    base: null,
    kept: keeps([sizeWf, sizeLoo], [flatWf, flatLoo]),
    note: keeps([sizeWf, sizeLoo], [flatWf, flatLoo]) ? 'kept' : 'tested, not kept',
  });
  // Category effect, shrunk, on top of the size curve.
  const catLoo = looMiss(peers, (rest) => {
    const f = olsFit(rest);
    const p0 = (p: SnapshotProtocol) => Math.exp(f.a + f.b * ln(p.tvl_usd / 1e8));
    const eff = categoryEffects(rest, p0);
    return (p: SnapshotProtocol) => p0(p) * Math.exp(eff.get(p.category ?? 'Unknown') ?? 0);
  });
  const catWf = (() => {
    const f = olsFit(train);
    const p0 = (p: SnapshotProtocol) => Math.exp(f.a + f.b * ln(p.tvl_usd / 1e8));
    const eff = categoryEffects(train, p0);
    return missMultiple(test, (p) => p0(p) * Math.exp(eff.get(p.category ?? 'Unknown') ?? 0));
  })();
  ladder.push({
    term: 'category effect, shrunk',
    loo: catLoo,
    wf: catWf,
    fold5: null,
    base: null,
    kept: keeps([catWf, catLoo], [sizeWf, sizeLoo]),
    note: keeps([catWf, catLoo], [sizeWf, sizeLoo]) ? 'kept' : 'tested, not kept',
  });
  // One extra regressor at a time, on top of the size curve.
  const extraTerms: { name: string; term: (p: SnapshotProtocol) => number }[] = [
    { name: '7-day TVL growth', term: (p) => clamp(finite(p.change_7d, 0), -50, 150) / 100 },
    { name: 'age, ln days listed', term: (p) => ln(Math.max(1, ageDays(asOf, p.listed_at) ?? 365)) },
    { name: 'chain count, ln', term: (p) => ln(Math.max(1, p.chains.length)) },
  ];
  for (const { name, term } of extraTerms) {
    const loo = looMiss(peers, (rest) => {
      const f = olsFit2(rest, term);
      if (f === null) return sizePred;
      return f;
    });
    const wf = (() => {
      const f = olsFit2(train, term);
      return f === null ? sizeWf : missMultiple(test, f);
    })();
    ladder.push({
      term: name,
      loo,
      wf,
      fold5: null,
      base: null,
      kept: keeps([wf, loo], [sizeWf, sizeLoo]),
      note: keeps([wf, loo], [sizeWf, sizeLoo]) ? 'kept' : 'tested, not kept',
    });
  }
  // Whole-curve alternatives to the OLS size curve, scored the same way. The
  // score is a median miss, so a median fit (LAD), a robust slope
  // (Theil–Sen) and a trimmed refit are live candidates, not decorations;
  // the category intercepts are tried at two more shrink strengths besides
  // the k=64 row above, and a size-weighted fit (bigger protocols carry
  // steadier multiples). None of them is in the model unless it improves
  // the walk-forward miss by more than the keep margin without making the
  // leave-one-out miss worse.
  const curveAlts: { name: string; fitFn: (train: SnapshotProtocol[]) => (p: SnapshotProtocol) => number }[] = [
    {
      name: 'LAD size curve (median fit)',
      fitFn: (t) => {
        const f = ladFit(t);
        return (p: SnapshotProtocol) => Math.exp(f.a + f.b * ln(p.tvl_usd / 1e8));
      },
    },
    {
      name: 'Theil–Sen size curve',
      fitFn: (t) => {
        const f = theilSenFit(t);
        return (p: SnapshotProtocol) => Math.exp(f.a + f.b * ln(p.tvl_usd / 1e8));
      },
    },
    {
      name: 'OLS, |resid| > 2.5 robust-sigma dropped once',
      fitFn: (t) => {
        const f = trimmedFit(t);
        return (p: SnapshotProtocol) => Math.exp(f.a + f.b * ln(p.tvl_usd / 1e8));
      },
    },
    { name: 'category intercepts, shrunk k=16', fitFn: (t) => catInterceptPredict(t, 16) },
    { name: 'category intercepts, shrunk k=256', fitFn: (t) => catInterceptPredict(t, 256) },
    {
      name: 'WLS size curve, weight ln(TVL)',
      fitFn: (t) => {
        const f = wlsFit(t, t.map((p) => Math.max(0.1, ln(p.tvl_usd / 1e8))));
        return (p: SnapshotProtocol) => Math.exp(f.a + f.b * ln(p.tvl_usd / 1e8));
      },
    },
  ];
  for (const { name, fitFn } of curveAlts) {
    const loo = looMiss(peers, fitFn);
    const wf = missMultiple(test, fitFn(train));
    ladder.push({
      term: name,
      loo,
      wf,
      fold5: null,
      base: null,
      kept: keeps([wf, loo], [sizeWf, sizeLoo]),
      note: keeps([wf, loo], [sizeWf, sizeLoo]) ? 'kept' : 'tested, not kept',
    });
  }
  return { ladder, fit: sizeFit };
}

/** The AUC of (outcome, probability) pairs, by the rank method with tied ranks averaged. */
function auc(pairs: [number, number][]): number {
  const nPos = pairs.filter(([y]) => y === 1).length;
  const nNeg = pairs.length - nPos;
  if (nPos === 0 || nNeg === 0) return 0.5;
  const sorted = pairs.map(([y, p], i) => ({ y, p, i })).sort((a, b) => a.p - b.p || a.i - b.i);
  let rankSum = 0;
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1]!.p === sorted[i]!.p) j++;
    const avgRank = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k++) if (sorted[k]!.y === 1) rankSum += avgRank;
    i = j + 1;
  }
  return (rankSum - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

/** The odds ladder: base rate, then each candidate feature appended to the kept list in turn. A term is kept only when it improves the walk-forward Brier by more than the keep margin without making the 5-fold Brier worse. Features are positional, so a rejected term is never smuggled in by a later one. The category token rate is NOT a candidate for keeping: it is a marginal average over protocols of very different ages, so it measures the category's age as much as its behaviour, and one feature swinging more than a logit and a half on the top pair makes the board fragile. The ladder still sweeps its shrink strengths as a diagnostic — the sweep and the with/without comparison below show what keeping it would have cost and gained — but the rate never enters the model. */
function oddsLadder(peers: SnapshotProtocol[], asOf: string): { ladder: LadderRow[]; beta: number[]; terms: number[]; baseRate: number; aucFold5: number; catRateK: number; catRateSweep: { k: number; fold5: number; wf: number }[]; catRateDiagnostic: { k: number; withFold5: number; withWf: number; withoutFold5: number; withoutWf: number }; locoBrier: number; lochoBrier: number } {
  const sorted = [...peers].sort((a, b) => ((a.listed_at ?? '') < (b.listed_at ?? '') ? -1 : 1));
  const folds: SnapshotProtocol[][] = [[], [], [], [], []];
  sorted.forEach((p, i) => folds[i % 5]!.push(p));
  const half = Math.floor(sorted.length / 2);
  const trainW = sorted.slice(0, half);
  const testW = sorted.slice(half);
  const baseRate = peers.filter((p) => !isPreToken(p)).length / peers.length;
  const rowsFor = (ps: SnapshotProtocol[], terms: number[]) =>
    ps.map((p) => ({ y: isPreToken(p) ? 0 : 1, x: [1, ...terms.map((i) => ODDS_FEATURES[i]!.fn(p, asOf, ps))] }));
  const predictWith = (beta: number[] | null, fallback: number, terms: number[], ctx: SnapshotProtocol[]) => (p: SnapshotProtocol): number =>
    beta === null ? fallback : sigmoid([1, ...terms.map((i) => ODDS_FEATURES[i]!.fn(p, asOf, ctx))].reduce((s, v, i) => s + v * beta[i]!, 0));
  const evalTerms = (terms: number[]): { fold5: number; base5: number; wf: number; baseWf: number } => {
    let num = 0;
    let den = 0;
    let numB = 0;
    for (let f = 0; f < 5; f++) {
      const testF = folds[f]!;
      const trainF = folds.flatMap((x, i) => (i === f ? [] : x));
      const beta = fitLogitBeta(rowsFor(trainF, terms), terms.length + 1);
      const b = trainF.filter((p) => !isPreToken(p)).length / trainF.length;
      const predict = predictWith(beta, b, terms, trainF);
      for (const p of testF) {
        const y = isPreToken(p) ? 0 : 1;
        num += (y - predict(p)) ** 2;
        numB += (y - b) ** 2;
        den++;
      }
    }
    const betaW = fitLogitBeta(rowsFor(trainW, terms), terms.length + 1);
    const bW = trainW.filter((p) => !isPreToken(p)).length / trainW.length;
    const predictW = predictWith(betaW, bW, terms, trainW);
    const wf = brier(testW.map((p) => [isPreToken(p) ? 0 : 1, predictW(p)] as [number, number]));
    const baseWf = brier(testW.map((p) => [isPreToken(p) ? 0 : 1, bW] as [number, number]));
    return { fold5: num / den, base5: numB / den, wf, baseWf };
  };
  const base = evalTerms([]);
  const ladder: LadderRow[] = [
    { term: 'base rate of peers', loo: null, wf: base.baseWf, fold5: base.base5, base: null, kept: false, note: 'baseline' },
  ];
  let prevFold5 = base.base5;
  let prevWf = base.baseWf;
  const kept: number[] = [];
  const catIdx = ODDS_FEATURES.findIndex((f) => f.name.startsWith('category token rate'));
  let catRateK = 5;
  const catRateSweep: { k: number; fold5: number; wf: number }[] = [];
  for (let i = 0; i < ODDS_FEATURES.length; i++) {
    if (i === catIdx) {
      // Diagnostic sweep only: for each k, the rate is pulled toward one
      // half by k pseudo-observations and the term is scored on both tests,
      // so the record shows what keeping it would have done. The rate is
      // never kept, whatever the sweep says: it is a marginal average over
      // protocols of very different ages, and a single feature must not
      // decide the board's top. Nothing about the board's top rows enters
      // this choice either way: the sweep is scored on the held-out tests
      // alone, and the policy is stated here, not fitted.
      let best: { k: number; fold5: number; wf: number } | null = null;
      let bestAny: { k: number; fold5: number; wf: number } | null = null;
      for (const k of CAT_RATE_K_SWEEP) {
        setCategoryRateK(k);
        const r = evalTerms([...kept, i]);
        catRateSweep.push({ k, fold5: r.fold5, wf: r.wf });
        if (bestAny === null || r.fold5 < bestAny.fold5) bestAny = { k, fold5: r.fold5, wf: r.wf };
        const passes = keeps([r.wf, r.fold5], [prevWf, prevFold5]);
        if (passes && (best === null || r.fold5 < best.fold5 || (r.fold5 === best.fold5 && k > best.k))) {
          best = { k, fold5: r.fold5, wf: r.wf };
        }
      }
      catRateK = best !== null ? best.k : 5;
      setCategoryRateK(catRateK);
      const shown = best ?? bestAny!;
      ladder.push({
        term: `${ODDS_FEATURES[i]!.name} (sweep k=${catRateK})`,
        loo: null,
        wf: shown.wf,
        fold5: shown.fold5,
        base: null,
        kept: false,
        note: 'diagnostic only, not kept: era-confounded marginal rate',
      });
      continue;
    }
    const trial = [...kept, i];
    const r = evalTerms(trial);
    const isKept = keeps([r.wf, r.fold5], [prevWf, prevFold5]);
    ladder.push({
      term: ODDS_FEATURES[i]!.name,
      loo: null,
      wf: r.wf,
      fold5: r.fold5,
      base: null,
      kept: isKept,
      note: isKept ? 'kept' : 'tested, not kept',
    });
    if (isKept) {
      kept.push(i);
      prevFold5 = r.fold5;
      prevWf = r.wf;
    }
  }
  setCategoryRateK(catRateK);
  // The with/without diagnostic: the kept set plus the category rate at the
  // sweep's best strength, against the kept set alone — the honest price of
  // dropping the rate, on the same two tests.
  const withRate = evalTerms([...kept, catIdx]);
  const catRateDiagnostic = {
    k: catRateK,
    withFold5: withRate.fold5,
    withWf: withRate.wf,
    withoutFold5: prevFold5,
    withoutWf: prevWf,
  };
  // Leave-one-group-out Brier of the kept model: each protocol is scored by
  // a model fitted without its whole category (then without its whole
  // chain), so the number says whether the odds travel to a category or a
  // chain the model has never seen.
  const groupBrier = (keyOf: (p: SnapshotProtocol) => string): number => {
    let num = 0;
    let den = 0;
    const groups = new Map<string, SnapshotProtocol[]>();
    for (const p of peers) {
      const k = keyOf(p);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    }
    for (const [, members] of groups) {
      const trainG = peers.filter((p) => !members.includes(p));
      if (trainG.length === 0) continue;
      const betaG = fitLogitBeta(rowsFor(trainG, kept), kept.length + 1);
      const bG = trainG.filter((p) => !isPreToken(p)).length / trainG.length;
      const predictG = predictWith(betaG, bG, kept, trainG);
      for (const p of members) {
        const y = isPreToken(p) ? 0 : 1;
        num += (y - predictG(p)) ** 2;
        den++;
      }
    }
    return den === 0 ? baseRate : num / den;
  };
  const locoBrier = groupBrier((p) => p.category ?? 'Unknown');
  const lochoBrier = groupBrier((p) => chainOf(p));
  const beta = fitLogitBeta(rowsFor(peers, kept), kept.length + 1) ?? [ln(baseRate / (1 - baseRate))];
  // The 5-fold AUC of the kept model, from out-of-fold predictions: each fold is
  // scored by a model fitted without it, so the number is held out, not in-sample.
  const oof: [number, number][] = [];
  for (let f = 0; f < 5; f++) {
    const testF = folds[f]!;
    const trainF = folds.flatMap((x, i) => (i === f ? [] : x));
    const betaF = fitLogitBeta(rowsFor(trainF, kept), kept.length + 1);
    const bF = trainF.filter((p) => !isPreToken(p)).length / trainF.length;
    const predictF = predictWith(betaF, bF, kept, trainF);
    for (const p of testF) oof.push([isPreToken(p) ? 0 : 1, predictF(p)]);
  }
  return { ladder, beta, terms: kept, baseRate, aucFold5: auc(oof), catRateK, catRateSweep, catRateDiagnostic, locoBrier, lochoBrier };
}

/** IRLS again, this time returning the coefficients themselves. */
function fitLogitBeta(rows: { y: number; x: number[] }[], width: number): number[] | null {
  const k = width;
  const ones = rows.filter((r) => r.y === 1).length;
  const beta = new Array<number>(k).fill(0);
  beta[0] = ln((ones + 0.5) / (rows.length - ones + 0.5));
  for (let iter = 0; iter < 50; iter++) {
    const XtX = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    const XtR = new Array<number>(k).fill(0);
    let maxStep = 0;
    for (const r of rows) {
      const z = r.x.reduce((s, v, i) => s + v * beta[i]!, 0);
      const p = sigmoid(z);
      const w = Math.max(1e-6, p * (1 - p));
      const resid = r.y - p;
      for (let i = 0; i < k; i++) {
        XtR[i]! += r.x[i]! * resid;
        for (let j = 0; j < k; j++) XtX[i]![j]! += w * r.x[i]! * r.x[j]!;
      }
    }
    for (let i = 0; i < k; i++) XtX[i]![i]! += 1e-6;
    const M = XtX.map((row, i) => [...row, XtR[i]!]);
    let singular = false;
    for (let c = 0; c < k; c++) {
      let piv = c;
      for (let r = c + 1; r < k; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
      [M[c], M[piv]] = [M[piv]!, M[c]!];
      const d = M[c]![c]!;
      if (Math.abs(d) < 1e-12) { singular = true; break; }
      for (let r = 0; r < k; r++) {
        if (r === c) continue;
        const f = M[r]![c]! / d;
        for (let j = c; j <= k; j++) M[r]![j]! -= f * M[c]![j]!;
      }
    }
    if (singular) return null;
    const step = M.map((row, i) => row[k]! / row[i]!);
    for (let i = 0; i < k; i++) {
      beta[i]! += step[i]!;
      maxStep = Math.max(maxStep, Math.abs(step[i]!));
    }
    if (maxStep < 1e-8) break;
  }
  return beta.every(Number.isFinite) ? beta : null;
}

/** The first chain a protocol names, or 'other' when it names none. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'other';
}

/** Gas per transaction for a protocol, from its first chain's planning estimate. */
function gasUsd(p: SnapshotProtocol): number {
  return GAS_USD[chainOf(p)] ?? GAS_DEFAULT_USD;
}

/** The default deposit for a farm plan: a flat $5,000 (see DEFAULT_DEPOSIT_USD). The TVL argument stays so callers need not change, and so a future snapshot can revisit the rule in one place. */
export function defaultDeposit(_tvlUsd: number): number {
  return DEFAULT_DEPOSIT_USD;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The qualifying action for the protocol's category, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): { action: string; weekly: string } {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return {
      action: `Supply $${capital} of USDC to ${name} on ${chain} as collateral and borrow a small amount against it.`,
      weekly: `Repay part of the loan and borrow again, or top up the supply, so the position moves every week.`,
    };
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) {
    return {
      action: `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`,
      weekly: `Claim any rewards, swap a small amount through the pool, and re-add the liquidity.`,
    };
  }
  if (c.includes('bridge')) {
    return {
      action: `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`,
      weekly: `Bridge a small amount back and forth so the route is used in more than one week.`,
    };
  }
  if (c.includes('staking') || c.includes('restak')) {
    return {
      action: `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`,
      weekly: `Restake the rewards, or stake a small extra amount, so the stake grows every week.`,
    };
  }
  if (c.includes('perpetual') || c.includes('derivative')) {
    return {
      action: `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`,
      weekly: `Close and reopen a small position, keeping the margin deposited throughout.`,
    };
  }
  if (c.includes('prediction')) {
    return {
      action: `Fund $${capital} and place one market position on ${name} on ${chain}.`,
      weekly: `Place one more small position on a new market each week.`,
    };
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) {
    return {
      action: `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares.`,
      weekly: `Move a small amount between the vault's strategies, or top up the deposit.`,
    };
  }
  if (c.includes('stable')) {
    return {
      action: `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`,
      weekly: `Mint a little more, or use the stable asset in one swap, each week.`,
    };
  }
  if (c.includes('rwa')) {
    return {
      action: `Mint $${capital} of the protocol's yield asset on ${chain} and hold it in your wallet.`,
      weekly: `Claim the yield and mint a small extra amount with it.`,
    };
  }
  if (c.includes('insurance')) {
    return {
      action: `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`,
      weekly: `Check the policy and, if a new cover pool opens, add a small amount to it.`,
    };
  }
  return {
    action: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    weekly: `Make one deposit, swap or vote in the protocol's app each week.`,
  };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  const cost = step.cost_usd === 0 ? 'free' : `$${step.cost_usd.toFixed(2)}`;
  const time = step.minutes >= 60 ? `${(step.minutes / 60).toFixed(1)} h` : `${step.minutes} min`;
  let s = `${step.text} Cost: ${cost}. Time: ${time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: ten steps, each an action with a dollar cost and minutes.
 * The plan is derived from the protocol's own record (category, chains, TVL, age),
 * never from a hand-written list of names. Gas is counted per transaction on the
 * protocol's first chain, at the planning estimate in GAS_USD.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, deposit: number): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasUsd(p);
  const hold = holdDaysFor(age);
  const { action, weekly } = actionFor(p, deposit, chain);
  const weeks = FARM.horizon_weeks;
  return [
    { text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`, cost_usd: gas, minutes: 5 },
    { text: `Read the protocol's own docs or points page first and confirm the action below is one it counts toward a distribution; note the date it started counting, and make the first move before any snapshot it announces.`, cost_usd: 0, minutes: 15 },
    { text: `Move $${deposit} of USDC to ${chain} from an exchange that lists it, or bridge it in from a chain you already use.`, cost_usd: gas, minutes: 15 },
    { text: `Read the strategy or docs and write down what can fail: a vault stacks other protocols beneath it, a bridge can pause, a stable asset can depeg.`, cost_usd: 0, minutes: 10 },
    { text: action, cost_usd: 2 * gas, minutes: 15 },
    { text: `Deepen the position once: top up the deposit or use a second feature of the app, so the wallet shows more than a single deposit.`, cost_usd: gas, minutes: 10 },
    { text: `${weekly} Do it once a week for ${weeks} weeks.`, cost_usd: weeks * gas, minutes: 5 * weeks },
    { text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot. Decide the exit before you enter: if the position falls 20% below the $${deposit} you put in, or the protocol announces a token or a snapshot, withdraw within a day; never leave the whole amount in one protocol.`, cost_usd: 0, minutes: 5 },
    { text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes, never from a link in a message.`, cost_usd: gas, minutes: 10 },
    { text: `Write the wallet, the dates and every transaction hash in a farm log so you can repeat the position or unwind it.`, cost_usd: 0, minutes: 5 },
  ];
}

/** The farm verdict at a deposit, drop share and horizon: modelled drop, fees, net, net per hour, and the verdict against the two bars. */
export function farmVerdict(implied: number, tvlUsd: number, feesUsd: number, minutes: number, deposit: number, dropShare: number, horizonWeeks: number): Verdict {
  const drop = implied * (deposit / Math.max(1, tvlUsd)) * dropShare;
  const net = drop - feesUsd;
  const hours = Math.max(0.5, minutes / 60);
  const netPerHour = net / hours;
  const tbill = deposit * FARM.tbill_rate * (horizonWeeks / 52);
  const verdict: Verdict['verdict'] = net > tbill && netPerHour >= FARM.hour_bar_usd ? 'FARM' : net > 0 ? 'MARGINAL' : 'SKIP';
  return {
    verdict,
    deposit_usd: deposit,
    drop_usd: Math.round(drop * 100) / 100,
    fees_usd: Math.round(feesUsd * 100) / 100,
    net_usd: Math.round(net * 100) / 100,
    net_per_hour: Math.round(netPerHour * 100) / 100,
    hands_on_minutes: minutes,
    tbill_usd: Math.round(tbill * 100) / 100,
  };
}

/** Everything the fits compute once per snapshot: both ladders, the curve, the odds, the residual quantiles, and the two extra held-out tests per side. */
export interface Fits {
  value_ladder: LadderRow[];
  fit: { a: number; b: number };
  odds_ladder: LadderRow[];
  beta: number[];
  terms: number[];
  base_rate: number;
  auc_fold5: number;
  cat_rate_k: number;
  cat_rate_sweep: { k: number; fold5: number; wf: number }[];
  cat_rate_diagnostic: { k: number; withFold5: number; withWf: number; withoutFold5: number; withoutWf: number };
  loco_brier: number;
  locho_brier: number;
  q10: number;
  q25: number;
  q75: number;
  q90: number;
  /** Leave-one-category-out and leave-one-chain-out median miss of the size curve. */
  loco_miss: number;
  locho_miss: number;
  /** Per-category leave-one-out residual bands, for categories with at least
   *  CAT_BAND_MIN_N priced peers; other categories use the global band. */
  cat_quantiles: Record<string, { n: number; q10: number; q25: number; q75: number; q90: number }>;
  /** Share of priced caps inside their own category's band, validated
   *  leave-one-out (each peer's band excludes the peer itself). */
  range_cat_p2575: number;
  range_cat_p1090: number;
  range_cat_n: number;
}

/** A category carries its own residual band only when it has this many priced peers; fewer, and the global band is the honest one. */
export const CAT_BAND_MIN_N = 8;

/** Fit everything once: the value ladder, the odds ladder, the leave-one-out residuals for the printed ranges, and the two extra held-out tests per side. */
export function fitAll(snapshot: Snapshot): Fits {
  const peers = snapshot.protocols.filter((p) => !isPreToken(p) && isClean(p) && (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0);
  const datedPeers = peers.filter((p) => p.listed_at !== null).sort((a, b) => ((a.listed_at ?? '') < (b.listed_at ?? '') ? -1 : 1));
  const { ladder: valueLadderRows, fit } = valueLadder(peers, datedPeers, snapshot.as_of);
  // Each priced peer's residual under a curve fitted without it, kept with
  // the peer so the bands can be cut per category as well as globally.
  const looByPeer = peers.map((p, i) => {
    const rest = peers.filter((_, j) => j !== i);
    const f = olsFit(rest);
    return { p, res: ln(p.mcap_usd!) - ln(Math.max(1, Math.exp(f.a + f.b * ln(p.tvl_usd / 1e8)))) };
  });
  const looResiduals = looByPeer.map((x) => x.res).sort((a, b) => a - b);
  const q = (x: number) => looResiduals[Math.min(looResiduals.length - 1, Math.max(0, Math.floor(x * looResiduals.length)))]!;
  const quantilesOf = (values: number[]) => {
    const s = [...values].sort((a, b) => a - b);
    const at = (x: number) => s[Math.min(s.length - 1, Math.max(0, Math.floor(x * s.length)))]!;
    return { q10: at(0.1), q25: at(0.25), q75: at(0.75), q90: at(0.9) };
  };
  // Leave-one-group-out median miss of the size curve: each priced peer is
  // scored by a curve fitted without its whole category (then without its
  // whole chain), so the number says whether the curve travels to a
  // category or a chain it has never seen.
  const groupMiss = (keyOf: (p: SnapshotProtocol) => string): number => {
    const groups = new Map<string, SnapshotProtocol[]>();
    for (const p of peers) {
      const k = keyOf(p);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    }
    const errs: number[] = [];
    for (const [, members] of groups) {
      const trainG = peers.filter((p) => !members.includes(p));
      if (trainG.length < 10) continue;
      const f = olsFit(trainG);
      for (const p of members) errs.push(Math.abs(ln(p.mcap_usd!) - ln(Math.max(1, Math.exp(f.a + f.b * ln(p.tvl_usd / 1e8))))));
    }
    errs.sort((a, b) => a - b);
    return Math.exp(median(errs));
  };
  const locoMiss = groupMiss((p) => p.category ?? 'Unknown');
  const lochoMiss = groupMiss((p) => chainOf(p));
  // Per-category residual bands, and their leave-one-out coverage: each
  // peer's band is cut from the other peers in its category, never from
  // itself, so the coverage is held out. Categories too thin for their own
  // band use the global one, and the count says how many carry their own.
  const byCat = new Map<string, number[]>();
  for (const { p, res } of looByPeer) {
    const k = p.category ?? 'Unknown';
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k)!.push(res);
  }
  const catQuantiles: Record<string, { n: number; q10: number; q25: number; q75: number; q90: number }> = {};
  for (const [k, rs] of byCat) {
    if (rs.length < CAT_BAND_MIN_N) continue;
    catQuantiles[k] = { n: rs.length, ...quantilesOf(rs) };
  }
  const globalQ = quantilesOf(looResiduals);
  let in2575 = 0;
  let in1090 = 0;
  for (const { p, res } of looByPeer) {
    const k = p.category ?? 'Unknown';
    const rs = byCat.get(k)!;
    // The band is cut from the category's other peers, by identity — never
    // from the peer itself, so the coverage is held out.
    const catPeers = looByPeer.filter((x) => (x.p.category ?? 'Unknown') === k);
    const others = catPeers.filter((x) => x.p !== p).map((x) => x.res);
    const b = rs.length >= CAT_BAND_MIN_N ? quantilesOf(others) : globalQ;
    if (res >= b.q25 && res <= b.q75) in2575++;
    if (res >= b.q10 && res <= b.q90) in1090++;
  }
  const rangeCatP2575 = in2575 / looByPeer.length;
  const rangeCatP1090 = in1090 / looByPeer.length;
  const rangeCatN = Object.keys(catQuantiles).length;
  const oddsPeers = snapshot.protocols.filter((p) => p.listed_at !== null && isClean(p));
  const { ladder: oddsLadderRows, beta, terms, baseRate, aucFold5, catRateK, catRateSweep, catRateDiagnostic, locoBrier, lochoBrier } = oddsLadder(oddsPeers, snapshot.as_of);
  return { value_ladder: valueLadderRows, fit, odds_ladder: oddsLadderRows, beta, terms, base_rate: baseRate, auc_fold5: aucFold5, cat_rate_k: catRateK, cat_rate_sweep: catRateSweep, cat_rate_diagnostic: catRateDiagnostic, loco_brier: locoBrier, locho_brier: lochoBrier, q10: q(0.1), q25: q(0.25), q75: q(0.75), q90: q(0.9), loco_miss: locoMiss, locho_miss: lochoMiss, cat_quantiles: catQuantiles, range_cat_p2575: rangeCatP2575, range_cat_p1090: rangeCatP1090, range_cat_n: rangeCatN };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, fits: Fits): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const rankable = [...chosen.values()];
  const { fit, beta, terms, q10, q25, q75, q90, cat_quantiles } = fits;
  // A row's range uses its own category's leave-one-out band where the
  // category has enough priced peers, and the global band otherwise: the
  // board rows are pre-token, never in the priced set, so no band ever
  // reads the row it prices.
  const bandFor = (category: string | null): { q10: number; q25: number; q75: number; q90: number } => {
    const b = cat_quantiles[category ?? 'Unknown'];
    return b === undefined ? { q10, q25, q75, q90 } : { q10: b.q10, q25: b.q25, q75: b.q75, q90: b.q90 };
  };
  // The dated, clean peers are the category-rate context: the same set the
  // odds were fitted on, so a row's odds read its own category's record.
  const oddsPeers = snapshot.protocols.filter((p) => p.listed_at !== null && isClean(p));

  // The priced comps: traded, clean, with a usable market cap. They fit the curve.
  const peers = snapshot.protocols.filter((p) => !isPreToken(p) && isClean(p) && (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0);

  // Bootstrap rank ranges: refit the curve on resampled peers, re-rank, record the 5th..95th rank.
  const rng = mulberry32(BOOTSTRAP_SEED);
  const rankSamples = new Map<string, number[]>();
  for (const p of rankable) rankSamples.set(p.slug, []);
  for (let b = 0; b < BOOTSTRAP_REFITS; b++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < peers.length; i++) sample.push(peers[Math.floor(rng() * peers.length)]!);
    const f = olsFit(sample);
    const scored = rankable
      .map((p) => ({
        slug: p.slug,
        implied: Math.max(1, Math.round(Math.exp(f.a + f.b * ln(Math.max(1, p.tvl_usd) / 1e8)) * tokenOdds(p, snapshot.as_of, beta, terms, oddsPeers))),
      }))
      .sort((x, y) => y.implied - x.implied || (x.slug < y.slug ? -1 : 1));
    scored.forEach((s, i) => rankSamples.get(s.slug)!.push(i + 1));
  }
  const rankRange = (slug: string): [number, number] => {
    const rs = [...rankSamples.get(slug)!].sort((a, b) => a - b);
    return [rs[Math.floor(0.05 * rs.length)]!, rs[Math.min(rs.length - 1, Math.floor(0.95 * rs.length))]!];
  };

  // Nearest priced peers for each row: same category first, then closest TVL.
  const peerRows = peers.map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    tvl_usd: p.tvl_usd,
    mcap_usd: p.mcap_usd!,
    multiple: p.mcap_usd! / p.tvl_usd,
    fitted_multiple: fittedMultiple(p.tvl_usd, fit),
  }));
  const nearestPeers = (p: SnapshotProtocol): PeerRef[] => {
    const sameCat = peerRows.filter((q) => q.category === p.category);
    const rest = peerRows.filter((q) => q.category !== p.category);
    const byTvl = (a: PeerRef, b: PeerRef) => Math.abs(ln(a.tvl_usd) - ln(p.tvl_usd)) - Math.abs(ln(b.tvl_usd) - ln(p.tvl_usd));
    return [...sameCat.sort(byTvl).slice(0, 3), ...rest.sort(byTvl).slice(0, 2)].slice(0, 5);
  };

  const scored = rankable.map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const multiple = fittedMultiple(p.tvl_usd, fit);
    const valueIfLaunches = Math.max(1, Math.round(p.tvl_usd * multiple));
    const odds = tokenOdds(p, snapshot.as_of, beta, terms, oddsPeers);
    const implied = Math.max(1, Math.round(valueIfLaunches * odds));
    const band = bandFor(p.category);
    const deposit = defaultDeposit(p.tvl_usd);
    const steps = farmSteps(p, age, deposit);
    const fees = steps.reduce((s, st) => s + st.cost_usd, 0);
    const minutes = steps.reduce((s, st) => s + st.minutes, 0);
    const verdict = farmVerdict(implied, p.tvl_usd, fees, minutes, deposit, FARM.drop_share, FARM.horizon_weeks);
    // The same plan priced at three fixed deposits, under the same two bars:
    // the verdict at each size, so a reader can see what a bigger cheque buys.
    const tierVerdicts: TierVerdict[] = TIER_DEPOSITS.map((dep) => {
      const v = farmVerdict(implied, p.tvl_usd, fees, minutes, dep, FARM.drop_share, FARM.horizon_weeks);
      return {
        deposit_usd: dep,
        verdict: v.verdict,
        drop_usd: v.drop_usd,
        net_usd: v.net_usd,
        net_per_hour: v.net_per_hour,
        tbill_usd: v.tbill_usd,
        share_of_tvl: Math.round((dep / Math.max(1, p.tvl_usd)) * 1e6) / 1e6,
      };
    });
    const [rankLo, rankHi] = rankRange(p.slug);
    return {
      p,
      age,
      multiple,
      valueIfLaunches,
      odds,
      implied,
      band,
      deposit,
      steps,
      fees,
      minutes,
      verdict,
      tierVerdicts,
      rankLo,
      rankHi,
    };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.age,
    implied_value_usd: s.implied,
    value_if_launches_usd: s.valueIfLaunches,
    fitted_multiple: Math.round(s.multiple * 1e4) / 1e4,
    token_odds: s.odds,
    range_lo_usd: Math.max(1, Math.round(s.valueIfLaunches * Math.exp(s.band.q25) * s.odds)),
    range_hi_usd: Math.max(1, Math.round(s.valueIfLaunches * Math.exp(s.band.q75) * s.odds)),
    range_p10_usd: Math.max(1, Math.round(s.valueIfLaunches * Math.exp(s.band.q10) * s.odds)),
    range_p90_usd: Math.max(1, Math.round(s.valueIfLaunches * Math.exp(s.band.q90) * s.odds)),
    rank_lo: s.rankLo,
    rank_hi: s.rankHi,
    verdict: s.verdict,
    tier_verdicts: s.tierVerdicts,
    peers: nearestPeers(s.p),
    farm_steps: s.steps.map(stepText),
  }));
}

/** The live-token protocols that price the curve, by market cap. */
export function liveRows(snapshot: Snapshot, fits: Fits): LiveRow[] {
  const peers = snapshot.protocols.filter((p) => !isPreToken(p) && isClean(p) && (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0);
  return peers
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      fitted_multiple: Math.round(fittedMultiple(p.tvl_usd, fits.fit) * 1e4) / 1e4,
    }));
}

/** Every snapshot protocol in exactly one accounting group; the counts sum to the snapshot size. */
export function accounting(snapshot: Snapshot, board: BoardRow[]): AccountGroup[] {
  const ranked = new Set(board.map((r) => r.slug));
  const watch = new Set(snapshot.watchlist);
  const rankedWatch = board.filter((r) => watch.has(r.slug)).length;
  const rankedEarly = board.length - rankedWatch;
  const traded = snapshot.protocols.filter((p) => !isPreToken(p));
  const peers = traded.filter((p) => isClean(p) && (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0).length;
  const noCap = traded.filter((p) => isClean(p) && !((p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0)).length;
  const tradedOut = traded.filter((p) => !isClean(p)).length;
  const preOut = snapshot.protocols.filter((p) => isPreToken(p) && !ranked.has(p.slug)).length;
  return [
    { label: 'Ranked · watchlist', count: rankedWatch },
    { label: 'Ranked · early, below the floor', count: rankedEarly },
    { label: 'Token trades · priced comp', count: peers },
    { label: 'Token recorded · no usable cap', count: noCap },
    { label: 'Token trades · out by the rule', count: tradedOut },
    { label: 'No token · out by the rule', count: preOut },
  ];
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const fits = fitAll(snapshot);
  // The odds ladder leaves the category-rate shrink at its chosen strength;
  // set it explicitly before any row is scored, so the board never reads a
  // strength left over from a rejected sweep trial.
  setCategoryRateK(fits.cat_rate_k);
  const board = buildBoard(snapshot, fits);
  const live = liveRows(snapshot, fits);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const peers = snapshot.protocols.filter((p) => !isPreToken(p) && isClean(p) && (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0);
  const valueLadderRows = fits.value_ladder;
  const oddsLadderRows = fits.odds_ladder;
  // The odds model's honest scores come from the ladder, not from re-scoring the data it was fitted on.
  const keptOdds = oddsLadderRows.filter((r) => r.kept);
  const lastKept = keptOdds.length > 0 ? keptOdds[keptOdds.length - 1]! : oddsLadderRows[0]!;
  const baseOdds = oddsLadderRows[0]!;
  // The range honesty is the share of leave-one-out residuals inside the printed bands.
  const looResiduals: number[] = [];
  for (let i = 0; i < peers.length; i++) {
    const rest = peers.filter((_, j) => j !== i);
    const f = olsFit(rest);
    looResiduals.push(ln(peers[i]!.mcap_usd!) - ln(Math.max(1, Math.exp(f.a + f.b * ln(peers[i]!.tvl_usd / 1e8)))));
  }
  looResiduals.sort((a, b) => a - b);
  const inBand = (lo: number, hi: number) => looResiduals.filter((r) => r >= lo && r <= hi).length / looResiduals.length;
  const valueFit: ValueFit = {
    a: Math.round(fits.fit.a * 1000) / 1000,
    b: Math.round(fits.fit.b * 1000) / 1000,
    n_peers: peers.length,
    flat_multiple: Math.round(median(peers.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b)) * 1e4) / 1e4,
    loo_miss: Math.round(valueLadderRows[1]!.loo! * 100) / 100,
    wf_miss: Math.round(valueLadderRows[1]!.wf! * 100) / 100,
    flat_loo_miss: Math.round(valueLadderRows[0]!.loo! * 100) / 100,
    flat_wf_miss: Math.round(valueLadderRows[0]!.wf! * 100) / 100,
    residual_q10: Math.round(fits.q10 * 100) / 100,
    residual_q25: Math.round(fits.q25 * 100) / 100,
    residual_q75: Math.round(fits.q75 * 100) / 100,
    residual_q90: Math.round(fits.q90 * 100) / 100,
    range_p2575: Math.round(inBand(fits.q25, fits.q75) * 1000) / 1000,
    range_p1090: Math.round(inBand(fits.q10, fits.q90) * 1000) / 1000,
    loco_miss: Math.round(fits.loco_miss * 100) / 100,
    locho_miss: Math.round(fits.locho_miss * 100) / 100,
    range_cat_p2575: Math.round(fits.range_cat_p2575 * 1000) / 1000,
    range_cat_p1090: Math.round(fits.range_cat_p1090 * 1000) / 1000,
    range_cat_n: fits.range_cat_n,
  };
  const oddsFit: OddsFit = {
    beta: fits.beta.map((b) => Math.round(b * 1000) / 1000),
    terms: fits.terms,
    n_peers: snapshot.protocols.filter((p) => p.listed_at !== null && isClean(p)).length,
    base_rate: Math.round(fits.base_rate * 1000) / 1000,
    brier_fold5: Math.round(lastKept.fold5! * 1000) / 1000,
    brier_base_fold5: Math.round(baseOdds.fold5! * 1000) / 1000,
    brier_wf: Math.round(lastKept.wf! * 1000) / 1000,
    brier_base_wf: Math.round(baseOdds.wf! * 1000) / 1000,
    auc_fold5: Math.round(fits.auc_fold5 * 1000) / 1000,
    cat_rate_k: fits.cat_rate_k,
    cat_rate_diagnostic: {
      k: fits.cat_rate_diagnostic.k,
      with_fold5: Math.round(fits.cat_rate_diagnostic.withFold5 * 1000) / 1000,
      with_wf: Math.round(fits.cat_rate_diagnostic.withWf * 1000) / 1000,
      without_fold5: Math.round(fits.cat_rate_diagnostic.withoutFold5 * 1000) / 1000,
      without_wf: Math.round(fits.cat_rate_diagnostic.withoutWf * 1000) / 1000,
    },
    loco_brier: Math.round(fits.loco_brier * 1000) / 1000,
    locho_brier: Math.round(fits.locho_brier * 1000) / 1000,
  };
  // Worth farming at each fixed deposit, under the same two bars; and the
  // rows that clear the bars at some deposit size.
  const tierCounts = TIER_DEPOSITS.map((dep) => {
    const vs = board.map((r) => r.tier_verdicts.find((t) => t.deposit_usd === dep)!.verdict);
    return {
      deposit_usd: dep,
      farm: vs.filter((v) => v === 'FARM').length,
      marginal: vs.filter((v) => v === 'MARGINAL').length,
      skip: vs.filter((v) => v === 'SKIP').length,
    };
  });
  const farmAnyTierCount = board.filter(
    (r) => r.verdict.verdict === 'FARM' || r.tier_verdicts.some((t) => t.verdict === 'FARM'),
  ).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    farm_count: board.filter((r) => r.verdict.verdict === 'FARM').length,
    marginal_count: board.filter((r) => r.verdict.verdict === 'MARGINAL').length,
    skip_count: board.filter((r) => r.verdict.verdict === 'SKIP').length,
    tier_counts: tierCounts,
    farm_any_tier_count: farmAnyTierCount,
    watchlist: snapshot.watchlist,
    value_fit: valueFit,
    value_ladder: valueLadderRows,
    odds_fit: oddsFit,
    odds_ladder: oddsLadderRows,
    odds_cat_sweep: fits.cat_rate_sweep.map((s) => ({ k: s.k, fold5: Math.round(s.fold5 * 1000) / 1000, wf: Math.round(s.wf * 1000) / 1000 })),
    accounting: accounting(snapshot, board),
    checksum: '',
    rows: board,
    live,
  };
  return { board, radar };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}
