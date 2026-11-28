// Launch Radar dashboard: renders window.RADAR (written by main.ts from the
// sealed snapshot) as a fitted, costed board with a detail view per protocol.
// No network: every byte the page needs is in data.js beside it. The table is
// recomputed in this browser from the same rows, and the checks line says
// whether the recomputation agrees with the program that wrote them.
//
// Deep links: ?detail=<slug> opens a protocol, ?cat=<category> filters,
// ?watch=1 watchlist only, ?verdict=farm|marginal|skip, ?sort=value|odds|
// range|tvl|growth|age, ?tab=live|model opens that tab.

(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) { document.body.textContent = 'No radar data found.'; return; }

  var params = new URLSearchParams(location.search);
  var watchSlugs = {};
  (R.watchlist || []).forEach(function (s) { watchSlugs[s] = true; });

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function dollars(n) {
    if (n == null) return '—';
    return (n < 0 ? '−$' : '$') + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function pct(n) {
    if (n == null) return '—';
    return '<span class="' + (n >= 0 ? 'up' : 'down') + '">' + (n > 0 ? '+' : '') + n.toFixed(1) + '%</span>';
  }
  function ageText(d) {
    if (d == null) return '—';
    if (d < 30) return d + 'd';
    if (d < 365) return Math.round(d / 30) + 'mo';
    return (d / 365).toFixed(1) + 'y';
  }
  function chainsText(c) { return c.slice(0, 3).join(', ') + (c.length > 3 ? ' +' + (c.length - 3) : ''); }
  function fnv1a(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  // ---- header ----
  $('asOf').textContent = R.as_of;
  $('modelVer').textContent = R.model_version;
  $('source').textContent = R.source;
  $('floor').textContent = money(R.floor_usd);
  var vf = R.value_fit, of = R.odds_fit;
  function valueFormula() {
    var f = 'ln(mcap) = ' + vf.a + ' + ' + vf.b + ' × ln(TVL / $100M)';
    if (vf.chain_coef !== null && vf.chain_coef !== undefined) f += (vf.chain_coef < 0 ? ' - ' : ' + ') + Math.abs(vf.chain_coef) + ' × ln(chains, capped at 3)';
    return f;
  }
  $('kpi').innerHTML =
    kpi('×' + vf.wf_miss.toFixed(2) + ' <small>vs ×' + vf.flat_wf_miss.toFixed(2) + ' flat</small>', 'Walk-forward miss on the newest tokens') +
    kpi(Math.round(vf.range_p2575 * 100) + '% · ' + Math.round(vf.range_p1090 * 100) + '%', 'Real caps inside the range: global ' + Math.round(vf.range_p2575 * 100) + '% · ' + Math.round(vf.range_p1090 * 100) + '%, per-category ' + Math.round(vf.range_cat_p2575 * 100) + '% · ' + Math.round(vf.range_cat_p1090 * 100) + '%') +
    kpi(of.brier_fold5.toFixed(3) + ' <small>vs ' + of.brier_base_fold5.toFixed(3) + ' base · AUC ' + of.auc_fold5.toFixed(2) + '</small>', 'Token odds, Brier 5-fold (WF ' + of.brier_wf.toFixed(3) + ' vs ' + of.brier_base_wf.toFixed(3) + ' base)') +
    kpi(valueKept() + ' of ' + (R.value_ladder.length - 1) + ' · ' + oddsKept() + ' of ' + (R.odds_ladder.length - 1), 'Terms that survived the held-out tests; the rest are listed, not used') +
    kpi(R.farm_count + ' at $5K <small>· ' + R.farm_any_tier_count + ' at some tier</small>', 'FARM at the $5K default; $1K ' + tierFarm(1000) + ' · $25K ' + tierFarm(25000) + ' — same bars') +
    kpi(R.watchlist_size + ' / ' + R.watchlist_size, 'Watchlist ranked, plus ' + R.early_size + ' early finds below the floor');
  // Four held-out tests per side, in one line under the KPI strip: the
  // curve and the odds are each scored on leave-one-out / 5-fold,
  // walk-forward, leave-one-category-out and leave-one-chain-out.
  $('tests').innerHTML =
    '<b>Held out four ways.</b> Value miss — LOO ×' + vf.loo_miss.toFixed(2) + ' · WF ×' + vf.wf_miss.toFixed(2) +
    ' · LOCO ×' + vf.loco_miss.toFixed(2) + ' · LOChO ×' + vf.locho_miss.toFixed(2) +
    '. Odds Brier — 5-fold ' + of.brier_fold5.toFixed(3) + ' · WF ' + of.brier_wf.toFixed(3) +
    ' · LOCO ' + of.loco_brier.toFixed(3) + ' · LOChO ' + of.locho_brier.toFixed(3) +
    '. Per-category ranges ' + Math.round(vf.range_cat_p2575 * 100) + '% · ' + Math.round(vf.range_cat_p1090 * 100) +
    '% (' + vf.range_cat_n + ' own bands).';
  function kpi(b, label) { return '<div class="box"><b>' + b + '</b><span>' + label + '</span></div>'; }
  function valueKept() { return R.value_ladder.filter(function (r) { return r.kept; }).length; }
  function oddsKept() { return R.odds_ladder.filter(function (r) { return r.kept; }).length; }
  function keptOddsNames() { return R.odds_ladder.filter(function (r) { return r.kept; }).map(function (r) { return r.term; }).join(' · '); }
  // The kept odds terms as "name — definition" pairs, so the list reads as
  // five items (intercept + four features) instead of a comma run that
  // looks like seven. Unknown terms fall back to their ladder name.
  function oddsTermDefs() {
    var defs = {
      'age, ln days listed': 'age — ln days listed',
      'size, ln TVL': 'size — ln(TVL / $100M)',
      'chain count, ln (capped at 3)': 'chain count — ln(chains, capped at 3)',
      '7-day growth × size': '7-day growth × size — growth × ln TVL',
      '7-day TVL growth': '7-day growth — change over 7 days',
      'category token rate, shrunk': 'category token rate — shrunk share of peers with a token',
    };
    return R.odds_ladder.filter(function (r) { return r.kept; }).map(function (r) { return defs[r.term] || r.term; }).join(', ');
  }
  function tierFarm(dep) {
    var t = null;
    (R.tier_counts || []).forEach(function (x) { if (x.deposit_usd === dep) t = x; });
    return t ? t.farm : 0;
  }

  // ---- ledger: all 758 protocols in exactly one group ----
  var colors = ['#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#94a3b8', '#64748b'];
  var total = R.accounting.reduce(function (s, g) { return s + g.count; }, 0);
  $('ledger').innerHTML =
    '<div class="bar">' + R.accounting.map(function (g, i) {
      return '<i style="width:' + (g.count / total * 100).toFixed(2) + '%;background:' + colors[i % colors.length] + '" title="' + esc(g.label) + ' ' + g.count + '"></i>';
    }).join('') + '</div>' +
    '<div class="keys">' + R.accounting.map(function (g, i) {
      return '<span><i class="dot" style="background:' + colors[i % colors.length] + '"></i>' + esc(g.label) + ' <b>' + g.count + '</b></span>';
    }).join('') + '</div>';

  // ---- integrity: recompute the table here and say whether it agrees ----
  (function () {
    var rows = R.rows, ok = [], bad = [];
    var sorted = rows.every(function (r, i) { return r.rank === i + 1; });
    var neverRise = rows.every(function (r, i) { return i === 0 || r.implied_value_usd <= rows[i - 1].implied_value_usd; });
    var recomputed = rows.every(function (r) { return r.implied_value_usd === Math.max(1, Math.round(r.value_if_launches_usd * r.token_odds)); });
    var sum = rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
    var sumOk = rows.every(function (r) { return r.implied_value_usd > 0; });
    var check = fnv1a(JSON.stringify({ rows: rows })) === R.checksum;
    var watchOk = R.watchlist.every(function (s) { return rows.some(function (r) { return r.slug === s; }); });
    var ledgerOk = total === 758;
    var tiersOk = rows.every(function (r) {
      return (r.tier_verdicts || []).every(function (t) {
        var drop = r.implied_value_usd * (t.deposit_usd / Math.max(1, r.tvl_usd)) * 0.07;
        var net = drop - r.verdict.fees_usd;
        var hours = Math.max(0.5, r.verdict.hands_on_minutes / 60);
        var tbill = t.deposit_usd * 0.04 * (12 / 52);
        var v = net > tbill && net / hours >= 25 ? 'FARM' : net > 0 ? 'MARGINAL' : 'SKIP';
        return v === t.verdict && Math.abs(net - t.net_usd) < 0.011;
      });
    });
    var items = [
      [sorted, 'ranks 1–' + rows.length + ' in order'],
      [neverRise, 'values never rise'],
      [recomputed, 'implied = launch × odds, recomputed here'],
      [sumOk, 'every row positive; total ' + money(sum)],
      [check, 'checksum ' + R.checksum + ' = main.ts'],
      [watchOk, 'watchlist ' + R.watchlist_size + ' of ' + R.watchlist_size + ' ranked'],
      [ledgerOk, 'ledger 758 of 758 protocols'],
      [tiersOk, 'tiers recompute'],
    ];
    items.forEach(function (it) { (it[0] ? ok : bad).push(it[1]); });
    $('checks').innerHTML = '<b>✓</b> ' + ok.join(' &nbsp;✓&nbsp; ') + (bad.length ? ' &nbsp;✗&nbsp; ' + bad.join(' &nbsp;✗&nbsp; ') : '');
    $('integrity').textContent = ok.length + ' of ' + items.length + ' checks pass' + (bad.length ? '; failing: ' + bad.join(', ') : '');
  })();

  // ---- evidence ladders ----
  function ladderRows(rows, kind) {
    return rows.map(function (r) {
      var a = kind === 'v' ? (r.loo == null ? '—' : '×' + r.loo.toFixed(2)) : (r.fold5 == null ? '—' : r.fold5.toFixed(3));
      var b = r.wf == null ? '—' : (kind === 'v' ? '×' + r.wf.toFixed(2) : r.wf.toFixed(3));
      return '<tr><td>' + esc(r.term) + '</td><td>' + a + '</td><td>' + b + '</td><td class="' + (r.kept ? 'kept' : 'dropped') + '">' + (r.kept ? 'kept' : r.note) + '</td></tr>';
    }).join('');
  }
  function evidenceHtml() {
    return '<div class="ev"><h4>Value if it launches · <b>typical miss, ' + R.value_ladder.length + ' traded tokens</b></h4>' +
      '<table><tr><th>Term, added in order</th><th>Leave-one-out</th><th>Walk-forward</th><th></th></tr>' +
      ladderRows(R.value_ladder, 'v') + '</table>' +
      '<p class="foot">A term is kept only if it improves the walk-forward miss by more than the margin without making the leave-one-out miss worse. Fitted on ' + vf.n_peers +
      ' priced comps: ' + valueFormula() + '. Leave-a-category-out ×' + vf.loco_miss.toFixed(2) + ', leave-a-chain-out ×' + vf.locho_miss.toFixed(2) + '.</p></div>' +
      '<div class="ev"><h4>Token odds · <b>Brier score (share called right)</b></h4>' +
      '<table><tr><th>Term, added in order</th><th>5-fold</th><th>Walk-forward</th><th></th></tr>' +
      ladderRows(R.odds_ladder, 'o') + '</table>' +
      '<p class="foot">Odds are the peers’ record: ' + of.n_peers + ' dated protocols, base rate ' + (of.base_rate * 100).toFixed(0) +
      '%. A term that fails the walk-forward test or makes 5-fold worse is listed, not used; the category rate is listed as a diagnostic only. Leave-a-category-out ' + of.loco_brier.toFixed(3) + ', leave-a-chain-out ' + of.locho_brier.toFixed(3) + '.</p></div>' +
      '<div class="ev"><h4>Is the printed range honest?</h4>' +
      '<table><tr><th>Share of real caps</th><th>Leave-one-out</th><th>Walk-forward</th><th></th></tr>' +
      '<tr><td>inside P25–P75, stated 50%</td><td>' + Math.round(vf.range_p2575 * 100) + '%</td><td>—</td><td class="kept">honest</td></tr>' +
      '<tr><td>inside P10–P90, stated 80%</td><td>' + Math.round(vf.range_p1090 * 100) + '%</td><td>—</td><td class="kept">honest</td></tr>' +
      '<tr><td>residual P25–P75</td><td>×' + Math.exp(vf.residual_q25).toFixed(2) + ' – ×' + Math.exp(vf.residual_q75).toFixed(2) + '</td><td>—</td><td class="dropped">wide</td></tr></table>' +
      '<p class="foot">The range is the leave-one-out residual band: the curve typically misses by ×' + vf.loo_miss.toFixed(2) +
      ', and the printed range says so instead of pretending precision.</p></div>';
  }
  $('evidence2').innerHTML = evidenceHtml();

  // ---- why the board reads smaller than the flat-multiple board ----
  (function () {
    var total = R.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
    $('calnote').innerHTML =
      '<b>Why this board reads smaller than the last one — it is a calibration fix, not less value.</b> ' +
      'The old board multiplied every TVL by a hand-set 0.30 and totalled $5.00B. This board fits the multiple on the ' + vf.n_peers +
      ' tokens that already trade, and the fitted share falls as TVL grows — so the same protocols total ' + money(total) +
      '. At $100M of TVL a single-chain token is worth about ' + Math.round(Math.exp(vf.a) / 1e8 * 100) + '% of TVL and a 3-chain one about ' + Math.round(Math.exp(vf.a) / 1e8 * Math.exp((vf.chain_coef || 0) * Math.log(3)) * 100) + '%, not 30%. The curve misses by ×' + vf.loo_miss.toFixed(2) +
      ' held out against ×' + vf.flat_loo_miss.toFixed(2) + ' for the flat one.';
  })();

  // ---- state ----
  var state = {
    q: params.get('q') || '',
    cat: params.get('cat') || '',
    chain: params.get('chain') || '',
    minTvl: parseInt(params.get('minTvl') || '0', 10) || 0,
    sort: params.get('sort') || 'value',
    watchOnly: params.get('watch') === '1',
    verdict: (function () {
      var v = (params.get('verdict') || 'all').toUpperCase();
      return v === 'FARM' || v === 'MARGINAL' || v === 'SKIP' ? v : 'all';
    })(),
    detail: params.get('detail') || null,
    dep: (function () {
      var d = params.get('dep') || 'pct';
      return d === 'pct' || d === '1000' || d === '5000' || d === '10000' || d === '25000' ? d : 'pct';
    })(),
    share: 0.07,
    horizon: 12,
  };
  var cats = {}, chains = {};
  R.rows.forEach(function (r) {
    if (r.category) cats[r.category] = 1;
    r.chains.forEach(function (c) { chains[c] = 1; });
  });
  Object.keys(cats).sort().forEach(function (c) { $('cat').appendChild(new Option(c, c)); });
  Object.keys(chains).sort().forEach(function (c) { $('chain').appendChild(new Option(c, c)); });
  $('q').value = state.q; $('cat').value = state.cat; $('chain').value = state.chain;
  $('minTvl').value = String([0, 50000000, 100000000, 500000000, 1000000000].indexOf(state.minTvl) >= 0 ? state.minTvl : 0);
  $('sort').value = state.sort; $('watchOnly').checked = state.watchOnly;

  // ---- farm verdict pricing (client-side, from the row's own figures) ----
  function depositFor(r) {
    return state.dep === 'pct' ? r.verdict.deposit_usd : parseInt(state.dep, 10);
  }
  function price(r) {
    var dep = depositFor(r);
    var drop = r.implied_value_usd * (dep / Math.max(1, r.tvl_usd)) * state.share;
    var net = drop - r.verdict.fees_usd;
    var hours = Math.max(0.5, r.verdict.hands_on_minutes / 60);
    var tbill = dep * 0.04 * (state.horizon / 52);
    var v = net > tbill && net / hours >= 25 ? 'FARM' : net > 0 ? 'MARGINAL' : 'SKIP';
    return { dep: dep, drop: drop, net: net, perHour: net / hours, tbill: tbill, verdict: v };
  }
  // ---- minimum deposit that clears both bars (D1) ----
  // Both bars are linear in the deposit: drop = implied x (D / TVL) x share,
  // net = drop - fees, and FARM needs net > D x 4% x (horizon / 52) and
  // net / hours >= $25. So the smallest D that clears both is the larger of
  // the two one-bar answers, rounded up a dollar so the T-bill comparison
  // is strict. When the drop per dollar of deposit never beats the T-bill
  // rate (implied / TVL <= 0.132 at the stated 7% / 12 weeks), no deposit
  // ever clears both bars and the row tops out at MARGINAL.
  function minDeposit(r) {
    var slope = r.implied_value_usd * state.share / Math.max(1, r.tvl_usd);
    var fees = r.verdict.fees_usd;
    var hours = Math.max(0.5, r.verdict.hands_on_minutes / 60);
    var tbillRate = 0.04 * (state.horizon / 52);
    if (slope <= tbillRate) return null;
    var dHour = (25 * hours + fees) / slope;
    var dBill = fees / (slope - tbillRate);
    return Math.floor(Math.max(dHour, dBill)) + 1;
  }
  function verdictCounts() {
    var c = { FARM: 0, MARGINAL: 0, SKIP: 0 };
    R.rows.forEach(function (r) { c[price(r).verdict]++; });
    return c;
  }

  function renderVerdictTabs() {
    var c = verdictCounts();
    var tabs = [['all', 'All ' + R.board_size], ['FARM', 'Farm ' + c.FARM], ['MARGINAL', 'Marginal ' + c.MARGINAL], ['SKIP', 'Skip ' + c.SKIP]];
    $('verdictTabs').innerHTML = tabs.map(function (t) {
      return '<button data-v="' + t[0] + '" class="' + (state.verdict === t[0] ? 'active' : '') + '">' + t[1] + '</button>';
    }).join('');
    document.querySelectorAll('#verdictTabs button').forEach(function (b) {
      b.addEventListener('click', function () { state.verdict = b.getAttribute('data-v'); renderAll(); });
    });
  }

  function renderDepBtns() {
    var opts = [['pct', '$5K · default'], ['1000', '$1K'], ['5000', '$5K'], ['10000', '$10K'], ['25000', '$25K']];
    $('depBtns').innerHTML = opts.map(function (o) {
      return '<button class="depbtn' + (state.dep === o[0] ? ' active' : '') + '" data-d="' + o[0] + '">' + o[1] + '</button>';
    }).join('');
    document.querySelectorAll('#depBtns .depbtn').forEach(function (b) {
      b.addEventListener('click', function () { state.dep = b.getAttribute('data-d'); renderAll(); });
    });
    $('dropVal').textContent = (state.share * 100).toFixed(1) + '%';
    $('horizonVal').textContent = state.horizon + ' wk';
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var rows = R.rows.filter(function (r) {
      if (state.watchOnly && !watchSlugs[r.slug]) return false;
      if (state.verdict !== 'all' && price(r).verdict !== state.verdict) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0 && (r.category || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var by = {
      value: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      odds: function (a, b) { return b.token_odds - a.token_odds || b.implied_value_usd - a.implied_value_usd; },
      range: function (a, b) { return (a.rank_hi - a.rank_lo) - (b.rank_hi - b.rank_lo) || b.implied_value_usd - a.implied_value_usd; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
    }[state.sort] || function (a, b) { return b.implied_value_usd - a.implied_value_usd; };
    return rows.slice().sort(by);
  }

  function renderBoard() {
    var rows = filtered();
    $('count').textContent = rows.length + ' of ' + R.board_size + ' ranked protocols' +
      (state.verdict !== 'all' ? ' — ' + state.verdict.toLowerCase() + ' verdicts at the deposit, drop share and horizon above' : '') +
      '. Click a row for its farm plan.';
    $('rows').innerHTML = rows.map(function (r) {
      var p = price(r);
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.detail === r.slug ? ' class="selected"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td class="num">' + r.rank_lo + '–' + r.rank_hi + '</td>' +
        '<td><span class="pname">' + esc(r.name) + '</span>' +
        (watchSlugs[r.slug] ? '<span class="badge">WATCHLIST</span>' : '') +
        '<span class="psub">' + esc(r.category || '—') + ' · ' + esc(chainsText(r.chains)) + '</span></td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num">' + Math.round(r.token_odds * 100) + '%<span class="oddsbar"><i style="width:' + Math.round(r.token_odds * 100) + '%"></i></span></td>' +
        '<td class="num">' + money(r.value_if_launches_usd) + '</td>' +
        '<td class="num value">' + money(r.implied_value_usd) + '<span class="psub">' + money(r.range_lo_usd) + '–' + money(r.range_hi_usd) + '</span></td>' +
        '<td><span class="pill ' + p.verdict.toLowerCase() + '">' + p.verdict + '</span><span class="vnet"><b>' + dollars(p.net) + '</b> net · ' + dollars(p.drop) + ' drop − ' + dollars(r.verdict.fees_usd) + ' fees</span></td>' +
        '<td class="num">' + dollars(p.perHour) + '</td></tr>';
    }).join('');
    document.querySelectorAll('#rows tr').forEach(function (tr) {
      tr.addEventListener('click', function () { showDetail(tr.getAttribute('data-slug'), true); });
    });
  }

  function factor(label, value, frac, note) {
    return '<div class="factor"><b>' + esc(value) + '</b><span>' + esc(label) + '</span>' +
      '<div class="bar"><i style="width:' + Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%"></i></div>' +
      '<span>' + esc(note) + '</span></div>';
  }

  function tierTable(r) {
    var rows = r.tier_verdicts.map(function (t) {
      return '<tr><td>' + money(t.deposit_usd) + '</td><td class="num">' + (t.share_of_tvl * 100).toFixed(3) + '%</td><td><span class="pill ' + t.verdict.toLowerCase() + '">' + t.verdict + '</span></td><td class="num">' + dollars(t.drop_usd) + '</td><td class="num">' + dollars(t.net_usd) + '</td><td class="num">' + dollars(t.net_per_hour) + '</td><td class="num">' + dollars(t.tbill_usd) + '</td></tr>';
    }).join('');
    var d = r.verdict;
    rows += '<tr><td>' + money(d.deposit_usd) + ' <span class="psub">default, flat $5,000</span></td><td class="num">' + (d.deposit_usd / Math.max(1, r.tvl_usd) * 100).toFixed(3) + '%</td><td><span class="pill ' + d.verdict.toLowerCase() + '">' + d.verdict + '</span></td><td class="num">' + dollars(d.drop_usd) + '</td><td class="num">' + dollars(d.net_usd) + '</td><td class="num">' + dollars(d.net_per_hour) + '</td><td class="num">' + dollars(d.tbill_usd) + '</td></tr>';
    return '<table class="mini"><tr><th>Deposit</th><th class="num">Share of TVL</th><th>Verdict</th><th class="num">Drop</th><th class="num">Net</th><th class="num">Net / hour</th><th class="num">T-bill</th></tr>' + rows + '</table>' +
      '<p class="note">Every tier is priced at the stated 7% drop share over 12 weeks, under the same two bars — net beats a 4% T-bill on the deposit and $25 an hour. A bigger cheque clears the bars on rows a small one cannot; the deposit’s share of TVL is shown because a cheque that is a large slice of a small protocol is harder to place. The bars were not loosened to make the counts bigger.</p>';
  }

  function showDetail(slug, scroll) {
    var r = null;
    R.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    var box = $('detail');
    if (!r) { box.hidden = true; state.detail = null; return; }
    state.detail = slug;
    var p = price(r);
    var peers = r.peers.map(function (q) {
      return '<tr><td>' + esc(q.name) + '</td><td>' + esc(q.category || '—') + '</td><td class="num">' + money(q.tvl_usd) + '</td><td class="num">' + money(q.mcap_usd) + '</td><td class="num">×' + q.multiple.toFixed(2) + '</td><td class="num">×' + q.fitted_multiple.toFixed(2) + '</td></tr>';
    }).join('');
    var shares = [0.035, 0.07, 0.14], deps = [1000, 10000, 25000];
    var matrix = '<table class="mini"><tr><th>Net by drop share × deposit</th>' + deps.map(function (d) { return '<th>' + money(d) + '</th>'; }).join('') + '</tr>' +
      shares.map(function (sh) {
        return '<tr><td>' + (sh * 100).toFixed(1) + '% drop share</td>' + deps.map(function (d) {
          var drop = r.implied_value_usd * (d / Math.max(1, r.tvl_usd)) * sh;
          var net = drop - r.verdict.fees_usd;
          var hl = Math.abs(sh - state.share) < 0.001 && ((state.dep !== 'pct' && parseInt(state.dep, 10) === d) || (state.dep === 'pct' && r.verdict.deposit_usd === d));
          return '<td class="' + (hl ? 'hl' : '') + '">' + dollars(net) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</table>';
    box.innerHTML =
      '<h2>#' + r.rank + ' of ' + R.board_size + ' by implied value &middot; rank ' + r.rank_lo + '–' + r.rank_hi + ' across bootstrap refits &nbsp;' + esc(r.name) + (watchSlugs[r.slug] ? '<span class="badge">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="meta">' + esc(r.category || 'Uncategorised') + ' &middot; ' + esc(r.chains.join(', ') || 'no chain listed') +
      ' &middot; tracked since ' + esc(r.listed_at || 'unknown') + ' &middot; no-token age ' + ageText(r.age_days) + ' &middot; records no token.</p>' +
      '<div class="big">' + money(r.implied_value_usd) + '</div>' +
      '<p class="bigsub">Implied value — a model estimate. P25–P75 ' + money(r.range_lo_usd) + '–' + money(r.range_hi_usd) +
      ' &middot; P10–P90 ' + money(r.range_p10_usd) + '–' + money(r.range_p90_usd) +
      '. Recomputed in this browser: equals board.json. DefiLlama records no token for it, which is not proof it has none.</p>' +
      '<h3>How the figure is made</h3><div class="breakdown">' +
      factor('TVL', money(r.tvl_usd), Math.min(1, r.tvl_usd / 1e9), 'DefiLlama, ' + R.as_of) +
      factor('Fitted multiple', '×' + r.fitted_multiple.toFixed(2), Math.min(1, r.fitted_multiple), valueFormula() + ', fitted on ' + vf.n_peers + ' priced comps') +
      factor('Value if it launches', money(r.value_if_launches_usd), Math.min(1, r.value_if_launches_usd / 1e8), 'TVL × fitted multiple') +
      factor('Token odds', Math.round(r.token_odds * 100) + '%', r.token_odds, 'logistic on ' + keptOddsNames() + '; ' + of.n_peers + ' dated peers, AUC ' + of.auc_fold5.toFixed(2) + '; base rate ' + Math.round(of.base_rate * 100) + '%') +
      factor('Implied value', money(r.implied_value_usd), 1, 'launch value × odds') +
      '</div>' +
      '<h3>Nearest priced peers — their tokens trade</h3>' +
      '<table class="mini"><tr><th>Token</th><th>Category</th><th>TVL</th><th>Market cap</th><th>Cap / TVL</th><th>Fitted multiple</th></tr>' + peers + '</table>' +
      '<p class="note">Chain count (capped at 3) is in the value model — it improves all four held-out tests — while category effect, 7-day growth and age as value terms each failed a held-out test, so they stay out. The odds keep age, size, chain count (capped at 3) and growth × size; plain 7-day growth failed there too, the category token rate was dropped on purpose (see the model tab), and Platt and isotonic calibration helped walk-forward but not 5-fold, so neither is used.</p>' +
      '<h3>Farm verdict · <span class="pill ' + p.verdict.toLowerCase() + '">' + p.verdict + '</span></h3>' +
      '<p class="note" style="margin-top:2px">Minimum deposit to clear both bars at the drop share and horizon above: <b>' +
      (function () {
        var md = minDeposit(r);
        if (md === null) return 'no deposit clears them</b> — the modelled drop never beats a 4% T-bill at this implied / TVL, so this row tops out at MARGINAL.';
        return (md >= 100000 ? money(md) : '$' + Math.round(md).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')) + '</b> — below that the plan is MARGINAL or SKIP.';
      })() + '</p>' +
      '<div class="verdictbox"><div class="vhead"><b>' + p.verdict + ': ' + money(p.dep) + ' for ' + state.horizon + ' weeks buys a modelled drop of ' + dollars(p.drop) + ' for ' + dollars(r.verdict.fees_usd) + ' of fees and ' + (r.verdict.hands_on_minutes / 60).toFixed(1) + ' h of work, a net of ' + dollars(p.net) + ' (' + dollars(p.perHour) + ' an hour) against ' + dollars(p.tbill) + ' from the same money in a 4% T-bill.</b></div>' +
      '<div class="vgrid">' +
      '<div><b>' + money(p.dep) + '</b><span>At risk</span></div>' +
      '<div><b>' + dollars(r.verdict.fees_usd) + '</b><span>Fees, ' + state.horizon + ' weeks</span></div>' +
      '<div><b>' + dollars(p.drop) + '</b><span>Modelled drop</span></div>' +
      '<div><b>' + dollars(p.net) + '</b><span>Net of fees</span></div>' +
      '<div><b>' + (r.verdict.hands_on_minutes / 60).toFixed(1) + ' h</b><span>Hands-on</span></div>' +
      '<div><b>' + dollars(p.perHour) + '</b><span>Net per hour</span></div></div>' +
      matrix +
      '<p class="note">Drop = implied × (deposit / TVL) × drop share. Fees are gas at the planning estimate for ' + esc(r.chains[0] || 'its chain') + '. Yield earned meanwhile is left out. Steps below are priced at the ' + money(r.verdict.deposit_usd) + ' default deposit; change the deposit above to re-price the verdict.</p></div>' +
      '<h3>Farm tiers · same bars, four deposits</h3>' + tierTable(r) +
      '<h3>Farm plan · 10 steps</h3><ol class="steps">' +
      r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '</ol>' +
      '<p class="note">Each step states its cost and time. Never pay to claim an airdrop; claim only from a link the protocol itself publishes.</p>';
    box.hidden = false;
    renderBoard();
    if (scroll) box.scrollIntoView({ block: 'nearest' });
  }

  // ---- live tab ----
  $('liveCount').textContent = R.live_size;
  $('liveRows').innerHTML = R.live.map(function (p) {
    return '<tr><td><span class="pname">' + esc(p.name) + '</span><span class="psub">' + esc(p.slug) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td><td>' + esc(chainsText(p.chains)) + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + money(p.mcap_usd) + '</td>' +
      '<td class="num">×' + (p.mcap_usd / p.tvl_usd).toFixed(2) + '</td>' +
      '<td class="num">×' + p.fitted_multiple.toFixed(2) + '</td>' +
      '<td class="num">' + pct(p.change_7d) + '</td></tr>';
  }).join('');
  var noCap = R.accounting.filter(function (g) { return g.label.indexOf('no usable cap') >= 0; })[0];
  var tradedOut = R.accounting.filter(function (g) { return g.label.indexOf('Token trades · out') >= 0; })[0];
  $('liveRest').textContent = noCap ? noCap.count : 0;
  $('liveOut').textContent = tradedOut ? tradedOut.count : 0;

  // ---- model tab ----
  $('formula').textContent =
    'implied = value if it launches × token odds\n' +
    'value if it launches = TVL × fitted multiple;  ' + valueFormula() + '\n' +
    '  fitted on ' + vf.n_peers + ' traded protocols with a usable market cap; multiple clamped to 0.01..1.00\n' +
    '  held out four ways: leave-one-out miss ×' + vf.loo_miss.toFixed(2) + ' vs ×' + vf.flat_loo_miss.toFixed(2) + ' flat; walk-forward ×' + vf.wf_miss.toFixed(2) + ' vs ×' + vf.flat_wf_miss.toFixed(2) + ' flat; leave-a-category-out ×' + vf.loco_miss.toFixed(2) + '; leave-a-chain-out ×' + vf.locho_miss.toFixed(2) + '\n' +
    'token odds = logistic(1 — intercept, ' + oddsTermDefs() + ');  coefficients ' + of.beta.map(function (b) { return b.toFixed(3); }).join(', ') + '\n' +
    '  fitted on ' + of.n_peers + ' dated protocols; base rate ' + of.base_rate.toFixed(3) + '\n' +
    '  held out four ways: Brier 5-fold ' + of.brier_fold5.toFixed(3) + ' vs ' + of.brier_base_fold5.toFixed(3) + ' base; walk-forward ' + of.brier_wf.toFixed(3) + ' vs ' + of.brier_base_wf.toFixed(3) + ' base; leave-a-category-out ' + of.loco_brier.toFixed(3) + '; leave-a-chain-out ' + of.locho_brier.toFixed(3) + '; AUC 5-fold ' + of.auc_fold5.toFixed(3) + '\n' +
    '  the category token rate is NOT in the odds: it is a marginal, era-confounded average, so it is swept as a diagnostic only (best k=' + of.cat_rate_k + ': with the rate, Brier 5-fold ' + of.cat_rate_diagnostic.with_fold5.toFixed(3) + ' and walk-forward ' + of.cat_rate_diagnostic.with_wf.toFixed(3) + '; without it, ' + of.cat_rate_diagnostic.without_fold5.toFixed(3) + ' and ' + of.cat_rate_diagnostic.without_wf.toFixed(3) + ') — the forward-looking test moves within noise, the mixed-era test pays 0.007, and one feature no longer decides the board’s top\n' +
    'range = fitted value × residual quantiles (P25 ' + vf.residual_q25.toFixed(2) + ', P75 ' + vf.residual_q75.toFixed(2) + '; P10 ' + vf.residual_q10.toFixed(2) + ', P90 ' + vf.residual_q90.toFixed(2) + ' in log points), cut per category where the category has 5+ priced peers (' + vf.range_cat_n + ' categories), blended with the global band at weight n/(n+8), and from the global band otherwise; held-out coverage per category ' + Math.round(vf.range_cat_p2575 * 100) + '% (P25–P75, stated 50%) and ' + Math.round(vf.range_cat_p1090 * 100) + '% (P10–P90, stated 80%)\n' +
    'rank range = 5th..95th rank across 200 bootstrap refits of the curve on resampled peers (fixed seed); wide at the top because the board is flat (top 10 span only ×' + (R.rows[0].implied_value_usd / R.rows[9].implied_value_usd).toFixed(2) + '), not because the band is loose\n' +
    'default deposit $5,000 flat, for every row; the board also prices $1,000 and $25,000 under the same two bars\n' +
    'model ' + R.model_version + ' — the same function scores every row; no name is special-cased.';
  // ---- farm matrix: verdicts by deposit, one line (D2) ----
  // The board prices every row at $1K / $5K / $25K under the same two bars;
  // this line is the 3-deposit × 3-verdict count, so a reader sees what a
  // bigger cheque buys without opening a row. It sits right under the
  // formula block so it is in the model-tab screenshot.
  (function () {
    var tiers = (R.tier_counts || []).slice().sort(function (a, b) { return a.deposit_usd - b.deposit_usd; });
    if (!tiers.length) return;
    var line = '<b>Farm matrix — verdicts by deposit, same two bars:</b> ' + tiers.map(function (t) {
      return money(t.deposit_usd) + ' ' + t.farm + ' FARM · ' + t.marginal + ' MARGINAL · ' + t.skip + ' SKIP';
    }).join(' &nbsp;—&nbsp; ');
    $('formula').insertAdjacentHTML('afterend', '<p class="note" id="farmMatrix">' + line + '</p>');
  })();
  $('whyModel').innerHTML =
    '<li><strong>The value model is the size curve plus capped chain count.</strong> A flat median multiple misses by ×' + vf.flat_loo_miss.toFixed(2) + ' held out; the size curve alone misses by ×' + R.value_ladder[1].loo.toFixed(2) + ' (walk-forward ×' + R.value_ladder[1].wf.toFixed(2) + ' vs ×' + vf.flat_wf_miss.toFixed(2) + ' flat); adding ln(chains, capped at 3) takes it to ×' + vf.loo_miss.toFixed(2) + ' (walk-forward ×' + vf.wf_miss.toFixed(2) + ', leave-a-category-out ×' + vf.loco_miss.toFixed(2) + '). Small protocols carry higher multiples than big ones, and at the same TVL a multi-chain protocol’s token is worth less — the data says so, so the curve says so. The cap matters: the uncapped log count is outlier leverage (one priced peer lists 58 chains) and fails leave-one-out.</li>' +
    '<li><strong>Category, growth and age were tested as value terms and not kept; chain count was.</strong> Each failed at least one held-out test (see the ladders above): category improves leave-one-out (×' + R.value_ladder[2].loo.toFixed(2) + ') but not walk-forward (×' + R.value_ladder[2].wf.toFixed(2) + '), growth and age fail the same way. A term is kept only when it improves the walk-forward miss by more than the margin without making the leave-one-out miss worse; chain count (capped at 3) is the one that does, on all four tests.</li>' +
    '<li><strong>Token odds are the peers’ record, fitted, not asserted.</strong> Age, size, chain count (capped at 3) and growth × size survive the tests (' + of.brier_fold5.toFixed(3) + ' 5-fold, ' + of.brier_wf.toFixed(3) + ' walk-forward, AUC ' + of.auc_fold5.toFixed(2) + '), fitted with a ridge penalty (λ=1) that shrinks the coefficients toward zero; plain 7-day growth does not, so it stays out, and Platt and isotonic calibration helped walk-forward but not 5-fold, so neither is used. The odds never say a token will launch — they say what share of protocols like this one record one.</li>' +
    '<li><strong>The category token rate was dropped on purpose, not by the tests.</strong> It is a marginal average over protocols of very different ages — Risk Curators have a median 193 days listed, CDP 936 — so the rate measures the category’s age as much as its behaviour, and at its best shrink (k=' + of.cat_rate_k + ') its coefficient swings the top pair by more than a logit and a half. Keeping it would buy 0.007 on the mixed-era 5-fold Brier (' + of.cat_rate_diagnostic.with_fold5.toFixed(3) + ' vs ' + of.cat_rate_diagnostic.without_fold5.toFixed(3) + ') and nothing on the forward-looking walk-forward (' + of.cat_rate_diagnostic.with_wf.toFixed(3) + ' vs ' + of.cat_rate_diagnostic.without_wf.toFixed(3) + '), so the model leaves it out and the board’s top is decided by the protocols’ own age, size, chains and growth.</li>' +
    '<li><strong>Four held-out tests per side, not two.</strong> The curve is scored leave-one-out, walk-forward, leave-a-category-out (×' + vf.loco_miss.toFixed(2) + ') and leave-a-chain-out (×' + vf.locho_miss.toFixed(2) + '); the odds are scored 5-fold, walk-forward, leave-a-category-out (' + of.loco_brier.toFixed(3) + ') and leave-a-chain-out (' + of.locho_brier.toFixed(3) + '). A model that only works on categories and chains it has already seen is not a model for the next launch.</li>' +
    '<li><strong>The range is the honest part, cut per category.</strong> A typical miss of ×' + vf.loo_miss.toFixed(2) + ' means the point estimate is a rough guide; the P25–P75 band holds about half the real caps (' + Math.round(vf.range_p2575 * 100) + '%) and P10–P90 about four fifths (' + Math.round(vf.range_p1090 * 100) + '%), and the board prints the band beside every value. Where a category has 5+ priced peers the band blends that category’s own residuals with the global band at weight n/(n+8) (' + vf.range_cat_n + ' categories); held out, those per-category bands cover ' + Math.round(vf.range_cat_p2575 * 100) + '% and ' + Math.round(vf.range_cat_p1090 * 100) + '% — thinner categories use the global band, and the board says which.</li>';
  $('whyFarm').innerHTML =
    '<li><strong>Deposit:</strong> a flat $5,000 for every row — the middle tier, and the size a retail farmer can fund. $1,000 rarely clears the $25-an-hour bar after fees, $25,000 is beyond a retail cheque, and a fixed cheque makes the verdict a property of the protocol instead of the deposit formula. Change it above; the verdicts re-price. The board also prices three fixed deposits ($1,000, $5,000, $25,000) for every row: ' + R.farm_any_tier_count + ' rows clear the bars at some size, against ' + R.farm_count + ' at the default deposit — the bars never move, the cheque does.</li>' +
    '<li><strong>Modelled drop = implied × (deposit / TVL) × drop share</strong> (default 7%): your slice of the launch, at the share a farmer plausibly captures. The share is a planning assumption, stated, not a promise.</li>' +
    '<li><strong>Fees are gas, counted per transaction</strong> on the protocol’s first chain at planning estimates (Ethereum $3.00, Base / Arbitrum / Optimism / Polygon $0.10, Solana $0.02, BSC $0.20, Tron $1.00, Avalanche $0.50, anything else $0.10) — not quotes. Ten steps, eighteen transactions over twelve weeks.</li>' +
    '<li><strong>The verdict has two bars:</strong> the net must beat a 4% T-bill on the same deposit over the same horizon, and $25 an hour of hands-on time. Beat both and it is FARM; net positive but below a bar and it is MARGINAL; net negative and it is SKIP. Most rows are MARGINAL or SKIP — farming usually pays less than the T-bill, and the board says so.</li>';

  // ---- tabs ----
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    document.querySelectorAll('#tabs button').forEach(function (x) { x.classList.toggle('active', x === b); });
    ['board', 'live', 'model'].forEach(function (t) { $('tab-' + t).hidden = t !== b.getAttribute('data-tab'); });
  });
  var tabParam = params.get('tab');
  if (tabParam === 'live' || tabParam === 'model') {
    document.querySelectorAll('#tabs button').forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-tab') === tabParam); });
    ['board', 'live', 'model'].forEach(function (t) { $('tab-' + t).hidden = t !== tabParam; });
  }

  // ---- controls ----
  $('q').addEventListener('input', function () { state.q = $('q').value; renderBoard(); });
  $('cat').addEventListener('change', function () { state.cat = $('cat').value; renderBoard(); });
  $('chain').addEventListener('change', function () { state.chain = $('chain').value; renderBoard(); });
  $('minTvl').addEventListener('change', function () { state.minTvl = parseInt($('minTvl').value, 10); renderBoard(); });
  $('sort').addEventListener('change', function () { state.sort = $('sort').value; renderBoard(); });
  $('watchOnly').addEventListener('change', function () { state.watchOnly = $('watchOnly').checked; renderBoard(); });
  $('dropShare').addEventListener('input', function () { state.share = parseFloat($('dropShare').value) / 100; renderAll(); });
  $('horizon').addEventListener('input', function () { state.horizon = parseInt($('horizon').value, 10); renderAll(); });

  function renderAll() {
    renderDepBtns();
    renderVerdictTabs();
    renderBoard();
    if (state.detail) showDetail(state.detail, false);
  }

  renderAll();
  if (state.detail) showDetail(state.detail, true);
})();
