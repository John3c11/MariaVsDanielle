// Analytics tab. Not in index.html: core.js (openAnalytics) loads it the first time someone opens Analytics.
// The jinx and bad-beat math that Stats and Profiles also use lives in insights.js.
// Part of the MariaVsDanielle site. All js/ files share one global scope and load in the order listed in index.html.

    // ── Analytics section filters ───────────────────────────────────────────
    // Each filterable section renders one block per filter combination (an "af-v" variant);
    // the filter buttons just show the matching block. Long lists show the first N rows
    // with a "Show all" toggle.
    var AF = {};

    function afBar(g, key, label, opts, def) {
      if (!AF[g]) AF[g] = { keys: [], state: {} };
      AF[g].keys.push(key);
      AF[g].state[key] = def;
      var h = '<div class="af-bar' + (key === 'season' ? ' af-bar-season' : '') + '"><span class="af-bar-label">' + label + '</span>';
      opts.forEach(function(o) {
        h += '<button class="filter-btn ' + (o[2] || '') + (o[0] === def ? ' active' : '') + '"' +
          ' data-af-g="' + g + '" data-af-k="' + key + '" data-af-val="' + o[0] + '">' + o[1] + '</button>';
      });
      return h + '</div>';
    }

    // Only the version on screen is put on the page; the rest wait in AF_HTML until a filter shows them
    // (Analytics used to put every season x picker version of every section on the page at once).
    var AF_HTML = {}, AF_SEQ = 0;
    function afVariant(g, vals, inner) {
      var id = 'afv' + (++AF_SEQ);
      AF_HTML[id] = inner;
      return '<div class="af-v" style="display:none" data-g="' + g + '" data-v="' + vals.join('|') + '" data-lazy="' + id + '"></div>';
    }

    // rowsHtml: array of row strings. Rows past `limit` hide behind "Show all" (moreList in core.js, v135:
    // the same Show all / Show less as every other list on the site).
    function afList(rowsHtml, limit, wrapOpen, wrapClose) { return moreList(rowsHtml, limit, wrapOpen, wrapClose); }

    // ── Analytics layout: one season picker + four sub-tabs ──────────────────
    var AN_TABS = [
      ['trends', '📈 Trends', ['Hit Grid', 'Luck Meter', 'Weekly Units', 'Form']],
      ['picking', '🎯 Picking', ['Boldness Meter', 'Pressure Picks', 'Picking vs Reality', 'Who Scores First']],
      ['players', '🏈 Players & Teams', ['Overachievers & Busts', 'TD Scorer Leaderboard', 'Chaos Corner']],
      ['pain', '😬 Pain', ['Jinx Tracker', 'Bad Beats']],
      ['whatif', '🔮 What-If', ['Anytime TD']],
    ];
    // Sections folded into another one: [target, 'sub' (shown) or 'list' (behind a button), subheading, button label]
    // Order matters: a section that receives others must be merged after them.
    var AN_MERGE = {
      'Week-by-Week Results': ['Weekly Units', 'list', 'Week by week', 'Show the week-by-week list'],
      'Odds vs Hits': ['Boldness Meter', 'sub', 'Where the hits come from'],
    };
    var AN_RENAME = { 'Who Scores First': 'Which Side Scores First' };
    // "Explore this →" on each story (v134): the same question in 🧪 Explore, already set up.
    // The season picked on Stories carries over (yr=…) unless it's All.
    var AN_EXPLORE = {
      'Hit Grid': 'who=both', 'Luck Meter': 'who=both&split=odds', 'Weekly Units': 'who=both&split=yr', 'Form': 'who=both&split=yr',
      'Boldness Meter': 'who=both&split=odds', 'Picking vs Reality': 'who=both&split=pos', 'Which Side Scores First': 'who=both&split=side', 'Who Scores First': 'who=both&split=side',
      'Overachievers & Busts': 'who=both&split=player', 'TD Scorer Leaderboard': 'who=both&res=hit&split=player', 'Chaos Corner': 'who=both&res=hit&odds=4',
    };
    function anStore(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

    function anOrganize(root, seasonOpts) {
      var secs = {}, order = [];
      root.querySelectorAll(':scope > .an-sec').forEach(function(s) { var t = s.getAttribute('data-sec'); secs[t] = s; order.push(t); });
      function find(name) {
        if (name.charAt(0) === '*') return order.filter(function(t) { return /^(\d{4} Season|Season Comparison)$/.test(t); }).map(function(t) { return secs[t]; })[0];
        return secs[name];
      }
      // Sections that don't change with the season picker get an "all seasons" tag
      order.forEach(function(t) {
        var s = secs[t], h = s.querySelector('.an-h');
        if (h && !s.querySelector('.af-bar-season')) h.insertAdjacentHTML('beforeend', '<span class="an-all">' + (t === 'Pick of the Season' ? 'this season' : 'all seasons') + '</span>');
      });
      // Merges
      Object.keys(AN_MERGE).forEach(function(src) {
        var from = secs[src], m = AN_MERGE[src], to = secs[m[0]];
        if (!from || !to) return;
        var box = document.createElement('div');
        box.className = 'an-merged';
        box.innerHTML = '<div class="an-sub">' + m[2] + '</div>';
        Array.prototype.slice.call(from.childNodes).forEach(function(n) { if (!(n.classList && n.classList.contains('an-h'))) box.appendChild(n); });
        if (m[1] === 'list') {
          var det = to.querySelector(':scope > details.an-more');
          if (!det) { det = document.createElement('details'); det.className = 'an-more'; det.innerHTML = '<summary>' + (m[3] || 'Show more') + '</summary>'; to.appendChild(det); }
          det.appendChild(box);
        } else to.appendChild(box);
        from.remove(); delete secs[src];
      });
      Object.keys(AN_RENAME).forEach(function(t) {
        var h = secs[t] && secs[t].querySelector('.an-h');
        if (h) h.firstChild.textContent = AN_RENAME[t];
      });
      // 🧪 "Explore this →" at the foot of each story that has a matching question
      Object.keys(secs).forEach(function(t) {
        if (!AN_EXPLORE[t]) return;
        secs[t].insertAdjacentHTML('beforeend', '<div class="an-x-row"><button class="an-x" data-an-x="' + AN_EXPLORE[t] + '">🧪 Explore this →</button></div>');
      });
      root.addEventListener('click', function(e) {
        var x = e.target.closest('[data-an-x]');
        if (x) openLabQuery(x.getAttribute('data-an-x') + (seasonNow !== 'all' ? '&yr=' + seasonNow : ''));
      });
      // Controls + panes
      var seasonNow = anStore('mvd-an-season') || 'all';
      if (!seasonOpts.some(function(o) { return o[0] === seasonNow; })) seasonNow = 'all';
      var tabNow = anStore('mvd-an-tab') || 'trends';
      if (!AN_TABS.some(function(t) { return t[0] === tabNow; })) tabNow = 'trends'; // old 'highlights' (Hit Grid now tops Trends)
      var top = document.createElement('div');
      top.className = 'an-controls';
      top.innerHTML = '<div class="af-bar an-season"><span class="af-bar-label">Season</span>' + seasonOpts.map(function(o) {
          return '<button class="filter-btn' + (o[0] === seasonNow ? ' active' : '') + '" data-an-season="' + o[0] + '">' + o[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="an-tabs">' + AN_TABS.map(function(t) {
          return '<button class="an-tab' + (t[0] === tabNow ? ' on' : '') + '" data-an-tab="' + t[0] + '">' + t[1] + '</button>';
        }).join('') + '</div>';
      var topSec = secs._top;
      root.insertBefore(top, topSec ? topSec.nextSibling : root.firstChild);
      var used = {};
      var lastPane = top;
      AN_TABS.forEach(function(t) {
        var pane = document.createElement('div');
        pane.className = 'an-pane';
        pane.setAttribute('data-pane', t[0]);
        pane.style.display = t[0] === tabNow ? '' : 'none';
        t[2].forEach(function(name) { var s = find(name); if (s) { pane.appendChild(s); used[s.getAttribute('data-sec')] = 1; } });
        root.insertBefore(pane, lastPane.nextSibling);
        lastPane = pane;
      });
      // Anything not listed lands at the end of Trends so nothing goes missing
      Object.keys(secs).forEach(function(t) {
        if (t !== '_top' && !used[t] && secs[t].parentNode === root) root.querySelector('.an-pane[data-pane="trends"]').appendChild(secs[t]);
      });
      function setSeason(v) {
        seasonNow = v; anStore('mvd-an-season', v);
        root.classList.toggle('an-one-season', v !== 'all');
        top.querySelectorAll('[data-an-season]').forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-an-season') === v); });
        Object.keys(AF).forEach(function(g) {
          if (AF[g].keys.indexOf('season') < 0) return;
          // A section without this option (Season Race has no "All") falls back to its first one: the current season
          var gv = v;
          if (!document.querySelector('[data-af-g="' + g + '"][data-af-k="season"][data-af-val="' + v + '"]')) {
            var first = document.querySelector('[data-af-g="' + g + '"][data-af-k="season"]');
            if (!first) return;
            gv = first.getAttribute('data-af-val');
          }
          AF[g].state.season = gv;
          document.querySelectorAll('[data-af-g="' + g + '"][data-af-k="season"]').forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-af-val') === gv); });
          afApply(g);
        });
      }
      top.addEventListener('click', function(e) {
        var s = e.target.closest('[data-an-season]');
        if (s) { setSeason(s.getAttribute('data-an-season')); return; }
        var t = e.target.closest('[data-an-tab]');
        if (!t) return;
        tabNow = t.getAttribute('data-an-tab'); anStore('mvd-an-tab', tabNow);
        top.querySelectorAll('[data-an-tab]').forEach(function(b) { b.classList.toggle('on', b === t); });
        root.querySelectorAll('.an-pane').forEach(function(p) { p.style.display = p.getAttribute('data-pane') === tabNow ? '' : 'none'; });
      });
      setSeason(seasonNow);
    }

    function afApply(g) {
      var want = AF[g].keys.map(function(k) { return AF[g].state[k]; }).join('|');
      document.querySelectorAll('.af-v[data-g="' + g + '"]').forEach(function(el) {
        var show = el.getAttribute('data-v') === want, id = el.getAttribute('data-lazy');
        if (show && id) { el.innerHTML = AF_HTML[id] || ''; delete AF_HTML[id]; el.removeAttribute('data-lazy'); }
        el.style.display = show ? '' : 'none';
      });
    }

    function afInit(root) {
      Object.keys(AF).forEach(afApply);
      root.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-af-g]');
        if (!btn) return;
        var g = btn.getAttribute('data-af-g');
        AF[g].state[btn.getAttribute('data-af-k')] = btn.getAttribute('data-af-val');
        btn.parentElement.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        afApply(g);
      });
    }

    var ANALYTICS_LOADED = false;
    async function loadAnalyticsTab() {
      if (ANALYTICS_LOADED) return;
      ANALYTICS_LOADED = true;
      try {
        // Chronological: oldest season first, sheet order within a season.
        // (Streaks and 10-game stretches depend on this order.)
        const rows = await loadAllBets();
        const scored = rows.filter(function(r) {
          return (r.homePick || r.awayPick) && (r.correct === "Yes" || r.correct === "No");
        });

        const medals = ["🥇", "🥈", "🥉"];
        const medalColors = ["#FBBF24", "#888", "#8B4513"];


        // Each section becomes its own block so anOrganize() can sort it into a sub-tab
        function section(title) {
          return '</div><div class="an-sec" data-sec="' + title + '"><div class="an-h">' + title + '</div>';
        }

        function statRow(label, val) {
          return '<div class="u-d-flex u-jc-space-between u-p-10px-0 u-bb-0-5px-solid-rgba-255-255-255-0-06 u-fs-13px"><span class="u-muted">' + label + '</span><span class="u-fw-600 u-c-t1">' + val + '</span></div>';
        }

        function pct(n, d) { return d ? Math.round(n/d*100) + "%" : "—"; }

        function twoCol(leftHtml, rightHtml) {
          return '<div class="ui-cols2 two-col">' + leftHtml + rightHtml + '</div>';
        }

        function personCard(name, contentHtml) {
          var color = personColor(name);
          return '<div class="u-bg-rgba-255-255-255-0-05 u-r-10px u-p-16px">' +
            '<div style="font-size:14px;font-weight:700;color:' + color + ';margin-bottom:12px">' + name + '</div>' +
            contentHtml + '</div>';
        }

        var html = '<div class="an-sec" data-sec="_top">';

        // Filter options shared by sections
        var AN_YEARS = rows.map(function(r) { return r.year; })
          .filter(function(y, i, a) { return a.indexOf(y) === i; })
          .sort(function(a, b) { return parseInt(b) - parseInt(a); });
        var CUR_SEASON = 'all'; // default view: every season
        function wkLabel(year, week) { return year + ' ' + wkName(week); }
        var SEASON_OPTS = AN_YEARS.map(function(y) { return [y, y]; }).concat([['all', 'All']]);
        var PICKER_OPTS = [['all', 'Both'], ['Maria', 'Maria', 'maria-btn'], ['Danielle', 'Danielle', 'danielle-btn']];
        function inSeason(r, season) { return season === 'all' || r.year === season; }
        function byPicker(r, picker) { return picker === 'all' ? (r.picker === 'Maria' || r.picker === 'Danielle') : r.picker === picker; }
        var EMPTY = function(t) { return '<div class="u-c-muted u-fs-13px u-ta-center u-p-16px">' + t + '</div>'; };

        // (v121: "Most picked & cursed picks" cut. Each Profile has Ride or Die + the Hall of Shame, and the Stat Lab splits by player.)

        // ── Streaks ───────────────────────────────────────────────────────────
        // ── Jinx Tracker ──────────────────────────────────────────────────────
        html += section("Jinx Tracker");
        html += '<div class="ui-note u-mb">A <b>jinx</b> is when someone picks a player, skips him the next time his team comes up, and he scores the first TD. <b>Loyalty</b> is how often they stick with a player when his team comes back around.</div>';

        var JX = computeJinxes(rows), jinxes = JX.jinxes, loyalty = JX.loyalty;

        function loyaltyStr(p) {
          var L = loyalty[p], total = L.kept + L.dropped;
          return total ? pct(L.kept, total) + ' (' + L.kept + '/' + total + ')' : '—';
        }
        html += twoCol(
          personCard("Maria", statRow("Jinxes", jinxes.Maria.length) + statRow("Loyalty", loyaltyStr("Maria"))),
          personCard("Danielle", statRow("Jinxes", jinxes.Danielle.length) + statRow("Loyalty", loyaltyStr("Danielle")))
        );

        function jinxSentence(j) {
          var pColor = personColor(j.picker);
          var oColor = personColor(j.other);
          // Year on the scoring week always; on the drop week only if it was a different season
          var from = j.fromYear !== j.year ? wkLabel(j.fromYear, j.fromWeek) : wkName(j.fromWeek);
          var to = wkLabel(j.year, j.week);
          var txt = '<span style="color:' + pColor + ';font-weight:600">' + j.picker + '</span> dropped ' +
            coloredText(j.player, j.team) + ' after ' + from + '. He scored first in ' + to + '.';
          if (j.cashed) {
            txt += ' And <span style="color:' + oColor + ';font-weight:600">' + j.other + '</span> cashed him' +
              (j.cashed.odds ? ' at ' + formatOdds(j.cashed.odds) : '') +
              ' (' + (j.cashed.units >= 0 ? '+' : '') + j.cashed.units + 'u).';
          }
          return txt;
        }

        var allJinx = jinxes.Maria.concat(jinxes.Danielle);
        var worst = allJinx.filter(function(j) { return j.cashed; })
          .sort(function(a, b) { return b.cashed.units - a.cashed.units; })[0];
        if (worst) {
          html += '<div class="u-bg-rgba-251-191-36-0-15 u-r-10px u-p-14px-16px u-m-8px-0-12px">' +
            '<div class="u-fs-11px u-fw-600 u-c-warn u-tt-uppercase u-ls-0-06em u-mb-6px">Worst Jinx</div>' +
            '<div class="u-fs-13px u-c-soft u-lh-1-6">' + jinxSentence(worst) + '</div></div>';
        }

        allJinx.sort(function(a, b) {
          if (a.year !== b.year) return parseInt(b.year) - parseInt(a.year);
          return b.week - a.week;
        });
        if (!allJinx.length) {
          html += EMPTY('No jinxes yet.');
        } else {
          html += '<div class="af-bars">' + afBar('jinx', 'picker', 'Show', [['all', 'Both'], ['Maria', 'Maria', 'maria-btn'], ['Danielle', 'Danielle', 'danielle-btn']], 'all') + '</div>';
          ['all', 'Maria', 'Danielle'].forEach(function(p) {
            var list = allJinx.filter(function(j) { return p === 'all' || j.picker === p; });
            var inner = list.length ? afList(list.map(function(j) {
              return '<div class="u-p-10px-0 u-bb-0-5px-solid-rgba-255-255-255-0-06 u-fs-13px u-c-soft u-lh-1-5">' + jinxSentence(j) + '</div>';
            }), 5) : EMPTY('No jinxes for ' + p + ' yet.');
            html += afVariant('jinx', [p], '<div class="u-mb-s">' + inner + '</div>');
          });
        }

        // ── Bad Beats (filled in after ESPN is checked) ─────────────────────
        html += section("Bad Beats");
        html += '<div class="ui-note u-mb">A <b>bad beat</b> is when someone\'s pick scored a touchdown in that game, just not the first one.</div>';
        html += '<div id="bad-beats"><div class="loading">Checking every game with ESPN…</div></div>';

        // ── 🔮 What-If: Anytime TD (v136, filled in once every TD is known) ──
        html += section("Anytime TD");
        html += '<div class="ch-intro">What if the bet paid when their player scored <b>any</b> touchdown, not just the first one?</div>';
        html += '<div class="af-bar-season" hidden></div><div id="whatif-box"><div class="loading">Finding every touchdown…</div></div>'; // follows the Season picker on top

        // ── Hit Grid (chart) ──
        html += section("Hit Grid");
        html += '<div class="ch-intro">Every bet as a square, so hot and cold stretches stand out.</div>';
        html += '<div class="af-bars">' + afBar('hgrid', 'season', 'Season', SEASON_OPTS, CUR_SEASON) + '</div>';
        SEASON_OPTS.forEach(function(so) { html += afVariant('hgrid', [so[0]], '<div class="ch-box">' + hitGridChart(rows, so[0]) + '</div>'); });
        html += '<div class="an-link">Biggest hits, longest streaks and best stretches: <button class="link-btn" onclick="switchTab(\'legacy\')">📖 Record Book in All-Time →</button></div>';

        // (v121: Pick of the Season cut. The Museum's big hits and each Profile's Best Hit show it.)

        // (v134: the Splits links are gone. 🧪 Explore sits right next to Stories now, and each story has its own "Explore this" button.)

        // ── Who Scores First: home or away team ──────────────────────────────
        html += section("Who Scores First");
        html += '<div class="ui-note u-mb">Which team scored the first touchdown in every game they bet on, from the Which Side Scored column.</div>';
        html += '<div class="af-bars">' + afBar('wsf', 'season', 'Season', SEASON_OPTS, CUR_SEASON) + '</div>';
        SEASON_OPTS.forEach(function(so) {
          var season = so[0], seen = {}, all = { Home: 0, Away: 0 }, bySlot = {};
          rows.forEach(function(r) {
            if (!inSeason(r, season) || !r.firstScorer) return;
            var side = /^home$/i.test(r.side) ? 'Home' : /^away$/i.test(r.side) ? 'Away' : '';
            var k = r.year + '_' + r.week + '_' + r.game;
            if (!side || seen[k]) return;
            seen[k] = 1;
            all[side]++;
            var sl = r.slot || 'Other';
            (bySlot[sl] = bySlot[sl] || { Home: 0, Away: 0 })[side]++;
          });
          var tot = all.Home + all.Away;
          if (!tot) { html += afVariant('wsf', [season], EMPTY('No scored games yet.')); return; }
          function split(h, a, big) {
            var t = h + a, hp = Math.round(h / t * 100);
            return '<div style="display:flex;justify-content:space-between;gap:8px;white-space:nowrap;font-size:' + (big ? 14 : 12) + 'px;margin-bottom:5px">' +
              '<span>🏠 Home <b>' + hp + '%</b></span><span><b>' + (100 - hp) + '%</b> Away ✈️</span></div>' +
              '<div style="display:flex;height:' + (big ? 12 : 7) + 'px;border-radius:999px;overflow:hidden;gap:2px">' +
              '<div style="width:' + hp + '%;background:#FBBF24"></div><div class="u-f-1 u-bg-a78bfa"></div></div>';
          }
          var hp = all.Home / tot;
          var lean = Math.abs(hp - 0.5) < 0.04 ? 'Basically a coin flip.' :
            (hp > 0.5 ? 'Home teams' : 'Road teams') + ' have scored first in ' + Math.round(Math.max(hp, 1 - hp) * 100) + '% of games.';
          lean += ' (' + all.Home + ' home, ' + all.Away + ' away)';
          var inner = '<div class="u-bg-rgba-255-255-255-0-05 u-r-10px u-p-14px-16px">' + split(all.Home, all.Away, true) +
            '<div class="u-fs-12px u-c-soft u-m-10px-0-4px">' + lean + '</div>';
          var slots = Object.keys(bySlot).sort(function(a, b) {
            var ORD = ['TNF','FNF','SNF','MNF','International','Thanksgiving','Black Friday','Saturday','Christmas','WNF'];
            var ai = ORD.indexOf(a), bi = ORD.indexOf(b);
            return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
          });
          if (slots.length > 1) {
            inner += '<div class="u-mt-12px u-bt-1px-solid-rgba-255-255-255-0-08 u-pt-6px">' + slots.map(function(sl) {
              var x = bySlot[sl];
              return '<div class="u-p-7px-0"><div class="u-fs-11px u-fw-700 u-ls-0-06em u-tt-uppercase u-c-muted u-mb-4px">' + escHtml(sl) + ' · ' + x.Home + ' home, ' + x.Away + ' away</div>' + split(x.Home, x.Away) + '</div>';
            }).join('') + '</div>';
          }
          html += afVariant('wsf', [season], inner + '</div>');
        });

        // (v135: Best Stretches & Biggest Wins cut. Biggest hits, streaks and the best 10-game stretch are in
        //  📜 All-Time's Record Book; the Hit Grid links there.)
        // ── Positions (used by Picking vs Reality; hit rate by position is in the Stat Lab) ────
        try { await ROSTERS_READY; } catch (e) {}
        var POS_ORDER = ['WR', 'RB', 'TE', 'QB', 'Other'];
        function posOf(name) {
          var info = ROSTER_INFO[playerKey(name)];
          var p = info && info.pos ? info.pos.replace(/\d+/g, '') : '';
          return POS_ORDER.indexOf(p) >= 0 ? p : 'Other';
        }

        // ── Picking vs Reality: what they pick vs who actually scores first ──
        html += section("Picking vs Reality");
        html += '<div class="ui-note u-mb">How often each of them picks each position, next to how often that position actually scores the first touchdown. Defense, special teams and players not on the Rosters tab count as Other.</div>';
        html += '<div class="af-bars">' + afBar('pvr', 'season', 'Season', SEASON_OPTS, CUR_SEASON) + '</div>';
        SEASON_OPTS.forEach(function(so) {
          var season = so[0], P = { Maria: {}, Danielle: {} }, PN = { Maria: 0, Danielle: 0 }, R = {}, RN = 0, seen = {};
          rows.forEach(function(r) {
            if (!inSeason(r, season)) return;
            if (r.picker === 'Maria' || r.picker === 'Danielle') {
              [r.homePick, r.awayPick].filter(Boolean).forEach(function(pk) { var q = posOf(pk); P[r.picker][q] = (P[r.picker][q] || 0) + 1; PN[r.picker]++; });
            }
            var k = r.year + '_' + r.week + '_' + r.game;
            if (r.firstScorer && !seen[k]) { seen[k] = 1; var q = posOf(r.firstScorer); R[q] = (R[q] || 0) + 1; RN++; }
          });
          if (!RN || !(PN.Maria + PN.Danielle)) { html += afVariant('pvr', [season], EMPTY('Not enough games yet.')); return; }
          function share(map, n, q) { return n ? (map[q] || 0) / n : 0; }
          function bar(label, v, c) {
            return '<div class="u-d-grid u-gtc-62px-1fr-38px u-gap-8px u-ai-center u-fs-11px u-p-2px-0">' +
              '<span style="color:' + c + ';font-weight:700">' + label + '</span>' +
              '<div class="u-h-7px u-r-4px u-bg-rgba-255-255-255-0-06"><div style="width:' + Math.round(v * 100) + '%;height:7px;border-radius:4px;background:' + c + '"></div></div>' +
              '<span class="u-ta-right u-fw-700">' + Math.round(v * 100) + '%</span></div>';
          }
          var inner = '<div class="u-bg-rgba-255-255-255-0-05 u-r-10px u-p-8px-14px">';
          POS_ORDER.forEach(function(q, i) {
            var real = share(R, RN, q), m = share(P.Maria, PN.Maria, q), d = share(P.Danielle, PN.Danielle, q);
            if (!real && !m && !d) return;
            inner += '<div style="padding:9px 0;' + (i ? 'border-top:0.5px solid rgba(255,255,255,0.06)' : '') + '">' +
              '<div class="u-fs-13px u-fw-800 u-mb-5px">' + q + '</div>' +
              bar('Scores', real, '#E5E7EB') + bar('Maria', m, SB_M) + bar('Danielle', d, SB_D) + '</div>';
          });
          inner += '</div>';
          // Biggest mismatch for each of them
          var notes = ['Maria', 'Danielle'].map(function(who) {
            if (!PN[who]) return '';
            var worst = null;
            POS_ORDER.forEach(function(q) {
              if (q === 'Other') return; // defense / special teams TDs aren't pickable
              var gap = share(P[who], PN[who], q) - share(R, RN, q);
              if (!worst || Math.abs(gap) > Math.abs(worst.gap)) worst = { q: q, gap: gap };
            });
            if (!worst || Math.abs(worst.gap) < 0.05) return '<div class="ui-note-plain"><b style="color:' + (personColor(who)) + '">' + who + '</b> picks pretty much in line with reality.</div>';
            return '<div class="ui-note-plain"><b style="color:' + (personColor(who)) + '">' + who + '</b> ' +
              (worst.gap > 0 ? 'over-picks' : 'under-picks') + ' ' + worst.q + 's: ' + Math.round(share(P[who], PN[who], worst.q) * 100) + '% of her picks, but they score first ' + Math.round(share(R, RN, worst.q) * 100) + '% of the time.</div>';
          }).join('');
          html += afVariant('pvr', [season], inner + '<div class="u-mt-10px">' + notes + '</div>');
        });

        // ── Weekly Units (chart) ──
        // (v121: Season Race moved to All-Time's race chart, which now has season chips.)

        // ── Luck Meter ──
        html += section("Luck Meter");
        html += '<div class="ch-intro">Good or lucky? Hits compared with what the odds expected.</div>';
        html += '<div class="af-bars">' + afBar('luck', 'season', 'Season', SEASON_OPTS, AN_YEARS[0]) + '</div>';
        SEASON_OPTS.forEach(function(so) { html += afVariant('luck', [so[0]], luckSection(rows, so[0])); });

        html += section("Weekly Units");
        html += '<div class="ch-intro">Units won or lost each week. Bars above the line are winning weeks.</div>';
        html += '<div class="af-bars">' + afBar('wkunits', 'season', 'Season', SEASON_OPTS, CUR_SEASON) + '</div>';
        SEASON_OPTS.forEach(function(so) { html += afVariant('wkunits', [so[0]], '<div class="ch-box">' + weeklyUnitsChart(rows, so[0]) + '</div>'); });

        // ── Form (chart) ──
        html += section("Form");
        html += '<div class="ch-intro">Who\'s hot: hit rate over each person\'s last 8 bets.</div>';
        html += '<div class="af-bars">' + afBar('form', 'season', 'Season', SEASON_OPTS, CUR_SEASON) + '</div>';
        SEASON_OPTS.forEach(function(so) { html += afVariant('form', [so[0]], '<div class="ch-box">' + formChart(rows, so[0]) + '</div>'); });

// ── Week-by-Week Results Timeline ────────────────────────────────────
        html += section("Week-by-Week Results");
        html += '<div class="af-bars">' + afBar('wbw', 'season', 'Season', SEASON_OPTS, CUR_SEASON) + '</div>';
        SEASON_OPTS.forEach(function(so) {
          var season = so[0];
          var wkResults = {};
          rows.filter(function(r) {
            return inSeason(r, season) && (r.homePick || r.awayPick) && (r.correct === 'Yes' || r.correct === 'No');
          }).forEach(function(r) {
            var key = r.year + '_W' + r.week;
            if (!wkResults[key]) wkResults[key] = { year: r.year, week: r.week, Maria: { w: 0, l: 0 }, Danielle: { w: 0, l: 0 } };
            if (r.picker === 'Maria' || r.picker === 'Danielle') {
              if (r.correct === 'Yes') wkResults[key][r.picker].w++;
              else wkResults[key][r.picker].l++;
            }
          });
          var wkKeys = Object.keys(wkResults).sort(function(a, b) {
            var ay = parseInt(wkResults[a].year), by = parseInt(wkResults[b].year);
            if (ay !== by) return by - ay;
            return wkResults[b].week - wkResults[a].week;
          });
          var rowsHtml = wkKeys.map(function(key) {
            var wk = wkResults[key];
            var mW = wk.Maria.w, mL = wk.Maria.l, dW = wk.Danielle.w, dL = wk.Danielle.l;
            var winnerColor = mW > dW ? SB_M : dW > mW ? SB_D : '#6B7280';
            var winnerLabel = mW > dW ? 'Maria' : dW > mW ? 'Danielle' : 'Tied';
            return '<div class="u-d-grid u-gtc-80px-1fr-80px u-gap-8px u-ai-center u-p-8px-0 u-bb-0-5px-solid-rgba-255-255-255-0-06">' +
              '<span class="u-fs-11px u-c-muted">' + wkLabel(wk.year, wk.week) + '</span>' +
              '<div class="u-d-flex u-ai-center u-gap-6px">' +
                '<span style="font-size:12px;color:' + SB_M + ';font-weight:600">M: ' + mW + '/' + (mW + mL) + '</span>' +
                '<span class="u-c-faint u-fs-10px">·</span>' +
                '<span style="font-size:12px;color:' + SB_D + ';font-weight:600">D: ' + dW + '/' + (dW + dL) + '</span>' +
              '</div>' +
              '<span style="font-size:12px;font-weight:700;color:' + winnerColor + ';text-align:right">' + winnerLabel + '</span>' +
            '</div>';
          });
          html += afVariant('wbw', [season], '<div class="u-mb-16px">' +
            (rowsHtml.length ? afList(rowsHtml, 6) : EMPTY('No scored weeks yet.')) + '</div>');
        });

        // (v135: Win Rate by Week cut. Week-by-Week Results above has the same weeks, and best/worst week are in the Record Book.)

        // (v134: Month by Month cut. Weekly Units shows the same run of form week by week, and Explore filters any stretch of weeks.)

        // ── Odds vs Hits (chart) ──
        html += section("Odds vs Hits");
        html += '<div class="ch-intro">Where the hits actually come from.</div>';
        html += '<div class="af-bars">' + afBar('oddsx', 'season', 'Season', SEASON_OPTS, CUR_SEASON) + '</div>';
        SEASON_OPTS.forEach(function(so) { html += afVariant('oddsx', [so[0]], '<div class="ch-box">' + oddsStripChart(rows, so[0]) + '</div>'); });

        // (Season Comparison moved to All-Time's 📅 By Season table, history.js)

        // (v121: Team Report Card cut. The Stat Lab's "Split by team" has the same records and units per team.)

        // ── Overachievers & Busts / Boldness Meter / Pressure Picks (insights.js) ──
        html += section("Overachievers & Busts");
        html += '<div class="ch-intro">Players who keep beating their odds, and the ones who keep letting them down.</div>';
        html += '<div class="af-bars">' + afBar('ob', 'season', 'Season', SEASON_OPTS, AN_YEARS[0]) + afBar('ob', 'picker', 'Picker', PICKER_OPTS, 'all') + '</div>';
        SEASON_OPTS.forEach(function(so) { PICKER_OPTS.forEach(function(po) { html += afVariant('ob', [so[0], po[0]], bustsSection(rows, so[0], po[0])); }); });
        html += section("Boldness Meter");
        html += '<div class="ch-intro">Are they getting braver or playing it safe, and does going bold pay?</div>';
        html += '<div class="af-bars">' + afBar('bold', 'season', 'Season', SEASON_OPTS, AN_YEARS[0]) + '</div>';
        SEASON_OPTS.forEach(function(so) { html += afVariant('bold', [so[0]], boldSection(rows, so[0])); });
        html += section("Pressure Picks");
        html += '<div class="ch-intro">Clutch or choker: how each does when she\'s behind for the week.</div>';
        html += '<div class="af-bars">' + afBar('press', 'season', 'Season', SEASON_OPTS, AN_YEARS[0]) + '</div>';
        SEASON_OPTS.forEach(function(so) { html += afVariant('press', [so[0]], pressureSection(rows, so[0])); });

        // ── Chaos Corner ──
        try { await loadNFL(); } catch (e) {}
        html += section("Chaos Corner");
        html += '<div class="ch-intro">The first touchdowns nobody could have picked.</div>';
        html += '<div class="af-bars">' + afBar('chaos', 'season', 'Season', SEASON_OPTS, AN_YEARS[0]) + '</div>';
        SEASON_OPTS.forEach(function(so) { html += afVariant('chaos', [so[0]], chaosSection(rows, so[0])); });

        // ── TD Scorers ──────────────────────────────────────────────────────────
        html += section("TD Scorer Leaderboard");
        html += '<div class="ui-note u-mb">Every player who has scored a first TD. <b>Picked</b> = how many of those TDs someone actually had them picked for that game.</div>';
        html += '<div class="af-bars">' +
          afBar('td', 'season', 'Season', SEASON_OPTS, CUR_SEASON) +
          afBar('td', 'who', 'Picked by', [['all', 'Anyone'], ['Maria', 'Maria', 'maria-btn'], ['Danielle', 'Danielle', 'danielle-btn']], 'all') + '</div>';

        // gameKey -> { Maria: {home, away}, Danielle: {...} }
        var gamePickMap = {};
        rows.forEach(function(r) {
          if (r.picker !== 'Maria' && r.picker !== 'Danielle') return;
          var gameKey = r.year + '_' + r.week + '_' + r.homeTeam + '_' + r.awayTeam;
          if (!gamePickMap[gameKey]) gamePickMap[gameKey] = {};
          gamePickMap[gameKey][r.picker] = { home: (r.homePick || '').trim(), away: (r.awayPick || '').trim() };
        });

        function tdTag(pickedBy) {
          if (pickedBy.has('Maria') && pickedBy.has('Danielle')) return '<span class="u-fs-10px u-fw-600 u-c-violet u-bg-rgba-167-139-250-0-18 u-r-4px u-p-2px-6px">Both</span>';
          if (pickedBy.has('Maria')) return '<span style="font-size:10px;font-weight:600;color:' + SB_M + ';background:' + hexA(SB_M, 0.15) + ';border-radius:4px;padding:2px 6px">Maria</span>';
          if (pickedBy.has('Danielle')) return '<span style="font-size:10px;font-weight:600;color:' + SB_D + ';background:' + hexA(SB_D, 0.16) + ';border-radius:4px;padding:2px 6px">Danielle</span>';
          return '<span class="ui-tiny">—</span>';
        }

        var tdHead = '<div class="u-bg-rgba-255-255-255-0-05 u-r-10px u-p-8px-12px">' +
          '<div class="u-d-grid u-gtc-1fr-90px-80px u-gap-8px u-p-8px-0-4px u-bb-1px-solid-rgba-255-255-255-0-10">' +
          '<span class="u-fs-11px u-c-muted u-tt-uppercase u-ls-0-05em u-fw-600">Player</span>' +
          '<span class="u-fs-11px u-c-muted u-tt-uppercase u-ls-0-05em u-fw-600 u-ta-center">TDs (picked)</span>' +
          '<span class="u-fs-11px u-c-muted u-tt-uppercase u-ls-0-05em u-fw-600 u-ta-center">Picked By</span>' +
          '</div>';

        SEASON_OPTS.forEach(function(so) {
          var season = so[0];
          var tdMap = {};
          rows.forEach(function(r) {
            if (!inSeason(r, season)) return;
            var scorer = (r.firstScorer || '').trim();
            if (!scorer) return;
            var gameKey = r.year + '_' + r.week + '_' + r.homeTeam + '_' + r.awayTeam;
            if (!tdMap[scorer]) tdMap[scorer] = { total: 0, picked: 0, pickedBy: new Set(), seenGames: new Set() };
            var t = tdMap[scorer];
            if (t.seenGames.has(gameKey)) return; // one entry per game
            t.seenGames.add(gameKey);
            t.total++;
            var gp = gamePickMap[gameKey] || {}, pickedThisGame = false;
            ['Maria', 'Danielle'].forEach(function(person) {
              var picks = gp[person];
              if (picks && (picks.home === scorer || picks.away === scorer)) { t.pickedBy.add(person); pickedThisGame = true; }
            });
            if (pickedThisGame) t.picked++;
          });
          var tdArr = Object.entries(tdMap)
            .sort(function(a, b) { return b[1].total - a[1].total || a[0].localeCompare(b[0]); });

          [['all'], ['Maria'], ['Danielle']].forEach(function(wo) {
            var who = wo[0];
            var list = tdArr.filter(function(e) { return who === 'all' || e[1].pickedBy.has(who); });
            if (!list.length) {
              html += afVariant('td', [season, who], EMPTY(who === 'all' ? 'No TD scorers recorded yet.' : who + " hasn't had a picked player score first yet."));
              return;
            }
            var divs = list.map(function(entry) {
              var data = entry[1];
              var tdDisplay = '<span class="u-fs-14px u-fw-700 u-c-soft">' + data.total + '</span>' +
                (data.picked > 0 && data.picked < data.total ? '<span class="u-fs-11px u-c-muted u-ml-3px">(' + data.picked + ' picked)</span>' : '');
              return '<div class="u-d-grid u-gtc-1fr-90px-80px u-gap-8px u-p-9px-0 u-bb-0-5px-solid-rgba-255-255-255-0-06 u-ai-center">' +
                '<span class="u-fs-13px u-fw-600 u-c-t1">' + entry[0] + '</span>' +
                '<span class="u-center">' + tdDisplay + '</span>' +
                '<span class="u-center">' + tdTag(data.pickedBy) + '</span>' +
              '</div>';
            });
            // Show everyone with 2+ first TDs; "Show all" adds the one-timers
            var lim = list.filter(function(e) { return e[1].total > 1; }).length || Math.min(10, list.length);
            html += afVariant('td', [season, who], afList(divs, lim, tdHead, '</div>'));
          });
        });


        // ── Bad Beats: every TD from ESPN for each tracked game ──────────────
        // 🔮 Anytime TD: the same bets, graded against every touchdown in the game.
        // Hits are real. Money is an estimate: anytime odds run about a quarter of first-TD odds
        // (+700 to score first is about +165 to score at all), so a hit pays its first-TD odds ÷ 4.3.
        // Like the sheet: any hit pays (two hits pay both), no hit loses 1u per pick.
        var ATD_RATIO = 4.3;
        async function loadWhatIf() {
          var box = document.getElementById('whatif-box');
          if (!box) return;
          var BB;
          try { BB = await computeBadBeats(rows); } catch (e) { BB = null; }
          if (!BB || !BB.anyData) { box.innerHTML = EMPTY('Couldn\'t get the touchdowns right now. Try again later.'); return; }
          var res = {}; Object.keys(BB.results).forEach(function(k) { res[k] = BB.results[k]; });
          var bets = scored.filter(function(r) { return isMD(r.picker) && (r.homePick || r.awayPick); }).map(function(r) {
            var tds = res[r.year + '_' + r.week + '_' + r.homeTeam + '_' + r.awayTeam];
            var picks = [[r.homePick, r.homeOdds], [r.awayPick, r.awayOdds]].filter(function(x) { return x[0]; });
            var per = r.netUnits ? Math.abs(r.netDollars / r.netUnits) : (parseFloat(r.amount) || 5);
            var b = { r: r, known: !!tds, ftdHit: r.correct === 'Yes' && !isNotOffered(r), ftdU: r.netUnits, ftdD: r.netDollars, per: per };
            if (!tds) return b;
            // (a first-TD hit always counts, even if ESPN spells the name differently)
            var hits = picks.filter(function(x) { return (b.ftdHit && sameScorer(r.firstScorer, x[0])) || tds.some(function(t) { return sameScorer(t.n, x[0]); }); });
            b.atdHit = hits.length > 0; b.atdHits = hits.length;
            b.atdU = hits.length ? hits.reduce(function(a, x) { return a + oddsN(x[1]) / ATD_RATIO; }, 0) : -picks.length;
            b.atdD = b.atdU * per;
            b.near = picks.filter(function(x) { return !(b.ftdHit && sameScorer(r.firstScorer, x[0])) && tds.some(function(t) { return sameScorer(t.n, x[0]); }); }).length;
            return b;
          });
          var years = AN_YEARS.slice(), cur = anStore('mvd-an-season') || 'all';
          if (cur !== 'all' && years.indexOf(cur) < 0) cur = 'all';
          function draw() {
            var list = bets.filter(function(b) { return cur === 'all' || b.r.year === cur; }), known = list.filter(function(b) { return b.known; });
            var S = {};
            ['Maria', 'Danielle'].forEach(function(w) {
              var mine = known.filter(function(b) { return b.r.picker === w; });
              S[w] = { n: mine.length, f: 0, a: 0, fu: 0, au: 0, fd: 0, ad: 0, near: 0 };
              mine.forEach(function(b) { var x = S[w]; if (b.ftdHit) x.f++; if (b.atdHit) x.a++; x.fu += b.ftdU; x.au += b.atdU; x.fd += b.ftdD; x.ad += b.atdD; x.near += b.near; });
            });
            function card(w) {
              var x = S[w], c = personColor(w);
              return '<div class="wi-card" style="--pc:' + c + '"><div class="wi-who" style="color:' + c + '">' + w + '</div>' +
                '<div class="wi-row"><span>First TD <small>what happened</small></span><b>' + x.f + '/' + x.n + '</b><b class="' + (x.fu >= 0 ? 'u-good' : 'u-bad') + '">' + fmtU(x.fu) + '</b></div>' +
                '<div class="wi-row wi-any"><span>Anytime TD <small>est. money</small></span><b>' + x.a + '/' + x.n + '</b><b class="' + (x.au >= 0 ? 'u-good' : 'u-bad') + '">' + fmtU(x.au) + '</b></div>' +
                '<div class="wi-foot">' + (x.a - x.f > 0 ? '+' + (x.a - x.f) + ' more winning bet' + (x.a - x.f === 1 ? '' : 's') : 'No extra wins') + ' · ' + fmtDWhole(x.ad) + ' instead of ' + fmtDWhole(x.fd) + '</div></div>';
            }
            function lead(k) { var m = S.Maria[k], d = S.Danielle[k]; return Math.abs(m - d) < 0.05 ? 'they\'re tied' : '<b style="color:' + personColor(m > d ? 'Maria' : 'Danielle') + '">' + (m > d ? 'Maria' : 'Danielle') + '</b> leads by ' + Math.abs(m - d).toFixed(1) + 'u'; }
            var h = '';
            if (!known.length) { box.innerHTML = EMPTY('No finished games yet' + (cur === 'all' ? '' : ' in ' + cur) + '.'); return; }
            h += '<div class="ui-cols2 two-col">' + card('Maria') + card('Danielle') + '</div>';
            h += '<div class="wi-verdict">First TD: ' + lead('fu') + '. Anytime TD: ' + lead('au') + ' <span class="mc-est">est</span>.</div>';
            var near = S.Maria.near + S.Danielle.near;
            if (near) h += '<div class="an-link">' + near + ' pick' + (near === 1 ? '' : 's') + ' scored, just not first. Every one, with how close it was: <button class="link-btn" onclick="openAnalyticsPane(\'pain\')">😬 Bad Beats →</button></div>';
            h += '<div class="ui-note">Hits are real: every touchdown in the game, from ESPN. Money is estimated: anytime odds are roughly first-TD odds ÷ ' + ATD_RATIO + ' (+700 to score first ≈ +165 to score at all). Games where the scorer wasn\'t offered count here, since anytime bets still pay.' +
              (list.length > known.length ? ' ' + (list.length - known.length) + ' bet' + (list.length - known.length === 1 ? '' : 's') + ' left out (ESPN didn\'t have the game).' : '') + '</div>';
            box.innerHTML = h;
          }
          // The Season picker at the top of Stories drives this one too
          document.getElementById('analytics-content').addEventListener('click', function(e) {
            var b = e.target.closest('[data-an-season]');
            if (b) { cur = b.getAttribute('data-an-season'); draw(); }
          });
          draw();
        }

        async function loadBadBeats() {
          var box = document.getElementById('bad-beats');
          if (!box) return;
          var BB = await computeBadBeats(rows, function(done, total) {
            var l = box.querySelector('.loading');
            if (l) l.textContent = 'Checking every game with ESPN… ' + done + '/' + total;
          });
          var beats = BB.beats, failed = BB.failed, order = BB.order, results = BB.results;

          if (!order.length) { box.innerHTML = EMPTY('No finished games yet.'); return; }
          if (Object.keys(results).every(function(k) { return !results[k]; })) {
            box.innerHTML = EMPTY('Couldn\'t reach ESPN right now. Try again later.');
            return;
          }

          function gapText(b) { return b.gap <= 0 ? 'right after' : b.gap === 1 ? '1 min after' : b.gap + ' min after'; }
          function line(b) {
            var c = personColor(b.who);
            return '<span style="color:' + c + ';font-weight:600">' + b.who + '</span> had ' + coloredText(b.player, b.team) +
              '. He scored in ' + b.q + (b.clock ? ' (' + b.clock + ')' : '') + ', ' + gapText(b) + ' <b>' + b.first + '</b> scored first · ' + wkLabel(b.year, b.week) + '.';
          }
          var count = { Maria: 0, Danielle: 0 }, closest = { Maria: null, Danielle: null };
          beats.forEach(function(b) {
            count[b.who]++;
            if (!closest[b.who] || b.gap < closest[b.who].gap) closest[b.who] = b;
          });
          var out = twoCol(
            personCard('Maria', statRow('Bad beats', count.Maria) + statRow('Closest call', closest.Maria ? closest.Maria.player + ' (' + gapText(closest.Maria) + ')' : '—')),
            personCard('Danielle', statRow('Bad beats', count.Danielle) + statRow('Closest call', closest.Danielle ? closest.Danielle.player + ' (' + gapText(closest.Danielle) + ')' : '—'))
          );
          var worst = beats.slice().sort(function(a, b) { return a.gap - b.gap; })[0];
          if (worst) {
            out += '<div class="u-bg-rgba-248-113-113-0-12 u-bd-1px-solid-rgba-248-113-113-0-3 u-r-10px u-p-14px-16px u-m-8px-0-12px">' +
              '<div class="u-fs-11px u-fw-700 u-c-bad2 u-tt-uppercase u-ls-0-08em u-mb-6px">💔 Most Painful</div>' +
              '<div class="u-fs-13px u-c-soft u-lh-1-6">' + line(worst) + '</div></div>';
          }
          beats.sort(function(a, b) { return a.year !== b.year ? parseInt(b.year) - parseInt(a.year) : b.week - a.week; });
          if (beats.length) {
            out += '<div class="af-bars">' + afBar('bb', 'picker', 'Show', PICKER_OPTS, 'all') + '</div>';
            PICKER_OPTS.forEach(function(po) {
              var list = beats.filter(function(b) { return po[0] === 'all' || b.who === po[0]; });
              out += afVariant('bb', [po[0]], list.length ? afList(list.map(function(b) {
                return '<div class="u-p-10px-0 u-bb-0-5px-solid-rgba-255-255-255-0-06 u-fs-13px u-c-soft u-lh-1-5">' + line(b) + '</div>';
              }), 5) : EMPTY('No bad beats for ' + po[1] + '.'));
            });
          } else {
            out += EMPTY('No bad beats yet. Every picked player who scored was first.');
          }
          if (failed) out += '<div class="u-fs-11px u-c-muted u-mt-6px">' + failed + ' game' + (failed > 1 ? 's' : '') + ' couldn\'t be matched on ESPN and were skipped.</div>';
          box.innerHTML = out;
          if (AF.bb) afApply('bb');
        }

        var analyticsEl = document.getElementById("analytics-content");
        analyticsEl.innerHTML = html + '</div>';
        afInit(analyticsEl);
        anOrganize(analyticsEl, SEASON_OPTS);
        loadBadBeats();
        loadWhatIf();
      } catch(e) {
        console.error(e);
        document.getElementById("analytics-content").innerHTML = '<div class="loading">Error loading analytics.</div>';
      }
    }
