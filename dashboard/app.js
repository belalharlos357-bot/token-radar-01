// Token Radar dashboard: renders window.RADAR (written by main.ts from the
// sealed snapshot) as a sortable, filterable board with a detail view per
// protocol. No network: every byte the page needs is in data.js beside it.
//
// Deep links, used by the screenshots and by readers: ?detail=<slug> opens a
// protocol's detail view, ?cat=<category> filters to one category,
// ?watch=1 shows the watchlist only, ?sort=tvl|growth|age changes the order.

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
  function pct(n) {
    if (n == null) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return '<span class="' + (n >= 0 ? 'up' : 'down') + '">' + s + '</span>';
  }
  function growthText(n) {
    if (n == null) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function ageText(d) {
    if (d == null) return '—';
    if (d < 30) return d + 'd';
    if (d < 365) return Math.round(d / 30) + 'mo';
    return (d / 365).toFixed(1) + 'y';
  }
  function chainsText(c) { return c.slice(0, 3).join(', ') + (c.length > 3 ? ' +' + (c.length - 3) : ''); }

  // ---- header ----
  $('asOf').textContent = R.as_of;
  $('source').textContent = R.source;
  $('floor').textContent = money(R.floor_usd);
  var top = R.rows[0];
  $('stats').innerHTML =
    stat(R.board_size, 'protocols ranked') +
    stat(R.watchlist_size, 'on the watchlist') +
    stat(R.early_size, 'early finds below the floor') +
    stat(money(top ? top.implied_value_usd : 0), 'top implied value') +
    stat(R.live_size, 'live tokens set aside');
  function stat(b, label) {
    return '<div class="stat"><b>' + esc(b) + '</b><span>' + esc(label) + '</span></div>';
  }

  // ---- filter controls ----
  var cats = {}, chains = {};
  R.rows.forEach(function (r) {
    if (r.category) cats[r.category] = 1;
    r.chains.forEach(function (c) { chains[c] = 1; });
  });
  Object.keys(cats).sort().forEach(function (c) {
    $('cat').appendChild(new Option(c, c));
  });
  Object.keys(chains).sort().forEach(function (c) {
    $('chain').appendChild(new Option(c, c));
  });

  var state = {
    q: params.get('q') || '',
    cat: params.get('cat') || '',
    chain: params.get('chain') || '',
    minTvl: parseInt(params.get('minTvl') || '0', 10) || 0,
    sort: params.get('sort') || 'value',
    watchOnly: params.get('watch') === '1',
    detail: params.get('detail') || null,
  };
  $('q').value = state.q;
  $('cat').value = state.cat;
  $('chain').value = state.chain;
  $('minTvl').value = String([0, 50000000, 100000000, 500000000, 1000000000].indexOf(state.minTvl) >= 0 ? state.minTvl : 0);
  $('sort').value = state.sort;
  $('watchOnly').checked = state.watchOnly;

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var rows = R.rows.filter(function (r) {
      if (state.watchOnly && !watchSlugs[r.slug]) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      return true;
    });
    var by = {
      value: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
    }[state.sort] || function (a, b) { return b.implied_value_usd - a.implied_value_usd; };
    return rows.slice().sort(by);
  }

  function renderBoard() {
    var rows = filtered();
    $('count').textContent = rows.length + ' of ' + R.board_size + ' ranked protocols' +
      (state.watchOnly ? ' — watchlist only' : '') + '. Click a row for its farm plan.';
    $('rows').innerHTML = rows.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.detail === r.slug ? ' class="selected"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><span class="pname">' + esc(r.name) + '</span>' +
        (watchSlugs[r.slug] ? '<span class="badge">WATCHLIST</span>' : '') +
        '<span class="psub">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(chainsText(r.chains)) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num value">' + money(r.implied_value_usd) + '</td></tr>';
    }).join('');
    document.querySelectorAll('#rows tr').forEach(function (tr) {
      tr.addEventListener('click', function () { showDetail(tr.getAttribute('data-slug')); });
    });
  }

  function factor(label, value, frac, note) {
    return '<div class="factor"><b>' + esc(value) + '</b><span>' + esc(label) + '</span>' +
      '<div class="bar"><i style="width:' + Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%"></i></div>' +
      '<span>' + esc(note) + '</span></div>';
  }

  function showDetail(slug) {
    var r = null;
    R.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    var box = $('detail');
    if (!r) { box.hidden = true; state.detail = null; return; }
    state.detail = slug;
    var m = R.model;
    var base = r.tvl_usd * m.base_multiple;
    box.innerHTML =
      '<h2>#' + r.rank + ' ' + esc(r.name) + (watchSlugs[r.slug] ? '<span class="badge">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="meta">' + esc(r.category || 'Uncategorised') + ' &middot; ' + esc(r.chains.join(', ') || 'no chain listed') +
      ' &middot; tracked since ' + esc(r.listed_at || 'unknown') + ' &middot; records no token.</p>' +
      '<div class="breakdown">' +
      factor('TVL × ' + m.base_multiple, money(base), Math.min(1, base / 1e9), 'base = TVL × ' + m.base_multiple) +
      factor('Growth ×' + r.growth_multiplier.toFixed(2), growthText(r.change_7d), Math.min(1, (r.change_7d || 0) / 50 + 0.5), '7-day TVL change') +
      factor('Maturity ×' + r.maturity_multiplier.toFixed(2), ageText(r.age_days), Math.min(1, (r.age_days || 0) / 1460), 'days with no token') +
      factor('Breadth ×' + r.breadth_multiplier.toFixed(2), r.chains.length + ' chains', Math.min(1, r.chains.length / 6), '+3% per chain, max 6') +
      factor('Implied value', money(r.implied_value_usd), 1, 'base × growth × maturity × breadth') +
      '</div>' +
      '<h3>How to farm it</h3><ol class="steps">' +
      r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '</ol>' +
      '<p class="note">Each step states its cost and time. Never pay to claim an airdrop; claim only from a link the protocol itself publishes.</p>';
    box.hidden = false;
    renderBoard();
    box.scrollIntoView({ block: 'nearest' });
  }

  // ---- live tab ----
  $('liveRows').innerHTML = R.live.map(function (p) {
    return '<tr><td><span class="pname">' + esc(p.name) + '</span><span class="psub">' + esc(p.slug) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td><td>' + esc(chainsText(p.chains)) + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + money(p.mcap_usd) + '</td>' +
      '<td class="num">' + pct(p.change_7d) + '</td></tr>';
  }).join('');

  // ---- model tab ----
  var m = R.model;
  $('formula').textContent =
    'implied = TVL x ' + m.base_multiple + ' x growth x maturity x breadth\n' +
    'growth   = 1 + clamp(7d change, ' + m.growth_floor + '%, +' + m.growth_cap + '%) / 100 x ' + m.growth_weight + '\n' +
    'maturity = ' + m.maturity_floor + ' + min(age, ' + m.maturity_days + 'd) / ' + m.maturity_days + 'd x ' + m.maturity_range + '  (age unknown: ' + m.unknown_age_days + 'd)\n' +
    'breadth  = 1 + ' + m.breadth_per_chain + ' x min(chains, ' + m.breadth_max_chains + ')\n' +
    'model ' + R.model_version + ' — the same function scores every row; no name is special-cased.';

  // ---- tabs ----
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    document.querySelectorAll('#tabs button').forEach(function (x) { x.classList.toggle('active', x === b); });
    ['board', 'live', 'model'].forEach(function (t) { $('tab-' + t).hidden = t !== b.getAttribute('data-tab'); });
  });

  // ---- controls ----
  $('q').addEventListener('input', function () { state.q = $('q').value; renderBoard(); });
  $('cat').addEventListener('change', function () { state.cat = $('cat').value; renderBoard(); });
  $('chain').addEventListener('change', function () { state.chain = $('chain').value; renderBoard(); });
  $('minTvl').addEventListener('change', function () { state.minTvl = parseInt($('minTvl').value, 10); renderBoard(); });
  $('sort').addEventListener('change', function () { state.sort = $('sort').value; renderBoard(); });
  $('watchOnly').addEventListener('change', function () { state.watchOnly = $('watchOnly').checked; renderBoard(); });

  renderBoard();
  if (state.detail) showDetail(state.detail);
})();
