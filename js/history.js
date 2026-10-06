// History tabs: Bet History, Legacy (all-time totals, Season Wrapped, Crowd Wrapped) and Money.
// Part of the MariaVsDanielle site. All js/ files share one global scope and load in the order listed in index.html.

    // ── Bet History tab ──────────────────────────────────────────────────────────
    var BH_LOADED = false;
    var ALL_BH_BETS = [];
    var BH_FILTERS = { year: 'all', picker: 'all', result: 'all', order: 'desc' };

    function filterBHHistory() {
      var q = document.getElementById('bh-search') ? document.getElementById('bh-search').value.toLowerCase().trim() : '';
      var filtered = ALL_BH_BETS.filter(function(b) {
        if (q && !b.searchText.includes(q)) return false;
        if (BH_FILTERS.year !== 'all' && b.year !== BH_FILTERS.year) return false;
        if (BH_FILTERS.picker !== 'all' && b.picker !== BH_FILTERS.picker) return false;
        if (BH_FILTERS.result !== 'all' && b.correct !== BH_FILTERS.result) return false;
        return true;
      });
      filtered.sort(function(a, b) {
        if (BH_FILTERS.order === 'asc') {
          if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
          if (a.week !== b.week) return parseInt(a.week) - parseInt(b.week);
          return a.idx - b.idx;
        } else {
          if (a.year !== b.year) return parseInt(b.year) - parseInt(a.year);
          if (a.week !== b.week) return parseInt(b.week) - parseInt(a.week);
          return b.idx - a.idx;
        }
      });
      BH_SHOW = 25;
      BH_LAST = filtered;
      renderBHHistory(filtered);
    }
    var BH_SHOW = 25, BH_LAST = [];

    function renderBHHistory(bets) {
      var el = document.getElementById('bh-history-table');
      var countEl = document.getElementById('bh-hist-count');
      if (countEl) countEl.textContent = bets.length + ' bet' + (bets.length !== 1 ? 's' : '');
      if (!el) return;
      var header = '<div class="bh-head" style="display:grid;grid-template-columns:44px 40px 1fr 80px 1fr 70px 110px 50px;gap:8px;padding-bottom:8px;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:10px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em">' +
        '<span>Year</span><span>Wk</span><span>Game</span><span>Picker</span><span>Players</span><span>Odds</span><span>First TD</span><span>Units</span></div>';
      var rows = bets.slice(0, BH_SHOW).map(function(b) {
        // First TD scorer: green = hit, red = miss, gray = not offered (didn't count)
        var noOffer = b.notOffered;
        var resultBg = noOffer ? 'rgba(255,255,255,0.08)' : b.correct === 'Yes' ? 'rgba(52,211,153,0.15)' : b.correct === 'No' ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.08)';
        var resultColor = noOffer ? '#9CA3AF' : b.correct === 'Yes' ? '#34D399' : b.correct === 'No' ? '#F87171' : '#9CA3AF';
        var resultText = b.firstScorer ? escHtml(b.firstScorer) : '⏳';
        var pickerColor = personColor(b.picker);
        var unitColor = b.netUnits > 0 ? '#34D399' : b.netUnits < 0 ? '#F87171' : '#9CA3AF';
        var unitStr = b.netUnits !== 0 ? (b.netUnits > 0 ? '+' : '') + b.netUnits + 'u' : '0u';
        var homeColored = b.homePick ? coloredText(b.homePick, b.homeTeam) : '';
        var awayColored = b.awayPick ? coloredText(b.awayPick, b.awayTeam) : '';
        var players = [homeColored, awayColored].filter(Boolean).join('<span style="color:#9CA3AF"> / </span>') || '—';
        var gameDisplay = b.homeTeam && b.awayTeam ? coloredGame(b.homeTeam, b.awayTeam) : (b.game || '—');
        if (b.firstScorer && b.homeTeam) gameDisplay += ' <button class="rp-mini" title="Replay this game" aria-label="Replay this game" onclick="replayGame(\'' + b.year + '\',' + parseInt(b.week, 10) + ',\'' + escHtml(String(b.game)) + '\')">⏪</button>';
        return '<div class="bh-row" data-ctx-year="' + b.year + '" data-ctx-week="' + b.week + '" style="display:grid;grid-template-columns:44px 40px 1fr 80px 1fr 70px 110px 50px;gap:8px;padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:12px;align-items:start">' +
          '<span style="font-size:11px;font-weight:600;color:' + (b.year === CURRENT_YEAR ? '#60A5FA' : '#34D399') + '">' + b.year + '</span>' +
          '<span style="color:#9CA3AF;text-align:center">' + (PLAYOFF_SHORT[parseInt(b.week, 10)] || b.week) + '</span>' +
          '<span style="font-weight:500">' + gameDisplay + '</span>' +
          '<span style="font-weight:500;color:' + pickerColor + '">' + b.picker + '</span>' +
          '<span>' + players + '</span>' +
          '<span style="color:#A1A9B6">' + b.odds + '</span>' +
          '<span class="bh-ftd" title="' + (noOffer ? 'Not offered, bet did not count' : '') + '" style="font-size:11px;font-weight:600;padding:3px 7px;border-radius:5px;text-align:center;line-height:1.3;background:' + resultBg + ';color:' + resultColor + '">' + resultText + '</span>' +
          '<span style="text-align:right;font-weight:500;color:' + unitColor + '">' + unitStr + '</span>' +
          '</div>';
      }).join('');
      var more = bets.length > BH_SHOW ? '<div style="text-align:center;margin:14px 0 4px"><button class="adm-btn" id="bh-more">Show ' + Math.min(25, bets.length - BH_SHOW) + ' more · ' + (bets.length - BH_SHOW) + ' left</button></div>' : '';
      el.innerHTML = bets.length === 0 ? '<div style="color:#9CA3AF;text-align:center;padding:32px">No results.</div>' : header + rows + more;
      var mb = document.getElementById('bh-more');
      if (mb) mb.addEventListener('click', function() { BH_SHOW += 25; renderBHHistory(bets); });
    }

    function loadBetHistoryTab() {
      if (BH_LOADED) return;
      BH_LOADED = true;
      Promise.all(SEASONS.map(fetchLegacySeason)).then(function(results) {
        ALL_BH_BETS = [];
        results.forEach(function(bets) { ALL_BH_BETS = ALL_BH_BETS.concat(bets); });
        // Add original index for tiebreaking within same year+week
        ALL_BH_BETS.forEach(function(b, i) { b.idx = i; });
        // oldest first: SEASONS array is newest first, so we reverse to get oldest first


        var html = '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap" id="bh-filters">' +
          '<div style="display:flex;gap:4px;align-items:center"><span style="font-size:11px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Year</span>' +
          '<button class="filter-btn active" data-key="year" data-val="all">All</button>' +
          SEASONS.map(function(se) { return '<button class="filter-btn" data-key="year" data-val="' + se.year + '">' + se.year + '</button>'; }).join('') + '</div>' +
          '<div style="display:flex;gap:4px;align-items:center;margin-left:12px"><span style="font-size:11px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Picker</span>' +
          '<button class="filter-btn active" data-key="picker" data-val="all">Both</button>' +
          '<button class="filter-btn maria-btn" data-key="picker" data-val="Maria">Maria</button>' +
          '<button class="filter-btn danielle-btn" data-key="picker" data-val="Danielle">Danielle</button></div>' +
          '<div style="display:flex;gap:4px;align-items:center;margin-left:12px"><span style="font-size:11px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Result</span>' +
          '<button class="filter-btn active" data-key="result" data-val="all">All</button>' +
          '<button class="filter-btn win-btn" data-key="result" data-val="Yes">Win</button>' +
          '<button class="filter-btn loss-btn" data-key="result" data-val="No">Loss</button></div>' +
          '<div style="display:flex;gap:4px;align-items:center;margin-left:12px"><span style="font-size:11px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Order</span><button class="filter-btn" data-key="order" data-val="asc">Oldest First</button><button class="filter-btn active" data-key="order" data-val="desc">Newest First</button></div>' +
          '</div>' +
          '<input type="text" id="bh-search" style="width:100%;padding:10px 14px;font-family:Inter,sans-serif;font-size:14px;border:0.5px solid rgba(255,255,255,0.10);border-radius:8px;background:rgba(255,255,255,0.05);color:#F3F4F6;outline:none;margin-bottom:12px" placeholder="Search player, team, week, year, or picker..." oninput="filterBHHistory()">' +
          '<div id="bh-hist-count" style="font-size:12px;color:#9CA3AF;margin-bottom:12px"></div>' +
          '<div id="bh-history-table"></div>';

        document.getElementById('bethistory-content').innerHTML = html;

        document.getElementById('bh-filters').addEventListener('click', function(e) {
          var btn = e.target.closest('.filter-btn');
          if (!btn) return;
          var key = btn.getAttribute('data-key');
          var val = btn.getAttribute('data-val');
          BH_FILTERS[key] = val;
          var group = btn.parentElement;
          group.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          filterBHHistory();
        });

        filterBHHistory();
      }).catch(function(e) {
        console.error(e);
        document.getElementById('bethistory-content').innerHTML = '<div style="color:#9CA3AF;text-align:center;padding:32px">Error: ' + e.message + '</div>';
      });
    }

    var ALL_LEGACY_BETS = [];
    function fetchLegacySeason(season) {
      var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + season.sheetId +
        '/values/' + encodeURIComponent(season.tab + '!A1:Q400') + '?key=' + API_KEY;
      return fetch(url).then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function(data) {
        // Real bets with at least one pick
        return readBets(data.values).filter(function(b) { return isMDRow(b) && (b.homePick || b.awayPick); }).map(function(b) {
          var game = b.home && b.away ? b.home + ' vs ' + b.away : '';
          var oddsArr = [];
          if (b.homePick && !isNaN(parseFloat(b.homeOdds))) oddsArr.push(formatOdds(b.homeOdds));
          if (b.awayPick && !isNaN(parseFloat(b.awayOdds))) oddsArr.push(formatOdds(b.awayOdds));
          return {
            homeOddsN: parseFloat(b.homeOdds) || 0, awayOddsN: parseFloat(b.awayOdds) || 0,
            year: season.year, week: b.week, game: game,
            homeTeam: b.home, awayTeam: b.away,
            picker: b.picker, homePick: b.homePick, awayPick: b.awayPick,
            firstScorer: b.scorer, correct: b.correct, wasOffered: b.wasOffered,
            netUnits: b.units, netDollars: b.dollars, amount: b.amount, notOffered: b.notOffered,
            odds: oddsArr.join(' / ') || '—',
            searchText: (season.year + ' ' + b.week + ' ' + game + ' ' + (resolveTeam(b.home) || '') + ' ' + (resolveTeam(b.away) || '') + ' ' + b.picker + ' ' + b.homePick + ' ' + b.awayPick).toLowerCase()
          };
        });
      });
    }

    // All-Time totals for Maria and Danielle (not-offered games don't count)
    function calcLegacyStats(bets) {
      var t = { mCorrect: 0, mTotal: 0, dCorrect: 0, dTotal: 0, mUnits: 0, dUnits: 0, mDollars: 0, dDollars: 0 };
      bets.forEach(function(b) {
        if (!(b.correct === 'Yes' || b.correct === 'No') || b.notOffered) return;
        var k = b.picker === 'Maria' ? 'm' : b.picker === 'Danielle' ? 'd' : null;
        if (!k) return;
        t[k + 'Total']++; if (b.correct === 'Yes') t[k + 'Correct']++;
        t[k + 'Units'] += b.netUnits; t[k + 'Dollars'] += b.netDollars;
      });
      return t;
    }

    function legacyStatCard(label, mVal, dVal) {
      return '<div class="lg-tile"><div class="lg-label">' + label + '</div>' +
        '<div class="lg-row"><span class="lg-val" style="color:' + SB_M + '">' + mVal + '</span><span class="lg-who">Maria</span></div>' +
        '<div class="lg-row"><span class="lg-val" style="color:' + SB_D + '">' + dVal + '</span><span class="lg-who">Danielle</span></div>' +
        '</div>';
    }
    function secH(title, note) { return '<div class="pf-h">' + title + (note ? ' <small>' + note + '</small>' : '') + '</div>'; }


    // ── Season Wrapped (Legacy tab) ─────────────────────────────────────────

    function wrappedCard(year, bets) {
      function scoredBet(b) { return (b.correct === 'Yes' || b.correct === 'No') && !b.notOffered; }
      var P = { Maria: { u: 0, d: 0, w: 0, t: 0 }, Danielle: { u: 0, d: 0, w: 0, t: 0 } };
      var who = ['Maria', 'Danielle'];

      bets.forEach(function(b) {
        if (!P[b.picker] || !scoredBet(b)) return;
        var p = P[b.picker];
        p.u += b.netUnits; p.d += b.netDollars; p.t++;
        if (b.correct === 'Yes') p.w++;
      });
      if (P.Maria.t + P.Danielle.t === 0) return '';

      var champ = P.Maria.u > P.Danielle.u ? 'Maria' : P.Danielle.u > P.Maria.u ? 'Danielle' : null;
      var margin = Math.abs(P.Maria.u - P.Danielle.u);
      var bg = champ === 'Maria' ? 'linear-gradient(140deg,#0F0F12 0%,#3B0D0D 55%,#991B1B 100%)'
             : champ === 'Danielle' ? 'linear-gradient(140deg,#0F0F12 0%,#0C1A3D 55%,#1E40AF 100%)'
             : 'linear-gradient(140deg,#0F0F12 0%,#1F2937 100%)';
      function pc(n) { return n === 'Maria' ? SB_M : n === 'Danielle' ? SB_D : '#E5E7EB'; }
      function nm(n) { return '<span style="color:' + pc(n) + '">' + n + '</span>'; }

      // Pick of the season: longest odds that hit
      var pos = null;
      bets.forEach(function(b) {
        if (b.correct !== 'Yes' || !P[b.picker]) return;
        var o = b.firstScorer === b.homePick ? b.homeOddsN : b.firstScorer === b.awayPick ? b.awayOddsN : Math.max(b.homeOddsN, b.awayOddsN);
        if (!pos || o > pos.o) pos = { o: o, b: b };
      });

      // Best single week for one person
      var wk = {};
      bets.forEach(function(b) {
        if (!P[b.picker] || !scoredBet(b)) return;
        var k = b.picker + '|' + b.week;
        wk[k] = (wk[k] || 0) + b.netUnits;
      });
      var bestWk = null;
      Object.keys(wk).forEach(function(k) { if (!bestWk || wk[k] > bestWk.u) bestWk = { u: wk[k], who: k.split('|')[0], week: k.split('|')[1] }; });

      // Streaks
      function streak(name, want) {
        var best = 0, cur = 0;
        bets.forEach(function(b) {
          if (b.picker !== name || !scoredBet(b)) return;
          cur = (b.correct === want) ? cur + 1 : 0;
          best = Math.max(best, cur);
        });
        return best;
      }
      function streakTile(want) {
        var m = streak('Maria', want), d = streak('Danielle', want);
        var top = Math.max(m, d);
        var holder = m === d ? 'Both' : m > d ? 'Maria' : 'Danielle';
        return { n: top, who: holder };
      }
      var heater = streakTile('Yes'), drought = streakTile('No');

      // Most-picked players + cursed pick
      var picks = { Maria: {}, Danielle: {} }, all = {}, hit = {};
      bets.forEach(function(b) {
        if (!P[b.picker]) return;
        [b.homePick, b.awayPick].filter(Boolean).forEach(function(pl) {
          picks[b.picker][pl] = (picks[b.picker][pl] || 0) + 1;
          all[pl] = (all[pl] || 0) + 1;
        });
        if (b.correct === 'Yes' && b.firstScorer) hit[b.firstScorer] = true;
      });
      function top(obj) {
        var best = null;
        Object.keys(obj).forEach(function(k) { if (!best || obj[k] > best.n) best = { name: k, n: obj[k] }; });
        return best;
      }
      var favM = top(picks.Maria), favD = top(picks.Danielle);
      var cursed = null;
      Object.keys(all).forEach(function(k) {
        if (hit[k] || all[k] < 2) return;
        if (!cursed || all[k] > cursed.n) cursed = { name: k, n: all[k], by: who.filter(function(n) { return picks[n][k]; }).map(function(n) { return n + ' ' + picks[n][k] + 'x'; }) };
      });

      // Top first-TD scorer of the season (one count per game)
      var seen = {}, tds = {};
      bets.forEach(function(b) {
        if (!b.firstScorer) return;
        var gk = b.week + '_' + b.game;
        if (seen[gk]) return;
        seen[gk] = true;
        tds[b.firstScorer] = (tds[b.firstScorer] || 0) + 1;
      });
      var topTD = top(tds);

      // Weeks won (most correct that week)
      var wkC = {};
      bets.forEach(function(b) {
        if (!P[b.picker] || !scoredBet(b)) return;
        if (!wkC[b.week]) wkC[b.week] = { Maria: 0, Danielle: 0 };
        if (b.correct === 'Yes') wkC[b.week][b.picker]++;
      });
      var ww = { Maria: 0, Danielle: 0, tie: 0 };
      Object.keys(wkC).forEach(function(w) {
        var c = wkC[w];
        if (c.Maria > c.Danielle) ww.Maria++; else if (c.Danielle > c.Maria) ww.Danielle++; else ww.tie++;
      });

      // ── Build the card ──
      var glow = champ === 'Maria' ? 'rgba(239,68,68,0.55)' : champ === 'Danielle' ? 'rgba(59,130,246,0.55)' : 'rgba(255,255,255,0.25)';
      var h = '<div class="wrapped" data-share="' + year + '-wrapped" style="background:' + bg + ';--wr-glow:' + glow + '">';
      h += '<button class="share-btn" onclick="shareCard(this)" title="Share as image">Share</button>';
      h += '<button class="wr-story no-share" onclick="openStory(\'' + year + '\')">▶ Story</button>';
      h += '<div class="wr-kicker">Season Wrapped</div>';
      h += '<div class="wr-year">' + year + '</div>';
      h += '<div class="wr-champ">' + (champ
        ? '🏆 ' + nm(champ) + ' takes the season by ' + margin.toFixed(1) + ' units'
        : '🤝 Dead even. Nobody takes the crown.') + '</div>';

      h += '<div class="wr-score">';
      who.forEach(function(n) {
        var p = P[n];
        h += '<div class="wr-side">' +
          '<div class="wr-side-name" style="color:' + pc(n) + '">' + n + (champ === n ? ' 👑' : '') + '</div>' +
          '<div class="wr-units" style="color:' + pc(n) + '">' + fmtU(p.u) + '</div>' +
          '<div class="wr-sub">' + fmtD(p.d) + '</div>' +
          '<div class="wr-sub">' + p.w + '/' + p.t + ' correct (' + (p.t ? Math.round(p.w / p.t * 100) : 0) + '%)</div>' +
        '</div>';
      });
      h += '</div>';

      h += '<div class="wr-chart">' + wrappedChart(bets) + '</div>';

      function tile(label, main, sub) {
        return '<div class="wr-tile"><div class="wr-tile-label">' + label + '</div>' +
          '<div class="wr-tile-main">' + main + '</div>' + (sub ? '<div class="wr-tile-sub">' + sub + '</div>' : '') + '</div>';
      }
      h += '<div class="wr-tiles">';
      if (pos) h += tile('🎯 Pick of the Season', pos.b.firstScorer + ' ' + fmtOdds(pos.o),
        nm(pos.b.picker) + ' · ' + wkName(pos.b.week) + (pos.b.game ? ' · ' + pos.b.game : ''));
      if (bestWk && bestWk.u > 0) h += tile('📈 Best Week', nm(bestWk.who) + ' ' + fmtU(bestWk.u), weekName(bestWk.week));
      if (heater.n) h += tile('🔥 Longest Heater', heater.n + ' straight', nm(heater.who));
      if (drought.n) h += tile('🧊 Longest Drought', drought.n + ' straight misses', nm(drought.who));
      h += tile('🗓️ Weeks Won', nm('Maria') + ' ' + ww.Maria + ' · ' + nm('Danielle') + ' ' + ww.Danielle, ww.tie ? ww.tie + ' tied' : '');
      if (favM || favD) {
        var fav = function(n, f) {
          return f ? '<div class="wr-fav"><span style="color:' + pc(n) + '">' + n + '</span> · ' + f.name +
            ' <span style="opacity:0.6;font-weight:500">' + f.n + 'x</span></div>' : '';
        };
        h += '<div class="wr-tile"><div class="wr-tile-label">❤️ Ride or Die</div>' + fav('Maria', favM) + fav('Danielle', favD) + '</div>';
      }
      if (topTD) h += tile('🏈 TD Machine', topTD.name, topTD.n + ' first TD' + (topTD.n === 1 ? '' : 's'));
      if (cursed) h += tile('💀 Cursed Pick', cursed.name, cursed.by.map(function(s) { var n = s.split(' ')[0]; return nm(n) + s.slice(n.length); }).join(' · ') + ', never cashed');
      h += '<div class="wr-more" data-wr-year="' + year + '"></div>'; // luck, boldness, team of the year… (insights.js)
      h += '</div></div>';
      return h;
    }

    // Season race: running units for both, drawn for the dark card
    function wrappedChart(bets) {
      var games = [], idx = {};
      bets.forEach(function(b) {
        if ((b.picker !== 'Maria' && b.picker !== 'Danielle') || (b.correct !== 'Yes' && b.correct !== 'No')) return;
        var k = b.week + '_' + b.game;
        if (!(k in idx)) { idx[k] = games.length; games.push({ week: b.week, Maria: 0, Danielle: 0 }); }
        games[idx[k]][b.picker] += b.netUnits;
      });
      if (games.length < 2) return '';
      var m = [0], d = [0];
      games.forEach(function(g) { m.push(m[m.length - 1] + g.Maria); d.push(d[d.length - 1] + g.Danielle); });
      var W = 600, H = 150, L = 8, R = 52, T = 10, B = 18;
      var lo = Math.min.apply(null, m.concat(d, [0])), hi = Math.max.apply(null, m.concat(d, [0]));
      if (hi === lo) hi = lo + 1;
      function x(i) { return L + i * (W - L - R) / games.length; }
      function y(v) { return T + (hi - v) / (hi - lo) * (H - T - B); }
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block" font-family="Inter,sans-serif">';
      svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="rgba(255,255,255,0.25)" stroke-dasharray="4 3"/>';
      // first game of each week, label every few
      var lastWk = null, n = 0;
      games.forEach(function(g, i) {
        if (g.week === lastWk) return;
        lastWk = g.week;
        if (n++ % 3) return;
        svg += '<text x="' + x(i + 1) + '" y="' + (H - 4) + '" font-size="10" fill="rgba(255,255,255,0.45)" text-anchor="middle">' + wkShort(g.week) + '</text>';
      });
      function line(vals, color) {
        var pts = vals.map(function(v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
        return '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
      }
      svg += line(d, SB_D) + line(m, SB_M);
      var N = games.length, ym = y(m[N]), yd = y(d[N]);
      if (Math.abs(ym - yd) < 14) { var mid = (ym + yd) / 2, up = m[N] >= d[N]; ym = mid + (up ? -7 : 7); yd = mid + (up ? 7 : -7); }
      function f(v) { return (v >= 0 ? '+' : '') + v.toFixed(1); }
      svg += '<text x="' + (x(N) + 8) + '" y="' + (ym + 4) + '" font-size="13" font-weight="700" fill="' + SB_M + '">' + f(m[N]) + '</text>';
      svg += '<text x="' + (x(N) + 8) + '" y="' + (yd + 4) + '" font-size="13" font-weight="700" fill="' + SB_D + '">' + f(d[N]) + '</text>';
      return svg + '</svg>';
    }

    function loadLegacyTab() {
      if (ALL_LEGACY_BETS.length > 0) return; // already loaded
      Promise.all(SEASONS.map(fetchLegacySeason)).then(function(results) {
        var allBets = [];
        var byYear = [];
        results.forEach(function(bets, i) {
          allBets = allBets.concat(bets);
          byYear.push({ year: SEASONS[i].year, bets: bets });
        });
        ALL_LEGACY_BETS = allBets.slice().reverse();

        var s = calcLegacyStats(allBets);
        var legacyYears = byYear.filter(function(ys) { return ys.year !== CURRENT_YEAR; });

        var winner = s.mUnits > s.dUnits ? 'Maria leads all-time' : s.dUnits > s.mUnits ? 'Danielle leads all-time' : 'All-time tied';

        var html = '<div style="font-size:13px;color:#A1A9B6;margin-bottom:24px">' + winner + ' · ' + SEASONS.length + ' seasons of data</div>';

        // Big screens: totals + earnings on the left, Record Book on the right (no effect elsewhere)
        html += '<div class="wide-cols"><div class="wide-col">';
        // All-time stats
        html += secH('📊 All-Time Totals');
        html += '<div class="lg-grid">';
        html += legacyStatCard('Units', fmtU(s.mUnits), fmtU(s.dUnits));
        html += legacyStatCard('Dollars', fmtDResp(s.mDollars), fmtDResp(s.dDollars));
        html += legacyStatCard('Correct', s.mCorrect+'/'+s.mTotal, s.dCorrect+'/'+s.dTotal);
        html += legacyStatCard('Accuracy', (s.mTotal?Math.round(s.mCorrect/s.mTotal*100):0)+'%', (s.dTotal?Math.round(s.dCorrect/s.dTotal*100):0)+'%');
        html += '</div>';

        // Earnings by season (both of them together). This used to be its own tab.
        html += secH('📅 By Season', 'hit rates, odds and earnings') + '<div id="legacy-earn"><div class="loading">Loading…</div></div>';

        html += '</div><div class="wide-col">';
        // Record Book (insights.js): every all-time record and who holds it
        html += secH('📖 Record Book', 'ties go to whoever did it first') + '<div id="legacy-records"><div class="loading">Loading…</div></div>';
        html += '</div></div>';

        // All-time race: running units across every season
        var race = allTimeRaceChart(byYear.slice().reverse().reduce(function(a, ys) { return a.concat(ys.bets); }, []));
        if (race) html += secH('🏁 The All-Time Race') + '<div class="ch-box" style="margin-bottom:28px">' + race + '</div>';
        // 🔮 The Chalk Team (js/chalk.js) and ⏪ Replay (js/replay.js), filled in once their files load
        html += '<div id="chalk-slot" class="lazy-slot"></div><div id="replay-slot" class="lazy-slot"></div>';

        // Previous seasons: one Season Wrapped card each, newest first
        if (legacyYears.length > 0) {
          html += secH('🎁 Season Wrapped') + '<div class="wr-list">';
          legacyYears.forEach(function(ys) {
            html += wrappedCard(ys.year, ys.bets);
            if (parseInt(ys.year, 10) >= 2026) html += '<div class="crowd-wr-slot" data-year="' + ys.year + '"></div>'; // the Crowd started in 2026
          });
          html += '</div>';
        }
        html += '<div style="font-size:12px;color:#9CA3AF;text-align:center;margin:-8px 0 20px">' + CURRENT_YEAR + ' Wrapped unlocks when the season is over.</div>';

        document.getElementById('legacy-content').innerHTML = html;
        fillCrowdWrapped();
        if (typeof fillWrappedExtras === 'function') fillWrappedExtras();
        loadEarnings(byYear);
        loadScriptOnce('js/chalk.js').then(function() { renderChalkCard(document.getElementById('chalk-slot')); }).catch(function() {});
        loadScriptOnce('js/replay.js').then(function() { renderReplayCard(document.getElementById('replay-slot')); }).catch(function() {});
        loadAllBets().then(function(all) { var el = document.getElementById('legacy-records'); if (el) el.innerHTML = recordBookHtml(all) || '<div class="loading">No records yet.</div>'; });
      }).catch(function(e) {
        console.error(e);
        document.getElementById('legacy-content').innerHTML = '<div style="color:#9CA3AF;text-align:center;padding:32px">Error loading legacy data: ' + e.message + '</div>';
      });
    }


    // ── Crowd Wrapped: one card per finished season, 2026 and later ─────────
    function fillCrowdWrapped() {
      document.querySelectorAll('.crowd-wr-slot').forEach(function(slot) {
        var year = slot.getAttribute('data-year');
        var season = SEASONS.filter(function(s) { return String(s.year) === String(year); })[0];
        if (!season || !PICKS_URL) return;
        var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + season.sheetId + '/values/' + encodeURIComponent(season.tab + '!A1:Q400') + '?key=' + API_KEY;
        Promise.all([picksApi({ action: 'crowd', season: year }), fetch(url).then(function(r) { return r.json(); })]).then(function(res) {
          slot.outerHTML = crowdWrappedCard(year, res[0], crowdGames(res[1].values || []));
        }).catch(function() { slot.remove(); });
      });
    }
    function crowdWrappedCard(year, crowd, G) {
      if (!crowd || !crowd.picks || !crowd.picks.length) return '';
      var styles = crowd.styles || {};
      function col(n) { return (styles[n] && styles[n].color) || FRIEND_COLOR; }
      function nm(n) { var e = styles[n] && styles[n].emoji; return '<span style="color:' + col(n) + ';font-weight:800">' + (e ? e + ' ' : '') + escHtml(n) + '</span>'; }
      var R = rankFriends(crowd, G);
      var all = R.stats.filter(function(s) { return s.n > 0; });
      if (!all.length) return '';
      var board = R.ranked.length ? R.ranked : all.slice().sort(function(a, b) { return b.pct - a.pct || b.n - a.n; });
      var champ = board[0];
      var m = mdStats('Maria', G), d = mdStats('Danielle', G);
      function top(fn) { return all.slice().sort(function(a, b) { return fn(b) - fn(a); })[0]; }
      var heat = top(function(s) { return s.heater.n; });
      var wolf = top(function(s) { return s.lone.length; });
      var beatM = top(function(s) { return s.h2h.Maria.me; });
      var beatD = top(function(s) { return s.h2h.Danielle.me; });
      var bestWk = null;
      all.forEach(function(s) { Object.keys(s.weeks).forEach(function(w) { if (!bestWk || s.weeks[w].w > bestWk.n) bestWk = { n: s.weeks[w].w, who: s.name, week: w }; }); });
      var pc = {};
      crowd.picks.forEach(function(p) { [p.homePick, p.awayPick].filter(Boolean).forEach(function(x) { pc[x] = (pc[x] || 0) + 1; }); });
      var favP = Object.keys(pc).sort(function(a, b) { return pc[b] - pc[a]; })[0];
      var beatBoth = all.filter(function(s) { return s.n >= CROWD_MIN && s.pct > m.pct && s.pct > d.pct; }).length;

      var cc = col(champ.name);
      var h = '<div class="wrapped" data-share="' + year + '-crowd-wrapped" style="background:linear-gradient(140deg,#0F0F12 0%,#0B2E2B 55%,#0F766E 100%);--wr-glow:' + hexA(cc, 0.55) + '">';
      h += '<button class="share-btn" onclick="shareCard(this)" title="Share as image">Share</button>';
      h += '<div class="wr-kicker">Crowd Wrapped</div><div class="wr-year">' + year + '</div>';
      h += '<div class="wr-champ">👑 ' + nm(champ.name) + ' wins the Crowd at ' + pctTxt(champ.pct) + ' (' + champ.w + '–' + (champ.n - champ.w) + ')</div>';
      h += '<div class="wr-chart" style="padding:10px 14px">' + board.slice(0, 5).map(function(s, i) {
        return '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:14px' + (i ? ';border-top:1px solid rgba(255,255,255,0.08)' : '') + '"><span>' + (i === 0 ? '👑' : i + 1) + '&nbsp; ' + nm(s.name) + '</span><span style="opacity:0.85">' + s.w + '–' + (s.n - s.w) + ' · <b>' + pctTxt(s.pct) + '</b></span></div>';
      }).join('') +
        '<div style="display:flex;justify-content:space-between;padding:6px 0 2px;font-size:12px;opacity:0.7;border-top:1px dashed rgba(255,255,255,0.15)"><span>For reference: <span style="color:' + SB_M + '">Maria ' + pctTxt(m.pct) + '</span> · <span style="color:' + SB_D + '">Danielle ' + pctTxt(d.pct) + '</span></span><span>' + all.length + ' friends played</span></div></div>';
      function tile(label, main, sub) {
        return '<div class="wr-tile"><div class="wr-tile-label">' + label + '</div><div class="wr-tile-main">' + main + '</div>' + (sub ? '<div class="wr-tile-sub">' + sub + '</div>' : '') + '</div>';
      }
      h += '<div class="wr-tiles">';
      if (heat && heat.heater.n) h += tile('🔥 Longest Heater', heat.heater.n + ' straight', nm(heat.name));
      if (bestWk && bestWk.n) h += tile('📈 Best Week', bestWk.n + ' hits', nm(bestWk.who) + ' · ' + weekName(bestWk.week));
      if (wolf && wolf.lone.length) h += tile('🐺 Lone Wolf', wolf.lone.length + ' solo hit' + (wolf.lone.length > 1 ? 's' : ''), nm(wolf.name));
      if (beatM && beatM.h2h.Maria.me) h += tile('⚔️ Maria\'s Rival', nm(beatM.name), 'beat her ' + beatM.h2h.Maria.me + ' time' + (beatM.h2h.Maria.me > 1 ? 's' : ''));
      if (beatD && beatD.h2h.Danielle.me) h += tile('⚔️ Danielle\'s Rival', nm(beatD.name), 'beat her ' + beatD.h2h.Danielle.me + ' time' + (beatD.h2h.Danielle.me > 1 ? 's' : ''));
      if (favP) h += tile('❤️ Crowd Favorite', escHtml(favP), 'picked ' + pc[favP] + ' times');
      h += tile('🏆 Beat Both', beatBoth + ' friend' + (beatBoth === 1 ? '' : 's'), 'better win % than Maria and Danielle');
      h += '</div></div>';
      return h;
    }

    // ── Earnings by season (inside All-Time) ─────────────────────────────────
    function loadEarnings(byYear) {
      var box = document.getElementById('legacy-earn');
      if (!box) return;
      var results = byYear.map(function(ys) {
        var scored = ys.bets.filter(function(b) { return b.correct === 'Yes' || b.correct === 'No'; });
        var noRows = ys.bets.filter(function(b) { return b.notOffered; });
        var units = scored.reduce(function(a, b) { return a + b.netUnits; }, 0);
        var dollars = scored.reduce(function(a, b) { return a + b.netDollars; }, 0);
        // Hit rate per person (games that counted) and the average odds of everything picked
        var counted = scored.filter(function(b) { return !b.notOffered; });
        function rate(who) { var m = counted.filter(function(b) { return b.picker === who; }); return m.length ? Math.round(m.filter(function(b) { return b.correct === 'Yes'; }).length / m.length * 100) : null; }
        var odds = []; ys.bets.forEach(function(b) { [b.homePick ? b.homeOddsN : 0, b.awayPick ? b.awayOddsN : 0].forEach(function(o) { var n = oddsN(o); if (n > 0) odds.push(n * 100); }); });
        return {
          year: ys.year, rateM: rate('Maria'), rateD: rate('Danielle'), avgOdds: odds.length ? Math.round(odds.reduce(function(a, x) { return a + x; }, 0) / odds.length) : 0,
          hitsM: counted.filter(function(b) { return b.picker === 'Maria' && b.correct === 'Yes'; }).length, nM: counted.filter(function(b) { return b.picker === 'Maria'; }).length,
          hitsD: counted.filter(function(b) { return b.picker === 'Danielle' && b.correct === 'Yes'; }).length, nD: counted.filter(function(b) { return b.picker === 'Danielle'; }).length,
          bets: scored.length + noRows.length, notOffered: noRows.length, units: units, dollars: dollars,
          // Worst case: not offered games count as -2u and -2 x the amount bet
          unitsWorst: units - 2 * noRows.length,
          dollarsWorst: dollars - noRows.reduce(function(a, b) { return a + 2 * (b.amount || 5); }, 0),
        };
      });
        const totalBets = results.reduce(function(a, r) { return a + r.bets; }, 0);
        const totalUnits = results.reduce(function(a, r) { return a + r.units; }, 0);
        const totalDollars = results.reduce(function(a, r) { return a + r.dollars; }, 0);

        function uColor(n) { return n > 0 ? "#34D399" : n < 0 ? "#F87171" : "#9CA3AF"; }

        function row(label, r, isTotal) {
          function cell(n, w, fmt) {
            return '<div class="er-c"><div style="color:' + uColor(n) + ';font-weight:700">' + fmt(n) + '</div>' +
              (w !== n ? '<div class="er-w" style="color:' + uColor(w) + '">' + fmt(w) + '</div>' : '') + '</div>';
          }
          return '<div class="er-row' + (isTotal ? ' er-total' : '') + '">' +
            '<div class="er-c er-y">' + label + '</div>' +
            '<div class="er-c"><div style="font-weight:700">' + r.bets + '</div>' + (r.notOffered ? '<div class="er-w">' + r.notOffered + ' not<br class="tn-short"> offered</div>' : '') + '</div>' +
            '<div class="er-c er-rate"><div style="color:' + SB_M + '">' + (r.rateM == null ? '—' : r.rateM + '%') + '</div><div style="color:' + SB_D + '">' + (r.rateD == null ? '—' : r.rateD + '%') + '</div>' +
              (r.avgOdds ? '<div class="er-w">avg +' + r.avgOdds + '</div>' : '') + '</div>' +
            cell(r.units, r.unitsWorst, fmtUResp) + cell(r.dollars, r.dollarsWorst, fmtDResp) + '</div>';
        }

        var html = '<div class="er-table"><div class="er-row er-head"><div class="er-c er-y">Season</div><div class="er-c">Bets</div><div class="er-c">Hit rate</div><div class="er-c">Units</div><div class="er-c">Money</div></div>';
        results.slice().sort(function(a, b) { return b.year - a.year; }).forEach(function(r) { html += row(r.year, r, false); });
        function sum(k) { return results.reduce(function(a, r) { return a + r[k]; }, 0); }
        html += row('Total', {
          rateM: sum('nM') ? Math.round(sum('hitsM') / sum('nM') * 100) : null, rateD: sum('nD') ? Math.round(sum('hitsD') / sum('nD') * 100) : null,
          avgOdds: 0,
          bets: totalBets, units: totalUnits, dollars: totalDollars,
          unitsWorst: results.reduce(function(a,r){return a+r.unitsWorst;},0),
          dollarsWorst: results.reduce(function(a,r){return a+r.dollarsWorst;},0),
          notOffered: results.reduce(function(a,r){return a+r.notOffered;},0)
        }, true);
        html += '</div><div class="er-note">Hit rate is <span style="color:' + SB_M + '">Maria</span> then <span style="color:' + SB_D + '">Danielle</span>, with the average odds of everything picked under it. Units and money are both of them combined: big numbers skip games where the first TD scorer wasn\'t offered, and the smaller numbers under them count those games as losses (worst case).</div>';
        box.innerHTML = html;
    }
