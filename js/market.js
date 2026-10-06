// 📈 The Crowd Market: friends trade fake coins on who wins each week (server side: Market.gs).
// Loaded on demand (loadScriptOnce) by the Crowd tab and the friends' 📈 Market screen.
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    var MKT = { data: null, at: 0, side: 'Maria', coins: 100 };
    function getMarket(fresh) {
      if (!fresh && MKT.data && Date.now() - MKT.at < 30000) return Promise.resolve(MKT.data);
      return picksApi({ action: 'market' }).then(function(d) { if (!d.error) { MKT.data = d; MKT.at = Date.now(); } return d; });
    }
    // Same math as Market.gs (LMSR)
    function mkPrice(q, B) { return 1 / (1 + Math.exp((q.Danielle - q.Maria) / B)); }
    function mkShares(q, side, coins, M) {
      var mine = side === 'Maria' ? q.Maria : q.Danielle, other = side === 'Maria' ? q.Danielle : q.Maria;
      var k = coins / (M.payout * M.b), a = mine / M.b, b = other / M.b, m = Math.max(a, b);
      var s = Math.exp(k) * (Math.exp(a - m) + Math.exp(b - m)) - Math.exp(b - m);
      return M.b * (Math.log(s) + m) - mine;
    }
    function mkName(n, M) {
      var st = (M.styles || {})[n] || {};
      return '<a class="fr-link" data-fname="' + escHtml(n) + '" style="color:' + (st.color || FRIEND_COLOR) + '">' + (st.emoji ? st.emoji + ' ' : '') + escHtml(n) + '</a>';
    }
    function mkPct(p) { return Math.round(p * 100) + '%'; }
    function mkCoins(n) { return Math.round(n).toLocaleString('en-US'); }
    function mkAgo(iso) {
      var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
      return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago';
    }
    function mkUntil(iso) {
      if (!iso) return '';
      var t = new Date(iso), m = Math.round((t - Date.now()) / 60000);
      var when = t.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
      return m <= 0 ? when : when + ' (in ' + (m < 60 ? m + 'm' : m < 1440 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h') + ')';
    }
    // Maria's price after every trade, as a small line
    function mkSpark(w) {
      var pts = [0.5].concat(w.trades.map(function(t) { return t.price; }));
      if (pts.length < 2) pts.push(0.5);
      var W = 280, H = 56, n = pts.length - 1;
      var xy = pts.map(function(p, i) { return [(i / n) * W, 4 + (1 - p) * (H - 8)]; });
      var d = xy.map(function(p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      return '<svg class="mk-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
        '<line x1="0" x2="' + W + '" y1="' + (H / 2) + '" y2="' + (H / 2) + '" stroke="rgba(255,255,255,0.15)" stroke-dasharray="3 4"/>' +
        '<path d="' + d + '" fill="none" stroke="' + SB_M + '" stroke-width="2.2" stroke-linejoin="round"/>' +
        '<circle cx="' + xy[n][0].toFixed(1) + '" cy="' + xy[n][1].toFixed(1) + '" r="3.5" fill="' + SB_M + '"/></svg>';
    }

    // Draws the whole Market into el. opts.trade = show the buy form (friends only)
    function renderMarket(el, opts) {
      opts = opts || {};
      if (!el) return;
      if (!el.innerHTML) el.innerHTML = '<div class="loading">Loading the market…</div>';
      getMarket(opts.fresh).then(function(M) {
        if (M.error) { el.innerHTML = opts.trade ? '<div class="loading">' + escHtml(M.error) + '</div>' : ''; return; }
        drawMarket(el, M, opts);
      }).catch(function() { el.innerHTML = opts.trade ? '<div class="loading">Couldn\'t reach the market. Try again in a minute.</div>' : ''; });
    }
    function drawMarket(el, M, opts) {
      var wk = M.weeks.filter(function(w) { return w.week === M.open; })[0];
      var live = M.weeks.filter(function(w) { return w.status === 'closed'; });
      var done = M.weeks.filter(function(w) { return w.status === 'settled'; }).reverse();
      var me = opts.trade && SUB.role === 'friend' ? (M.board.filter(function(b) { return b.friend === SUB.name; })[0] || { cash: M.start, riding: 0 }) : null;
      var h = '<div class="mk">';
      h += '<div class="mk-head"><div class="mk-title">📈 The Market</div><div class="mk-sub">Fake coins on who wins each week (most hits). A winning share pays ' + M.payout + ', a tie pays half.</div></div>';

      if (wk) {
        var p = mkPrice(wk.q, M.b);
        h += '<div class="mk-card">' +
          '<div class="mk-q"><span>' + weekName(wk.week) + ': who wins the week?</span>' + (wk.closes ? '<span class="mk-close">Closes ' + mkUntil(wk.closes) + '</span>' : '<span class="mk-close">Open until kickoff</span>') + '</div>' +
          '<div class="mk-bar"><i style="width:' + (p * 100).toFixed(1) + '%;background:' + SB_M + '"></i><i style="width:' + ((1 - p) * 100).toFixed(1) + '%;background:' + SB_D + '"></i></div>' +
          '<div class="mk-odds"><div><b style="color:' + SB_M + '">Maria ' + mkPct(p) + '</b><small>pays ' + (1 / p).toFixed(2) + '×</small></div>' +
          '<div style="text-align:right"><b style="color:' + SB_D + '">Danielle ' + mkPct(1 - p) + '</b><small>pays ' + (1 / (1 - p)).toFixed(2) + '×</small></div></div>' +
          (wk.trades.length ? mkSpark(wk) : '') +
          '<div class="mk-meta">' + mkCoins(wk.volume) + ' coins traded · ' + wk.trades.length + ' trade' + (wk.trades.length === 1 ? '' : 's') + '</div>';
        if (me) {
          h += '<div class="mk-trade"><div class="mk-bal">You have <b>' + mkCoins(me.cash) + '</b> coins' + (me.riding ? ' · ' + mkCoins(me.riding) + ' riding on games in play' : '') + '</div>' +
            '<div class="mk-sides"><button data-mk-side="Maria" class="' + (MKT.side === 'Maria' ? 'on' : '') + '" style="--pc:' + SB_M + '">Maria wins</button>' +
            '<button data-mk-side="Danielle" class="' + (MKT.side === 'Danielle' ? 'on' : '') + '" style="--pc:' + SB_D + '">Danielle wins</button></div>' +
            '<div class="mk-chips">' + [25, 50, 100, 250].map(function(c) { return '<button data-mk-c="' + c + '">' + c + '</button>'; }).join('') + '<button data-mk-c="all">All in</button></div>' +
            '<div class="mk-amt"><input class="adm-input" id="mk-coins" type="number" min="' + M.min + '" step="1" inputmode="numeric" value="' + Math.min(MKT.coins, Math.max(M.min, Math.floor(me.cash))) + '"><span>coins</span></div>' +
            '<div class="mk-prev" id="mk-prev"></div>' +
            '<button class="primary-btn" id="mk-buy" style="width:100%">Buy</button><div class="submit-msg" id="mk-msg"></div></div>';
        } else if (opts.trade) {
          h += '<div class="mk-meta">Only friends can trade. Maria and Danielle get to watch.</div>';
        }
        if (wk.trades.length) {
          h += '<div class="mk-h">Latest trades</div>' + wk.trades.slice(-6).reverse().map(function(t) {
            return '<div class="mk-tr">' + mkName(t.friend, M) + ' bought <b style="color:' + personColor(t.side) + '">' + t.shares.toFixed(1) + ' ' + t.side + '</b> for ' + mkCoins(t.coins) + '<span>' + mkAgo(t.at) + '</span></div>';
          }).join('');
        }
        h += '</div>';
      } else {
        h += '<div class="mk-card"><div class="mk-meta" style="margin:0">No market is open right now. The next week opens once there are games left to play.</div></div>';
      }

      // Weeks in play (trading closed, waiting on first TDs) and finished ones
      if (live.length || done.length) {
        h += '<div class="mk-h">Past weeks</div>' + live.concat(done).slice(0, 8).map(function(w) {
          var p = mkPrice(w.q, M.b);
          var res = w.status === 'settled'
            ? (w.winner === 'Tie' ? '🤝 Tie ' + w.hits.Maria + '–' + w.hits.Danielle + ', everyone gets half' : '🏆 <b style="color:' + personColor(w.winner) + '">' + w.winner + '</b> won ' + Math.max(w.hits.Maria, w.hits.Danielle) + '–' + Math.min(w.hits.Maria, w.hits.Danielle))
            : '⏳ In play · ' + w.scored + ' of ' + w.games + ' games scored';
          return '<div class="mk-row"><div><b>' + weekName(w.week) + '</b><div class="mk-rs">' + res + '</div></div><div class="mk-fp">closed at<br><b style="color:' + SB_M + '">M ' + mkPct(p) + '</b> · <b style="color:' + SB_D + '">D ' + mkPct(1 - p) + '</b></div></div>';
        }).join('');
      }

      // Leaderboard
      var board = M.board.filter(function(b) { return b.trades; });
      if (board.length) {
        h += '<div class="mk-h">Leaderboard <small>coins on hand + riding</small></div>' + board.map(function(b, i) {
          var tot = b.cash + b.riding, diff = tot - M.start;
          return '<div class="mk-lb"><span class="mk-rank">' + (i === 0 ? '👑' : i + 1) + '</span><span class="mk-who">' + mkName(b.friend, M) + '</span>' +
            '<span class="mk-tot">' + mkCoins(tot) + '<small style="color:' + (diff >= 0 ? '#34D399' : '#F87171') + '">' + (diff >= 0 ? '+' : '') + mkCoins(diff) + '</small></span></div>';
        }).join('');
      }
      h += '<div class="mk-foot">Everyone starts the season with ' + mkCoins(M.start) + ' coins. Prices move as people buy, so a price is the crowd\'s chance she wins. Trading closes at each week\'s first kickoff.</div></div>';
      el.innerHTML = h;
      if (me && wk) bindMarketTrade(el, M, wk, me, opts);
    }

    function bindMarketTrade(el, M, wk, me, opts) {
      var inp = el.querySelector('#mk-coins'), prev = el.querySelector('#mk-prev'), msg = el.querySelector('#mk-msg'), buy = el.querySelector('#mk-buy');
      function preview() {
        var c = Math.floor(Number(inp.value));
        MKT.coins = c || MKT.coins;
        if (!(c >= M.min)) { prev.textContent = 'At least ' + M.min + ' coins.'; buy.disabled = true; return; }
        if (c > me.cash) { prev.textContent = 'You only have ' + mkCoins(me.cash) + '.'; buy.disabled = true; return; }
        var sh = mkShares(wk.q, MKT.side, c, M), q2 = { Maria: wk.q.Maria, Danielle: wk.q.Danielle };
        q2[MKT.side] += sh;
        var after = mkPrice(q2, M.b), mine = MKT.side === 'Maria' ? after : 1 - after;
        prev.innerHTML = '≈ <b>' + sh.toFixed(1) + ' shares</b> · pays <b>' + mkCoins(sh * M.payout) + '</b> if ' + MKT.side + ' wins (' + mkCoins(sh * M.payout / 2) + ' on a tie) · her price goes to ' + mkPct(mine);
        buy.disabled = false;
        buy.textContent = 'Buy ' + MKT.side + ' for ' + mkCoins(c);
      }
      el.querySelectorAll('[data-mk-side]').forEach(function(b) {
        b.addEventListener('click', function() {
          MKT.side = b.getAttribute('data-mk-side');
          el.querySelectorAll('[data-mk-side]').forEach(function(x) { x.classList.toggle('on', x === b); });
          preview();
        });
      });
      el.querySelectorAll('[data-mk-c]').forEach(function(b) {
        b.addEventListener('click', function() { var v = b.getAttribute('data-mk-c'); inp.value = v === 'all' ? Math.floor(me.cash) : v; preview(); });
      });
      inp.addEventListener('input', preview);
      preview();
      buy.addEventListener('click', function() {
        var c = Math.floor(Number(inp.value));
        if (c >= 500 && !confirm('Spend ' + mkCoins(c) + ' coins on ' + MKT.side + ' winning ' + weekName(wk.week) + '?')) return;
        buy.disabled = true; buy.textContent = 'Buying…'; msg.textContent = '';
        picksApiOnce({ pin: SUB.pin, action: 'mbuy', week: wk.week, side: MKT.side, coins: c }).then(function(r) { // once: a retry could buy twice
          if (r.error) { msg.style.color = '#F87171'; msg.textContent = r.error; buy.disabled = false; preview(); return; }
          MKT.data = r.market; MKT.at = Date.now();
          drawMarket(el, r.market, opts);
          var m2 = el.querySelector('#mk-msg');
          if (m2) { m2.style.color = '#6EE7B7'; m2.textContent = '✅ Bought ' + r.shares.toFixed(1) + ' ' + r.side + ' shares for ' + mkCoins(r.coins) + ' coins.'; }
        }).catch(function() { msg.style.color = '#F87171'; msg.textContent = 'Couldn\'t reach the market. Reload before trying again, it may have gone through.'; buy.disabled = false; });
      });
    }
