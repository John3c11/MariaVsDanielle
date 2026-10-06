// 🃏 Trading cards: every player who scored first for someone (Maria, Danielle or a friend) is a card in their album.
// Rarity comes from where the player sits on the Rosters tab's depth chart: headliners are common,
// deep cuts are legendary. Loaded on demand by Profiles (loadScriptOnce).
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    var CARD_TIERS = [
      { k: 'legendary', t: 'Legendary', d: 'Deep cut (an extra on the Rosters tab)' },
      { k: 'epic', t: 'Epic', d: 'WR3 or QB' },
      { k: 'rare', t: 'Rare', d: 'WR2 or TE' },
      { k: 'common', t: 'Common', d: 'WR1 or RB1' },
    ];
    var TIER_BY_SLOT = { WR1: 'common', RB1: 'common', WR2: 'rare', TE: 'rare', WR3: 'epic', QB: 'epic' };
    var CARDS = { season: {}, sort: {}, all: {} }; // per album: chosen season / sort / show-all
    function tierOf(k) { return CARD_TIERS.filter(function(t) { return t.k === k; })[0]; }

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
    function buildCards(hits) {
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
        var c = C[k], d = depthOf(c.name);
        c.slot = d.slot; c.tier = d.tier; c.gone = d.gone;
        c.isNew = c.hits.some(function(h) { return h.year === latest.year && h.week === latest.week && h.year === CURRENT_YEAR; });
        return c;
      });
    }

    function rostersReady() { return (typeof ROSTERS_READY !== 'undefined' ? ROSTERS_READY : Promise.resolve()).catch(function() {}); }
    // Maria or Danielle's album
    function renderCardAlbum(el, who) {
      if (!el) return;
      Promise.all([loadAllBets(), rostersReady()]).then(function(res) {
        drawCardAlbum(el, { key: who, who: who, color: personColor(who), hits: mdHits(res[0], who), seasons: true });
      }).catch(function() { el.innerHTML = ''; });
    }
    // A friend's album: hits = [{ name, team, year, week }] from their profile
    function renderFriendCards(el, name, hits, color) {
      if (!el) return;
      rostersReady().then(function() { drawCardAlbum(el, { key: 'f:' + name, who: name, color: color, hits: hits, seasons: false }); });
    }

    function drawCardAlbum(el, A) {
      var season = A.seasons ? (CARDS.season[A.key] || 'all') : 'all', sort = CARDS.sort[A.key] || 'rarity';
      var years = SEASONS.map(function(s) { return s.year; });
      var cards = buildCards(A.hits.filter(function(x) { return season === 'all' || x.year === season; }));
      var order = { legendary: 0, epic: 1, rare: 2, common: 3 };
      cards.sort(sort === 'newest'
        ? function(a, b) { var x = a.hits[a.hits.length - 1], y = b.hits[b.hits.length - 1]; return y.year - x.year || y.week - x.week || order[a.tier.k] - order[b.tier.k]; }
        : function(a, b) { return order[a.tier.k] - order[b.tier.k] || b.hits.length - a.hits.length || b.best - a.best; });
      var counts = { legendary: 0, epic: 0, rare: 0, common: 0 };
      cards.forEach(function(c) { counts[c.tier.k]++; });
      var showAll = CARDS.all[A.key], LIMIT = 12;
      var h = '<div class="pf-h">🃏 Card Collection <small>' + cards.length + ' card' + (cards.length === 1 ? '' : 's') + ' · rarity = depth chart spot</small></div>' +
        '<div class="tcd-bar">' + (A.seasons ? '<div class="af-bar"><span class="af-bar-label">Season</span>' + ['all'].concat(years).map(function(y) {
          return '<button class="filter-btn' + (season === y ? ' active' : '') + '" data-tcd-season="' + y + '">' + (y === 'all' ? 'All' : y) + '</button>';
        }).join('') + '</div>' : '') +
        '<div class="af-bar"><span class="af-bar-label">Sort</span><button class="filter-btn' + (sort === 'rarity' ? ' active' : '') + '" data-tcd-sort="rarity">Rarest</button><button class="filter-btn' + (sort === 'newest' ? ' active' : '') + '" data-tcd-sort="newest">Newest</button></div></div>';
      if (!cards.length) {
        el.innerHTML = h + '<div class="ch-empty">No cards yet. Every first TD ' + escHtml(A.who) + ' calls becomes one.</div>';
      } else {
        h += '<div class="tcd-tally">' + CARD_TIERS.map(function(t) { return counts[t.k] ? '<span class="tcd-t-' + t.k + '" title="' + t.d + '">' + counts[t.k] + ' ' + t.t + '</span>' : ''; }).join('') +
          '<span class="tcd-key">Common WR1/RB1 · Rare WR2/TE · Epic WR3/QB · Legendary deep cuts</span></div>';
        h += '<div class="tcd-grid">' + cards.map(function(c, i) { return cardHtml(c, A, i >= LIMIT && !showAll); }).join('') + '</div>';
        if (cards.length > LIMIT && !showAll) h += '<div style="text-align:center"><button class="link-btn" data-tcd-all="1">Show all ' + cards.length + ' cards</button></div>';
        el.innerHTML = h;
        if (typeof fillHeadshots === 'function') fillHeadshots(el);
      }
      el.querySelectorAll('[data-tcd-season]').forEach(function(b) { b.addEventListener('click', function() { CARDS.season[A.key] = b.getAttribute('data-tcd-season'); drawCardAlbum(el, A); }); });
      el.querySelectorAll('[data-tcd-sort]').forEach(function(b) { b.addEventListener('click', function() { CARDS.sort[A.key] = b.getAttribute('data-tcd-sort'); drawCardAlbum(el, A); }); });
      var more = el.querySelector('[data-tcd-all]');
      if (more) more.addEventListener('click', function() { CARDS.all[A.key] = true; drawCardAlbum(el, A); });
      el.querySelectorAll('.tcd').forEach(function(card) {
        card.addEventListener('click', function(e) {
          if (e.target.closest('.tcd-share')) return shareTradingCard(card, e.target.closest('.tcd-share'));
          flipCard(card);
        });
        card.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipCard(card); } });
      });
    }

    function cardHtml(c, A, hidden) {
      var t = resolveTeam(c.team), tc = TEAM_COLORS[t] || { primary: '#374151', secondary: '#6B7280', dark: '#9CA3AF' };
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
          '<div class="tcd-pos' + (c.slot.length > 4 ? ' long' : '') + '">' + escHtml(c.slot) + '</div>' +
          (odds ? '<div class="tcd-sub-odds">best +' + Math.round(c.best) + '</div>' : '') +
          '<div class="tcd-foot"><span style="color:' + A.color + '">' + escHtml(A.who) + '</span> · ' + last.year + ' ' + wkName(last.week) + '</div>' +
        '</div>' +
        '<div class="tcd-back">' +
          '<div class="tcd-bname">' + escHtml(c.name) + '</div>' +
          '<div class="tcd-bsub">' + (c.gone ? 'Not on the Rosters tab anymore' : c.slot + ' for the ' + (t ? t.split(' ').pop() : 'team')) + ' · ' + c.tier.t + '</div>' +
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
