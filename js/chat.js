// Trash Talk tab.
// Part of the MariaVsDanielle site. All js/ files share one global scope and load in the order listed in index.html.

    // ── Trash Talk wall ─────────────────────────────────────────────────────
    // Everyone can read; only Maria and Danielle can post and react (with their PIN).
    var CHAT = { timer: null, pin: '', name: '', lastKey: '', season: null, seasons: [], msgs: [] };
    var CHAT_REACTIONS = ['🔥', '😂', '💀', '👏', '🤡'];

    function chatSeason() {
      return SEASONS.filter(function(x) { return x.year === CHAT.season; })[0] || SEASONS.filter(function(x) { return x.year === CURRENT_YEAR; })[0] || SEASONS[0];
    }
    function isCurrentChat() { return chatSeason().year === CURRENT_YEAR; }

    function fetchChatRows(season) {
      var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + season.sheetId + '/values/' +
        encodeURIComponent("'Trash Talk'!A1:E20000") + '?key=' + API_KEY;
      return fetch(url).then(function(r) { if (!r.ok) throw new Error('no tab'); return r.json(); })
        .then(function(d) { return d.values || []; });
    }

    function loadChatTab() {
      if (!CHAT.session) {
        try { CHAT.pin = localStorage.getItem('mvd-chat-pin') || ''; CHAT.name = localStorage.getItem('mvd-chat-name') || ''; } catch (e) {}
      }
      if (!CHAT.season) CHAT.season = CURRENT_YEAR;
      renderChatShell();
      refreshChat();
      findChatSeasons();
      stopChatRefresh();
      CHAT.timer = setInterval(function() { if (isCurrentChat()) refreshChat(); }, 20000);
    }
    function stopChatRefresh() { if (CHAT.timer) { clearInterval(CHAT.timer); CHAT.timer = null; } }

    // Only show a season switcher for seasons that actually have a Trash Talk tab
    function findChatSeasons() {
      if (CHAT.seasons.length) return drawSeasonSwitch();
      Promise.all(SEASONS.map(function(se) {
        return se.year === CURRENT_YEAR ? Promise.resolve(se) : fetchChatRows(se).then(function() { return se; }).catch(function() { return null; });
      })).then(function(list) {
        CHAT.seasons = list.filter(Boolean).map(function(se) { return se.year; }).sort().reverse();
        drawSeasonSwitch();
      });
    }
    function drawSeasonSwitch() {
      var box = document.getElementById('chat-seasons');
      if (!box) return;
      if (CHAT.seasons.length < 2) { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="af-bar" style="justify-content:center;margin-bottom:14px"><span class="af-bar-label">Season</span>' +
        CHAT.seasons.map(function(y) {
          return '<button class="filter-btn' + (y === CHAT.season ? ' active' : '') + '" data-chat-season="' + y + '">' + y + '</button>';
        }).join('') + '</div>';
      box.querySelectorAll('[data-chat-season]').forEach(function(b) {
        b.addEventListener('click', function() {
          CHAT.season = b.getAttribute('data-chat-season');
          CHAT.lastKey = '';
          drawSeasonSwitch();
          renderComposer();
          document.getElementById('chat-feed').innerHTML = '<div class="loading">Loading…</div>';
          document.getElementById('chat-pinned').innerHTML = '';
          refreshChat();
        });
      });
    }

    function renderChatShell() {
      var el = document.getElementById('chat-content');
      if (el.querySelector('#chat-feed')) { renderComposer(); return; }
      el.innerHTML =
        '<div style="text-align:center;margin-bottom:18px">' +
          '<div style="font-size:22px;font-weight:800;letter-spacing:-0.3px">Trash Talk 🗣️</div>' +
          '<div style="font-size:12px;color:#A1A9B6;margin-top:4px">Everyone can read. Only <span style="color:' + SB_M + ';font-weight:700">Maria</span> and <span style="color:' + SB_D + ';font-weight:700">Danielle</span> can post. Tap a message to react.</div>' +
        '</div>' +
        '<div id="chat-seasons"></div>' +
        '<div id="chat-compose"></div>' +
        '<div id="chat-pinned"></div>' +
        '<div class="chat-feed" id="chat-feed"><div class="loading">Loading…</div></div>';
      renderComposer();
      document.getElementById('chat-feed').addEventListener('click', onChatClick);
      document.getElementById('chat-pinned').addEventListener('click', onChatClick);
    }

    function renderComposer() {
      var box = document.getElementById('chat-compose');
      if (!PICKS_URL) { box.innerHTML = ''; return; }
      if (!isCurrentChat()) {
        box.innerHTML = '<div style="text-align:center;font-size:12px;color:#A1A9B6;margin-bottom:16px">📜 ' + CHAT.season + ' archive. Read only.</div>';
        return;
      }
      // Everyone else just reads, so the box stays folded behind a button
      if (!CHAT.pin && !CHAT.open) {
        box.innerHTML = '<div class="chat-fold"><button class="chat-fold-btn" id="chat-open">✏️ Post a message</button></div>';
        document.getElementById('chat-open').addEventListener('click', function() {
          CHAT.open = true; renderComposer();
          var t = document.getElementById('chat-text'); if (t) t.focus();
        });
        return;
      }
      var c = CHAT.name === 'Maria' ? SB_M : CHAT.name === 'Danielle' ? SB_D : '#F3F4F6';
      box.innerHTML = '<div class="chat-compose">' +
        '<textarea class="chat-input" id="chat-text" maxlength="280" placeholder="' + (CHAT.name ? 'Talk your trash, ' + CHAT.name + '…' : 'Say something…') + '"></textarea>' +
        '<div class="chat-row">' +
          (CHAT.pin
            ? '<div style="font-size:12px;color:#A1A9B6">Posting as <b style="color:' + c + '">' + CHAT.name + '</b> · <button class="link-btn" id="chat-forget">Not you?</button></div>'
            : '<div style="display:flex;align-items:center;gap:8px"><input class="chat-pin" id="chat-pin" type="password" inputmode="numeric" maxlength="4" placeholder="PIN" autocomplete="off">' +
              '<label style="font-size:11px;color:#A1A9B6;display:flex;align-items:center;gap:5px"><input type="checkbox" id="chat-remember" checked> Remember me</label></div>') +
          '<div style="display:flex;align-items:center;gap:10px"><span id="chat-count" style="font-size:11px;color:rgba(255,255,255,0.4)">280</span>' +
          '<button class="primary-btn" id="chat-send" style="padding:10px 22px">Post</button></div>' +
        '</div>' +
        '<div class="submit-msg" id="chat-msg"></div></div>';
      var ta = document.getElementById('chat-text');
      ta.addEventListener('input', function() { document.getElementById('chat-count').textContent = 280 - ta.value.length; });
      ta.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
      document.getElementById('chat-send').addEventListener('click', sendChat);
      var f = document.getElementById('chat-forget');
      if (f) f.addEventListener('click', function() {
        CHAT.pin = ''; CHAT.name = ''; CHAT.open = true;
        try { localStorage.removeItem('mvd-chat-pin'); localStorage.removeItem('mvd-chat-name'); } catch (e) {}
        renderComposer();
      });
    }

    // PIN to use: the remembered one, or whatever is typed in the PIN box
    function chatPin() { return CHAT.pin || ((document.getElementById('chat-pin') || {}).value || '').trim(); }

    function rememberChatUser(pin, name) {
      CHAT.name = name;
      if (typeof rememberMe === 'function') rememberMe(name);
      var remember = document.getElementById('chat-remember');
      if (!CHAT.pin && remember && remember.checked) {
        CHAT.pin = pin;
        try { localStorage.setItem('mvd-chat-pin', pin); localStorage.setItem('mvd-chat-name', name); } catch (e) {}
        renderComposer();
      }
    }

    function sendChat() {
      var ta = document.getElementById('chat-text');
      var msg = document.getElementById('chat-msg');
      var btn = document.getElementById('chat-send');
      var text = ta.value.trim();
      var pin = chatPin();
      if (!text) return;
      if (!pin) { msg.style.color = '#F87171'; msg.textContent = 'Enter your PIN to post.'; return; }
      btn.disabled = true; btn.textContent = 'Posting…'; msg.textContent = '';
      picksApi({ pin: pin, action: 'chat', text: text }).then(function(res) {
        btn.disabled = false; btn.textContent = 'Post';
        if (res.error) { msg.style.color = '#F87171'; msg.textContent = res.error; return; }
        var hadPin = !!CHAT.pin;
        rememberChatUser(pin, res.name);
        addLocalMessage(res.name, text);
        var t2 = document.getElementById('chat-text');
        if (t2) { t2.value = ''; document.getElementById('chat-count').textContent = '280'; }
        setTimeout(refreshChat, 1500);
      }).catch(function() {
        btn.disabled = false; btn.textContent = 'Post';
        msg.style.color = '#F87171'; msg.textContent = 'Couldn\'t reach the sheet. Try again.';
      });
    }

    function reactionPills(m) {
      var counts = {};
      Object.keys(m.reactions).forEach(function(who) { var e = m.reactions[who]; (counts[e] = counts[e] || []).push(who); });
      return Object.keys(counts).map(function(e) {
        var mine = CHAT.name && counts[e].indexOf(CHAT.name) >= 0;
        return '<span class="chat-react' + (mine ? ' mine' : '') + '" title="' + counts[e].join(' & ') + '">' + e +
          (counts[e].length > 1 ? ' ' + counts[e].length : '') + '</span>';
      }).join('');
    }

    function chatBubble(m) {
      var cls = m.who === 'Maria' ? 'maria' : 'danielle';
      var c = personColor(m.who);
      var t = m.when ? m.when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'now';
      var pills = m.reactions ? reactionPills(m) : '';
      return '<div class="chat-msg ' + cls + '"' + (m.row ? ' data-row="' + m.row + '"' : '') + '>' +
        '<div class="chat-meta"><span style="color:' + c + '">' + m.who + '</span><span class="chat-time">' + t + '</span></div>' +
        escHtml(m.text) +
        (pills ? '<div class="chat-reacts">' + pills + '</div>' : '') +
        '</div>';
    }

    function addLocalMessage(who, text) {
      var feed = document.getElementById('chat-feed');
      if (!feed) return;
      if (feed.querySelector('.loading') || feed.querySelector('.chat-empty')) feed.innerHTML = '';
      feed.insertAdjacentHTML('afterbegin', chatBubble({ who: who, text: text, when: new Date() }));
    }

    // Tap a message: show the reaction tray (current season only)
    function onChatClick(e) {
      var pick = e.target.closest('[data-emoji]');
      if (pick) { e.stopPropagation(); sendReaction(+pick.closest('[data-row]').getAttribute('data-row'), pick.getAttribute('data-emoji')); return; }
      var bubble = e.target.closest('[data-row]');
      document.querySelectorAll('.chat-tray').forEach(function(t) { t.remove(); });
      if (!bubble || !isCurrentChat()) return;
      var tray = document.createElement('div');
      tray.className = 'chat-tray';
      tray.innerHTML = CHAT_REACTIONS.map(function(em) { return '<button data-emoji="' + em + '">' + em + '</button>'; }).join('');
      bubble.appendChild(tray);
    }

    function sendReaction(row, emoji) {
      document.querySelectorAll('.chat-tray').forEach(function(t) { t.remove(); });
      var pin = chatPin();
      var msg = document.getElementById('chat-msg');
      if (!pin) {
        if (!CHAT.open) { CHAT.open = true; renderComposer(); msg = document.getElementById('chat-msg'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (msg) { msg.style.color = '#F87171'; msg.textContent = 'Enter your PIN above to react.'; }
        var pinBox = document.getElementById('chat-pin'); if (pinBox) pinBox.focus();
        return;
      }
      // Show it right away; the sheet catches up a moment later
      var m = CHAT.msgs.filter(function(x) { return x.row === row; })[0];
      if (m && CHAT.name) {
        if (m.reactions[CHAT.name] === emoji) delete m.reactions[CHAT.name]; else m.reactions[CHAT.name] = emoji;
        drawChat(CHAT.msgs);
      }
      picksApi({ pin: pin, action: 'react', row: row, emoji: emoji }).then(function(res) {
        if (res.error) { if (msg) { msg.style.color = '#F87171'; msg.textContent = res.error; } CHAT.lastKey = ''; refreshChat(); return; }
        if (!CHAT.name || !CHAT.pin) rememberChatUser(pin, res.name);
        if (m) { m.reactions = res.reactions || {}; drawChat(CHAT.msgs); }
      }).catch(function() { CHAT.lastKey = ''; refreshChat(); });
    }

    // ── Unread dot on the Trash Talk tab ──────────────────────────────────────
    // Each phone remembers how many messages it has seen.
    function chatCount(rows) {
      return rows.filter(function(r, i) { return i > 0 && (r[1] === 'Maria' || r[1] === 'Danielle') && (r[2] || '').trim(); }).length;
    }
    function chatSeen() { try { var n = parseInt(localStorage.getItem('mvd-chat-seen'), 10); return isNaN(n) ? null : n; } catch (e) { return null; } }
    function markChatRead(total) {
      try { localStorage.setItem('mvd-chat-seen', String(total)); } catch (e) {}
      setChatDot(0);
      if (typeof VISIT !== 'undefined' && VISIT.chat) { VISIT.chat = 0; drawVisitBanner(); }
    }
    function setChatDot(n) {
      document.querySelectorAll('.tab-btn[onclick="switchTab(\'chat\')"]').forEach(function(b) {
        var d = b.querySelector('.tab-dot');
        if (!n) { if (d) d.remove(); return; }
        if (!d) { d = document.createElement('span'); d.className = 'tab-dot'; b.appendChild(d); }
        d.textContent = n > 99 ? '99+' : n;
      });
    }
    function checkChatUnread() {
      var season = SEASONS.filter(function(x) { return x.year === CURRENT_YEAR; })[0];
      if (!season) return;
      fetchChatRows(season).then(function(rows) {
        var total = chatCount(rows), seen = chatSeen();
        if (seen === null) { try { localStorage.setItem('mvd-chat-seen', String(total)); } catch (e) {} return; } // first visit
        if (document.getElementById('tab-chat').classList.contains('active')) { markChatRead(total); return; }
        var n = Math.max(0, total - seen);
        setChatDot(n);
        if (typeof VISIT !== 'undefined') { VISIT.chat = n; drawVisitBanner(); }
      }).catch(function() {});
    }

    function parseSheetTime(v) {
      // Sheets returns the formatted date text, e.g. "10/1/2026 14:05:33"
      var m = (v || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
      if (m) return new Date(+m[3], +m[1] - 1, +m[2], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
      var d = new Date(v);
      return isNaN(d) ? null : d;
    }

    function parseReactions(v) {
      var out = {};
      (v || '').split(';').forEach(function(part) {
        var kv = part.split('=');
        if (kv.length === 2 && (kv[0].trim() === 'Maria' || kv[0].trim() === 'Danielle')) out[kv[0].trim()] = kv[1].trim();
      });
      return out;
    }

    function refreshChat() {
      var season = chatSeason();
      fetchChatRows(season).then(function(rows) {
        if (chatSeason() !== season) return; // switched seasons meanwhile
        var msgs = [];
        rows.forEach(function(r, i) {
          if (i === 0 || !(r[1] === 'Maria' || r[1] === 'Danielle') || !(r[2] || '').trim()) return;
          msgs.push({ row: i + 1, when: parseSheetTime(r[0]), who: r[1], text: r[2], pinned: /pin/i.test(r[3] || ''), reactions: parseReactions(r[4]) });
        });
        if (season.year === CURRENT_YEAR && document.getElementById('tab-chat').classList.contains('active')) markChatRead(msgs.length);
        var key = season.year + '|' + JSON.stringify(msgs.map(function(m) { return [m.row, m.text, m.pinned, m.reactions]; }));
        if (key === CHAT.lastKey) return;
        CHAT.lastKey = key;
        CHAT.msgs = msgs;
        if (!document.querySelector('.chat-tray')) drawChat(msgs);
      }).catch(function() {
        CHAT.msgs = [];
        drawChat([]); // tab doesn't exist yet
      });
    }

    function drawChat(msgs) {
      var feed = document.getElementById('chat-feed');
      var pinBox = document.getElementById('chat-pinned');
      if (!feed) return;
      var pinned = msgs.filter(function(m) { return m.pinned; });
      pinBox.innerHTML = pinned.map(function(m) {
        return '<div class="chat-pinned">📌 <b style="color:' + (personColor(m.who)) + '">' + m.who + ':</b> ' + escHtml(m.text) + '</div>';
      }).join('');
      if (!msgs.length) {
        feed.innerHTML = '<div class="chat-empty" style="text-align:center;color:#A1A9B6;padding:28px 0">' +
          (isCurrentChat() ? 'No trash talk yet. Somebody start it. 👀' : 'No trash talk saved for ' + CHAT.season + '.') + '</div>';
        return;
      }
      var html = '', lastDay = '';
      msgs.slice().reverse().forEach(function(m) {
        var day = m.when ? m.when.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '';
        if (day && day !== lastDay) { html += '<div class="chat-day">' + day + '</div>'; lastDay = day; }
        html += chatBubble(m);
      });
      feed.innerHTML = html;
    }
