// Admin, 👥 People: Friends (invite link, approvals), Trash Talk moderation
// Loaded by admin.js (showAdmin) the first time you open this section. Part of the MariaVsDanielle site; shares the global scope.

    // ── Admin: friends ──────────────────────────────────────────────────────
    function adminFriends() {
      var body = adminScreen('friends', '<div class="loading">Loading…</div>');
      picksApi({ pin: SUB.pin, action: 'friends' }).then(function(res) {
        if (!document.body.contains(body)) return; // left this tab before it loaded
        ADMIN.friends = res.friends || [];
        var list = ADMIN.friends;
        var h = '<div class="u-mt-0 pf-h">👥 Friends</div>' +
          '<div class="ui-note u-mb">Friends log in with their PIN to make their own picks. PINs are stored in the script, not the sheet. Text each friend their PIN.</div>' +
          '<div class="u-d-flex u-gap-8px u-fwrap-wrap u-mb-6px">' +
            '<input class="u-f-2 u-minw-140px adm-input" id="fr-name" placeholder="Name" maxlength="24">' +
            '<input class="u-w-90px u-ls-0-2em u-ta-center adm-input" id="fr-pin" placeholder="PIN" maxlength="4" inputmode="numeric">' +
            '<button class="adm-btn" id="fr-rand" title="Random PIN">🎲</button>' +
            '<button class="u-p-9px-18px primary-btn" id="fr-add">Add Friend</button>' +
          '</div><div class="u-ta-left submit-msg" id="adm-msg"></div>' +
          inviteHtml(res) +
          '<div class="u-fs-11px u-fw-800 u-ls-0-12em u-c-muted u-m-14px-0-4px">FRIENDS (' + list.length + ')</div>';
        h += list.length ? list.map(function(f) {
          return '<div class="adm-row"><div><b style="color:' + fStyle(f.name).color + '">' + (fStyle(f.name).emoji ? fStyle(f.name).emoji + ' ' : '') + escHtml(f.name) + '</b> <span class="u-c-muted u-ls-0-15em u-ml-6px">' + f.pin + '</span></div>' +
            '<div class="u-d-flex u-gap-6px"><button class="adm-btn" data-fprof="' + escHtml(f.name) + '">Profile</button>' +
            '<button class="adm-btn" data-fpin="' + escHtml(f.name) + '">PIN</button>' +
            '<button class="adm-btn red" data-frm="' + escHtml(f.name) + '">Remove</button></div></div>';
        }).join('') : '<div class="u-c-muted u-fs-13px u-p-10px-0">No friends yet.</div>';
        body.innerHTML = h;
        document.getElementById('fr-rand').addEventListener('click', function() {
          var taken = list.map(function(f) { return f.pin; }), pin;
          do { pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); } while (taken.indexOf(pin) >= 0);
          document.getElementById('fr-pin').value = pin;
        });
        document.getElementById('fr-add').addEventListener('click', function() {
          var name = document.getElementById('fr-name').value.trim(), pin = document.getElementById('fr-pin').value.trim();
          if (!name) return adminMsg('Type a name.');
          if (!/^\d{4}$/.test(pin)) return adminMsg('PINs are 4 digits.');
          adminMsg('Saving…', true);
          picksApi({ pin: SUB.pin, action: 'friendadd', name: name, newpin: pin }).then(function(r) {
            if (r.error) return adminMsg(r.error);
            CROWD.data = null; adminFriends();
          }).catch(function() { adminMsg('Couldn\'t reach the sheet.'); });
        });
        body.querySelectorAll('[data-frm]').forEach(function(b) {
          b.addEventListener('click', function() {
            var n = b.getAttribute('data-frm');
            if (!confirm('Remove ' + n + '? Their PIN stops working and they drop off the Crowd tab. Their old picks stay saved in the private sheet.')) return;
            picksApi({ pin: SUB.pin, action: 'friendrm', name: n }).then(function() { CROWD.data = null; adminFriends(); });
          });
        });
        body.querySelectorAll('[data-fprof]').forEach(function(b) {
          b.addEventListener('click', function() { openProfile(b.getAttribute('data-fprof')); });
        });
        body.querySelectorAll('[data-fpin]').forEach(function(b) {
          b.addEventListener('click', function() {
            var n = b.getAttribute('data-fpin');
            var pin = prompt('New 4-digit PIN for ' + n + ':', '');
            if (pin === null) return;
            pin = pin.trim();
            if (!/^\d{4}$/.test(pin)) return adminMsg('PINs are 4 digits.');
            adminMsg('Saving…', true);
            picksApi({ pin: SUB.pin, action: 'friendpin', name: n, newpin: pin }).then(function(r) {
              if (r.error) return adminMsg(r.error);
              adminFriends(); setTimeout(function() { adminMsg(n + '\'s new PIN is saved. Their old one stops working now.', true); }, 600);
            }).catch(function() { adminMsg('Couldn\'t reach the script.'); });
          });
        });
        bindInvite(body, res);
      });
    }
    // 📨 Invite link + people waiting to be approved (v129)
    function inviteLink(code) { return location.origin + location.pathname + '#join?c=' + code; }
    function inviteHtml(res) {
      var pend = res.pending || [], h = '<div class="pf-h">📨 Invite link</div>';
      h += res.invite
        ? '<div class="ui-note u-mb">Anyone with this link can ask to join. They pick a name and PIN, and you approve them here.</div>' +
          '<div class="inv-box"><code id="inv-url">' + escHtml(inviteLink(res.invite)) + '</code></div>' +
          '<div class="u-d-flex u-gap-6px u-fwrap-wrap u-mb-6px"><button class="adm-btn" id="inv-copy">📋 Copy</button>' +
          (navigator.share ? '<button class="adm-btn" id="inv-share">📤 Share</button>' : '') +
          '<button class="adm-btn" id="inv-new">🔄 New link</button><button class="adm-btn red" id="inv-off">Turn off</button></div>'
        : '<div class="ui-note u-mb">No invite link right now. Make one to let friends sign themselves up (you still approve each one).</div>' +
          '<button class="u-p-9px-18px primary-btn u-mb-6px" id="inv-new">Make an invite link</button>';
      if (pend.length) {
        h += '<div class="u-fs-11px u-fw-800 u-ls-0-12em u-c-warn u-m-14px-0-4px">WAITING FOR YOU (' + pend.length + ')</div>' +
          pend.map(function(r) {
            return '<div class="adm-row inv-pend"><div><b>' + escHtml(r.name) + '</b> <span class="u-c-muted u-fs-12px">' + (r.at ? new Date(r.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '') + '</span>' +
              (r.clash ? '<div class="u-fs-12px u-c-warn">Their PIN is already used. Approving asks you for a new one.</div>' : '') + '</div>' +
              '<div class="u-d-flex u-gap-6px"><button class="adm-btn" data-jok="' + escHtml(r.name) + '" data-clash="' + (r.clash ? 1 : '') + '">✅ Approve</button>' +
              '<button class="adm-btn red" data-jno="' + escHtml(r.name) + '">Decline</button></div></div>';
          }).join('');
      }
      return h;
    }
    function bindInvite(body, res) {
      function act(params, done) {
        adminMsg('Saving…', true);
        picksApi(Object.assign({ pin: SUB.pin }, params)).then(function(r) {
          if (r.error) {
            if (r.clash && params.action === 'joinok') return approve(params.name, true);
            return adminMsg(r.error);
          }
          CROWD.data = null; adminFriends();
          if (done) setTimeout(function() { adminMsg(done, true); }, 600);
        }).catch(function() { adminMsg('Couldn\'t reach the script.'); });
      }
      function approve(n, clash) {
        var params = { action: 'joinok', name: n };
        if (clash) {
          var pin = prompt(n + '\'s PIN is already used by someone else. Type a new 4-digit PIN for them (you\'ll need to text it to them):', '');
          if (pin === null) return adminMsg('');
          pin = pin.trim();
          if (!/^\d{4}$/.test(pin)) return adminMsg('PINs are 4 digits.');
          params.newpin = pin;
        }
        act(params, n + ' is in! They can log in now' + (clash ? ' with the new PIN you gave them.' : ' with the PIN they picked.'));
      }
      var on = function(id, fn) { var b = document.getElementById(id); if (b) b.addEventListener('click', fn); };
      on('inv-copy', function() {
        var url = inviteLink(res.invite);
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function() { adminMsg('Copied. Text it to your friends.', true); })
          .catch(function() { prompt('Copy this link:', url); });
      });
      on('inv-share', function() { navigator.share({ title: 'Join Maria vs Danielle', text: 'Make your picks against Maria and Danielle:', url: inviteLink(res.invite) }).catch(function() {}); });
      on('inv-new', function() {
        if (res.invite && !confirm('Make a new link? The old one stops working.')) return;
        act({ action: 'invitenew' }, 'New invite link ready.');
      });
      on('inv-off', function() { if (confirm('Turn off the invite link? Nobody new can sign up until you make another.')) act({ action: 'inviteoff' }); });
      body.querySelectorAll('[data-jok]').forEach(function(b) { b.addEventListener('click', function() { approve(b.getAttribute('data-jok'), !!b.getAttribute('data-clash')); }); });
      body.querySelectorAll('[data-jno]').forEach(function(b) {
        b.addEventListener('click', function() {
          var n = b.getAttribute('data-jno');
          if (confirm('Decline ' + n + '?')) act({ action: 'joinno', name: n });
        });
      });
    }
    // Trash Talk moderation
    function adminChat() {
      var body = adminScreen('chat', '<div class="loading">Loading…</div>');
      fetchChatRows(SEASONS[0]).then(function(rows) {
        var msgs = [];
        rows.forEach(function(r, i) { if (i && (r[2] || '').trim()) msgs.push({ row: i + 1, who: r[1], text: r[2], pinned: /pin/i.test(r[3] || '') }); });
        msgs.reverse();
        body.innerHTML = '<div class="ui-note u-mb">Pin the best ones to the top of the wall, or delete anything that should go.</div>' +
          '<div class="u-ta-left submit-msg" id="adm-msg"></div>' +
          (msgs.length ? msgs.slice(0, 60).map(function(m) {
            var c = personColor(m.who);
            return '<div class="adm-row"><div class="u-f-1 u-minw-0"><b style="color:' + c + '">' + escHtml(m.who) + '</b> ' + (m.pinned ? '📌 ' : '') +
              '<span class="u-c-soft">' + escHtml(m.text) + '</span></div>' +
              '<div class="u-d-flex u-gap-6px"><button class="adm-btn" data-pin="' + m.row + '">' + (m.pinned ? 'Unpin' : 'Pin') + '</button>' +
              '<button class="adm-btn red" data-del="' + m.row + '" data-text="' + escHtml(m.text) + '">Delete</button></div></div>';
          }).join('') : '<div class="u-c-muted u-fs-13px">No messages yet.</div>');
        body.querySelectorAll('[data-pin]').forEach(function(b) {
          b.addEventListener('click', function() {
            b.disabled = true;
            picksApi({ pin: SUB.pin, action: 'chatpin', row: b.getAttribute('data-pin') }).then(function(r) {
              if (r.error) return adminMsg(r.error);
              CHAT.lastKey = ''; adminChat();
            });
          });
        });
        body.querySelectorAll('[data-del]').forEach(function(b) {
          b.addEventListener('click', function() {
            if (!confirm('Delete this message for good?\n\n"' + b.getAttribute('data-text') + '"')) return;
            b.disabled = true;
            picksApi({ pin: SUB.pin, action: 'chatdel', row: b.getAttribute('data-del'), text: b.getAttribute('data-text') }).then(function(r) {
              if (r.error) return adminMsg(r.error);
              CHAT.lastKey = ''; adminChat();
            });
          });
        });
      }).catch(function() {
        body.innerHTML = '<div class="u-c-muted u-fs-13px">No Trash Talk tab yet. It appears after the first post.</div>';
      });
    }
