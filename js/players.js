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
          return (d.values || []).slice(1).map(function(r, i) {
            return {
              idx: i, year: season.year, game: (r[0] || '').toString().trim(), week: parseInt(r[1]) || 0,
              picker: (r[3] || '').trim(), home: resolveTeam(r[4]), away: resolveTeam(r[5]),
              homePick: (r[6] || '').trim(), awayPick: (r[7] || '').trim(),
              homeOdds: (r[8] || '').trim(), awayOdds: (r[9] || '').trim(),
              scorer: (r[11] || '').trim(), side: (r[13] || '').trim().toLowerCase(), netUnits: parseFloat(r[15]) || 0,
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
        });
        PLAYER_DB = db;
        schedulePlayerTagging();
        return db;
      });
      return PLAYER_DB_LOADING;
    }

    function isKnownPlayer(text) {
      var k = playerKey(text);
      return !!k && ((PLAYER_DB && PLAYER_DB[k]) || ROSTER_INFO[k]);
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
          if (el.closest('.pick-chip, button, input, .pc-card, .tabs-nav, .pin-input')) return;
          if (isKnownPlayer(t)) { el.classList.add('pl-link'); el.setAttribute('data-pname', t); }
        });
      });
    }

    function openPlayerCard(name) {
      loadPlayerDB().then(function(db) {
        var k = playerKey(name);
        var p = db[k] || { name: name, picks: { Maria: 0, Danielle: 0 }, hits: { Maria: 0, Danielle: 0 }, units: { Maria: 0, Danielle: 0 }, tds: {}, games: {}, gameOrder: [], team: '', lastOdds: null };
        var ri = ROSTER_INFO[k] || {};
        var team = resolveTeam(ri.team || p.team);
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
          var c = n === 'Maria' ? SB_M : SB_D;
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
          var vs = opp ? 'vs <span style="color:' + (oppTc ? oppTc.dark : '#F3F4F6') + ';font-weight:600">' + opp.split(' ').pop() + '</span>'
                       : (g.home.split(' ').pop() + ' vs ' + g.away.split(' ').pop());
          var chips = g.by.map(function(n) {
            var c = n === 'Maria' ? SB_M : SB_D;
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
            (team ? teamPill((ri.pos ? ri.pos + ' · ' : '') + team, team) : '') +
            '<div class="pc-name">' + p.name + outBadge(p.name) + '</div>' +
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
        var team = resolveTeam(p.team);
        var tc = TEAM_COLORS[team];
        var nick = team ? team.split(' ').pop() : '—';
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
        '<div class="division-header" onclick="toggleDivision(this)">Not Currently Offered (' + list.length + ') <span class="division-chevron">▼</span></div>' +
        '<div class="division-teams">' +
          '<div style="font-size:12px;color:#A1A9B6;margin:4px 0 10px">Players from past games who aren\'t on the current roster: anyone who was picked, plus anyone who scored a first TD. Team shown is their last team in your sheets. Tap a name for their card.</div>' +
          '<div class="team-block" style="border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03)"><div class="team-players-inner" style="background:transparent">' + rows + '</div></div>' +
        '</div></div>';
      schedulePlayerTagging();
    }

    // Short scouting line under each Submit Picks option
    function scoutLine(name) {
      var p = PLAYER_DB && PLAYER_DB[playerKey(name)];
      if (!p) return 'No history yet';
      var k = playerKey(name);
      var tds = Object.keys(p.tds).length;
      var picked = p.gameOrder.map(function(g) { return p.games[g]; }).filter(function(g) { return g.by.length && g.scorer; });
      var hits = picked.filter(function(g) { return playerKey(g.scorer) === k; }).length;
      var bits = ['🏈 ' + tds + ' TD' + (tds === 1 ? '' : 's')];
      if (picked.length) bits.push('hit ' + hits + '/' + picked.length);
      if (p.lastOdds) bits.push('last ' + formatOdds(p.lastOdds.odds));
      return bits.join(' · ');
    }
    function fillScouting() {
      document.querySelectorAll('.chip-scout').forEach(function(el) {
        el.textContent = scoutLine(el.getAttribute('data-scout'));
      });
    }

    function closePlayerCard() {
      var bd = document.getElementById('pc-backdrop');
      if (bd) bd.remove();
    }

    document.addEventListener('click', function(e) {
      var el = e.target.closest && e.target.closest('.pl-link');
      if (!el || el.closest('.pc-card')) return;
      e.preventDefault();
      openPlayerCard(el.getAttribute('data-pname'));
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
          for (const r of betRows.slice(1)) {
            const picker = (r[3] || '').trim();
            const homePick = (r[6] || '').trim();
            const awayPick = (r[7] || '').trim();
            if (!picker) continue;
            for (const player of [homePick, awayPick].filter(Boolean)) {
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
