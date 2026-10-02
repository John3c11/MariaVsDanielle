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
      renderBHHistory(filtered);
    }

    function renderBHHistory(bets) {
      var el = document.getElementById('bh-history-table');
      var countEl = document.getElementById('bh-hist-count');
      if (countEl) countEl.textContent = bets.length + ' bet' + (bets.length !== 1 ? 's' : '');
      if (!el) return;
      var header = '<div class="bh-head" style="display:grid;grid-template-columns:44px 40px 1fr 80px 1fr 70px 110px 50px;gap:8px;padding-bottom:8px;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:10px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em">' +
        '<span>Year</span><span>Wk</span><span>Game</span><span>Picker</span><span>Players</span><span>Odds</span><span>First TD</span><span>Units</span></div>';
      var rows = bets.map(function(b) {
        // First TD scorer: green = hit, red = miss, gray = not offered (didn't count)
        var noOffer = b.wasOffered === 'No' && b.netUnits === 0 && b.firstScorer;
        var resultBg = noOffer ? 'rgba(255,255,255,0.08)' : b.correct === 'Yes' ? 'rgba(52,211,153,0.15)' : b.correct === 'No' ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.08)';
        var resultColor = noOffer ? '#9CA3AF' : b.correct === 'Yes' ? '#34D399' : b.correct === 'No' ? '#F87171' : '#9CA3AF';
        var resultText = b.firstScorer ? escHtml(b.firstScorer) : '⏳';
        var pickerColor = b.picker === 'Maria' ? '#F87171' : '#60A5FA';
        var unitColor = b.netUnits > 0 ? '#34D399' : b.netUnits < 0 ? '#F87171' : '#9CA3AF';
        var unitStr = b.netUnits !== 0 ? (b.netUnits > 0 ? '+' : '') + b.netUnits + 'u' : '0u';
        var notOffered = '';
        var homeColored = b.homePick ? legacyColoredText(b.homePick, b.homeTeam) : '';
        var awayColored = b.awayPick ? legacyColoredText(b.awayPick, b.awayTeam) : '';
        var players = [homeColored, awayColored].filter(Boolean).join('<span style="color:#9CA3AF"> / </span>') || '—';
        var gameDisplay = b.homeTeam && b.awayTeam ? legacyColoredGame(b.homeTeam, b.awayTeam) : (b.game || '—');
        return '<div class="bh-row" style="display:grid;grid-template-columns:44px 40px 1fr 80px 1fr 70px 110px 50px;gap:8px;padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:12px;align-items:start">' +
          '<span style="font-size:11px;font-weight:600;color:' + (b.year === CURRENT_YEAR ? '#60A5FA' : '#34D399') + '">' + b.year + '</span>' +
          '<span style="color:#9CA3AF;text-align:center">' + b.week + '</span>' +
          '<span style="font-weight:500">' + gameDisplay + '</span>' +
          '<span style="font-weight:500;color:' + pickerColor + '">' + b.picker + '</span>' +
          '<span>' + players + notOffered + '</span>' +
          '<span style="color:#A1A9B6">' + b.odds + '</span>' +
          '<span class="bh-ftd" title="' + (noOffer ? 'Not offered, bet did not count' : '') + '" style="font-size:11px;font-weight:600;padding:3px 7px;border-radius:5px;text-align:center;line-height:1.3;background:' + resultBg + ';color:' + resultColor + '">' + resultText + '</span>' +
          '<span style="text-align:right;font-weight:500;color:' + unitColor + '">' + unitStr + '</span>' +
          '</div>';
      }).join('');
      el.innerHTML = bets.length === 0 ? '<div style="color:#9CA3AF;text-align:center;padding:32px">No results.</div>' : header + rows;
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
        var rows = (data.values || []).slice(1).filter(function(r) {
          return r[0] && r[3] && r[3].trim() && r[3].trim() !== 'John';
        });
        // Filter out rows where both picks are empty
        rows = rows.filter(function(r) {
          return (r[6] || '').trim() || (r[7] || '').trim();
        });
        return rows.map(function(r) {
          var picker = (r[3] || '').trim();
          var homeTeam = r[4] || '';
          var awayTeam = r[5] || '';
          var homePick = (r[6] || '').trim();
          var awayPick = (r[7] || '').trim();
          var homeOdds = r[8] || '';
          var awayOdds = r[9] || '';
          var firstScorer = (r[11] || '').trim();
          var correct = (r[12] || '').trim();
          var wasOffered = (r[14] || '').trim();
          var netUnits = parseFloat(r[15]) || 0;
          var netDollars = parseFloat(r[16]) || 0;
          var week = r[1] || '';
          var game = homeTeam && awayTeam ? homeTeam + ' vs ' + awayTeam : '';
          var oddsArr = [];
          if (homePick && !isNaN(parseFloat(homeOdds))) oddsArr.push('+' + Math.round(parseFloat(homeOdds) * 100));
          if (awayPick && !isNaN(parseFloat(awayOdds))) oddsArr.push('+' + Math.round(parseFloat(awayOdds) * 100));
          return {
            homeOddsN: parseFloat(homeOdds) || 0, awayOddsN: parseFloat(awayOdds) || 0,
            year: season.year, week: week, game: game,
            homeTeam: homeTeam, awayTeam: awayTeam,
            picker: picker, homePick: homePick, awayPick: awayPick,
            firstScorer: firstScorer, correct: correct, wasOffered: wasOffered,
            netUnits: netUnits, netDollars: netDollars,
            odds: oddsArr.join(' / ') || '—',
            searchText: (season.year + ' ' + week + ' ' + game + ' ' + (resolveTeam(homeTeam) || '') + ' ' + (resolveTeam(awayTeam) || '') + ' ' + picker + ' ' + homePick + ' ' + awayPick).toLowerCase()
          };
        });
      });
    }

    function calcLegacyStats(bets) {
      var mCorrect = 0, mTotal = 0, dCorrect = 0, dTotal = 0;
      var mUnits = 0, dUnits = 0, mDollars = 0, dDollars = 0;
      var mBigWin = null, dBigWin = null;
      var pickCounts = {}, scorerCounts = {}, seenGames = {};

      bets.forEach(function(b) {
        var gameKey = b.year + '_' + b.week + '_' + b.game;
        if (b.firstScorer && !seenGames[gameKey]) {
          seenGames[gameKey] = true;
          scorerCounts[b.firstScorer] = (scorerCounts[b.firstScorer] || 0) + 1;
        }
        [b.homePick, b.awayPick].filter(Boolean).forEach(function(p) {
          if (!pickCounts[p]) pickCounts[p] = { Maria: 0, Danielle: 0 };
          if (b.picker === 'Maria' || b.picker === 'Danielle') pickCounts[p][b.picker]++;
        });
        var notOffered = b.wasOffered === 'No' && b.netUnits === 0 && b.firstScorer !== '';
        var gameScored = (b.correct === 'Yes' || b.correct === 'No') && !notOffered;
        if (b.picker === 'Maria' && gameScored) {
          mTotal++; if (b.correct === 'Yes') mCorrect++;
          mUnits += b.netUnits; mDollars += b.netDollars;
          if (b.netUnits > 0 && (mBigWin === null || b.netUnits > mBigWin.units))
            mBigWin = { units: b.netUnits, dollars: b.netDollars, game: b.game, year: b.year, week: b.week };
        } else if (b.picker === 'Danielle' && gameScored) {
          dTotal++; if (b.correct === 'Yes') dCorrect++;
          dUnits += b.netUnits; dDollars += b.netDollars;
          if (b.netUnits > 0 && (dBigWin === null || b.netUnits > dBigWin.units))
            dBigWin = { units: b.netUnits, dollars: b.netDollars, game: b.game, year: b.year, week: b.week };
        }
      });

      var allPlayers = Object.keys(pickCounts).map(function(name) {
        return { name: name, total: pickCounts[name].Maria + pickCounts[name].Danielle, maria: pickCounts[name].Maria, danielle: pickCounts[name].Danielle };
      }).filter(function(p) { return p.total > 0; }).sort(function(a, b) { return b.total - a.total; });

      function bestStreak(pickerBets) {
        var best = { wins: 0, total: 0, units: 0, dollars: -Infinity, label: '' };
        for (var i = 0; i < pickerBets.length; i++) {
          for (var j = i + 1; j <= Math.min(i + 10, pickerBets.length); j++) {
            var window = pickerBets.slice(i, j);
            var w = window.filter(function(b) { return b.correct === 'Yes'; }).length;
            var t = window.length;
            var u = window.reduce(function(acc, b) { return acc + b.netUnits; }, 0);
            var d = window.reduce(function(acc, b) { return acc + b.netDollars; }, 0);
            if (d > best.dollars) {
              best = { wins: w, total: t, units: u, dollars: d, label: '$' + d.toFixed(2) + ' (+' + u.toFixed(1) + 'u) — ' + w + '/' + t + ' correct' };
            }
          }
        }
        if (best.dollars <= 0) best.label = 'No profitable stretch yet';
        return best;
      }

      var mariaBets = bets.filter(function(b) { return b.picker === 'Maria' && (b.correct === 'Yes' || b.correct === 'No'); });
      var danielleBets = bets.filter(function(b) { return b.picker === 'Danielle' && (b.correct === 'Yes' || b.correct === 'No'); });

      return {
        mCorrect: mCorrect, mTotal: mTotal, dCorrect: dCorrect, dTotal: dTotal,
        mUnits: mUnits, dUnits: dUnits, mDollars: mDollars, dDollars: dDollars,
        mBigWin: mBigWin, dBigWin: dBigWin,
        mStreak: bestStreak(mariaBets), dStreak: bestStreak(danielleBets),
        mostOverall: allPlayers[0],
        mariaMost: allPlayers.filter(function(p) { return p.maria > 0; }).sort(function(a, b) { return b.maria - a.maria; })[0],
        danielleMost: allPlayers.filter(function(p) { return p.danielle > 0; }).sort(function(a, b) { return b.danielle - a.danielle; })[0],
        scorerCounts: scorerCounts,
      };
    }

    function fmtL(n, prefix) {
      if (prefix === 'u') return (n >= 0 ? '+' : '') + n.toFixed(1) + 'u';
      if (prefix === '$') return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2);
      return n;
    }

    function legacyStatCard(label, mVal, dVal) {
      return '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:14px 16px">' +
        '<div style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">' + label + '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px"><span style="font-size:20px;font-weight:700;color:#F87171">' + mVal + '</span><span style="font-size:11px;color:#9CA3AF">Maria</span></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:20px;font-weight:700;color:#60A5FA">' + dVal + '</span><span style="font-size:11px;color:#9CA3AF">Danielle</span></div>' +
        '</div>';
    }


    // ── Season Wrapped (Legacy tab) ─────────────────────────────────────────
    var WR_M = '#F87171', WR_D = '#60A5FA'; // Maria / Danielle on dark backgrounds

    function wrappedCard(year, bets) {
      function notOffered(b) { return b.wasOffered === 'No' && b.netUnits === 0 && b.firstScorer !== ''; }
      function scoredBet(b) { return (b.correct === 'Yes' || b.correct === 'No') && !notOffered(b); }
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
      function pc(n) { return n === 'Maria' ? WR_M : n === 'Danielle' ? WR_D : '#E5E7EB'; }
      function nm(n) { return '<span style="color:' + pc(n) + '">' + n + '</span>'; }
      function u(n) { return (n >= 0 ? '+' : '') + n.toFixed(1) + 'u'; }
      function money(n) { return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2); }
      function odds(n) { return '+' + Math.round(n < 100 ? n * 100 : n); }

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
        if (!cursed || all[k] > cursed.n) cursed = { name: k, n: all[k] };
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
          '<div class="wr-units" style="color:' + pc(n) + '">' + u(p.u) + '</div>' +
          '<div class="wr-sub">' + money(p.d) + '</div>' +
          '<div class="wr-sub">' + p.w + '/' + p.t + ' correct (' + (p.t ? Math.round(p.w / p.t * 100) : 0) + '%)</div>' +
        '</div>';
      });
      h += '</div>';

      h += '<div class="wr-chart">' + wrappedChart(bets, notOffered) + '</div>';

      function tile(label, main, sub) {
        return '<div class="wr-tile"><div class="wr-tile-label">' + label + '</div>' +
          '<div class="wr-tile-main">' + main + '</div>' + (sub ? '<div class="wr-tile-sub">' + sub + '</div>' : '') + '</div>';
      }
      h += '<div class="wr-tiles">';
      if (pos) h += tile('🎯 Pick of the Season', pos.b.firstScorer + ' ' + odds(pos.o),
        nm(pos.b.picker) + ' · Wk ' + pos.b.week + (pos.b.game ? ' · ' + pos.b.game : ''));
      if (bestWk && bestWk.u > 0) h += tile('📈 Best Week', nm(bestWk.who) + ' ' + u(bestWk.u), 'Week ' + bestWk.week);
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
      if (cursed) h += tile('💀 Cursed Pick', cursed.name, 'Picked ' + cursed.n + 'x, never cashed');
      h += '</div></div>';
      return h;
    }

    // Season race: running units for both, drawn for the dark card
    function wrappedChart(bets, notOffered) {
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
        svg += '<text x="' + x(i + 1) + '" y="' + (H - 4) + '" font-size="10" fill="rgba(255,255,255,0.45)" text-anchor="middle">Wk ' + g.week + '</text>';
      });
      function line(vals, color) {
        var pts = vals.map(function(v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
        return '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
      }
      svg += line(d, WR_D) + line(m, WR_M);
      var N = games.length, ym = y(m[N]), yd = y(d[N]);
      if (Math.abs(ym - yd) < 14) { var mid = (ym + yd) / 2, up = m[N] >= d[N]; ym = mid + (up ? -7 : 7); yd = mid + (up ? 7 : -7); }
      function f(v) { return (v >= 0 ? '+' : '') + v.toFixed(1); }
      svg += '<text x="' + (x(N) + 8) + '" y="' + (ym + 4) + '" font-size="13" font-weight="700" fill="' + WR_M + '">' + f(m[N]) + '</text>';
      svg += '<text x="' + (x(N) + 8) + '" y="' + (yd + 4) + '" font-size="13" font-weight="700" fill="' + WR_D + '">' + f(d[N]) + '</text>';
      return svg + '</svg>';
    }

    function loadLegacyTab() {
      if (ALL_LEGACY_BETS.length > 0) return; // already loaded
      Promise.all(SEASONS.map(fetchLegacySeason)).then(function(results) {
        var allBets = [];
        var byYear = [];
        results.forEach(function(bets, i) {
          allBets = allBets.concat(bets);
          byYear.push({ year: SEASONS[i].year, stats: calcLegacyStats(bets), bets: bets });
        });
        ALL_LEGACY_BETS = allBets.slice().reverse();

        var s = calcLegacyStats(allBets);
        var legacyYears = byYear.filter(function(ys) { return ys.year !== CURRENT_YEAR; });

        var winner = s.mUnits > s.dUnits ? 'Maria leads all-time' : s.dUnits > s.mUnits ? 'Danielle leads all-time' : 'All-time tied';

        var html = '<div style="font-size:13px;color:#A1A9B6;margin-bottom:24px">' + winner + ' · ' + SEASONS.length + ' seasons of data</div>';

        // All-time stats
        html += '<div style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">All-Time Totals</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:28px">';
        html += legacyStatCard('Units', fmtL(s.mUnits,'u'), fmtL(s.dUnits,'u'));
        html += legacyStatCard('Dollars', fmtL(s.mDollars,'$'), fmtL(s.dDollars,'$'));
        html += legacyStatCard('Correct', s.mCorrect+'/'+s.mTotal, s.dCorrect+'/'+s.dTotal);
        html += legacyStatCard('Accuracy', (s.mTotal?Math.round(s.mCorrect/s.mTotal*100):0)+'%', (s.dTotal?Math.round(s.dCorrect/s.dTotal*100):0)+'%');
        html += '</div>';

        // Previous seasons: one Season Wrapped card each, newest first
        if (legacyYears.length > 0) {
          html += '<div style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">Season Wrapped</div>';
          legacyYears.forEach(function(ys) {
            html += wrappedCard(ys.year, ys.bets);
            if (parseInt(ys.year, 10) >= 2026) html += '<div class="crowd-wr-slot" data-year="' + ys.year + '"></div>'; // the Crowd started in 2026
          });
        }
        html += '<div style="font-size:12px;color:#9CA3AF;text-align:center;margin:-8px 0 20px">' + CURRENT_YEAR + ' Wrapped unlocks when the season is over.</div>';

        html += '<div>';


                html += '</div>';

        document.getElementById('legacy-content').innerHTML = html;
        fillCrowdWrapped();
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
      if (bestWk && bestWk.n) h += tile('📈 Best Week', bestWk.n + ' hits', nm(bestWk.who) + ' · Week ' + bestWk.week);
      if (wolf && wolf.lone.length) h += tile('🐺 Lone Wolf', wolf.lone.length + ' solo hit' + (wolf.lone.length > 1 ? 's' : ''), nm(wolf.name));
      if (beatM && beatM.h2h.Maria.me) h += tile('⚔️ Maria\'s Rival', nm(beatM.name), 'beat her ' + beatM.h2h.Maria.me + ' time' + (beatM.h2h.Maria.me > 1 ? 's' : ''));
      if (beatD && beatD.h2h.Danielle.me) h += tile('⚔️ Danielle\'s Rival', nm(beatD.name), 'beat her ' + beatD.h2h.Danielle.me + ' time' + (beatD.h2h.Danielle.me > 1 ? 's' : ''));
      if (favP) h += tile('❤️ Crowd Favorite', escHtml(favP), 'picked ' + pc[favP] + ' times');
      h += tile('🏆 Beat Both', beatBoth + ' friend' + (beatBoth === 1 ? '' : 's'), 'better win % than Maria and Danielle');
      h += '</div></div>';
      return h;
    }

    var MONEY_LOADED = false;
    async function loadMoneyTab() {
      if (MONEY_LOADED) return;
      MONEY_LOADED = true;
      try {
        const SEASONS_MONEY = SEASONS;

        const results = await Promise.all(SEASONS_MONEY.map(async function(s) {
          const url = "https://sheets.googleapis.com/v4/spreadsheets/" + s.sheetId +
            "/values/" + encodeURIComponent("Winnings!A1:Q400") + "?key=" + API_KEY;
          const res = await fetch(url);
          const data = await res.json();
          const rows = (data.values || []).slice(1).filter(function(r) {
            return r[0] && r[3] && r[3].trim() && r[3].trim() !== "John";
          });
          // All rows with at least one pick
          const withPicks = rows.filter(function(r) {
            const homePick = (r[6] || "").trim();
            const awayPick = (r[7] || "").trim();
            return homePick || awayPick;
          });
          // Scored games only (correct = Yes or No)
          const scored = withPicks.filter(function(r) {
            const correct = (r[12] || "").trim();
            return correct === "Yes" || correct === "No";
          });
          // Not offered games: wasOffered = No AND net units = 0 (losses have -2)
          const notOfferedRows = withPicks.filter(function(r) {
            const wasOffered = (r[14] || "").trim();
            const netU = parseFloat(r[15]) || 0;
            const firstScorer = (r[11] || "").trim();
            return wasOffered === "No" && firstScorer !== "" && netU === 0;
          });

          const bets = scored.length + notOfferedRows.length;
          const notOffered = notOfferedRows.length;
          const units = scored.reduce(function(acc, r) { return acc + (parseFloat(r[15]) || 0); }, 0);
          const dollars = scored.reduce(function(acc, r) { return acc + (parseFloat(r[16]) || 0); }, 0);

          // Worst case: not offered games count as -2u and -2 * amount bet
          const unitsWorst = units + notOfferedRows.reduce(function(acc, r) { return acc - 2; }, 0);
          const dollarsWorst = dollars + notOfferedRows.reduce(function(acc, r) {
            const amountBet = parseFloat(r[10]) || 5;
            return acc - (2 * amountBet);
          }, 0);

          return { year: s.year, bets, notOffered, units, dollars, unitsWorst, dollarsWorst };
        }));

        const totalBets = results.reduce(function(a, r) { return a + r.bets; }, 0);
        const totalUnits = results.reduce(function(a, r) { return a + r.units; }, 0);
        const totalDollars = results.reduce(function(a, r) { return a + r.dollars; }, 0);

        function fmtU(n) { return (n >= 0 ? "+" : "") + n.toFixed(1) + "u"; }
        function fmtD(n) { return (n >= 0 ? "+$" : "-$") + Math.abs(n).toFixed(2); }
        function uColor(n) { return n > 0 ? "#34D399" : n < 0 ? "#F87171" : "#9CA3AF"; }

        function yearCard(r, isTotal) {
          var label = isTotal ? "All-Time Total" : r.year + " Season";
          var bg = isTotal ? "linear-gradient(140deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))" : "rgba(255,255,255,0.05)";
          var border = isTotal ? "border-top:2px solid rgba(255,255,255,0.16);" : "";

          function statCol(labelText, actualN, worstN, fmtFn) {
            var aColor = uColor(actualN);
            var wColor = uColor(worstN);
            return '<div>' +
              '<div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">' + labelText + '</div>' +
              '<div class="money-num" style="font-size:20px;font-weight:700;color:' + aColor + '">' + fmtFn(actualN) + '</div>' +
              '<div style="font-size:12px;color:' + wColor + ';margin-top:2px">' + fmtFn(worstN) + ' worst case</div>' +
            '</div>';
          }

          return '<div style="background:' + bg + ';border-radius:10px;padding:18px 20px;margin-bottom:12px;' + border + '">' +
            '<div style="font-size:15px;font-weight:700;color:#F3F4F6;margin-bottom:14px">' + label + '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' +
              '<div><div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Bets Made</div>' +
                '<div class="money-num" style="font-size:20px;font-weight:700;color:#F3F4F6">' + r.bets + '</div>' +
                '<div style="font-size:12px;color:#9CA3AF;margin-top:2px">' + r.notOffered + ' not offered</div></div>' +
              statCol("Units", r.units, r.unitsWorst, fmtU) +
              statCol("Money", r.dollars, r.dollarsWorst, fmtD) +
            '</div></div>';
        }

        var html = yearCard({
          bets: totalBets, units: totalUnits, dollars: totalDollars,
          unitsWorst: results.reduce(function(a,r){return a+r.unitsWorst;},0),
          dollarsWorst: results.reduce(function(a,r){return a+r.dollarsWorst;},0),
          notOffered: results.reduce(function(a,r){return a+r.notOffered;},0)
        }, true);
        results.forEach(function(r) { html += yearCard(r, false); });
        document.getElementById("money-content").innerHTML = html;
      } catch(e) {
        console.error(e);
        document.getElementById("money-content").innerHTML = '<div class="loading">Error loading data.</div>';
      }
    }
