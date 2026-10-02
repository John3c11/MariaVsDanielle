// Charts: weekly units bars, hit grid, odds strip, form line and the all-time race.
// Part of the MariaVsDanielle site. All js/ files share one global scope and load in the order listed in index.html.
// Every chart is plain SVG/HTML. Marks carry data-tip="..." and the shared tooltip (bottom of this file) shows it.

    var CH = {
      grid: 'rgba(255,255,255,0.07)', zero: 'rgba(255,255,255,0.35)', axis: 'rgba(255,255,255,0.45)',
      surface: '#15171C', miss: 'rgba(255,255,255,0.13)',
    };
    // Draw at the real on-screen width so text stays readable on phones
    function chW() {
      var wrap = document.querySelector('.wrap');
      if (!wrap) return 600;
      var cs = getComputedStyle(wrap);
      var inner = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return Math.round(Math.min(600, Math.max(300, inner - 26)));
    }
    function chTip(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
    function chU(v) { v = Math.round(v * 10) / 10; return (v > 0 ? '+' : '') + v + 'u'; }
    function chLegend(items) {
      return '<div class="ch-legend">' + items.map(function(it) {
        return '<span><i class="ch-key ' + (it.cls || '') + '" style="' + (it.style || 'background:' + it.color) + '"></i>' + it.label + '</span>';
      }).join('') + '</div>';
    }
    // Nice y-axis steps
    function chScale(lo, hi, maxTicks) {
      lo = Math.min(lo, 0); hi = Math.max(hi, 0);
      var steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
      var step = steps.filter(function(s) { return (hi - lo) / s <= (maxTicks || 5); })[0] || 1000;
      lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
      if (hi === lo) hi = lo + step;
      return { lo: lo, hi: hi, step: step };
    }
    // A bar anchored at the baseline with a rounded data end
    function chBar(x, w, y0, y1, color, tip) {
      var top = Math.min(y0, y1), h = Math.abs(y1 - y0), r = Math.min(3, w / 2, h);
      var d;
      if (h < 0.5) d = 'M' + x + ',' + (y0 - 0.5) + 'h' + w + 'v1h' + (-w) + 'z';
      else if (y1 < y0) d = 'M' + x + ',' + y0 + 'V' + (top + r) + 'Q' + x + ',' + top + ' ' + (x + r) + ',' + top + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + top + ' ' + (x + w) + ',' + (top + r) + 'V' + y0 + 'Z';
      else d = 'M' + x + ',' + y0 + 'V' + (y1 - r) + 'Q' + x + ',' + y1 + ' ' + (x + r) + ',' + y1 + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y1 + ' ' + (x + w) + ',' + (y1 - r) + 'V' + y0 + 'Z';
      return '<path d="' + d + '" fill="' + color + '"/>' ;
    }

    // Decided bets in order. rows = analytics row objects (already oldest → newest).
    function chDecided(rows, season) {
      return rows.filter(function(r) {
        return (season === 'all' || r.year === season) && (r.picker === 'Maria' || r.picker === 'Danielle') &&
          (r.homePick || r.awayPick) && (r.correct === 'Yes' || r.correct === 'No');
      });
    }
    function chNotOffered(r) { return r.wasOffered === 'No' && r.netUnits === 0 && !!r.firstScorer; }

    // ── 1. Weekly units: one up/down bar per person per week ────────────────
    function weeklyUnitsChart(rows, season) {
      var W = {}, order = [];
      chDecided(rows, season).forEach(function(r) {
        var k = r.year + '_' + r.week;
        var w = W[k] || (W[k] = (order.push(k), { year: r.year, week: r.week, Maria: { u: 0, h: 0, n: 0 }, Danielle: { u: 0, h: 0, n: 0 } }));
        var p = w[r.picker]; p.u += r.netUnits;
        if (!chNotOffered(r)) { p.n++; if (r.correct === 'Yes') p.h++; }
      });
      if (order.length < 2) return '<div class="ch-empty">Needs at least two weeks of results.</div>';
      var vals = [];
      order.forEach(function(k) { vals.push(W[k].Maria.u, W[k].Danielle.u); });
      var sc = chScale(Math.min.apply(null, vals), Math.max.apply(null, vals), 5);
      var Wd = chW(), H = 230, L = 38, R = 8, T = 10, B = 28, pw = Wd - L - R;
      var band = pw / order.length, bw = Math.max(2, Math.min(12, band * 0.36));
      function y(v) { return T + (sc.hi - v) / (sc.hi - sc.lo) * (H - T - B); }
      var svg = '<svg viewBox="0 0 ' + Wd + ' ' + H + '" class="ch-svg" font-family="Inter,sans-serif">';
      for (var v = sc.lo; v <= sc.hi + 0.001; v += sc.step) {
        var z = Math.abs(v) < 0.001;
        svg += '<line x1="' + L + '" x2="' + (Wd - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="' + (z ? CH.zero : CH.grid) + '"' + (z ? ' stroke-dasharray="4 3"' : '') + '/>' +
          '<text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" font-size="10" fill="' + CH.axis + '" text-anchor="end">' + (v > 0 ? '+' : '') + v + '</text>';
      }
      var every = Math.ceil(order.length / 12);
      order.forEach(function(k, i) {
        var w = W[k], cx = L + band * i + band / 2;
        if (i > 0 && w.year !== W[order[i - 1]].year) {
          svg += '<line x1="' + (L + band * i) + '" x2="' + (L + band * i) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="rgba(255,255,255,0.25)" stroke-dasharray="3 3"/>' +
            '<text x="' + (L + band * i + 4) + '" y="' + (T + 10) + '" font-size="10" font-weight="700" fill="' + CH.axis + '">' + w.year + '</text>';
        }
        svg += chBar(cx - bw - 1, bw, y(0), y(w.Maria.u), SB_M) + chBar(cx + 1, bw, y(0), y(w.Danielle.u), SB_D);
        if (i % every === 0) svg += '<text x="' + cx + '" y="' + (H - B + 16) + '" font-size="10" fill="' + CH.axis + '" text-anchor="middle">' + w.week + '</text>';
        var tip = (season === 'all' ? w.year + ' ' : '') + 'Week ' + w.week + ' · Maria ' + chU(w.Maria.u) + ' (' + w.Maria.h + '/' + w.Maria.n + ') · Danielle ' + chU(w.Danielle.u) + ' (' + w.Danielle.h + '/' + w.Danielle.n + ')';
        svg += '<rect x="' + (L + band * i) + '" y="' + T + '" width="' + band + '" height="' + (H - T - B) + '" fill="transparent" class="ch-hit" data-tip="' + chTip(tip) + '"/>';
      });
      svg += '<text x="' + (L + pw / 2) + '" y="' + (H - 1) + '" font-size="9" fill="' + CH.axis + '" text-anchor="middle" opacity="0.7">WEEK</text></svg>';
      var best = { Maria: null, Danielle: null };
      order.forEach(function(k) { ['Maria', 'Danielle'].forEach(function(n) { if (!best[n] || W[k][n].u > best[n].u) best[n] = { u: W[k][n].u, w: W[k] }; }); });
      var up = { Maria: 0, Danielle: 0 };
      order.forEach(function(k) { ['Maria', 'Danielle'].forEach(function(n) { if (W[k][n].u > 0) up[n]++; }); });
      return chLegend([{ label: 'Maria', color: SB_M }, { label: 'Danielle', color: SB_D }]) + svg +
        '<div class="ch-note">Weeks in the green: <b style="color:' + SB_M + '">Maria ' + up.Maria + '</b> · <b style="color:' + SB_D + '">Danielle ' + up.Danielle + '</b> of ' + order.length + '.</div>';
    }

    // ── 2. Hit grid: one square per bet ─────────────────────────────────────
    function hitGridChart(rows, season) {
      var bets = chDecided(rows, season);
      if (!bets.length) return '<div class="ch-empty">No results yet.</div>';
      var h = chLegend([
        { label: 'Hit', style: 'background:' + SB_M + ';box-shadow:6px 0 0 ' + SB_D, cls: 'ch-key-pair' },
        { label: 'Miss', color: CH.miss },
        { label: 'Not offered', style: 'background:transparent;border:1.5px dashed rgba(255,255,255,0.35)' },
      ]);
      ['Maria', 'Danielle'].forEach(function(who) {
        var mine = bets.filter(function(r) { return r.picker === who; });
        var c = who === 'Maria' ? SB_M : SB_D, hits = 0, n = 0;
        var cells = '', lastWeek = null, lastYear = null;
        mine.forEach(function(r) {
          if (r.year !== lastYear) { cells += (lastYear ? '<span class="hg-yr">' + r.year + '</span>' : (season === 'all' ? '<span class="hg-yr">' + r.year + '</span>' : '')); lastYear = r.year; lastWeek = null; }
          if (lastWeek !== null && r.week !== lastWeek) cells += '<i class="hg-gap"></i>';
          lastWeek = r.week;
          var no = chNotOffered(r), hit = r.correct === 'Yes' && !no;
          if (!no) { n++; if (hit) hits++; }
          var tip = (season === 'all' ? r.year + ' ' : '') + 'Wk ' + r.week + ' · ' + resolveTeam(r.homeTeam) + ' vs ' + resolveTeam(r.awayTeam) +
            ' · First TD: ' + (r.firstScorer || '?') + ' · ' + who + ' had ' + [r.homePick, r.awayPick].filter(Boolean).join(' / ') + (no ? ' (not offered)' : hit ? ' ✅' : ' ❌');
          cells += '<i class="hg-cell' + (no ? ' no' : '') + '" style="' + (hit ? 'background:' + c : no ? '' : 'background:' + CH.miss) + '" data-tip="' + chTip(tip) + '"></i>';
        });
        h += '<div class="hg-row"><div class="hg-name" style="color:' + c + '">' + who + ' <span>' + hits + '/' + n + '</span></div><div class="hg-cells">' + cells + '</div></div>';
      });
      return h + '<div class="ch-note">Oldest to newest, left to right. Small gaps separate weeks. Tap a square for the game.</div>';
    }

    // ── 3. Odds strip: every player picked, placed by his odds ─────────────
    function oddsStripChart(rows, season) {
      var bets = chDecided(rows, season).filter(function(r) { return !chNotOffered(r); });
      var pts = { Maria: [], Danielle: [] };
      bets.forEach(function(r) {
        [[r.homePick, r.homeOdds, r.homeTeam], [r.awayPick, r.awayOdds, r.awayTeam]].forEach(function(x) {
          if (!x[0] || !(x[1] > 0)) return;
          pts[r.picker].push({ name: x[0], odds: Math.round(x[1] * 100), hit: playerKey(x[0]) === playerKey(r.firstScorer), r: r });
        });
      });
      var all = pts.Maria.concat(pts.Danielle);
      if (all.length < 4) return '<div class="ch-empty">Not enough picks with odds yet.</div>';
      var lo = Math.max(100, Math.min.apply(null, all.map(function(p) { return p.odds; }))), hi = Math.max.apply(null, all.map(function(p) { return p.odds; }));
      lo = Math.min(lo, 300); hi = Math.max(hi, 3000);
      var W = chW(), L = 70, R = 14, rowH = 64, T = 6, H = T + rowH * 2 + 24;
      function x(o) { return L + (Math.log(Math.max(o, lo)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) * (W - L - R); }
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ch-svg" font-family="Inter,sans-serif">';
      [300, 500, 1000, 2000, 3000, 5000].filter(function(t) { return t >= lo && t <= hi; }).forEach(function(t) {
        svg += '<line x1="' + x(t) + '" x2="' + x(t) + '" y1="' + T + '" y2="' + (T + rowH * 2) + '" stroke="' + CH.grid + '"/>' +
          '<text x="' + x(t) + '" y="' + (T + rowH * 2 + 16) + '" font-size="10" fill="' + CH.axis + '" text-anchor="middle">+' + t + '</text>';
      });
      var notes = [];
      ['Maria', 'Danielle'].forEach(function(who, ri) {
        var c = who === 'Maria' ? SB_M : SB_D, y0 = T + ri * rowH, mid = y0 + rowH / 2;
        svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + mid + '" y2="' + mid + '" stroke="rgba(255,255,255,0.05)"/>' +
          '<text x="' + (L - 10) + '" y="' + (mid + 4) + '" font-size="12" font-weight="700" fill="' + c + '" text-anchor="end">' + who + '</text>';
        // misses first so hits sit on top; deterministic jitter so dots don't stack
        var list = pts[who].slice().sort(function(a, b) { return (a.hit ? 1 : 0) - (b.hit ? 1 : 0); });
        list.forEach(function(p, i) {
          var j = ((i * 37) % 9 - 4) * 5.2;
          var tip = p.name + ' +' + p.odds + ' · ' + (season === 'all' ? p.r.year + ' ' : '') + 'Wk ' + p.r.week + (p.hit ? ' · scored first ✅' : '');
          svg += p.hit
            ? '<circle cx="' + x(p.odds).toFixed(1) + '" cy="' + (mid + j * 0.4).toFixed(1) + '" r="6" fill="' + c + '" stroke="' + CH.surface + '" stroke-width="2" data-tip="' + chTip(tip) + '"/>'
            : '<circle cx="' + x(p.odds).toFixed(1) + '" cy="' + (mid + j).toFixed(1) + '" r="4" fill="none" stroke="rgba(255,255,255,0.32)" stroke-width="1.5" data-tip="' + chTip(tip) + '"/>';
        });
        var hits = pts[who].filter(function(p) { return p.hit; }).map(function(p) { return p.odds; }).sort(function(a, b) { return a - b; });
        if (hits.length) notes.push('<b style="color:' + c + '">' + who + '</b>: ' + hits.length + ' hit' + (hits.length > 1 ? 's' : '') + ', typical +' + hits[Math.floor(hits.length / 2)]);
      });
      svg += '</svg>';
      return chLegend([{ label: 'Scored first', style: 'background:#E5E7EB' }, { label: 'Didn\'t', style: 'background:transparent;border:1.5px solid rgba(255,255,255,0.45)' }]) + svg +
        '<div class="ch-note">Every player picked, placed by his odds (left = favorites, right = longshots). ' + notes.join(' · ') + '</div>';
    }

    // ── Shared line chart (form line + all-time race) ───────────────────────
    // opts: { n, series:[{name,color,vals}], xLabels:[{i,label}], dividers:[{i,label}], tips:[...], fmt, lo, hi, step, height }
    function chLineChart(o) {
      var W = chW(), H = o.height || 230, L = 40, R = 60, T = 12, B = 26;
      var vals = [];
      o.series.forEach(function(s) { s.vals.forEach(function(v) { if (v !== null) vals.push(v); }); });
      var sc = o.lo !== undefined ? { lo: o.lo, hi: o.hi, step: o.step } : chScale(Math.min.apply(null, vals), Math.max.apply(null, vals), 5);
      function x(i) { return L + (o.n > 1 ? i / (o.n - 1) : 0) * (W - L - R); }
      function y(v) { return T + (sc.hi - v) / (sc.hi - sc.lo) * (H - T - B); }
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ch-svg" font-family="Inter,sans-serif">';
      for (var v = sc.lo; v <= sc.hi + 0.001; v += sc.step) {
        var z = Math.abs(v) < 0.001 && o.zeroLine !== false;
        svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="' + (z ? CH.zero : CH.grid) + '"' + (z ? ' stroke-dasharray="4 3"' : '') + '/>' +
          '<text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" font-size="10" fill="' + CH.axis + '" text-anchor="end">' + o.fmt(v, true) + '</text>';
      }
      (o.dividers || []).forEach(function(d) {
        svg += '<line x1="' + x(d.i) + '" x2="' + x(d.i) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="rgba(255,255,255,0.25)" stroke-dasharray="3 3"/>' +
          '<text x="' + (x(d.i) + 4) + '" y="' + (T + 10) + '" font-size="10" font-weight="700" fill="' + CH.axis + '">' + d.label + '</text>';
      });
      (o.xLabels || []).forEach(function(l) {
        svg += '<text x="' + x(l.i) + '" y="' + (H - B + 16) + '" font-size="10" fill="' + CH.axis + '" text-anchor="middle">' + l.label + '</text>';
      });
      var ends = [];
      o.series.forEach(function(s) {
        var d = '', pen = false, last = null;
        s.vals.forEach(function(v, i) {
          if (v === null) { pen = false; return; }
          d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pen = true; last = { i: i, v: v };
        });
        svg += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
        if (last) { svg += '<circle cx="' + x(last.i) + '" cy="' + y(last.v) + '" r="4" fill="' + s.color + '" stroke="' + CH.surface + '" stroke-width="2"/>'; ends.push({ y: y(last.v), x: x(last.i), txt: o.fmt(last.v), c: s.color }); }
      });
      if (ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 14) {
        var mid = (ends[0].y + ends[1].y) / 2, up = ends[0].y <= ends[1].y;
        ends[0].y = mid + (up ? -7 : 7); ends[1].y = mid + (up ? 7 : -7);
      }
      ends.forEach(function(e) { svg += '<text x="' + (e.x + 9) + '" y="' + (e.y + 4) + '" font-size="12" font-weight="700" fill="' + e.c + '">' + e.txt + '</text>'; });
      // hover columns
      var colW = (W - L - R) / Math.max(1, o.n - 1);
      for (var i = 0; i < o.n; i++) {
        if (!o.tips[i]) continue;
        svg += '<rect x="' + (x(i) - colW / 2) + '" y="' + T + '" width="' + colW + '" height="' + (H - T - B) + '" fill="transparent" class="ch-hit ch-col" data-tip="' + chTip(o.tips[i]) + '"/>';
      }
      return chLegend(o.series.map(function(s) { return { label: s.name, color: s.color }; })) + svg + '</svg>';
    }

    // ── 4. Form: win % over each person's last 8 bets ──────────────────────
    function formChart(rows, season) {
      var N = 8, bets = chDecided(rows, season).filter(function(r) { return !chNotOffered(r); });
      var G = [], gi = {};
      bets.forEach(function(r) { var k = r.year + '_' + r.week + '_' + r.game; if (!(k in gi)) { gi[k] = G.length; G.push({ year: r.year, week: r.week, home: r.homeTeam, away: r.awayTeam }); } });
      if (G.length < N) return '<div class="ch-empty">Needs at least ' + N + ' games.</div>';
      var hist = { Maria: [], Danielle: [] }, series = { Maria: [], Danielle: [] };
      G.forEach(function(g, i) {
        ['Maria', 'Danielle'].forEach(function(n) {
          var r = bets.filter(function(b) { return b.picker === n && gi[b.year + '_' + b.week + '_' + b.game] === i; })[0];
          if (r) hist[n].push(r.correct === 'Yes' ? 1 : 0);
          var h = hist[n];
          series[n].push(h.length >= N ? h.slice(-N).reduce(function(a, b) { return a + b; }, 0) / N * 100 : null);
        });
      });
      var xl = [], dv = [], tips = [];
      G.forEach(function(g, i) {
        if (i > 0 && g.year !== G[i - 1].year) dv.push({ i: i, label: g.year });
        if (i === 0 || g.week !== G[i - 1].week) xl.push({ i: i, label: 'Wk ' + g.week });
        var m = series.Maria[i], d = series.Danielle[i];
        tips.push(m === null && d === null ? '' : (season === 'all' ? g.year + ' ' : '') + 'Wk ' + g.week + ' · last ' + N + ': Maria ' + (m === null ? '—' : Math.round(m) + '%') + ' · Danielle ' + (d === null ? '—' : Math.round(d) + '%'));
      });
      var keep = Math.ceil(xl.length / 9); xl = xl.filter(function(l, k) { return k % keep === 0; });
      return chLineChart({ n: G.length, series: [{ name: 'Maria', color: SB_M, vals: series.Maria }, { name: 'Danielle', color: SB_D, vals: series.Danielle }],
        xLabels: xl, dividers: dv, tips: tips, lo: 0, hi: 100, step: 25, zeroLine: false, fmt: function(v) { return Math.round(v) + '%'; } }) +
        '<div class="ch-note">Share of the last ' + N + ' bets that hit, game by game. Not-offered games are skipped.</div>';
    }

    // ── 5. All-time race: running units across every season (All-Time tab) ─
    // bets: All-Time tab bet objects ({year, week, game, picker, netUnits, correct})
    function allTimeRaceChart(bets) {
      var G = [], gi = {};
      bets.filter(function(b) { return (b.picker === 'Maria' || b.picker === 'Danielle') && (b.correct === 'Yes' || b.correct === 'No'); })
        .forEach(function(b) {
          var k = b.year + '_' + b.week + '_' + b.game;
          if (!(k in gi)) { gi[k] = G.length; G.push({ year: b.year, week: b.week, Maria: 0, Danielle: 0 }); }
          G[gi[k]][b.picker] += b.netUnits;
        });
      if (G.length < 2) return '';
      var m = [0], d = [0], xl = [], dv = [], tips = [''];
      G.forEach(function(g, i) {
        m.push(m[i] + g.Maria); d.push(d[i] + g.Danielle);
        if (i > 0 && g.year !== G[i - 1].year) dv.push({ i: i + 1, label: g.year });
        tips.push(g.year + ' Wk ' + g.week + ' · Maria ' + chU(m[i + 1]) + ' · Danielle ' + chU(d[i + 1]));
      });
      xl.push({ i: 0, label: G[0].year });
      return chLineChart({ n: G.length + 1, series: [{ name: 'Maria', color: SB_M, vals: m }, { name: 'Danielle', color: SB_D, vals: d }],
        xLabels: [], dividers: [{ i: 0, label: G[0].year }].concat(dv), tips: tips, fmt: function(v, axis) { return axis ? (v > 0 ? '+' : '') + v : chU(v); }, height: 250 });
    }

    // ── Shared tooltip for anything with data-tip ───────────────────────────
    (function() {
      var tip = null, hideT = null;
      function el() {
        if (!tip) { tip = document.createElement('div'); tip.className = 'ch-tip'; document.body.appendChild(tip); }
        return tip;
      }
      function show(t, cx, cy) {
        var e = el(); e.textContent = t; e.style.display = 'block';
        var w = e.offsetWidth, h = e.offsetHeight;
        var left = Math.min(Math.max(8, cx - w / 2), window.innerWidth - w - 8);
        var top = cy - h - 14; if (top < 8) top = cy + 18;
        e.style.left = left + 'px'; e.style.top = top + 'px';
      }
      function hide() { if (tip) tip.style.display = 'none'; }
      document.addEventListener('pointermove', function(ev) {
        if (ev.pointerType === 'touch') return;
        var t = ev.target.closest && ev.target.closest('[data-tip]');
        if (t) show(t.getAttribute('data-tip'), ev.clientX, ev.clientY); else hide();
      });
      document.addEventListener('click', function(ev) {
        var t = ev.target.closest && ev.target.closest('[data-tip]');
        if (!t) { hide(); return; }
        show(t.getAttribute('data-tip'), ev.clientX, ev.clientY);
        clearTimeout(hideT); hideT = setTimeout(hide, 3500);
      });
      window.addEventListener('scroll', hide, { passive: true });
    })();
