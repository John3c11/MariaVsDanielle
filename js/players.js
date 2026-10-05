// Players: roster info, injuries, tap-a-name player cards, scouting lines, and the Rosters tab.
// Part of the MariaVsDanielle site. All js/ files share one global scope and load in the order listed in index.html.

    // ── Player cards: tap any player name for their history ──────────────────
    var ROSTER_INFO = {};      // playerKey -> { team, pos } from the Rosters tab
    var INJURED = {};          // playerKey -> note, from the optional "Injured" tab
    function outBadge(name) {
      var k = playerKey(name);
      if (!(k in INJURED)) return '';
      return '<span class="out-badge" title="' + (INJURED[k] || 'Injured') + '">🚑 OUT' + (INJURED[k] ? ' · ' + INJURED[k] : '') + '</span>';
    }
    function outRow(name) { return playerKey(name) in INJURED ? ' is-out' : ''; }
    var PLAYER_DB = null;      // playerKey -> stats, built from every season's sheet
    var PLAYER_DB_LOADING = null;

    function playerKey(n) {
      return (n || '').toString().toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '').replace(/[^a-z0-9]/g, '');
    }

    function loadPlayerDB() {
      if (PLAYER_DB_LOADING) return PLAYER_DB_LOADING;
      PLAYER_DB_LOADING = Promise.all(SEASONS.map(function(season) {
        var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + season.sheetId +
          '/values/' + encodeURIComponent(season.tab + '!A1:Q400') + '?key=' + API_KEY;
        return fetch(url).then(function(r) { return r.json(); }).then(function(d) {
          return readBets(d.values).map(function(b, i) {
            return {
              idx: i, year: season.year, game: b.game, week: b.weekN,
              picker: b.picker, home: resolveTeam(b.home), away: resolveTeam(b.away),
              homePick: b.homePick, awayPick: b.awayPick,
              homeOdds: b.homeOdds, awayOdds: b.awayOdds,
              scorer: b.scorer, side: b.side.toLowerCase(), netUnits: b.units,
            };
          }).filter(function(r) { return r.picker === 'Maria' || r.picker === 'Danielle'; });
        }).catch(function() { return []; });
      })).then(function(lists) {
        var rows = [].concat.apply([], lists).sort(function(a, b) {
          return a.year !== b.year ? parseInt(a.year) - parseInt(b.year) : a.idx - b.idx;
        });
        var db = {};
        function P(name) {
          var k = playerKey(name);
          if (!k) return null;
          return db[k] || (db[k] = { name: name.trim(), picks: { Maria: 0, Danielle: 0 }, hits: { Maria: 0, Danielle: 0 },
            units: { Maria: 0, Danielle: 0 }, tds: {}, games: {}, gameOrder: [], team: '', lastOdds: null });
        }
        function G(p, r) {
          var gk = r.year + '_' + r.week + '_' + r.game;
          if (!p.games[gk]) { p.games[gk] = { year: r.year, week: r.week, home: r.home, away: r.away, team: '', by: [], scorer: '' }; p.gameOrder.push(gk); }
          var g = p.games[gk];
          if (r.scorer) g.scorer = r.scorer;
          return g;
        }
        rows.forEach(function(r) {
          [[r.homePick, r.home, r.homeOdds], [r.awayPick, r.away, r.awayOdds]].forEach(function(x) {
            if (!x[0]) return;
            var p = P(x[0]);
            p.picks[r.picker]++;
            if (r.scorer && playerKey(r.scorer) === playerKey(x[0])) { p.hits[r.picker]++; p.units[r.picker] += r.netUnits; }
            p.team = x[1];
            if (!isNaN(parseFloat(x[2]))) p.lastOdds = { odds: x[2], year: r.year, week: r.week };
            var g = G(p, r);
            g.team = x[1];
            if (g.by.indexOf(r.picker) < 0) g.by.push(r.picker);
          });
          if (r.scorer) {
            var p = P(r.scorer);
            p.tds[r.year + '_' + r.week + '_' + r.game] = r.year;
            var g = G(p, r);
            // "Which Side Scored" tells us the scorer's team even if nobody picked him
            var sideTeam = r.side === 'home' ? r.home : r.side === 'away' ? r.away : '';
            if (sideTeam) { p.team = sideTeam; if (!g.team) g.team = sideTeam; }
          }
        });
        Object.keys(db).forEach(function(k) {
          var p = db[k], last = p.games[p.gameOrder[p.gameOrder.length - 1]];
          p.last = last ? { year: last.year, week: last.week } : null;
          // Team stints in order, e.g. Packers 2025 Wk 1–18, then Patriots 2026 Wk 1–
          p.stints = [];
          p.gameOrder.forEach(function(gk) {
            var g = p.games[gk];
            if (!g.team) return;
            var s = p.stints[p.stints.length - 1];
            if (s && s.team === g.team && s.year === g.year) s.to = g.week;
            else p.stints.push({ team: g.team, year: g.year, from: g.week, to: g.week });
          });
        });
        PLAYER_DB = db;
        schedulePlayerTagging();
        return db;
      });
      return PLAYER_DB_LOADING;
    }

    // "Buffalo Bills", "Bills" or another known spelling -> "Buffalo Bills" (exact names only, no guessing)
    function isTeamText(t) {
      var r = resolveTeam(t);
      if (!TEAM_COLORS[r]) return '';
      return t === r || t === r.split(' ').pop() || TEAM_ALIASES[t] === r ? r : '';
    }

    function isKnownPlayer(text) {
      var k = playerKey(text);
      return !!k && ((PLAYER_DB && PLAYER_DB[k]) || ROSTER_INFO[k] || (NFL[k] && SKILL_POS[NFL[k].pos]));
    }

    // Mark every on-screen player name as tappable
    var PL_TAG_PENDING = false;
    function schedulePlayerTagging() {
      if (PL_TAG_PENDING) return;
      PL_TAG_PENDING = true;
      requestAnimationFrame(function() {
        PL_TAG_PENDING = false;
        if (!PLAYER_DB && !Object.keys(ROSTER_INFO).length) return;
        document.querySelectorAll('.wrap span:not(.pl-link), .wrap div:not(.pl-link), .wrap b:not(.pl-link), .wrap td:not(.pl-link)').forEach(function(el) {
          if (el.children.length) return;
          var t = el.textContent.trim();
          if (t.length < 4 || t.length > 40) return;
          // Nothing on the Log In tab opens a card: picks are made without seeing stats
          if (el.closest('.pick-chip, button, input, .pc-card, .tabs-nav, .pin-input, #tab-submit')) return;
          if (isKnownPlayer(t)) { el.classList.add('pl-link'); el.setAttribute('data-pname', t); return; }
          // Team names open a team card (a team pill with a logo is tagged as a whole)
          var team = isTeamText(t);
          if (team && !el.closest('.tm-link, .af-bar, .filter-btn')) {
            var target = el.closest('.tpill') || el;
            target.classList.add('tm-link'); target.setAttribute('data-team', team);
          }
        });
      });
    }

    // ── NFL Players tab: every player's real current team (ESPN, refreshed daily) ──
    // The Rosters tab says who's OFFERED. This says who plays where.
    var NFL = {}, NFL_READY = null;
    var SKILL_POS = { QB: 1, RB: 1, WR: 1, TE: 1, FB: 1 };
    function loadNFL() {
      if (NFL_READY) return NFL_READY;
      NFL_READY = fetchSheet('NFL Players', 'A1:F4000').then(function(rows) {
        rows.slice(1).forEach(function(r) {
          var n = (r[0] || '').trim(); if (!n) return;
          var k = playerKey(n), p = { name: n, team: resolveTeam(r[1]), pos: (r[2] || '').trim(), id: (r[4] || '').trim(), inj: (r[5] || '').trim() };
          // Same name on two teams (e.g. two Josh Allens): keep the offensive player
          if (NFL[k] && SKILL_POS[NFL[k].pos] && !SKILL_POS[p.pos]) return;
          NFL[k] = p;
        });
        return NFL;
      }).catch(function() { return NFL; });
      return NFL_READY;
    }
    function nflOf(name) { return NFL[playerKey(name)] || null; }
    function isOffered(name) { var r = ROSTER_INFO[playerKey(name)]; return !!(r && r.team && !r.hidden); }
    function nowTeam(name) {
      var n = nflOf(name); if (n && n.team) return n.team;
      var r = ROSTER_INFO[playerKey(name)]; return r && r.team ? resolveTeam(r.team) : '';
    }

    // ── Player headshots from ESPN team rosters (saved on the phone for a week) ──
    var HS = { mem: {} };
    function hsTeamMap(team) {
      var abbr = TEAM_ABBR[resolveTeam(team)];
      if (!abbr) return Promise.resolve({});
      if (HS.mem[abbr]) return HS.mem[abbr];
      var key = 'mvd-hs-' + abbr, cached = null;
      try { cached = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
      if (cached && Date.now() - cached.at < 7 * 864e5) return (HS.mem[abbr] = Promise.resolve(cached.map));
      HS.mem[abbr] = espnGet('teams/' + abbr + '/roster').then(function(d) {
        var map = {};
        (function walk(o) {
          if (!o || typeof o !== 'object') return;
          if (Array.isArray(o)) { o.forEach(walk); return; }
          var nm = o.fullName || o.displayName;
          if (nm && (o.headshot || o.position) && o.id) {
            var url = o.headshot && o.headshot.href ? o.headshot.href : 'https://a.espncdn.com/i/headshots/nfl/players/full/' + o.id + '.png';
            map[playerKey(nm)] = url.replace('https://a.espncdn.com/i/', 'https://a.espncdn.com/combiner/i?img=/i/') + (url.indexOf('a.espncdn.com/i/') >= 0 ? '&w=150&h=109&scale=crop' : '');
          }
          Object.keys(o).forEach(function(k) { if (k !== 'headshot' && k !== 'links' && k !== 'logos') walk(o[k]); });
        })(d);
        try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), map: map })); } catch (e) {}
        return map;
      }).catch(function() { delete HS.mem[abbr]; return {}; });
      return HS.mem[abbr];
    }
    // A round headshot slot; fillHeadshots() swaps in the photo (team logo if ESPN has none)
    function headshot(name, team, size) {
      var t = resolveTeam(team || (ROSTER_INFO[playerKey(name)] || {}).team || '');
      var s = size || 28;
      return '<span class="hs" data-hs-name="' + escHtml(name) + '" data-hs-team="' + escHtml(t) + '" style="width:' + s + 'px;height:' + s + 'px"></span>';
    }
    function fillHeadshots(root) {
      (root || document).querySelectorAll('.hs[data-hs-name]:not([data-hs-done])').forEach(function(el) {
        el.setAttribute('data-hs-done', '1');
        var name = el.getAttribute('data-hs-name'), team = el.getAttribute('data-hs-team');
        if (!team) { el.remove(); return; }
        // Fastest: the ESPN id from the NFL Players tab
        var nf = nflOf(name);
        if (nf && nf.id) {
          var im = new Image();
          im.alt = ''; im.onload = function() { el.innerHTML = ''; el.appendChild(im); el.classList.add('hs-on'); };
          im.onerror = function() { el.innerHTML = teamLogo(nf.team || team, 'hs-logo'); };
          im.src = 'https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/' + nf.id + '.png&w=150&h=109&scale=crop';
          return;
        }
        // Players change teams: look on his current roster first, then the team from that game
        var now = nowTeam(name);
        var tries = [now, team].filter(function(t, i, a) { return t && a.indexOf(t) === i; });
        Promise.all(tries.map(hsTeamMap)).then(function(maps) {
          var url = null;
          maps.forEach(function(m) { if (!url && m[playerKey(name)]) url = m[playerKey(name)]; });
          if (url) {
            var img = new Image();
            img.alt = ''; img.onload = function() { el.innerHTML = ''; el.appendChild(img); el.classList.add('hs-on'); };
            img.onerror = function() { el.innerHTML = teamLogo(team, 'hs-logo'); };
            img.src = url;
          } else el.innerHTML = teamLogo(team, 'hs-logo');
        });
      });
    }

    // ── 🔍 Player search (Rosters tab) ───────────────────────────────────────
    function setupPlayerSearch() {
      var input = document.getElementById('psearch'), box = document.getElementById('psearch-res');
      if (!input || input.getAttribute('data-ready')) return;
      input.setAttribute('data-ready', '1');
      var results = [];
      function everyone() {
        var out = {};
        Object.keys(NFL).forEach(function(k) { var n = NFL[k]; if (SKILL_POS[n.pos]) out[k] = { name: n.name, team: n.team, pos: n.pos }; });
        Object.keys(ROSTER_INFO).forEach(function(k) { var r = ROSTER_INFO[k]; if (r && r.name && !out[k]) out[k] = { name: r.name, team: resolveTeam(r.team), pos: r.pos || '' }; });
        Object.keys(PLAYER_DB || {}).forEach(function(k) { var p = PLAYER_DB[k]; if (!out[k] && p && p.name) out[k] = { name: p.name, team: resolveTeam(p.team), pos: '', former: true }; });
        Object.keys(out).forEach(function(k) { out[k].offered = isOffered(out[k].name); });
        return out;
      }
      function run() {
        var q = input.value.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        if (q.length < 2) { box.innerHTML = ''; results = []; return; }
        var all = everyone(), words = q.split(/\s+/);
        results = Object.keys(all).map(function(k) {
          var p = all[k], n = p.name.toLowerCase().replace(/[^a-z0-9 ]/g, ''), parts = n.split(' ');
          if (!words.every(function(w) { return n.indexOf(w) >= 0; })) return null;
          var score = n.indexOf(q) === 0 ? 0 : parts.some(function(pt) { return pt.indexOf(q) === 0; }) ? 1 : 2;
          return { p: p, k: k, s: score };
        }).filter(Boolean).sort(function(a, b) { return a.s - b.s || a.p.name.localeCompare(b.p.name); }).slice(0, 8);
        if (!results.length) { box.innerHTML = '<div class="psearch-none">No player called "' + escHtml(input.value) + '"</div>'; return; }
        box.innerHTML = results.map(function(r, i) {
          var p = r.p, db = (PLAYER_DB || {})[r.k], tds = db ? Object.keys(db.tds).length : 0, picks = db ? db.picks.Maria + db.picks.Danielle : 0;
          var sub = [p.pos ? p.pos.replace(/\d+/g, '') : '', p.team ? p.team.split(' ').pop() + (p.former ? ' (last seen)' : '') : '', p.offered ? '<span style="color:#34D399">offered</span>' : 'not offered'].filter(Boolean).join(' · ');
          var stat = [tds ? '🏈 ' + tds + ' first TD' + (tds > 1 ? 's' : '') : '', picks ? 'picked ' + picks + 'x' : ''].filter(Boolean).join(' · ');
          return '<button class="psearch-item" data-ps="' + i + '">' + (p.team ? headshot(p.name, p.team, 34) : '') +
            '<span class="psearch-txt"><b>' + escHtml(p.name) + '</b><small>' + sub + (stat ? ' · ' + stat : '') + '</small></span></button>';
        }).join('');
        fillHeadshots(box);
      }
      input.addEventListener('input', run);
      input.addEventListener('focus', function() { Promise.all([loadPlayerDB(), loadNFL()]).then(run); });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && results[0]) { e.preventDefault(); openPlayerCard(results[0].p.name); input.blur(); }
        if (e.key === 'Escape') { input.value = ''; run(); }
      });
      box.addEventListener('click', function(e) {
        var b = e.target.closest('[data-ps]');
        if (b) openPlayerCard(results[+b.getAttribute('data-ps')].p.name);
      });
    }

    // ctx (optional): { year, week } of the game the name was tapped in
    function openPlayerCard(name, ctx) {
      Promise.all([loadPlayerDB(), loadNFL()]).then(function(res) {
        var db = res[0];
        var k = playerKey(name);
        var p = db[k] || { name: name, picks: { Maria: 0, Danielle: 0 }, hits: { Maria: 0, Danielle: 0 }, units: { Maria: 0, Danielle: 0 }, tds: {}, games: {}, gameOrder: [], team: '', lastOdds: null, stints: [] };
        var ri = ROSTER_INFO[k] || {};
        var onRoster = isOffered(name);
        var nf = nflOf(name);
        var stints = p.stints || [];
        var lastStint = stints[stints.length - 1];
        var team = (nf && nf.team) || (ri.team ? resolveTeam(ri.team) : '') || resolveTeam(p.team);
        var inNFL = !!(nf && nf.team) || onRoster;
        var posTxt = onRoster && ri.pos ? ri.pos : (nf ? nf.pos : '');
        function abbr(t) { return (TEAM_ABBR[resolveTeam(t)] || t.split(' ').pop()).toUpperCase(); }
        function nick(t) { return resolveTeam(t).split(' ').pop(); }
        // Team history, newest first: "2026 Patriots · 2025 Packers"
        var hist = stints.slice().reverse().map(function(s) {
          var same = stints.filter(function(x) { return x.year === s.year; }).length > 1;
          return '<span style="color:' + ((TEAM_COLORS[s.team] || {}).dark || '#F3F4F6') + '">' + s.year + ' ' + nick(s.team) + (same ? ' Wk ' + s.from + '–' + s.to : '') + '</span>';
        });
        var moved = stints.some(function(s) { return s.team !== team; });
        if (team && lastStint && lastStint.team !== team) hist.unshift('<span style="color:' + ((TEAM_COLORS[team] || {}).dark || '#F3F4F6') + '">Now ' + nick(team) + '</span>');
        // The game it was opened from, if he was on a different team then
        var ctxLine = '';
        if (ctx && ctx.year && ctx.week) {
          var cg = null;
          p.gameOrder.forEach(function(gk) { var g = p.games[gk]; if (String(g.year) === String(ctx.year) && +g.week === +ctx.week && g.team) cg = g; });
          if (cg && cg.team !== team) ctxLine = '<div class="pc-ctx">In that game: ' + teamLogo(cg.team) + '<b>' + nick(cg.team) + '</b> · ' + cg.year + ' Week ' + cg.week + '</div>';
        }
        var tc = TEAM_COLORS[team] || { bg: '#1F2937', text: '#FFFFFF', primary: '#1F2937', dark: '#F3F4F6' };
        var headBg = tc.bg === '#FFFFFF' ? tc.primary : tc.bg;

        // First TDs by season
        var tdYears = {};
        Object.keys(p.tds).forEach(function(g) { var y = p.tds[g]; tdYears[y] = (tdYears[y] || 0) + 1; });
        var tdTotal = Object.keys(p.tds).length;
        var tdSub = Object.keys(tdYears).sort().reverse().map(function(y) { return y + ': ' + tdYears[y]; }).join(' · ') || 'None yet';

        // Hit rate in games someone picked him (scored games only)
        var pickedGames = p.gameOrder.map(function(g) { return p.games[g]; }).filter(function(g) { return g.by.length && g.scorer; });
        var hitGames = pickedGames.filter(function(g) { return playerKey(g.scorer) === k; }).length;

        function person(n) {
          var c = personColor(n);
          var u = p.units[n];
          return '<div class="pc-person"><span style="color:' + c + ';font-weight:700">' + n + '</span>' +
            '<span style="color:rgba(255,255,255,0.85)">' + (p.picks[n] ? 'picked ' + p.picks[n] + 'x · hit ' + p.hits[n] + 'x' +
              (p.hits[n] ? ' · <span style="color:#34D399;font-weight:700">+' + u.toFixed(1) + 'u</span>' : '') : '<span style="color:rgba(255,255,255,0.45)">never picked</span>') +
            '</span></div>';
        }

        var games = p.gameOrder.slice().reverse().slice(0, 6).map(function(gk) {
          var g = p.games[gk];
          var myTeam = g.team || (team === g.home || team === g.away ? team : '');
          var opp = myTeam === g.home ? g.away : myTeam === g.away ? g.home : '';
          var oppTc = TEAM_COLORS[opp];
          var myTc = TEAM_COLORS[myTeam];
          var vs = opp ? '<span style="color:' + (myTc ? myTc.dark : '#F3F4F6') + ';font-weight:700">' + abbr(myTeam) + '</span> vs <span style="color:' + (oppTc ? oppTc.dark : '#F3F4F6') + ';font-weight:600">' + abbr(opp) + '</span>'
                       : (abbr(g.home) + ' vs ' + abbr(g.away));
          var chips = g.by.map(function(n) {
            var c = personColor(n);
            return '<span class="pc-chip" style="color:' + c + ';background:' + hexA(c, 0.15) + '">' + n.charAt(0) + '</span>';
          }).join('');
          var res = !g.scorer ? '<span style="color:rgba(255,255,255,0.45)">Pending</span>'
                  : playerKey(g.scorer) === k ? '<span style="color:#34D399;font-weight:700">🏈 Scored first</span>'
                  : '<span style="color:rgba(255,255,255,0.45)">—</span>';
          return '<div class="pc-game"><span style="color:rgba(255,255,255,0.55)">' + g.year + ' Wk ' + g.week + '</span>' +
            '<span>' + vs + ' ' + chips + '</span><span>' + res + '</span></div>';
        }).join('');

        var html = '<div class="pc-backdrop" id="pc-backdrop"><div class="pc-card" role="dialog" aria-label="' + p.name + '">' +
          '<div class="pc-head" style="background:linear-gradient(150deg,' + hexA(headBg, 0.95) + ' 0%,' + hexA(headBg, 0.35) + ' 70%, rgba(17,19,24,1) 100%)">' +
            '<button class="pc-close" id="pc-close" aria-label="Close">×</button>' +
            (team ? '<div class="pc-hs">' + headshot(p.name, team, 76) + '</div>' : '') +
            (team ? '<span class="pc-now">' + (inNFL ? 'Now' : 'Last seen') + '</span>' + teamPill((posTxt ? posTxt + ' · ' : '') + team + (inNFL || !lastStint ? '' : ' (' + lastStint.year + ')'), team) : '') +
            '<div class="pc-tags">' + (onRoster ? '<span class="pc-tag on">✓ Offered</span>' : '<span class="pc-tag">Not offered</span>') +
              (nf && nf.inj ? '<span class="pc-tag inj">ESPN: ' + escHtml(nf.inj) + '</span>' : '') + (!inNFL && nf === null && Object.keys(NFL).length ? '<span class="pc-tag">Not on an NFL roster</span>' : '') + '</div>' +
            '<div class="pc-name">' + p.name + outBadge(p.name) + '</div>' +
 (moved || (hist.length && !inNFL) ? '<div class="pc-teams">' + hist.join(' · ') + '</div>' : '') + ctxLine +
            (p.lastOdds ? '<div class="pc-sub">Last odds ' + formatOdds(p.lastOdds.odds) + ' (' + p.lastOdds.year + ' Wk ' + p.lastOdds.week + ')</div>' : '') +
          '</div>' +
          '<div class="pc-body">' +
            '<div class="pc-tiles">' +
              '<div class="pc-tile"><div class="pc-label">First TDs</div><div class="pc-big">' + tdTotal + '</div><div class="pc-small">' + tdSub + '</div></div>' +
              '<div class="pc-tile"><div class="pc-label">When Picked</div><div class="pc-big">' + (pickedGames.length ? Math.round(hitGames / pickedGames.length * 100) + '%' : '—') + '</div>' +
                '<div class="pc-small">' + (pickedGames.length ? 'scored first in ' + hitGames + ' of ' + pickedGames.length : 'no picked games yet') + '</div></div>' +
            '</div>' +
            person('Maria') + person('Danielle') +
            (games ? '<div class="pc-games"><div class="pc-label">Recent games</div>' + games + '</div>' : '') +
          '</div></div></div>';

        closePlayerCard();
        document.body.insertAdjacentHTML('beforeend', html);
        var bd = document.getElementById('pc-backdrop');
        bd.addEventListener('click', function(e) { if (e.target === bd) closePlayerCard(); });
        document.getElementById('pc-close').addEventListener('click', closePlayerCard);
        fillHeadshots(bd);
      });
    }


    // ── Rosters: "Not Currently Offered" division ───────────────────────────
    function renderFormerDivision(db) {
      var el = document.getElementById('former-division');
      if (!el) return;
      var list = Object.keys(db).filter(function(k) {
        var ri = ROSTER_INFO[k];
        return !ri || ri.hidden;
      }).map(function(k) { return db[k]; }).filter(function(p) {
        return p.picks.Maria + p.picks.Danielle > 0 || Object.keys(p.tds).length > 0;
      }).sort(function(a, b) {
        var ay = a.last ? parseInt(a.last.year) * 100 + a.last.week : 0;
        var by = b.last ? parseInt(b.last.year) * 100 + b.last.week : 0;
        return by - ay || a.name.localeCompare(b.name);
      });
      if (!list.length) { el.innerHTML = ''; return; }

      var rows = list.map(function(p) {
        var nf = nflOf(p.name);
        var team = nf && nf.team ? nf.team : resolveTeam(p.team);
        var tc = TEAM_COLORS[team];
        var nick = nf && nf.team ? team.split(' ').pop() : Object.keys(NFL).length ? 'No team' : (team ? team.split(' ').pop() : '—');
        var tds = Object.keys(p.tds).length;
        var bits = [];
        if (p.picks.Maria) bits.push('<span style="color:' + SB_M + '">Maria x' + p.picks.Maria + '</span>');
        if (p.picks.Danielle) bits.push('<span style="color:' + SB_D + '">Danielle x' + p.picks.Danielle + '</span>');
        if (tds) bits.push('<span style="color:#34D399">🏈 ' + tds + ' first TD' + (tds > 1 ? 's' : '') + '</span>');
        return '<div class="player-row" style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);align-items:center">' +
          '<span class="pos-label" style="min-width:74px;color:' + (tc ? tc.dark : '#A1A9B6') + '">' + nick + '</span>' +
          '<span class="player-name-text" style="flex:1"><span>' + p.name + '</span></span>' +
          '<span style="font-size:10px;text-align:right">' + bits.join(' <span style="color:rgba(255,255,255,0.25)">·</span> ') +
          (p.last ? ' <span style="color:rgba(255,255,255,0.4)">· last ' + p.last.year + ' Wk ' + p.last.week + '</span>' : '') + '</span>' +
        '</div>';
      }).join('');

      el.innerHTML = '<div class="division-block">' +
        '<div class="division-header" onclick="toggleDivision(this)">Picked Before, Not Offered Now (' + list.length + ') <span class="division-chevron">▼</span></div>' +
        '<div class="division-teams">' +
          '<div style="font-size:12px;color:#A1A9B6;margin:4px 0 10px">Players from past games who aren\'t offered right now: anyone who was picked, plus anyone who scored a first TD. The team shown is where they play today (from ESPN). Tap a name for their card.</div>' +
          '<div class="team-block" style="border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03)"><div class="team-players-inner" style="background:transparent">' + rows + '</div></div>' +
        '</div></div>';
      schedulePlayerTagging();
    }

    function closePlayerCard() {
      var bd = document.getElementById('pc-backdrop');
      if (bd) bd.remove();
    }

    document.addEventListener('click', function(e) {
      var tm = e.target.closest && e.target.closest('.tm-link');
      if (tm && !tm.closest('.pc-card') && !(e.target.closest('.pl-link'))) { e.preventDefault(); openTeamCard(tm.getAttribute('data-team')); return; }
      var el = e.target.closest && e.target.closest('.pl-link');
      if (!el || el.closest('.pc-card')) return;
      e.preventDefault();
      var c = el.closest('[data-ctx-week]');
      openPlayerCard(el.getAttribute('data-pname'), c ? { year: c.getAttribute('data-ctx-year'), week: c.getAttribute('data-ctx-week') } : null);
    });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closePlayerCard(); });
    new MutationObserver(function(muts) {
      if (muts.some(function(m) { return m.addedNodes.length && !(m.target.closest && m.target.closest('.pc-card')); })) schedulePlayerTagging();
    }).observe(document.body, { childList: true, subtree: true });

    function toggleDivision(el) {
      el.classList.toggle('open');
      el.nextElementSibling.classList.toggle('open');
    }

    async function loadRosters() {
      try {
        await loadNFL();
        const [rosterRows, qbRows, injuredRows] = await Promise.all([
          fetchSheet('Rosters', 'A1:AG10'),
          fetchSheet('QBs', 'A1:A50'),
          fetchSheet('Injured', 'A1:B100').catch(() => []),   // optional tab
        ]);
        INJURED = {};
        injuredRows.slice(1).forEach(r => {
          const n = (r[0] || '').trim();
          if (n) INJURED[playerKey(n)] = (r[1] || '').trim();
        });

        // Parse valid QBs — A3 onward (index 2+)
        const validQBs = new Set(qbRows.slice(2).map(r => (r[0] || '').trim()).filter(Boolean));

        // Parse roster header (team names in row 1, cols B onward)
        const header = rosterRows[0];
        const teams = header.slice(1).map(t => (t || '').trim()).filter(Boolean);

        // Parse positions and players
        const POSITIONS = ['WR1','RB1','WR2','QB','TE','WR3'];
        const posRows = rosterRows.slice(1, 7); // rows 2-7 = positions
        const extraRows = rosterRows.slice(7).filter(r => r.some(c => c));

        // Build team data: teamName -> {pos: player, extras: []}
        const teamData = {};
        for (let ti = 0; ti < teams.length; ti++) {
          const col = ti + 1;
          const team = teams[ti];
          teamData[team] = { players: [], extras: [] };
          for (let pi = 0; pi < POSITIONS.length; pi++) {
            const player = (posRows[pi] && posRows[pi][col] || '').trim();
            if (player) { teamData[team].players.push({ pos: POSITIONS[pi], name: player }); ROSTER_INFO[playerKey(player)] = { team: team, pos: POSITIONS[pi], name: player }; }
          }
          for (const er of extraRows) {
            const extra = (er[col] || '').trim();
            if (extra) { teamData[team].extras.push(extra); if (!ROSTER_INFO[playerKey(extra)]) ROSTER_INFO[playerKey(extra)] = { team: team, pos: '', name: extra }; }
          }
        }

        // Build pick counts per player per picker from bet history
        const pickCounts = {}; // { playerName: { Maria: N, Danielle: N } }
        try {
          const betRows = await fetchSheet('Winnings', 'A1:Q400');
          for (const b of readBets(betRows)) {
            const picker = b.picker;
            if (!picker) continue;
            for (const player of [b.homePick, b.awayPick].filter(Boolean)) {
              if (!pickCounts[player]) pickCounts[player] = {};
              pickCounts[player][picker] = (pickCounts[player][picker] || 0) + 1;
            }
          }
        } catch(e) { console.warn('Could not load pick counts', e); }

        // Render divisions
        let html = '';
        for (const [division, divTeams] of Object.entries(DIVISIONS)) {
          html += `<div class="division-block">
            <div class="division-header" onclick="toggleDivision(this)">
              ${division} <span class="division-chevron">▼</span>
            </div>
            <div class="division-teams">`;

          for (const teamName of divTeams) {
            const td = teamData[teamName];
            if (!td) continue;
            const tc = TEAM_COLORS[teamName] || { primary: '#1C1C1E', secondary: '#6B7280', text: '#ffffff' };
            const fade = hexA(tc.bg === '#FFFFFF' ? tc.primary : tc.bg, 0.45);
            html += `<div class="team-block" style="border:1px solid ${hexA(tc.dark || '#FFFFFF', 0.35)};background:linear-gradient(160deg, ${fade} 0%, rgba(255,255,255,0.03) 75%)">
              <div class="team-header-bar" style="background:${tc.bg || tc.primary};color:${tc.text}">${teamName}</div>
              <div class="team-players-inner"><div class="player-list">`;
            for (const { pos, name } of td.players) {
              const isQB = pos === 'QB';
              // Skip QBs not in the offered list entirely
              if (isQB && !validQBs.has(name)) { ROSTER_INFO[playerKey(name)].hidden = true; continue; }
              const nameClass = isQB ? 'qb-valid' : 'player-name-text';
              const counts = pickCounts[name] || {};
              const pickNotes = [];
              if (counts['Maria']) pickNotes.push(`Maria x${counts['Maria']}`);
              if (counts['Danielle']) pickNotes.push(`Danielle x${counts['Danielle']}`);
              const pickNote = pickNotes.length ? `<span style="font-size:10px;color:#9CA3AF;margin-left:6px">${pickNotes.join(', ')}</span>` : '';
              const posColor = tc.dark || tc.primary;
              html += `<div class="player-row${outRow(name)}"><span class="pos-label" style="color:${posColor}">${pos}</span><span class="${nameClass}"><span>${name}</span>${outBadge(name)}${pickNote}</span></div>`;
            }
            for (const extra of td.extras) {
              const counts = pickCounts[extra] || {};
              const pickNotes = [];
              if (counts['Maria']) pickNotes.push(`Maria x${counts['Maria']}`);
              if (counts['Danielle']) pickNotes.push(`Danielle x${counts['Danielle']}`);
              const pickNote = pickNotes.length ? `<span style="font-size:10px;color:#9CA3AF;margin-left:6px">${pickNotes.join(', ')}</span>` : '';
              html += `<div class="player-row${outRow(extra)}"><span class="pos-label" style="color:${tc.dark || tc.primary}">+</span><span class="player-name-text extra"><span>${extra}</span>${outBadge(extra)}${pickNote}</span></div>`;
            }
            // Everyone else on the team (from ESPN), grayed out
            const offeredKeys = new Set(td.players.concat(td.extras.map(n => ({ name: n }))).map(x => playerKey(x.name)));
            const others = Object.keys(NFL).map(k => NFL[k]).filter(n => n.team === teamName && SKILL_POS[n.pos] && !offeredKeys.has(playerKey(n.name)))
              .sort((a, b) => ['QB', 'RB', 'FB', 'WR', 'TE'].indexOf(a.pos) - ['QB', 'RB', 'FB', 'WR', 'TE'].indexOf(b.pos) || a.name.localeCompare(b.name));
            if (others.length) {
              html += `<details class="more-players"><summary>+ ${others.length} more not offered</summary>` +
                others.map(n => `<div class="player-row not-offered"><span class="pos-label">${n.pos}</span><span class="player-name-text"><span>${escHtml(n.name)}</span>${n.inj ? '<span class="inj-tag">' + escHtml(n.inj) + '</span>' : ''}</span></div>`).join('') +
                `</details>`;
            }
            html += `</div></div></div>`;
          }

          html += `</div></div>`;
        }

        html += '<div id="former-division"></div>';
        document.getElementById('rosters-content').innerHTML = html;
        loadPlayerDB().then(renderFormerDivision);
        schedulePlayerTagging();
      } catch(e) {
        console.error(e);
        document.getElementById('rosters-content').innerHTML = '<div class="loading">Error loading rosters.</div>';
      }
    }
