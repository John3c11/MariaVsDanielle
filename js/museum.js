// 🏛️ The Museum: the rivalry's greatest moments, every season.
// Most moments are found automatically in the sheets (biggest hits, perfect weeks, champions...).
// John adds his own from the admin 🏛️ Museum tab, and can add a note, a photo or a ⭐ to any
// automatic one, or hide it (Museum.gs keeps those). Loaded when the tab opens (loadScriptOnce).
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    var MUSEUM = { filter: 'all', saved: null };
    var MU_TAGS = {
      bighit:  { ic: '💰', t: 'Biggest hit ever' },
      bigweek: { ic: '📈', t: 'Best week ever' },
      perfect: { ic: '🧹', t: 'Perfect week' },
      double:  { ic: '🤝', t: 'Same longshot' },
      heater:  { ic: '🔥', t: 'Longest heater' },
      drought: { ic: '🌵', t: 'Drought over' },
      first:   { ic: '🌱', t: 'Where it started' },
      champ:   { ic: '🏆', t: 'Season champion' },
      mile:    { ic: '🎯', t: 'Milestone' },
      custom:  { ic: '🏛️', t: 'Moment' },
    };
    var MU_MILESTONES = [25, 50, 100, 150, 200];

    // ── Automatic moments, from every season's bets ─────────────────────────
    function museumAuto(rows) {
      var out = [], MD = ['Maria', 'Danielle'];
      function game(r) { return (r.awayTeam ? r.awayTeam.split(' ').pop() : '?') + ' @ ' + (r.homeTeam ? r.homeTeam.split(' ').pop() : '?'); }
      function hitInfo(r) {
        var home = playerKey(r.firstScorer) === playerKey(r.homePick);
        return { player: r.firstScorer, team: home ? r.homeTeam : r.awayTeam, odds: oddsN(home ? r.homeOdds : r.awayOdds) * 100 };
      }
      function add(m) { m.season = String(m.season); out.push(m); }
      var decided = rows.filter(function(r) { return (r.correct === 'Yes' || r.correct === 'No') && !isNotOffered(r); });
      var years = {};
      decided.forEach(function(r) { years[r.year] = 1; });

      MD.forEach(function(who) {
        var mine = decided.filter(function(r) { return r.picker === who; });
        var hits = mine.filter(function(r) { return r.correct === 'Yes'; });
        if (!hits.length) return;
        // Where it started: her first hit ever
        var f = hits[0], fi = hitInfo(f);
        add({ id: 'auto:first:' + who, tag: 'first', who: who, season: f.year, week: f.week, game: game(f), player: fi.player, team: fi.team,
          title: who + '\'s first hit', caption: fi.player + (fi.odds ? ' at +' + Math.round(fi.odds) : '') + '. The one that started it all.' });
        // Biggest hit ever
        var best = null;
        hits.forEach(function(r) { var x = hitInfo(r); if (!best || x.odds > best.x.odds) best = { r: r, x: x }; });
        if (best && best.x.odds) add({ id: 'auto:bighit:' + who, tag: 'bighit', who: who, season: best.r.year, week: best.r.week, game: game(best.r),
          player: best.x.player, team: best.x.team, odds: best.x.odds,
          title: best.x.player + ' at +' + Math.round(best.x.odds), caption: 'The longest shot ' + who + ' has ever cashed. ' + fmtU(best.r.netUnits) + ' on one pick.' });
        // Best week ever (units)
        var W = {};
        mine.forEach(function(r) { var k = r.year + '|' + r.week; (W[k] = W[k] || { year: r.year, week: r.week, u: 0, n: 0, h: 0 }); W[k].u += r.netUnits; W[k].n++; if (r.correct === 'Yes') W[k].h++; });
        var bw = Object.keys(W).map(function(k) { return W[k]; }).sort(function(a, b) { return b.u - a.u; })[0];
        if (bw && bw.u > 0) add({ id: 'auto:bigweek:' + who, tag: 'bigweek', who: who, season: bw.year, week: bw.week,
          title: fmtU(bw.u) + ' in one week', caption: who + ' went ' + bw.h + ' for ' + bw.n + ' and had her best week ever.' });
        // Perfect weeks: 3+ picks, every one hit
        Object.keys(W).forEach(function(k) {
          var w = W[k];
          if (w.n >= 3 && w.h === w.n) add({ id: 'auto:perfect:' + who + ':' + w.year + ':' + w.week, tag: 'perfect', who: who, season: w.year, week: w.week,
            title: who + ' goes ' + w.h + ' for ' + w.n, caption: 'Every single pick hit. ' + fmtU(w.u) + ' for the week.' });
        });
        // Longest heater and longest drought (snapped by a hit)
        var run = 0, best2 = { n: 0 }, dry = 0, bestDry = { n: 0 };
        mine.forEach(function(r) {
          if (r.correct === 'Yes') {
            run++; if (run > best2.n) best2 = { n: run, r: r };
            if (dry > bestDry.n) bestDry = { n: dry, r: r };
            dry = 0;
          } else { run = 0; dry++; }
        });
        if (best2.n >= 3) add({ id: 'auto:heater:' + who, tag: 'heater', who: who, season: best2.r.year, week: best2.r.week,
          title: best2.n + ' straight hits', caption: 'The longest run ' + who + ' has ever been on. It reached ' + best2.n + ' with ' + best2.r.firstScorer + '.' });
        if (bestDry.n >= 6) { var di = hitInfo(bestDry.r);
          add({ id: 'auto:drought:' + who, tag: 'drought', who: who, season: bestDry.r.year, week: bestDry.r.week, game: game(bestDry.r), player: di.player, team: di.team,
            title: bestDry.n + ' misses, then ' + di.player, caption: 'The longest dry spell ' + who + ' has had, finally snapped' + (di.odds ? ' at +' + Math.round(di.odds) : '') + '.' }); }
        // Milestones: her 25th, 50th, 100th... hit
        MU_MILESTONES.forEach(function(n) {
          var r = hits[n - 1]; if (!r) return;
          var x = hitInfo(r);
          add({ id: 'auto:mile:' + who + ':' + n, tag: 'mile', who: who, season: r.year, week: r.week, game: game(r), player: x.player, team: x.team,
            title: 'Hit No. ' + n, caption: who + '\'s ' + n + 'th first-TD hit, courtesy of ' + x.player + '.' });
        });
      });

      // Both cashed the same longshot (+1000 or longer): the 3 biggest each season
      var byGame = {}, doubles = {};
      decided.forEach(function(r) { if (r.correct === 'Yes') { var k = r.year + '|' + r.game; (byGame[k] = byGame[k] || []).push(r); } });
      Object.keys(byGame).forEach(function(k) {
        var g = byGame[k];
        if (g.length < 2 || g[0].picker === g[1].picker) return;
        var x = hitInfo(g[0]);
        if (x.odds < 1000) return;
        (doubles[g[0].year] = doubles[g[0].year] || []).push({ r: g[0], x: x });
      });
      Object.keys(doubles).forEach(function(y) {
        doubles[y].sort(function(a, b) { return b.x.odds - a.x.odds; }).slice(0, 3).forEach(function(d) {
          add({ id: 'auto:double:' + y + ':' + d.r.game, tag: 'double', who: 'Both', season: y, week: d.r.week, game: game(d.r), player: d.x.player, team: d.x.team,
            title: 'Both of them on ' + d.x.player, caption: 'Same game, same longshot, both cashed at +' + Math.round(d.x.odds) + '.' });
        });
      });

      // Season champions (finished seasons only)
      Object.keys(years).forEach(function(y) {
        if (y >= CURRENT_YEAR) return;
        var u = { Maria: 0, Danielle: 0 };
        decided.forEach(function(r) { if (r.year === y && u[r.picker] !== undefined) u[r.picker] += r.netUnits; });
        var win = u.Maria >= u.Danielle ? 'Maria' : 'Danielle', lose = win === 'Maria' ? 'Danielle' : 'Maria';
        add({ id: 'auto:champ:' + y, tag: 'champ', who: win, season: y, week: 99,
          title: win + ' wins ' + y, caption: fmtU(u[win]) + ' to ' + fmtU(u[lose]) + '. Bragging rights secured for a whole year.' });
      });
      return out;
    }

    // Automatic moments + John's notes, photos and his own moments
    function museumMerge(auto, saved) {
      var S = {};
      (saved || []).forEach(function(m) { S[m.id] = m; });
      var list = auto.map(function(a) {
        var s = S[a.id];
        if (!s) return a;
        delete S[a.id];
        var m = Object.assign({}, a);
        if (s.title) m.title = s.title;
        if (s.caption) m.caption = s.caption;
        m.photo = s.photo || ''; m.star = s.star; m.hidden = s.hidden; m.edited = !!(s.title || s.caption || s.photo || s.star);
        return m;
      });
      Object.keys(S).forEach(function(k) {
        var s = S[k];
        if (k.indexOf('auto:') === 0) return; // a note on a moment that's no longer found
        list.push({ id: s.id, tag: 'custom', who: s.who, season: s.season, week: s.week, title: s.title, caption: s.caption, photo: s.photo, star: s.star, hidden: s.hidden, custom: true });
      });
      list.sort(function(a, b) { return (b.season - a.season) || ((b.week || 0) - (a.week || 0)) || ((b.star ? 1 : 0) - (a.star ? 1 : 0)); });
      return list;
    }

    function museumData(fresh) {
      var saved = (!fresh && MUSEUM.saved) ? Promise.resolve(MUSEUM.saved)
        : (PICKS_URL ? picksApi({ action: 'museum' }).then(function(r) { return (r && r.items) || []; }).catch(function() { return []; }) : Promise.resolve([]));
      return Promise.all([loadAllBets(), saved, (typeof ROSTERS_READY !== 'undefined' ? ROSTERS_READY : Promise.resolve()).catch(function() {})]).then(function(res) {
        MUSEUM.saved = res[1];
        return museumMerge(museumAuto(res[0]), res[1]);
      });
    }

    // ── The page ────────────────────────────────────────────────────────────
    function loadMuseumTab() {
      var el = document.getElementById('museum-content');
      if (!el) return;
      if (!el.innerHTML) el.innerHTML = '<div class="loading">Opening the Museum…</div>';
      museumData().then(function(list) { drawMuseum(el, list); })
        .catch(function() { el.innerHTML = '<div class="loading">Couldn\'t open the Museum. Check your connection.</div>'; });
    }

    function museumWhen(m) {
      if (m.week === 99) return m.season + ' · Final';
      return m.season + (m.week ? ' · ' + wkName(m.week) : '') + (m.game ? ' · ' + escHtml(m.game) : '');
    }
    function museumCard(m) {
      var tag = MU_TAGS[m.tag] || MU_TAGS.custom;
      var col = m.who === 'Maria' || m.who === 'Danielle' ? personColor(m.who) : '#FBBF24';
      var art = m.photo ? '<div class="mu-photo"><img src="' + escHtml(m.photo) + '" alt="" loading="lazy" referrerpolicy="no-referrer"></div>'
        : m.player ? '<div class="mu-art">' + headshot(m.player, m.team, 64) + '</div>'
        : m.who === 'Maria' || m.who === 'Danielle' ? '<div class="mu-art"><img class="mu-face" src="pics/' + m.who + '.jpeg" alt=""></div>'
        : '<div class="mu-art mu-ic">' + tag.ic + '</div>';
      return '<div class="mu-card' + (m.star ? ' mu-star' : '') + (m.photo ? ' has-photo' : '') + '" style="--mc:' + col + '">' + art +
        '<div class="mu-body">' +
          '<div class="mu-tag">' + tag.ic + ' ' + tag.t + (m.star ? ' <span class="mu-st">★ Featured</span>' : '') + '</div>' +
          '<div class="mu-title">' + escHtml(m.title) + '</div>' +
          (m.caption ? '<div class="mu-cap">' + escHtml(m.caption) + '</div>' : '') +
          '<div class="mu-when">' + (m.who ? '<b style="color:' + col + '">' + escHtml(m.who) + '</b> · ' : '') + museumWhen(m) + '</div>' +
        '</div></div>';
    }

    function drawMuseum(el, list) {
      var shown = list.filter(function(m) { return !m.hidden; });
      var years = []; shown.forEach(function(m) { if (years.indexOf(m.season) < 0) years.push(m.season); });
      var f = MUSEUM.filter;
      var vis = shown.filter(function(m) {
        if (f === 'all') return true;
        if (f === 'star') return m.star;
        if (f === 'Maria' || f === 'Danielle') return m.who === f || m.who === 'Both';
        return m.season === f;
      });
      var stars = shown.filter(function(m) { return m.star; });
      var h = '<div class="mu-hero"><div class="mu-hero-ic">🏛️</div><div><div class="mu-hero-t">The Museum</div>' +
        '<div class="mu-hero-s">The rivalry\'s greatest moments, every season. ' + shown.length + ' on display.</div></div></div>';
      h += '<div class="af-bar mu-filters">' + [['all', 'All'], ['Maria', 'Maria'], ['Danielle', 'Danielle']].concat(stars.length ? [['star', '★ Featured']] : []).concat(years.map(function(y) { return [y, y]; })).map(function(b) {
        return '<button class="filter-btn' + (f === b[0] ? ' active' : '') + '" data-mu-f="' + b[0] + '">' + b[1] + '</button>';
      }).join('') + '</div>';
      // ★ Featured moments sit on top (and not again below)
      if (f === 'all' && stars.length) {
        h += '<div class="mu-year mu-feat"><span>★ Featured</span></div><div class="mu-grid">' + stars.map(museumCard).join('') + '</div>';
        vis = vis.filter(function(m) { return !m.star; });
      }
      if (!vis.length && !(f === 'all' && stars.length)) h += '<div class="ch-empty">Nothing here yet.</div>';
      var last = null;
      vis.forEach(function(m) {
        if (m.season !== last) { h += '<div class="mu-year"><span>' + m.season + '</span></div><div class="mu-grid">'; }
        h += museumCard(m);
        last = m.season;
        var next = vis[vis.indexOf(m) + 1];
        if (!next || next.season !== m.season) h += '</div>';
      });
      el.innerHTML = h;
      if (typeof fillHeadshots === 'function') fillHeadshots(el);
      el.querySelectorAll('[data-mu-f]').forEach(function(b) {
        b.addEventListener('click', function() { MUSEUM.filter = b.getAttribute('data-mu-f'); drawMuseum(el, list); });
      });
      el.querySelectorAll('.mu-photo img').forEach(function(im) { im.addEventListener('error', function() { var c = im.closest('.mu-card'); im.parentNode.remove(); if (c) c.classList.remove('has-photo'); }); });
    }

    // Shrink a photo on the phone before sending it (long side 1400px, JPEG)
    function museumShrink(file) {
      return new Promise(function(resolve, reject) {
        var fr = new FileReader();
        fr.onerror = reject;
        fr.onload = function() {
          var im = new Image();
          im.onerror = function() { reject(new Error('Not a photo')); };
          im.onload = function() {
            var k = Math.min(1, 1400 / Math.max(im.width, im.height));
            var c = document.createElement('canvas');
            c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            resolve(c.toDataURL('image/jpeg', 0.82));
          };
          im.src = fr.result;
        };
        fr.readAsDataURL(file);
      });
    }
    function museumUpload(pin, file) {
      return museumShrink(file).then(function(data) {
        return fetch(PICKS_URL, { method: 'POST', body: JSON.stringify({ pin: pin, action: 'museumphoto', data: data }) })
          .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
      });
    }
