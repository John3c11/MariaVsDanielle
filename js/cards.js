// 🃏 Trading cards: every player who scored first for someone (Maria, Danielle or a friend) is a card in their album.
// Rarity: Maria and Danielle's cards go by the best odds the player paid off at (they have odds).
// Friends' cards go by where the player sits on the Rosters tab's depth chart: headliners are common,
// deep cuts are legendary. Loaded on demand by Profiles (loadScriptOnce).
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    var CARD_TIERS = [
      { k: 'legendary', t: 'Legendary', d: 'Deep cut (an extra on the Rosters tab)' },
      { k: 'epic', t: 'Epic', d: 'WR3 or QB' },
      { k: 'rare', t: 'Rare', d: 'WR2 or TE' },
      { k: 'common', t: 'Common', d: 'WR1 or RB1' },
    ];
    var TIER_BY_SLOT = { WR1: 'common', RB1: 'common', WR2: 'rare', TE: 'rare', WR3: 'epic', QB: 'epic' };
    var ODDS_TIERS = [{ k: 'legendary', min: 2500 }, { k: 'epic', min: 1500 }, { k: 'rare', min: 800 }, { k: 'common', min: 0 }]; // best odds paid
    function oddsTier(best) { for (var i = 0; i < ODDS_TIERS.length; i++) if (best >= ODDS_TIERS[i].min) return tierOf(ODDS_TIERS[i].k); return tierOf('common'); }
    var CARD_KEY = { odds: 'Common under +800 · Rare +800 · Epic +1500 · Legendary +2500 (best odds he hit at)', depth: 'Common WR1/RB1 · Rare WR2/TE · Epic WR3/QB · Legendary deep cuts' };
    var CARDS = { season: {}, sort: {}, all: {} }; // per album: chosen season / sort / show-all
    function tierOf(k) { return CARD_TIERS.filter(function(t) { return t.k === k; })[0]; }

    // 📸 Roster history (Automation.gs saves both teams' Rosters columns when a game kicks off),
    // so a card shows where a player was on the depth chart THAT week, not where he is today.
    var RH_POS = ['WR1', 'RB1', 'WR2', 'QB', 'TE', 'WR3', 'Extra', 'Extra', 'Extra'];
    var ROSTER_HIST = null; // year -> week -> playerKey -> { pos, team }
    function loadRosterHistory() {
      if (ROSTER_HIST) return Promise.resolve(ROSTER_HIST);
      return Promise.all(SEASONS.map(function(se) {
        var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + se.sheetId + '/values/' + encodeURIComponent("'Roster History'!A1:M4000") + '?key=' + API_KEY;
        return fetch(url).then(function(r) { return r.ok ? r.json() : { values: [] }; }).then(function(d) { return { year: se.year, rows: (d.values || []).slice(1) }; })
          .catch(function() { return { year: se.year, rows: [] }; });
      })).then(function(list) {
        ROSTER_HIST = {};
        list.forEach(function(x) {
          var Y = ROSTER_HIST[x.year] = {};
          x.rows.forEach(function(r) {
            var w = parseInt(r[0], 10);
            if (!w) return;
            var W = Y[w] = Y[w] || {};
            for (var i = 0; i < RH_POS.length; i++) { var n = (r[4 + i] || '').trim(); if (n && !W[playerKey(n)]) W[playerKey(n)] = { pos: RH_POS[i], team: r[2] }; }
          });
        });
        return ROSTER_HIST;
      });
    }
    // Where he was the week of this hit (null if that week wasn't saved)
    function depthThen(name, year, week) {
      var W = ROSTER_HIST && ROSTER_HIST[year] && ROSTER_HIST[year][parseInt(week, 10)];
      var x = W && W[playerKey(name)];
      if (!x) return null;
      if (TIER_BY_SLOT[x.pos]) return { slot: x.pos, tier: tierOf(TIER_BY_SLOT[x.pos]), then: true };
      return { slot: 'Deep cut', tier: tierOf('legendary'), then: true };
    }

    // Where a player sits on the Rosters tab right now
    function depthOf(name) {
      var ri = typeof ROSTER_INFO !== 'undefined' ? ROSTER_INFO[playerKey(name)] : null;
      if (ri && ri.pos && TIER_BY_SLOT[ri.pos]) return { slot: ri.pos, tier: tierOf(TIER_BY_SLOT[ri.pos]) };
      if (ri && ri.team && !ri.pos) return { slot: 'Deep cut', tier: tierOf('legendary') };
      var nf = typeof nflOf === 'function' ? nflOf(name) : null;
      return { slot: nf && nf.pos ? nf.pos : 'Off the board', tier: tierOf('rare'), gone: true }; // not on the Rosters tab anymore
    }

    // Maria / Danielle: their hits from every season (with odds and units)
    function mdHits(rows, who) {
      var out = [];
      rows.forEach(function(r) {
        if (r.picker !== who || r.correct !== 'Yes' || isNotOffered(r) || !r.firstScorer) return;
        var home = playerKey(r.firstScorer) === playerKey(r.homePick);
        out.push({ name: r.firstScorer, team: home ? r.homeTeam : r.awayTeam, year: r.year, week: r.week, odds: oddsN(home ? r.homeOdds : r.awayOdds) * 100, units: r.netUnits });
      });
      return out;
    }
    // Hits -> one card per player
    function buildCards(hits, mode) {
      var C = {}, latest = { year: '', week: 0 };
      hits.forEach(function(x) {
        var k = playerKey(x.name);
        var c = C[k] || (C[k] = { name: x.name, team: x.team, hits: [], best: 0, units: 0 });
        c.team = x.team || c.team;
        c.hits.push(x);
        if (x.odds) c.best = Math.max(c.best, x.odds);
        if (x.units) c.units += x.units;
        if (x.year > latest.year || (x.year === latest.year && x.week > latest.week)) latest = { year: x.year, week: x.week };
      });
      return Object.keys(C).map(function(k) {
        var c = C[k], last = c.hits[c.hits.length - 1];
        var d = depthThen(c.name, last.year, last.week) || depthOf(c.name); // that week's depth chart if saved, else today's
        c.slot = d.slot; c.gone = d.gone; c.then = d.then;
        c.tier = mode === 'odds' ? oddsTier(c.best) : d.tier;
        c.isNew = c.hits.some(function(h) { return h.year === latest.year && h.week === latest.week && h.year === CURRENT_YEAR; });
        return c;
      });
    }

    function rostersReady() {
      return Promise.all([(typeof ROSTERS_READY !== 'undefined' ? ROSTERS_READY : Promise.resolve()).catch(function() {}), loadRosterHistory().catch(function() {})]);
    }
    // Maria or Danielle's album
    function renderCardAlbum(el, who) {
      if (!el) return;
      Promise.all([loadAllBets(), rostersReady()]).then(function(res) {
        drawCardAlbum(el, { key: who, who: who, color: personColor(who), hits: mdHits(res[0], who), seasons: true, mode: 'odds' });
      }).catch(function() { el.innerHTML = ''; });
    }
    // Any album (Maria, Danielle, a friend, the Machine): A = { key, who, color, hits, seasons, mode }
    function drawCardAlbum(el, A) {
      var season = A.seasons ? (CARDS.season[A.key] || 'all') : 'all', sort = CARDS.sort[A.key] || 'rarity';
      var years = SEASONS.map(function(s) { return s.year; });
      var cards = buildCards(A.hits.filter(function(x) { return season === 'all' || x.year === season; }), A.mode);
      var order = { legendary: 0, epic: 1, rare: 2, common: 3 };
      cards.sort(sort === 'newest'
        ? function(a, b) { var x = a.hits[a.hits.length - 1], y = b.hits[b.hits.length - 1]; return y.year - x.year || y.week - x.week || order[a.tier.k] - order[b.tier.k]; }
        : function(a, b) { return order[a.tier.k] - order[b.tier.k] || (A.mode === 'odds' ? b.best - a.best || b.hits.length - a.hits.length : b.hits.length - a.hits.length || b.best - a.best); });
      var counts = { legendary: 0, epic: 0, rare: 0, common: 0 };
      cards.forEach(function(c) { counts[c.tier.k]++; });
      var showAll = CARDS.all[A.key], LIMIT = 12;
      var h = '<div class="pf-h">🃏 Card Collection <small>' + cards.length + ' card' + (cards.length === 1 ? '' : 's') + ' · rarity = ' + (A.mode === 'odds' ? 'odds' : 'depth chart spot') + '</small></div>' +
        '<div class="tcd-bar">' + (A.seasons ? '<div class="af-bar"><span class="af-bar-label">Season</span>' + ['all'].concat(years).map(function(y) {
          return '<button class="filter-btn' + (season === y ? ' active' : '') + '" data-tcd-season="' + y + '">' + (y === 'all' ? 'All' : y) + '</button>';
        }).join('') + '</div>' : '') +
        '<div class="af-bar"><span class="af-bar-label">Sort</span><button class="filter-btn' + (sort === 'rarity' ? ' active' : '') + '" data-tcd-sort="rarity">Rarest</button><button class="filter-btn' + (sort === 'newest' ? ' active' : '') + '" data-tcd-sort="newest">Newest</button></div></div>';
      if (!cards.length) {
        el.innerHTML = h + '<div class="ch-empty">No cards yet. Every first TD ' + escHtml(A.who) + ' calls becomes one.</div>';
      } else {
        h += '<div class="tcd-tally">' + CARD_TIERS.map(function(t) { return counts[t.k] ? '<span class="tcd-t-' + t.k + '" title="' + t.d + '">' + counts[t.k] + ' ' + t.t + '</span>' : ''; }).join('') +
          '<span class="tcd-key">' + CARD_KEY[A.mode] + '</span></div>';
        h += '<div class="tcd-grid">' + cards.map(function(c, i) { return cardHtml(c, A, i >= LIMIT && !showAll); }).join('') + '</div>';
        if (cards.length > LIMIT) h += '<div class="af-more"><button class="link-btn" data-tcd-all="1">' + (showAll ? 'Show less' : 'Show all ' + cards.length) + '</button></div>';
        el.innerHTML = h;
        if (typeof fillHeadshots === 'function') fillHeadshots(el);
      }
      el.querySelectorAll('[data-tcd-season]').forEach(function(b) { b.addEventListener('click', function() { CARDS.season[A.key] = b.getAttribute('data-tcd-season'); drawCardAlbum(el, A); }); });
      el.querySelectorAll('[data-tcd-sort]').forEach(function(b) { b.addEventListener('click', function() { CARDS.sort[A.key] = b.getAttribute('data-tcd-sort'); drawCardAlbum(el, A); }); });
      var more = el.querySelector('[data-tcd-all]');
      if (more) more.addEventListener('click', function() { CARDS.all[A.key] = !CARDS.all[A.key]; drawCardAlbum(el, A); });
      el.querySelectorAll('.tcd').forEach(function(card) {
        card.addEventListener('click', function(e) {
          if (e.target.closest('.tcd-share')) return shareTradingCard(card, e.target.closest('.tcd-share'));
          flipCard(card);
        });
        card.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipCard(card); } });
      });
    }

    function cardHtml(c, A, hidden) {
      var t = resolveTeam(c.team), tc = TEAM_COLORS[t] || { primary: '#374151', secondary: '#6B7280', dark: '#A1A9B6' };
      var first = c.hits[0], last = c.hits[c.hits.length - 1], odds = c.best > 0;
      var back = c.hits.slice().reverse().map(function(x) {
        return '<div class="tcd-hit"><span>' + x.year + ' ' + wkName(x.week) + '</span>' + (x.odds ? '<b>+' + Math.round(x.odds) + '</b>' : '') + (x.units ? '<em>' + fmtU(x.units) + '</em>' : '<em>✓</em>') + '</div>';
      }).join('');
      return '<div class="tcd tcd-' + c.tier.k + '" tabindex="0" role="button" aria-label="' + escHtml(c.name) + ' card, ' + c.tier.t + '"' +
        ' data-share="card-' + playerKey(A.who) + '-' + playerKey(c.name) + '" style="--c1:' + (tc.primary || '#374151') + ';--c2:' + (tc.secondary || tc.primary || '#6B7280') + (hidden ? ';display:none' : '') + '">' +
        '<div class="tcd-front">' +
          '<div class="tcd-top"><span class="tcd-rar">' + c.tier.t + '</span>' + (c.isNew ? '<span class="tcd-new">NEW</span>' : '') + (c.hits.length > 1 ? '<span class="tcd-x">×' + c.hits.length + '</span>' : '') + '</div>' +
          '<div class="tcd-art">' + headshot(c.name, t, 78) + '</div>' +
          '<div class="tcd-name">' + escHtml(c.name) + '</div>' +
          '<div class="tcd-team">' + teamLogo(t) + escHtml(t ? t.split(' ').pop() : '') + '</div>' +
          (A.mode === 'odds' && odds
            ? '<div class="tcd-pos">+' + Math.round(c.best) + '</div><div class="tcd-sub-odds">' + escHtml(c.gone ? 'best odds' : c.slot + ' · best odds') + '</div>'
            : '<div class="tcd-pos' + (c.slot.length > 4 ? ' long' : '') + '">' + escHtml(c.slot) + '</div>' + (odds ? '<div class="tcd-sub-odds">best +' + Math.round(c.best) + '</div>' : '')) +
          '<div class="tcd-foot"><span style="color:' + A.color + '">' + escHtml(A.who) + '</span> · ' + last.year + ' ' + wkName(last.week) + '</div>' +
        '</div>' +
        '<div class="tcd-back">' +
          '<div class="tcd-bname">' + escHtml(c.name) + '</div>' +
          '<div class="tcd-bsub">' + (c.then ? (c.slot === 'Deep cut' ? 'A deep cut' : c.slot) + ' for the ' + (t ? t.split(' ').pop() : 'team') + ' that week' : c.gone ? 'Not on the Rosters tab anymore' : c.slot + ' for the ' + (t ? t.split(' ').pop() : 'team')) + ' · ' + c.tier.t + '</div>' +
          '<div class="tcd-bsub">Hit ' + c.hits.length + '× for ' + escHtml(A.who) + (c.units ? ' · ' + fmtU(c.units) + ' total' : '') + '</div>' +
          '<div class="tcd-hits">' + back + '</div>' +
          '<div class="tcd-bsub">First pulled ' + first.year + ' ' + wkName(first.week) + '</div>' +
          '<button class="tcd-share no-share">Share card</button>' +
        '</div>' +
        '<button class="share-btn tcd-sbtn" tabindex="-1" aria-hidden="true">Share</button>' +
      '</div>';
    }

    // Flat flip (no 3D), so the card still saves cleanly as a picture
    function flipCard(card) {
      if (card.classList.contains('flipping')) return;
      card.classList.add('flipping');
      setTimeout(function() { card.classList.toggle('flip'); }, 160);
      setTimeout(function() { card.classList.remove('flipping'); }, 340);
    }
    function shareTradingCard(card, btn) {
      var go = function() { if (typeof shareCard === 'function') shareCard(card.querySelector('.tcd-sbtn')); };
      btn.textContent = 'Saving…';
      if (card.classList.contains('flip')) { flipCard(card); setTimeout(go, 420); } else go();
      setTimeout(function() { btn.textContent = 'Share card'; }, 2400);
    }
