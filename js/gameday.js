// 📺 Game Day: a full-screen live view of one game that Maria and Danielle both picked.
// Opened from the 📺 button on a live game in Live Picks (openGameDay in core.js loads this file).
// Reads ESPN's public scoreboard + game summary every 20 seconds; nothing is saved anywhere.
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    var GD = { home: '', away: '', id: null, timer: null, picks: [], done: false, test: null };
    var GD_MS = 20000;

    // test = { year, week, picks } opens a finished game instead of a live one (admin's 📺 Test Game Day)
    function startGameDay(home, away, test) {
      GD.home = home; GD.away = away; GD.id = null; GD.done = false; GD.test = test || null;
      GD.picks = test ? test.picks : gdPicksFromLive(home, away);
      var root = document.getElementById('gameday');
      if (!root) {
        root = document.createElement('div');
        root.id = 'gameday';
        root.className = 'gd-root dk'; // .dk = stays dark in the light theme (v140)
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'Game Day');
        document.body.appendChild(root);
        root.addEventListener('click', function(e) {
          if (e.target.closest('.gd-x')) closeGameDay();
          if (e.target.closest('.gd-takeover')) e.target.closest('.gd-takeover').remove();
        });
        document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && root.classList.contains('open')) closeGameDay(); });
      }
      root.innerHTML = '<div class="gd-frame"><div class="gd-top"><span class="gd-title">📺 Game Day' + (test ? ' <span class="gd-test">TEST · ' + escHtml(test.year + ' ' + weekName(test.week)) + '</span>' : '') + '</span><button class="gd-x" aria-label="Close">✕</button></div><div class="gd-body"><div class="st-loading">Getting the game from ESPN…</div></div></div>';
      root.classList.add('open');
      document.documentElement.classList.add('st-lock');
      gdRefresh();
    }
    function closeGameDay() {
      clearTimeout(GD.timer);
      var root = document.getElementById('gameday');
      if (root) { root.classList.remove('open'); root.innerHTML = ''; }
      document.documentElement.classList.remove('st-lock');
    }

    // The four picks for this game, read from the Live Picks cards (home pick first, then away)
    function gdPicksFromLive(home, away) {
      var out = [];
      document.querySelectorAll('#live-picks .live-game').forEach(function(g) {
        var s = g.querySelector('.live-strip');
        if (!s || s.getAttribute('data-home') !== home || s.getAttribute('data-away') !== away) return;
        ['maria', 'danielle'].forEach(function(cls) {
          var card = g.querySelector('.live-pick-card.' + cls);
          if (!card) return;
          var odds = ((card.querySelector('.pick-odds') || {}).textContent || '').split('/').map(function(x) { return x.trim(); });
          card.querySelectorAll('.lp-pick').forEach(function(p, i) {
            out.push({ who: cls === 'maria' ? 'Maria' : 'Danielle', name: p.getAttribute('data-player'), team: i === 0 ? home : away, odds: odds[i] || '' });
          });
        });
      });
      return out;
    }

    async function gdRefresh() {
      clearTimeout(GD.timer);
      var root = document.getElementById('gameday');
      if (!root || !root.classList.contains('open')) return;
      var body = root.querySelector('.gd-body');
      try {
        var board = await espnGet(GD.test ? (GD.test.week > 18 ? 'scoreboard?dates=' + GD.test.year + '&seasontype=3&week=' + (GD.test.week - 18) : 'scoreboard?dates=' + GD.test.year + '&seasontype=2&week=' + GD.test.week) : 'scoreboard');
        var hk = espnTeamKey(GD.home), ak = espnTeamKey(GD.away), ev = null;
        (board.events || []).forEach(function(e) {
          var c = e.competitions && e.competitions[0];
          if (!c) return;
          var keys = c.competitors.map(function(x) { return espnTeamKey(x.team.displayName); });
          if (keys.indexOf(hk) >= 0 && keys.indexOf(ak) >= 0) ev = e;
        });
        if (!ev) { body.innerHTML = '<div class="st-loading">ESPN doesn\'t list this game right now.</div>'; return; }
        GD.id = ev.id;
        var sum = null;
        if (ev.status.type.state !== 'pre') { try { sum = await espnGet('summary?event=' + ev.id); } catch (e) {} }
        body.innerHTML = gdHtml(ev, sum);
        if (typeof fillHeadshots === 'function') fillHeadshots(body);
        gdTakeover(ev, sum);
        GD.done = ev.status.type.state === 'post';
      } catch (e) {
        if (!body.querySelector('.gd-score')) body.innerHTML = '<div class="st-loading">Couldn\'t reach ESPN. Trying again…</div>';
      }
      if (!GD.done) GD.timer = setTimeout(gdRefresh, GD_MS);
    }

    // Live box score: name -> { car, ryd, rec, tgt, cyd, td }
    function gdStats(sum) {
      var S = {};
      ((sum && sum.boxscore && sum.boxscore.players) || []).forEach(function(tp) {
        (tp.statistics || []).forEach(function(cat) {
          var L = (cat.labels || []).map(function(x) { return String(x).toUpperCase(); });
          (cat.athletes || []).forEach(function(a) {
            var nm = a.athlete && a.athlete.displayName;
            if (!nm) return;
            var s = S[nm] || (S[nm] = { car: 0, ryd: 0, rec: 0, tgt: 0, cyd: 0, td: 0, pyd: 0 });
            function v(lab) { var i = L.indexOf(lab); return i >= 0 ? parseFloat(String(a.stats[i]).replace(/,/g, '')) || 0 : 0; }
            if (cat.name === 'rushing') { s.car = v('CAR'); s.ryd = v('YDS'); s.td += v('TD'); }
            if (cat.name === 'receiving') { s.rec = v('REC'); s.cyd = v('YDS'); s.tgt = v('TGTS'); s.td += v('TD'); }
            if (cat.name === 'passing') { s.pyd = v('YDS'); }
          });
        });
      });
      return S;
    }
    function gdFind(S, pick) {
      var k = Object.keys(S).filter(function(n) { return sameScorer(n, pick) || normName(n) === normName(pick); })[0];
      return k ? S[k] : null;
    }
    function gdFirstTD(sum) {
      var sp = ((sum && sum.scoringPlays) || []).filter(tdPlay);
      return sp.length ? tdScorerName(sp[0].text) : null;
    }
    function gdPlays(sum) {
      var d = (sum && sum.drives) || {}, all = [];
      (d.previous || []).forEach(function(x) { (x.plays || []).forEach(function(p) { all.push(p); }); });
      ((d.current && d.current.plays) || []).forEach(function(p) { all.push(p); });
      return all.slice(-5).reverse();
    }

    function gdHtml(ev, sum) {
      var comp = ev.competitions[0], st = ev.status.type, sit = comp.situation || {};
      var H = comp.competitors.filter(function(c) { return c.homeAway === 'home'; })[0] || comp.competitors[0];
      var A = comp.competitors.filter(function(c) { return c.homeAway === 'away'; })[0] || comp.competitors[1];
      function side(c) {
        var t = resolveTeam(c.team.displayName), tc = TEAM_COLORS[t] || {}, has = sit.possession && String(sit.possession) === String(c.id || c.team.id);
        return '<div class="gd-team" style="--tc:' + (tc.dark || '#F3F4F6') + '">' + teamLogo(t, 'gd-logo') +
          '<div class="gd-abbr">' + escHtml(c.team.abbreviation || teamNick(t)) + (has && st.state === 'in' ? ' <span class="gd-ball">🏈</span>' : '') + '</div>' +
          '<div class="gd-pts">' + (st.state === 'pre' ? '–' : (c.score || 0)) + '</div></div>';
      }
      var clock = st.state === 'pre' ? 'Kickoff ' + new Date(ev.date).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
        : st.state === 'post' ? 'Final' : (st.shortDetail || '');
      var h = '<div class="gd-score">' + side(H) + '<div class="gd-mid">' + (st.state === 'in' ? '<span class="ls-dot"></span><span class="gd-live">LIVE</span>' : '') +
        '<div class="gd-clock">' + escHtml(clock) + '</div>' +
        (st.state === 'in' && sit.downDistanceText ? '<div class="gd-down">' + escHtml(sit.downDistanceText) + '</div>' : '') +
        (st.state === 'in' && sit.isRedZone ? '<div class="gd-rz">🚨 RED ZONE</div>' : '') + '</div>' + side(A) + '</div>';
      // Field: where the ball is, from the side with the ball (possessionText like "PIT 34")
      if (st.state === 'in' && sit.possessionText && sit.possession) {
        var m = /([A-Z]{2,3})\s+(\d+)/.exec(sit.possessionText), off = [H, A].filter(function(c) { return String(c.id || c.team.id) === String(sit.possession); })[0];
        if (m && off) {
          var own = m[1] === off.team.abbreviation, yl = parseInt(m[2], 10);
          var toGo = own ? 100 - yl : yl;                // yards to the end zone the offense is attacking
          // Drawn with the home end zone on the left, so home drives right and the away team drives left
          var pos = off === H ? 100 - toGo : toGo;        // % from the left goal line
          var hc = (TEAM_COLORS[resolveTeam(H.team.displayName)] || {}).primary || '#374151', ac = (TEAM_COLORS[resolveTeam(A.team.displayName)] || {}).primary || '#374151';
          h += '<div class="gd-field"><i class="gd-ez" style="left:0;background:' + hc + '"></i><i class="gd-ez" style="right:0;background:' + ac + '"></i>' +
            '<i class="gd-mark" style="left:' + (8 + pos * 0.84).toFixed(1) + '%"></i><span class="gd-togo">' + escHtml(off.team.abbreviation) + ' · ' + toGo + ' yds to the end zone</span></div>';
        }
      }

      // First TD
      var first = st.state === 'pre' ? null : gdFirstTD(sum);
      if (first) {
        var who = GD.picks.filter(function(p) { return sameScorer(first, p.name); }).map(function(p) { return p.who; });
        h += '<div class="gd-ftd hit"><div class="gd-ftd-k">🏈 First touchdown</div><div class="gd-ftd-n">' + escHtml(first) + '</div>' +
          '<div>' + (who.length ? '🎉 ' + who.map(function(n) { return '<b style="color:' + personColor(n) + '">' + n + '</b>'; }).join(' & ') + ' hit it!' : 'Nobody had him 😩') + '</div></div>';
      } else {
        h += '<div class="gd-ftd"><div class="gd-ftd-k">🏈 First touchdown</div><div>' + (st.state === 'pre' ? 'Not started yet. All four picks are alive.' : 'No touchdowns yet. Still anyone\'s game.') + '</div></div>';
      }

      // The four picks, with live touches/yards and an involvement meter
      var S = gdStats(sum), heats = [];
      var cards = GD.picks.map(function(p) {
        var s = gdFind(S, p.name) || { car: 0, ryd: 0, rec: 0, tgt: 0, cyd: 0, td: 0 };
        var touches = s.car + Math.max(s.tgt, s.rec), yds = s.ryd + s.cyd;
        var off = sit.possession && [H, A].filter(function(c) { return String(c.id || c.team.id) === String(sit.possession); })[0];
        var rz = st.state === 'in' && sit.isRedZone && off && resolveTeam(off.team.displayName) === resolveTeam(p.team);
        var heat = Math.min(100, Math.round(touches * 8 + yds * 0.6 + (rz ? 25 : 0)));
        heats.push(heat);
        var hit = first && sameScorer(first, p.name);
        var line = [s.car ? s.car + ' car ' + s.ryd + ' yds' : '', (s.tgt || s.rec) ? s.rec + '/' + (s.tgt || s.rec) + ' rec ' + s.cyd + ' yds' : '', s.td ? s.td + ' TD' : ''].filter(Boolean).join(' · ') || (st.state === 'pre' ? 'Waiting for kickoff' : 'No touches yet');
        return { who: p.who, heat: heat, html: '<div class="gd-pick' + (hit ? ' hit' : first ? ' out' : '') + '" style="--pc:' + personColor(p.who) + '">' +
          headshot(p.name, p.team, 40) + '<div class="gd-pk-mid"><div class="gd-pk-n">' + escHtml(p.name) + (hit ? ' ✅' : '') + (rz && !first ? ' <span class="gd-rz-tag">RZ</span>' : '') + '</div>' +
          (p.odds ? '<div class="gd-pk-o">' + escHtml(p.odds) + '</div>' : '') +
          '<div class="gd-pk-s">' + line + '</div>' +
          (first ? '' : '<div class="gd-heat"><i style="width:' + heat + '%"></i></div>') + '</div></div>' };
      });
      var top = Math.max.apply(null, heats.concat([0]));
      h += '<div class="gd-cols">' + ['Maria', 'Danielle'].map(function(n) {
        var mine = cards.filter(function(c) { return c.who === n; });
        return '<div class="gd-col"><div class="gd-col-h" style="color:' + personColor(n) + '">' + n + '</div>' +
          mine.map(function(c) { return c.html.replace('class="gd-pick"', 'class="gd-pick' + (!first && top > 0 && c.heat === top ? ' hot' : '') + '"'); }).join('') + '</div>';
      }).join('') + '</div>';
      if (!first && st.state === 'in') h += '<div class="gd-note">The bar is how involved each pick is so far: touches, yards, and his team in the red zone.</div>';

      // Latest plays
      var plays = gdPlays(sum);
      if (plays.length) h += '<div class="gd-h">Latest plays</div>' + plays.map(function(p) {
        return '<div class="gd-play' + (p.scoringPlay ? ' sc' : '') + '"><span>' + (p.period ? 'Q' + p.period.number + ' ' : '') + escHtml((p.clock && p.clock.displayValue) || '') + '</span>' + escHtml(p.text || '') + '</div>';
      }).join('');
      h += '<div class="gd-foot">' + (st.state === 'post' ? 'Final. ' : 'Updates every 20 seconds. ') + 'Live data from ESPN.</div>';
      return h;
    }

    // The moment the first TD lands: a big takeover, once per game on this phone
    function gdTakeover(ev, sum) {
      var first = gdFirstTD(sum);
      if (!first || !GD.id) return;
      var seen = {};
      try { seen = JSON.parse(localStorage.getItem('mvd-gd-td') || '{}'); } catch (e) {}
      if (seen[GD.id] && !GD.test) return; // a test replays it every time
      if (!GD.test) seen[GD.id] = Date.now();
      try { localStorage.setItem('mvd-gd-td', JSON.stringify(seen)); } catch (e) {}
      var who = GD.picks.filter(function(p) { return sameScorer(first, p.name); });
      var p0 = who[0];
      var color = p0 ? personColor(p0.who) : '#A1A9B6';
      var team = p0 ? p0.team : '';
      var el = document.createElement('div');
      el.className = 'gd-takeover' + (p0 ? ' win' : '');
      el.style.setProperty('--pc', color);
      el.innerHTML = '<div class="gd-to-in"><div class="gd-to-k">TOUCHDOWN</div>' + (team ? headshot(first, team, 120) : '') +
        '<div class="gd-to-n">' + escHtml(first) + '</div><div class="gd-to-r">' +
        (who.length ? '🎉 ' + who.map(function(p) { return '<b style="color:' + personColor(p.who) + '">' + p.who + '</b>'; }).join(' & ') + ' hit it!' : 'Nobody had him 😩') +
        '</div><div class="gd-to-tap">tap to close</div></div>';
      document.getElementById('gameday').appendChild(el);
      if (typeof fillHeadshots === 'function') fillHeadshots(el);
      setTimeout(function() { if (el.parentNode) el.remove(); }, 6500);
    }
