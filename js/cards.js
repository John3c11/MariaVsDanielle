// 🃏 Trading cards: every player who scored first for Maria or Danielle becomes a card in her album.
// Rarity comes from the best odds he paid off at. Loaded on demand by Profiles (loadScriptOnce).
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    var CARD_TIERS = [
      { k: 'legendary', t: 'Legendary', min: 2500 },
      { k: 'epic', t: 'Epic', min: 1500 },
      { k: 'rare', t: 'Rare', min: 800 },
      { k: 'common', t: 'Common', min: 0 },
    ];
    var CARDS = { season: {}, sort: {}, all: {} }; // per person: chosen season / sort / show-all
    function cardTier(odds) { for (var i = 0; i < CARD_TIERS.length; i++) if (odds >= CARD_TIERS[i].min) return CARD_TIERS[i]; return CARD_TIERS[3]; }

    // All of one person's cards from the bet rows: one per player, with every time he paid off
    function collectCards(rows, who) {
      var C = {}, latest = { year: '', week: 0 };
      rows.forEach(function(r) {
        if (r.picker !== who || r.correct !== 'Yes' || isNotOffered(r) || !r.firstScorer) return;
        var home = playerKey(r.firstScorer) === playerKey(r.homePick);
        var odds = oddsN(home ? r.homeOdds : r.awayOdds) * 100, team = home ? r.homeTeam : r.awayTeam;
        var k = playerKey(r.firstScorer);
        var c = C[k] || (C[k] = { name: r.firstScorer, team: team, hits: [], best: 0, units: 0 });
        c.team = team;
        c.hits.push({ year: r.year, week: r.week, odds: odds, units: r.netUnits, home: r.homeTeam, away: r.awayTeam });
        c.best = Math.max(c.best, odds); c.units += r.netUnits;
        if (r.year > latest.year || (r.year === latest.year && r.week > latest.week)) latest = { year: r.year, week: r.week };
      });
      return Object.keys(C).map(function(k) {
        var c = C[k];
        c.tier = cardTier(c.best);
        c.isNew = c.hits.some(function(h) { return h.year === latest.year && h.week === latest.week && h.year === CURRENT_YEAR; });
        return c;
      });
    }

    function renderCardAlbum(el, who) {
      if (!el) return;
      loadAllBets().then(function(rows) { drawCardAlbum(el, who, rows); }).catch(function() { el.innerHTML = ''; });
    }
    function drawCardAlbum(el, who, rows) {
      var season = CARDS.season[who] || 'all', sort = CARDS.sort[who] || 'rarity';
      var years = SEASONS.map(function(s) { return s.year; });
      var mine = rows.filter(function(r) { return season === 'all' || r.year === season; });
      var cards = collectCards(mine, who);
      var order = { legendary: 0, epic: 1, rare: 2, common: 3 };
      cards.sort(sort === 'newest'
        ? function(a, b) { var x = a.hits[a.hits.length - 1], y = b.hits[b.hits.length - 1]; return y.year - x.year || y.week - x.week || b.best - a.best; }
        : function(a, b) { return order[a.tier.k] - order[b.tier.k] || b.best - a.best || b.hits.length - a.hits.length; });
      var counts = { legendary: 0, epic: 0, rare: 0, common: 0 };
      cards.forEach(function(c) { counts[c.tier.k]++; });
      var showAll = CARDS.all[who], LIMIT = 9;
      var h = '<div class="pf-h">🃏 Card Collection <small>' + cards.length + ' card' + (cards.length === 1 ? '' : 's') + '</small></div>' +
        '<div class="tcd-bar"><div class="af-bar"><span class="af-bar-label">Season</span>' + ['all'].concat(years).map(function(y) {
          return '<button class="filter-btn' + (season === y ? ' active' : '') + '" data-tcd-season="' + y + '">' + (y === 'all' ? 'All' : y) + '</button>';
        }).join('') + '</div>' +
        '<div class="af-bar"><span class="af-bar-label">Sort</span><button class="filter-btn' + (sort === 'rarity' ? ' active' : '') + '" data-tcd-sort="rarity">Rarest</button><button class="filter-btn' + (sort === 'newest' ? ' active' : '') + '" data-tcd-sort="newest">Newest</button></div></div>';
      if (!cards.length) {
        el.innerHTML = h + '<div class="ch-empty">No cards yet. Every first TD she hits becomes one.</div>';
      } else {
        h += '<div class="tcd-tally">' + CARD_TIERS.map(function(t) { return counts[t.k] ? '<span class="tcd-t-' + t.k + '">' + counts[t.k] + ' ' + t.t + '</span>' : ''; }).join('') + '</div>';
        h += '<div class="tcd-grid">' + cards.map(function(c, i) { return cardHtml(c, who, i >= LIMIT && !showAll); }).join('') + '</div>';
        if (cards.length > LIMIT && !showAll) h += '<div style="text-align:center"><button class="link-btn" data-tcd-all="1">Show all ' + cards.length + ' cards</button></div>';
        el.innerHTML = h;
        if (typeof fillHeadshots === 'function') fillHeadshots(el);
      }
      el.querySelectorAll('[data-tcd-season]').forEach(function(b) { b.addEventListener('click', function() { CARDS.season[who] = b.getAttribute('data-tcd-season'); drawCardAlbum(el, who, rows); }); });
      el.querySelectorAll('[data-tcd-sort]').forEach(function(b) { b.addEventListener('click', function() { CARDS.sort[who] = b.getAttribute('data-tcd-sort'); drawCardAlbum(el, who, rows); }); });
      var more = el.querySelector('[data-tcd-all]');
      if (more) more.addEventListener('click', function() { CARDS.all[who] = true; drawCardAlbum(el, who, rows); });
      el.querySelectorAll('.tcd').forEach(function(card) {
        card.addEventListener('click', function(e) {
          if (e.target.closest('.tcd-share')) return shareTradingCard(card, e.target.closest('.tcd-share'));
          flipCard(card);
        });
        card.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipCard(card); } });
      });
    }

    function cardHtml(c, who, hidden) {
      var t = resolveTeam(c.team), tc = TEAM_COLORS[t] || { primary: '#374151', secondary: '#6B7280', dark: '#9CA3AF' };
      var first = c.hits[0], last = c.hits[c.hits.length - 1];
      var back = c.hits.slice().reverse().map(function(x) {
        return '<div class="tcd-hit"><span>' + x.year + ' ' + wkName(x.week) + '</span><b>+' + Math.round(x.odds) + '</b><em>' + fmtU(x.units) + '</em></div>';
      }).join('');
      return '<div class="tcd tcd-' + c.tier.k + '" tabindex="0" role="button" aria-label="' + escHtml(c.name) + ' card, ' + c.tier.t + '"' +
        ' data-share="card-' + who.toLowerCase() + '-' + playerKey(c.name) + '" style="--c1:' + (tc.primary || '#374151') + ';--c2:' + (tc.secondary || tc.primary || '#6B7280') + (hidden ? ';display:none' : '') + '">' +
        '<div class="tcd-front">' +
          '<div class="tcd-top"><span class="tcd-rar">' + c.tier.t + '</span>' + (c.isNew ? '<span class="tcd-new">NEW</span>' : '') + (c.hits.length > 1 ? '<span class="tcd-x">×' + c.hits.length + '</span>' : '') + '</div>' +
          '<div class="tcd-art">' + headshot(c.name, t, 78) + '</div>' +
          '<div class="tcd-name">' + escHtml(c.name) + '</div>' +
          '<div class="tcd-team">' + teamLogo(t) + escHtml(t ? t.split(' ').pop() : '') + '</div>' +
          '<div class="tcd-odds">+' + Math.round(c.best) + '</div>' +
          '<div class="tcd-foot"><span style="color:' + personColor(who) + '">' + who + '</span> · ' + last.year + ' ' + wkName(last.week) + '</div>' +
        '</div>' +
        '<div class="tcd-back">' +
          '<div class="tcd-bname">' + escHtml(c.name) + '</div>' +
          '<div class="tcd-bsub">Paid off ' + c.hits.length + '× for ' + who + ' · ' + fmtU(c.units) + ' total</div>' +
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
