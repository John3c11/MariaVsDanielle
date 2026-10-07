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
      return '<div class="af-v" data-g="' + g + '" data-v="' + vals.join('|') + '" data-lazy="' + id + '" style="display:none"></div>';
    }

    // rowsHtml: array of row strings. Rows past `limit` hide behind a "Show all" button.
    // wrapOpen/wrapClose let rows sit inside a table or styled box.
    function afList(rowsHtml, limit, wrapOpen, wrapClose) {
      var out = '<div class="af-list af-collapsed">' + (wrapOpen || '');
      rowsHtml.forEach(function(r, i) {
        out += i < limit ? r : r.replace(/^<(\w+)/, '<$1 class="af-extra"');
      });
      out += (wrapClose || '');
      if (rowsHtml.length > limit) {
        var label = 'Show all ' + rowsHtml.length;
        out += '<div class="af-more"><button class="link-btn" data-af-more="1" data-label="' + label + '">' + label + '</button></div>';
      }
      return out + '</div>';
    }

    // ── Analytics layout: one season picker + five sub-tabs ──────────────────
    var AN_TABS = [
      ['highlights', '🔥 Highlights', ['Pick of the Season', 'Hit Grid']],
      ['trends', '📈 Trends', ['Season Race', 'Luck Meter', 'Weekly Units', 'Form', 'Month by Month']],
      ['picking', '🎯 Picking', ['Splits', 'Boldness Meter', 'Pressure Picks', 'Picking vs Reality', 'Who Scores First']],
      ['players', '🏈 Players & Teams', ['NFL Team Heat Map', 'Overachievers & Busts', 'TD Scorer Leaderboard', 'Chaos Corner']],
      ['pain', '😬 Pain', ['Jinx Tracker', 'Bad Beats']],
    ];
    // Sections folded into another one: [target, 'sub' (shown) or 'list' (behind a button), subheading, button label]
    // Order matters: a section that receives others must be merged after them.
    var AN_MERGE = {
      'Week-by-Week Results': ['Weekly Units', 'list', 'Week by week', 'Show the week-by-week list'],
      'Win Rate by Week': ['Weekly Units', 'list', 'Win rate by week', 'Show the week-by-week list'],
      'Odds vs Hits': ['Boldness Meter', 'sub', 'Where the hits come from'],
      'Best Stretches & Biggest Wins': ['Hit Grid', 'list', 'Best stretches & biggest wins (all seasons)', 'Show best stretches & biggest wins'],
      'Fun Stats': ['Overachievers & Busts', 'list', 'Most picked & cursed picks (all seasons)', 'Show most picked & cursed picks'],
    };
    var AN_RENAME = { 'Who Scores First': 'Which Side Scores First', 'NFL Team Heat Map': 'Team Report Card' };
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
      // Controls + panes
      var seasonNow = anStore('mvd-an-season') || 'all';
      if (!seasonOpts.some(function(o) { return o[0] === seasonNow; })) seasonNow = 'all';
      var tabNow = anStore('mvd-an-tab') || 'highlights';
      if (!AN_TABS.some(function(t) { return t[0] === tabNow; })) tabNow = 'highlights';
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
      // Anything not listed lands at the end of Highlights so nothing goes missing
      Object.keys(secs).forEach(function(t) {
        if (t !== '_top' && !used[t] && secs[t].parentNode === root) root.querySelector('.an-pane[data-pane="highlights"]').appendChild(secs[t]);
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
        var more = e.target.closest('[data-af-more]');
        if (more) {
          var list = more.closest('.af-list');
          var collapsed = list.classList.toggle('af-collapsed');
          more.textContent = collapsed ? more.getAttribute('data-label') : 'Show less';
          return;
        }
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

        function podium(title, items) {
          var html = '<div style="margin-bottom:28px"><div style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">' + title + '</div>';
          items.slice(0, 3).forEach(function(item, i) {
            html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06)">' +
              '<span style="font-size:20px">' + medals[i] + '</span>' +
              '<span style="flex:1;font-weight:600;color:#F3F4F6">' + item.name + '</span>' +
              '<span style="font-size:13px;color:#A1A9B6">' + item.count + '</span>' +
            '</div>';
          });
          html += '</div>';
          return html;
        }

        // Each section becomes its own block so anOrganize() can sort it into a sub-tab
        function section(title) {
          return '</div><div class="an-sec" data-sec="' + title + '"><div class="an-h">' + title + '</div>';
        }

        function statRow(label, val) {
          return '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:13px"><span style="color:#A1A9B6">' + label + '</span><span style="font-weight:600;color:#F3F4F6">' + val + '</span></div>';
        }

        function pct(n, d) { return d ? Math.round(n/d*100) + "%" : "—"; }

        function twoCol(leftHtml, rightHtml) {
          return '<div class="two-col" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px">' + leftHtml + rightHtml + '</div>';
        }

        function personCard(name, contentHtml) {
          var color = personColor(name);
          return '<div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:16px">' +
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
        var EMPTY = function(t) { return '<div style="color:#9CA3AF;font-size:13px;text-align:center;padding:16px">' + t + '</div>'; };

        // ── Fun Stats ─────────────────────────────────────────────────────────
        html += section("Fun Stats");

                // Most picked players per person
        ["Maria", "Danielle"].forEach(function(name) {
          var pickCount = {};
          rows.filter(function(r){return r.picker===name;}).forEach(function(r) {
            if (r.homePick) pickCount[r.homePick] = (pickCount[r.homePick] || 0) + 1;
            if (r.awayPick) pickCount[r.awayPick] = (pickCount[r.awayPick] || 0) + 1;
          });
          var top = Object.entries(pickCount).sort(function(a,b){return b[1]-a[1];}).map(function(e){return {name:e[0],count:e[1]+"x"};});
          html += podium(name + "'s Most Picked Players", top);
        });

        // Combined most picked players (both together)
        var combinedPickCount = {};
        rows.filter(function(r){return r.picker==="Maria"||r.picker==="Danielle";}).forEach(function(r) {
          if (r.homePick) combinedPickCount[r.homePick] = (combinedPickCount[r.homePick] || 0) + 1;
          if (r.awayPick) combinedPickCount[r.awayPick] = (combinedPickCount[r.awayPick] || 0) + 1;
        });
        var combinedTop = Object.entries(combinedPickCount).sort(function(a,b){return b[1]-a[1];}).map(function(e){return {name:e[0],count:e[1]+"x"};});
        html += podium("Most Picked Overall (Both)", combinedTop);

        // Most picked player who never scored
        ["Maria", "Danielle"].forEach(function(name) {
          var pickCount = {};
          var scored2 = new Set();
          rows.filter(function(r){return r.picker===name;}).forEach(function(r) {
            if (r.homePick) pickCount[r.homePick] = (pickCount[r.homePick] || 0) + 1;
            if (r.awayPick) pickCount[r.awayPick] = (pickCount[r.awayPick] || 0) + 1;
            if (r.correct === "Yes") {
              if (r.homePick && r.firstScorer === r.homePick) scored2.add(r.homePick);
              if (r.awayPick && r.firstScorer === r.awayPick) scored2.add(r.awayPick);
            }
          });
          var cursed = Object.entries(pickCount)
            .filter(function(e){ return !scored2.has(e[0]) && e[1] > 1; })
            .sort(function(a,b){return b[1]-a[1];});
          if (cursed.length > 0) {
            var color = personColor(name);
          html += '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">' + name + "'s Cursed Pick</div>" +
              '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px 16px;display:flex;justify-content:space-between">' +
              '<span style="font-weight:600;color:' + color + '">' + cursed[0][0] + '</span>' +
              '<span style="font-size:12px;color:#9CA3AF">picked ' + cursed[0][1] + 'x, never scored</span>' +
              '</div></div>';
          }
        });

        // ── Fun Stats from Legacy ─────────────────────────────────────────────
        function legFun(label, val, cls) {
          var color = cls === 'maria' ? SB_M : cls === 'danielle' ? SB_D : cls === 'red' ? '#F87171' : '#F3F4F6';
          return '<div style="display:flex;justify-content:space-between;padding:11px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:13px;gap:16px"><span style="color:#A1A9B6">' + label + '</span><span style="font-weight:600;text-align:right;color:' + color + '">' + val + '</span></div>';
        }

        // ── Streaks ───────────────────────────────────────────────────────────
        // ── Jinx Tracker ──────────────────────────────────────────────────────
        html += section("Jinx Tracker");
        html += '<div style="font-size:12px;color:#A1A9B6;margin-bottom:12px">A <b>jinx</b> is when someone picks a player, skips him the next time his team comes up, and he scores the first TD. <b>Loyalty</b> is how often they stick with a player when his team comes back around.</div>';

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
          html += '<div style="background:rgba(251,191,36,0.15);border-radius:10px;padding:14px 16px;margin:8px 0 12px">' +
            '<div style="font-size:11px;font-weight:600;color:#FCD34D;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Worst Jinx</div>' +
            '<div style="font-size:13px;color:#D1D5DB;line-height:1.6">' + jinxSentence(worst) + '</div></div>';
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
              return '<div style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:13px;color:#D1D5DB;line-height:1.5">' + jinxSentence(j) + '</div>';
            }), 5) : EMPTY('No jinxes for ' + p + ' yet.');
            html += afVariant('jinx', [p], '<div style="margin-bottom:8px">' + inner + '</div>');
          });
        }

        // ── Bad Beats (filled in after ESPN is checked) ─────────────────────
        html += section("Bad Beats");
        html += '<div style="font-size:12px;color:#A1A9B6;margin-bottom:12px">A <b>bad beat</b> is when someone\'s pick scored a touchdown in that game, just not the first one.</div>';
        html += '<div id="bad-beats"><div class="loading">Checking every game with ESPN…</div></div>';

        // ── Hit Grid (chart) ──
        html += section("Hit Grid");
        html += '<div class="ch-intro">Every bet as a square, so hot and cold stretches stand out.</div>';
        html += '<div class="af-bars">' + afBar('hgrid', 'season', 'Season', SEASON_OPTS, CUR_SEASON) + '</div>';
        SEASON_OPTS.forEach(function(so) { html += afVariant('hgrid', [so[0]], '<div class="ch-box">' + hitGridChart(rows, so[0]) + '</div>'); });

        // ── Pick of the Season ───────────────────────────────────────────────
        html += section("Pick of the Season");

        function getBestPick(betsArr) {
          var best = null;
          betsArr.filter(function(r){return r.correct==="Yes";}).forEach(function(r) {
            var rawOdds = r.homePick && r.firstScorer === r.homePick ? Math.abs(r.homeOdds) :
                         r.awayPick && r.firstScorer === r.awayPick ? Math.abs(r.awayOdds) :
                         Math.max(Math.abs(r.homeOdds), Math.abs(r.awayOdds));
            var odds = rawOdds < 100 ? rawOdds * 100 : rawOdds;
            if (!best || odds > best.odds) {
              best = { picker: r.picker, player: r.firstScorer || (r.homePick || r.awayPick),
                odds: odds, homeTeam: r.homeTeam, awayTeam: r.awayTeam, week: r.week, year: r.year };
            }
          });
          return best;
        }

        function pickCard(pick, yearLabel) {
          if (!pick) return '<div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:16px;margin-bottom:10px;color:#9CA3AF;font-size:13px">' + yearLabel + ' — No winning picks yet.</div>';
          var pColor = personColor(pick.picker);
          var gameDisplay = pick.homeTeam && pick.awayTeam ? pick.homeTeam + ' vs ' + pick.awayTeam : 'Game';
          var oddsDisplay = pick.odds >= 100 ? '+' + Math.round(pick.odds) : '+' + Math.round(pick.odds * 100);
          return '<div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:16px;margin-bottom:10px">' +
            '<div style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">' + yearLabel + '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
              '<div><div style="font-size:20px;font-weight:700;color:#F3F4F6">' + pick.player + '</div>' +
              '<div style="font-size:12px;color:#A1A9B6;margin-top:2px">' + gameDisplay + ' · ' + wkLabel(pick.year, pick.week) + '</div></div>' +
              '<div style="text-align:right"><div style="font-size:18px;font-weight:700;color:#34D399">' + oddsDisplay + '</div>' +
              '<div style="font-size:12px;font-weight:600;color:' + pColor + ';margin-top:2px">' + pick.picker + '</div></div>' +
            '</div></div>';
        }

        // This season only: every past season's Pick of the Season is on its Season Wrapped card (All-Time)
        html += pickCard(getBestPick(scored.filter(function(r){return r.year===CURRENT_YEAR;})), CURRENT_YEAR + " Season");
        if (AN_YEARS.length > 1) html += '<div class="ch-intro" style="margin-top:-2px">Past seasons\' picks are on their Season Wrapped cards on All-Time.</div>';

        // ── Splits now live in the 🧪 Stat Lab (v118): home/road, game slot, position and odds range ──
        html += section("Splits");
        html += '<div class="ch-intro">Home vs road picks, game slots, positions and odds ranges are now in the Stat Lab, side by side, for any season, and you can tap any row to dig in.</div><div class="lab-jump">' +
          [['side', '🏠 Home vs road'], ['slot', '🗓️ By game slot'], ['pos', '🏈 By position'], ['odds', '🎲 By odds range'], ['team', '🛡️ By team']].map(function(x) {
            return '<button class="lab-pre" onclick="openLabQuery(\'split=' + x[0] + '\')">' + x[1] + ' →</button>';
          }).join('') + '</div>';

        // ── Who Scores First: home or away team ──────────────────────────────
        html += section("Who Scores First");
        html += '<div style="font-size:12px;color:#A1A9B6;margin-bottom:12px">Which team scored the first touchdown in every game they bet on, from the Which Side Scored column.</div>';
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
              '<div style="width:' + hp + '%;background:#FBBF24"></div><div style="flex:1;background:#A78BFA"></div></div>';
          }
          var hp = all.Home / tot;
          var lean = Math.abs(hp - 0.5) < 0.04 ? 'Basically a coin flip.' :
            (hp > 0.5 ? 'Home teams' : 'Road teams') + ' have scored first in ' + Math.round(Math.max(hp, 1 - hp) * 100) + '% of games.';
          lean += ' (' + all.Home + ' home, ' + all.Away + ' away)';
          var inner = '<div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:14px 16px">' + split(all.Home, all.Away, true) +
            '<div style="font-size:12px;color:#D1D5DB;margin:10px 0 4px">' + lean + '</div>';
          var slots = Object.keys(bySlot).sort(function(a, b) {
            var ORD = ['TNF','FNF','SNF','MNF','International','Thanksgiving','Black Friday','Saturday','Christmas','WNF'];
            var ai = ORD.indexOf(a), bi = ORD.indexOf(b);
            return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
          });
          if (slots.length > 1) {
            inner += '<div style="margin-top:12px;border-top:1px solid rgba(255,255,255,0.08);padding-top:6px">' + slots.map(function(sl) {
              var x = bySlot[sl];
              return '<div style="padding:7px 0"><div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#A1A9B6;margin-bottom:4px">' + escHtml(sl) + ' · ' + x.Home + ' home, ' + x.Away + ' away</div>' + split(x.Home, x.Away) + '</div>';
            }).join('') + '</div>';
          }
          html += afVariant('wsf', [season], inner + '</div>');
        });

        // ── Best Stretch & Biggest Wins (from all-time data) ───────────────────
        html += section("Best Stretches & Biggest Wins");
        html += '<div style="margin-bottom:16px">';

        // Best 10-game stretch by money
        function bestStretchAll(betsArr) {
          var best = { dollars: -Infinity, label: 'No profitable stretch yet' };
          for (var i = 0; i < betsArr.length; i++) {
            for (var j = i+1; j <= Math.min(i+10, betsArr.length); j++) {
              var w = betsArr.slice(i,j);
              var wins = w.filter(function(b){return b.correct==="Yes";}).length;
              var u = w.reduce(function(a,b){return a+b.netUnits;},0);
              var d = w.reduce(function(a,b){return a+b.netDollars;},0);
              if (d > best.dollars) {
                var a = w[0], z = w[w.length - 1];
                var span = a.year === z.year
                  ? (a.week === z.week ? wkLabel(a.year, a.week) : a.year + ' ' + wkName(a.week) + '–' + (isPlayoffWeek(z.week) ? wkName(z.week) : z.week))
                  : wkLabel(a.year, a.week) + ' to ' + wkLabel(z.year, z.week);
                best = { wins:wins, total:w.length, units:u, dollars:d,
                  label: '$'+d.toFixed(2)+' (+'+u.toFixed(1)+'u) — '+wins+'/'+w.length+' correct · '+span };
              }
            }
          }
          return best;
        }

        var mStretchAll = bestStretchAll(rows.filter(function(r){return r.picker==="Maria" && (r.correct==="Yes"||r.correct==="No");}));
        var dStretchAll = bestStretchAll(rows.filter(function(r){return r.picker==="Danielle" && (r.correct==="Yes"||r.correct==="No");}));
        if (mStretchAll.dollars > -Infinity) html += legFun("Maria's best 10-game stretch", mStretchAll.label, 'maria');
        if (dStretchAll.dollars > -Infinity) html += legFun("Danielle's best 10-game stretch", dStretchAll.label, 'danielle');

        // Biggest wins all-time
        var mBigWin = null, dBigWin = null;
        rows.filter(function(r){return r.correct==="Yes";}).forEach(function(r) {
          if (r.picker==="Maria" && (!mBigWin || r.netUnits > mBigWin.netUnits)) mBigWin = r;
          if (r.picker==="Danielle" && (!dBigWin || r.netUnits > dBigWin.netUnits)) dBigWin = r;
        });
        if (mBigWin) html += legFun("Maria's biggest win ever", '+'+mBigWin.netUnits+'u ($'+mBigWin.netDollars+') — '+mBigWin.firstScorer+', '+wkLabel(mBigWin.year, mBigWin.week), 'maria');
        if (dBigWin) html += legFun("Danielle's biggest win ever", '+'+dBigWin.netUnits+'u ($'+dBigWin.netDollars+') — '+dBigWin.firstScorer+', '+wkLabel(dBigWin.year, dBigWin.week), 'danielle');

        // Most scored first TD (correctly guessed)
        var csc = {};
        rows.forEach(function(r){ if (r.firstScorer && r.correct==="Yes") csc[r.firstScorer]=(csc[r.firstScorer]||0)+1; });
        var cscArr = Object.keys(csc).map(function(n){return {name:n,count:csc[n]};}).sort(function(a,b){return b.count-a.count;});
        if (cscArr.length > 0) {
          var topC = cscArr[0].count;
          var tied = cscArr.filter(function(s){return s.count===topC;});
          var cVal = topC<=1 ? 'Tied at 1 — '+tied.map(function(s){return s.name;}).join(', ') : tied.map(function(s){return s.name;}).join(', ')+' ('+topC+'x)';
          html += legFun('Most scored first TD (correctly guessed)', cVal, '');
        }

        html += '</div>';

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
        html += '<div style="font-size:12px;color:#A1A9B6;margin-bottom:12px">How often each of them picks each position, next to how often that position actually scores the first touchdown. Defense, special teams and players not on the Rosters tab count as Other.</div>';
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
            return '<div style="display:grid;grid-template-columns:62px 1fr 38px;gap:8px;align-items:center;font-size:11px;padding:2px 0">' +
              '<span style="color:' + c + ';font-weight:700">' + label + '</span>' +
              '<div style="height:7px;border-radius:4px;background:rgba(255,255,255,0.06)"><div style="width:' + Math.round(v * 100) + '%;height:7px;border-radius:4px;background:' + c + '"></div></div>' +
              '<span style="text-align:right;font-weight:700">' + Math.round(v * 100) + '%</span></div>';
          }
          var inner = '<div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:8px 14px">';
          POS_ORDER.forEach(function(q, i) {
            var real = share(R, RN, q), m = share(P.Maria, PN.Maria, q), d = share(P.Danielle, PN.Danielle, q);
            if (!real && !m && !d) return;
            inner += '<div style="padding:9px 0;' + (i ? 'border-top:0.5px solid rgba(255,255,255,0.06)' : '') + '">' +
              '<div style="font-size:13px;font-weight:800;margin-bottom:5px">' + q + '</div>' +
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
            if (!worst || Math.abs(worst.gap) < 0.05) return '<div style="font-size:12px;padding:3px 0"><b style="color:' + (personColor(who)) + '">' + who + '</b> picks pretty much in line with reality.</div>';
            return '<div style="font-size:12px;padding:3px 0"><b style="color:' + (personColor(who)) + '">' + who + '</b> ' +
              (worst.gap > 0 ? 'over-picks' : 'under-picks') + ' ' + worst.q + 's: ' + Math.round(share(P[who], PN[who], worst.q) * 100) + '% of her picks, but they score first ' + Math.round(share(R, RN, worst.q) * 100) + '% of the time.</div>';
          }).join('');
          html += afVariant('pvr', [season], inner + '<div style="margin-top:10px">' + notes + '</div>');
        });

        // ── Weekly Units (chart) ──
        // ── Season Race (moved from Stats) ──
        html += section("Season Race");
        html += '<div class="ch-intro">Running units, game by game, one season at a time (every season together is the All-Time Race on All-Time). Tap a point for the score after that game.</div>';
        var RACE_OPTS = AN_YEARS.map(function(y) { return [y, y]; }); // no "All": that's the All-Time Race
        html += '<div class="af-bars">' + afBar('race', 'season', 'Season', RACE_OPTS, AN_YEARS[0]) + '</div>';
        RACE_OPTS.forEach(function(so) { html += afVariant('race', [so[0]], '<div class="an-showing">' + so[0] + ' season</div><div class="ch-box">' + seasonRaceChart(rows, so[0]) + '</div>'); });

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
            return '<div style="display:grid;grid-template-columns:80px 1fr 80px;gap:8px;align-items:center;padding:8px 0;border-bottom:0.5px solid rgba(255,255,255,0.06)">' +
              '<span style="font-size:11px;color:#9CA3AF">' + wkLabel(wk.year, wk.week) + '</span>' +
              '<div style="display:flex;align-items:center;gap:6px">' +
                '<span style="font-size:12px;color:' + SB_M + ';font-weight:600">M: ' + mW + '/' + (mW + mL) + '</span>' +
                '<span style="color:#4B5563;font-size:10px">·</span>' +
                '<span style="font-size:12px;color:' + SB_D + ';font-weight:600">D: ' + dW + '/' + (dW + dL) + '</span>' +
              '</div>' +
              '<span style="font-size:12px;font-weight:700;color:' + winnerColor + ';text-align:right">' + winnerLabel + '</span>' +
            '</div>';
          });
          html += afVariant('wbw', [season], '<div style="margin-bottom:16px">' +
            (rowsHtml.length ? afList(rowsHtml, 6) : EMPTY('No scored weeks yet.')) + '</div>');
        });

// ── Performance: Win rate by week ─────────────────────────────────────
        html += section("Win Rate by Week");
        html += '<div class="af-bars">' +
          afBar('wrw', 'season', 'Season', SEASON_OPTS, CUR_SEASON) +
          afBar('wrw', 'picker', 'Picker', PICKER_OPTS, 'all') + '</div>';
        html += '<div style="font-size:12px;color:#A1A9B6;margin-bottom:10px">A game counts as a win if any selected pick was right. Newest weeks first.</div>';
        SEASON_OPTS.forEach(function(so) {
          PICKER_OPTS.forEach(function(po) {
            var season = so[0], picker = po[0];
            var weekData = {};
            scored.forEach(function(r) {
              if (!inSeason(r, season) || !byPicker(r, picker)) return;
              var wk = r.year + '_' + r.week;
              var gameKey = r.year + "_" + r.week + "_" + r.homeTeam + "_" + r.awayTeam;
              if (!weekData[wk]) weekData[wk] = { year: r.year, week: r.week, wins: 0, total: 0, games: {} };
              if (!weekData[wk].games[gameKey]) {
                weekData[wk].games[gameKey] = { win: false };
                weekData[wk].total++;
              }
              if (r.correct === "Yes") weekData[wk].games[gameKey].win = true;
            });
            var weeks = Object.keys(weekData).map(function(k) {
              var d = weekData[k];
              d.wins = Object.values(d.games).filter(function(g) { return g.win; }).length;
              d.rate = d.wins / d.total;
              return d;
            }).sort(function(a, b) {
              return a.year !== b.year ? parseInt(b.year) - parseInt(a.year) : b.week - a.week;
            });
            if (!weeks.length) { html += afVariant('wrw', [season, picker], EMPTY('No scored games yet.')); return; }
            var best = weeks[0], worst = weeks[0];
            weeks.forEach(function(d) {
              if (d.rate > best.rate) best = d;
              if (d.rate < worst.rate) worst = d;
            });
            var bars = weeks.map(function(d) {
              var barColor = d.rate > 0.5 ? "#34D399" : d.rate > 0.25 ? "#FBBF24" : "#F87171";
              return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' +
                '<span style="font-size:11px;color:#9CA3AF;width:72px;flex-shrink:0">' + wkLabel(d.year, d.week) + '</span>' +
                '<div style="flex:1;background:rgba(255,255,255,0.12);border-radius:4px;height:10px">' +
                  '<div style="width:' + Math.round(d.rate * 100) + '%;background:' + barColor + ';height:10px;border-radius:4px"></div>' +
                '</div>' +
                '<span style="font-size:11px;color:#A1A9B6;width:62px;text-align:right;flex-shrink:0">' + pct(d.wins, d.total) + ' (' + d.wins + '/' + d.total + ')</span>' +
              '</div>';
            });
            var inner = afList(bars, 8, '<div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:16px;margin-bottom:12px">', '</div>');
            inner += statRow("Best week", wkLabel(best.year, best.week) + " — " + pct(best.wins, best.total));
            inner += statRow("Worst week", wkLabel(worst.year, worst.week) + " — " + pct(worst.wins, worst.total));
            html += afVariant('wrw', [season, picker], inner);
          });
        });

        // ── Month by Month ────────────────────────────────────────────────────
        // Dates come from the week number: Week 1 starts the Thursday after Labor Day.
        function gameDate(year, week, slot) {
          var y = parseInt(year, 10), sep1 = new Date(y, 8, 1);
          var labor = new Date(y, 8, 1 + ((8 - sep1.getDay()) % 7));
          if (/christmas/i.test(slot)) return new Date(y, 11, 25);
          var off = /wnf|wed/i.test(slot) ? -1 : /black friday|fri|fnf/i.test(slot) ? 1 : /sat/i.test(slot) ? 2 : /mnf|mon/i.test(slot) ? 4 : /tnf|thanksgiving|thu/i.test(slot) ? 0 : 3;
          return new Date(y, 8, labor.getDate() + 3 + (week - 1) * 7 + off);
        }
        var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        html += section("Month by Month");
        html += '<div class="af-bars">' + afBar('mbm', 'season', 'Season', SEASON_OPTS, CUR_SEASON) + '</div>';
        SEASON_OPTS.forEach(function(so) {
          var season = so[0], M = {};
          scored.forEach(function(r) {
            if (!inSeason(r, season) || (r.picker !== 'Maria' && r.picker !== 'Danielle')) return;
            var dt = gameDate(r.year, r.week, r.slot), mi = dt.getMonth();
            var order = mi >= 6 ? mi - 8 : mi + 4; // Sep=0 … Feb=5
            var x = M[mi] || (M[mi] = { order: order, Maria: { w: 0, n: 0, u: 0 }, Danielle: { w: 0, n: 0, u: 0 } });
            var p = x[r.picker];
            p.u += r.netUnits;
            if (isNotOffered(r)) return; // not offered: no win or loss
            p.n++; if (r.correct === 'Yes') p.w++;
          });
          var keys = Object.keys(M).sort(function(a, b) { return M[a].order - M[b].order; });
          if (!keys.length) { html += afVariant('mbm', [season], EMPTY('No scored games yet.')); return; }
          function cell(p, c) {
            if (!p.n) return '<span style="text-align:center;color:#6B7280">—</span>';
            var u = Math.round(p.u * 10) / 10;
            return '<span style="text-align:center"><b style="color:' + c + ';font-size:14px">' + p.w + '/' + p.n + '</b> <span style="color:#9CA3AF;font-size:11px">' + Math.round(p.w / p.n * 100) + '%</span>' +
              '<div style="font-size:11px;font-weight:700;color:' + (u > 0 ? '#34D399' : u < 0 ? '#F87171' : '#9CA3AF') + '">' + (u > 0 ? '+' : '') + u + 'u</div></span>';
          }
          var inner = '<div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:8px 12px">' +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:8px 0 4px;border-bottom:1px solid rgba(255,255,255,0.10)">' +
            '<span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Month</span>' +
            '<span style="font-size:11px;color:' + SB_M + ';text-transform:uppercase;letter-spacing:0.05em;font-weight:600;text-align:center">Maria</span>' +
            '<span style="font-size:11px;color:' + SB_D + ';text-transform:uppercase;letter-spacing:0.05em;font-weight:600;text-align:center">Danielle</span></div>';
          keys.forEach(function(k, i) {
            inner += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:10px 0;align-items:center;' + (i < keys.length - 1 ? 'border-bottom:0.5px solid rgba(255,255,255,0.06)' : '') + '">' +
              '<span style="font-size:13px;font-weight:600;color:#D1D5DB">' + MONTHS_LONG[k] + '</span>' + cell(M[k].Maria, SB_M) + cell(M[k].Danielle, SB_D) + '</div>';
          });
          inner += '</div>';
          // Best month for each
          var notes = ['Maria', 'Danielle'].map(function(who) {
            var best = keys.filter(function(k) { return M[k][who].n >= 5; }).sort(function(a, b) { return M[b][who].w / M[b][who].n - M[a][who].w / M[a][who].n; })[0];
            if (!best) return '';
            return '<span><b style="color:' + (personColor(who)) + '">' + who + '</b> is best in ' + MONTHS_LONG[best] + ' (' + Math.round(M[best][who].w / M[best][who].n * 100) + '%)</span>';
          }).filter(Boolean).join(' · ');
          html += afVariant('mbm', [season], inner + (notes ? '<div style="font-size:12px;color:#A1A9B6;margin-top:10px">' + notes + '. Months are worked out from the week number.</div>' : ''));
        });

        // ── Odds vs Hits (chart) ──
        html += section("Odds vs Hits");
        html += '<div class="ch-intro">Where the hits actually come from.</div>';
        html += '<div class="af-bars">' + afBar('oddsx', 'season', 'Season', SEASON_OPTS, CUR_SEASON) + '</div>';
        SEASON_OPTS.forEach(function(so) { html += afVariant('oddsx', [so[0]], '<div class="ch-box">' + oddsStripChart(rows, so[0]) + '</div>'); });

        // (Season Comparison moved to All-Time's 📅 By Season table, history.js)

        // ── NFL Team Heat Map ────────────────────────────────────────────────
        html += section("NFL Team Heat Map");
        html += '<div style="font-size:12px;color:#A1A9B6;margin-bottom:12px">Every team they pick from: how often, how often it paid, and the units won or lost. A hit counts for the scorer\'s team; a miss costs each picked team 1 unit.</div>';
        html += '<div class="af-bars">' +
          afBar('heat', 'season', 'Season', SEASON_OPTS, CUR_SEASON) +
          afBar('heat', 'picker', 'Picker', PICKER_OPTS, 'all') + '</div>';
        var thStyle = 'padding:6px 8px;color:#9CA3AF;font-size:10px;text-transform:uppercase;letter-spacing:0.05em';
        var heatHead = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">' +
          '<tr style="border-bottom:1.5px solid rgba(255,255,255,0.16)"><th style="text-align:left;' + thStyle + '">Team</th><th style="text-align:center;' + thStyle + '">Picked</th><th style="text-align:center;' + thStyle + '">Paid</th><th style="text-align:center;' + thStyle + '">Rate</th><th style="text-align:right;' + thStyle + '">Units</th></tr>';
        SEASON_OPTS.forEach(function(so) {
          PICKER_OPTS.forEach(function(po) {
            var season = so[0], picker = po[0];
            var teamPicks = {}, teamScored = {};
            rows.forEach(function(r) {
              if (!inSeason(r, season) || !byPicker(r, picker)) return;
              if (r.homePick) teamPicks[r.homeTeam] = (teamPicks[r.homeTeam] || 0) + 1;
              if (r.awayPick) teamPicks[r.awayTeam] = (teamPicks[r.awayTeam] || 0) + 1;
              if (r.firstScorer && r.homeTeam && r.correct === 'Yes') {
                var scorerTeam = r.homePick && r.firstScorer === r.homePick ? r.homeTeam :
                                 r.awayPick && r.firstScorer === r.awayPick ? r.awayTeam : null;
                if (scorerTeam) teamScored[scorerTeam] = (teamScored[scorerTeam] || 0) + 1;
              }
            });
            var TU = teamUnits(rows, season, picker);
            var allTeams = Object.keys(teamPicks).filter(function(t) { return t && t !== 'undefined'; });
            allTeams.sort(function(a, b) {
              return (teamPicks[b] || 0) - (teamPicks[a] || 0) || (teamScored[b] || 0) - (teamScored[a] || 0);
            });
            if (!allTeams.length) { html += afVariant('heat', [season, picker], EMPTY('No picks yet.')); return; }
            var trs = allTeams.map(function(team, i) {
              var picks = teamPicks[team] || 0;
              var sc = teamScored[team] || 0;
              var rate = picks > 0 ? sc / picks : 0;
              var tc = TEAM_COLORS[resolveTeam(team)];
              var bgColor = tc ? 'linear-gradient(90deg,' + hexA(tc.bg === '#FFFFFF' ? tc.primary : tc.bg, 0.35) + ',rgba(255,255,255,0.02) 70%)' : 'transparent';
              var rateColor = rate >= 0.3 ? '#34D399' : rate >= 0.15 ? '#FBBF24' : '#F87171';
              return '<tr style="background:' + bgColor + ';border-bottom:0.5px solid rgba(255,255,255,0.06)">' +
                '<td style="padding:7px 8px;font-weight:600;color:' + (tc ? tc.dark : '#F3F4F6') + '">' + teamName2(team) + '</td>' +
                '<td style="text-align:center;padding:7px 8px">' + picks + '</td>' +
                '<td style="text-align:center;padding:7px 8px">' + sc + '</td>' +
                '<td style="padding:7px 8px"><div style="display:flex;align-items:center;gap:6px">' +
                  '<div class="hm-bar" style="flex:1;background:rgba(255,255,255,0.12);border-radius:3px;height:8px"><div style="width:' + Math.round(rate * 100) + '%;background:' + rateColor + ';height:8px;border-radius:3px"></div></div>' +
                  '<span style="font-size:11px;color:' + rateColor + ';font-weight:600;min-width:30px">' + Math.round(rate * 100) + '%</span>' +
                '</div></td>' +
                '<td style="text-align:right;padding:7px 8px;font-weight:700;white-space:nowrap;color:' + ((TU[team] || 0) > 0 ? '#34D399' : (TU[team] || 0) < 0 ? '#F87171' : '#9CA3AF') + '">' + fmtU(TU[team] || 0) + '</td>' +
              '</tr>';
            });
            // Best and worst team to bet on (at least 3 picks)
            var ranked = allTeams.filter(function(t) { return (teamPicks[t] || 0) >= 3 && t in TU; }).sort(function(a, b) { return TU[b] - TU[a]; });
            var call = '';
            if (ranked.length >= 2) {
              var best = ranked[0], worst = ranked[ranked.length - 1];
              call = '<div class="tr-call">' +
                (TU[best] > 0 ? '<div>💸 Best team to bet on: ' + coloredText('<b>' + resolveTeam(best).split(' ').pop() + '</b>', best) + ' ' + fmtU(TU[best]) + '</div>' : '') +
                (TU[worst] < 0 ? '<div>🔥 The team that keeps burning ' + (picker === 'all' ? 'them' : picker) + ': ' + coloredText('<b>' + resolveTeam(worst).split(' ').pop() + '</b>', worst) + ' ' + fmtU(TU[worst]) + '</div>' : '') + '</div>';
            }
            html += afVariant('heat', [season, picker], call + afList(trs, 10, heatHead, '</table></div>'));
          });
        });
        html += '<div style="font-size:11px;color:#9CA3AF;margin-top:8px">Rate = times a pick from that team scored first ÷ times they picked from that team.</div>';

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
        html += '<div style="font-size:12px;color:#A1A9B6;margin-bottom:12px">Every player who has scored a first TD. <b>Picked</b> = how many of those TDs someone actually had them picked for that game.</div>';
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
          if (pickedBy.has('Maria') && pickedBy.has('Danielle')) return '<span style="font-size:10px;font-weight:600;color:#C4B5FD;background:rgba(167,139,250,0.18);border-radius:4px;padding:2px 6px">Both</span>';
          if (pickedBy.has('Maria')) return '<span style="font-size:10px;font-weight:600;color:' + SB_M + ';background:' + hexA(SB_M, 0.15) + ';border-radius:4px;padding:2px 6px">Maria</span>';
          if (pickedBy.has('Danielle')) return '<span style="font-size:10px;font-weight:600;color:' + SB_D + ';background:' + hexA(SB_D, 0.16) + ';border-radius:4px;padding:2px 6px">Danielle</span>';
          return '<span style="font-size:10px;color:#9CA3AF">—</span>';
        }

        var tdHead = '<div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:8px 12px">' +
          '<div style="display:grid;grid-template-columns:1fr 90px 80px;gap:8px;padding:8px 0 4px;border-bottom:1px solid rgba(255,255,255,0.10)">' +
          '<span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Player</span>' +
          '<span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;text-align:center">TDs (picked)</span>' +
          '<span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;text-align:center">Picked By</span>' +
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
              var tdDisplay = '<span style="font-size:14px;font-weight:700;color:#D1D5DB">' + data.total + '</span>' +
                (data.picked > 0 && data.picked < data.total ? '<span style="font-size:11px;color:#9CA3AF;margin-left:3px">(' + data.picked + ' picked)</span>' : '');
              return '<div style="display:grid;grid-template-columns:1fr 90px 80px;gap:8px;padding:9px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);align-items:center">' +
                '<span style="font-size:13px;font-weight:600;color:#F3F4F6">' + entry[0] + '</span>' +
                '<span style="text-align:center">' + tdDisplay + '</span>' +
                '<span style="text-align:center">' + tdTag(data.pickedBy) + '</span>' +
              '</div>';
            });
            html += afVariant('td', [season, who], afList(divs, 10, tdHead, '</div>'));
          });
        });


        // ── Bad Beats: every TD from ESPN for each tracked game ──────────────
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
            out += '<div style="background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.3);border-radius:10px;padding:14px 16px;margin:8px 0 12px">' +
              '<div style="font-size:11px;font-weight:700;color:#FCA5A5;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">💔 Most Painful</div>' +
              '<div style="font-size:13px;color:#D1D5DB;line-height:1.6">' + line(worst) + '</div></div>';
          }
          beats.sort(function(a, b) { return a.year !== b.year ? parseInt(b.year) - parseInt(a.year) : b.week - a.week; });
          if (beats.length) {
            out += '<div class="af-bars">' + afBar('bb', 'picker', 'Show', PICKER_OPTS, 'all') + '</div>';
            PICKER_OPTS.forEach(function(po) {
              var list = beats.filter(function(b) { return po[0] === 'all' || b.who === po[0]; });
              out += afVariant('bb', [po[0]], list.length ? afList(list.map(function(b) {
                return '<div style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:13px;color:#D1D5DB;line-height:1.5">' + line(b) + '</div>';
              }), 5) : EMPTY('No bad beats for ' + po[1] + '.'));
            });
          } else {
            out += EMPTY('No bad beats yet. Every picked player who scored was first.');
          }
          if (failed) out += '<div style="font-size:11px;color:#A1A9B6;margin-top:6px">' + failed + ' game' + (failed > 1 ? 's' : '') + ' couldn\'t be matched on ESPN and were skipped.</div>';
          box.innerHTML = out;
          if (AF.bb) afApply('bb');
        }

        var analyticsEl = document.getElementById("analytics-content");
        analyticsEl.innerHTML = html + '</div>';
        afInit(analyticsEl);
        anOrganize(analyticsEl, SEASON_OPTS);
        loadBadBeats();
      } catch(e) {
        console.error(e);
        document.getElementById("analytics-content").innerHTML = '<div class="loading">Error loading analytics.</div>';
      }
    }
