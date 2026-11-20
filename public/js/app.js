/* ═══════════════════════════════════════════════════════════════════════════
   SuperBuzz — Client Application
   ═══════════════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const socket = io({ reconnection: true, reconnectionDelay: 1000 });

  // ─── State ──────────────────────────────────────────────────────────────────
  let role = null;       // 'host' | 'player'
  let myName = '';
  let roomState = null;  // latest room state from server
  let mySocketId = null;
  let linkedRoomCode = null;

  socket.on('connect', () => { mySocketId = socket.id; });

  // ─── DOM References ────────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const landing = $('#landing');
  const hostDash = $('#host-dashboard');
  const playerView = $('#player-view');

  const roomCodeFromLink = window.location.pathname.match(/^\/room\/([^/]+)\/?$/)?.[1]
    || new URLSearchParams(window.location.search).get('room');
  if (roomCodeFromLink) {
    const code = roomCodeFromLink.trim().toUpperCase();
    linkedRoomCode = code;
    landing.classList.add('room-link-mode');
    $('#join-instructions').textContent = 'Enter your name to join this room.';
    $('#linked-room-code-value').textContent = code;
    $('#linked-room-code').classList.remove('hidden');
    $('#input-player-name').focus();
    const statusEl = $('#room-link-status');
    $('#input-room-code').value = code;
    $('#btn-join-room').disabled = true;
    if (!/^[A-Z0-9]{5}$/.test(code)) {
      statusEl.textContent = 'This room link is invalid. Check the link or ask the host for a new one.';
      statusEl.classList.remove('hidden');
    } else {
      fetch(`/api/rooms/${encodeURIComponent(code)}`)
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          statusEl.textContent = `Room ${result.code} is ready. Enter your name to join.`;
          statusEl.classList.add('room-link-ready');
          statusEl.classList.remove('hidden');
          $('#btn-join-room').disabled = false;
        })
        .catch((error) => {
          statusEl.textContent = error.message || 'This room is no longer available. Ask the host for a new link.';
          statusEl.classList.remove('room-link-ready');
          statusEl.classList.remove('hidden');
        });
    }
  }

  // ─── View Switching ────────────────────────────────────────────────────────
  function showView(view) {
    landing.classList.toggle('hidden', view !== 'landing');
    hostDash.classList.toggle('hidden', view !== 'host');
    playerView.classList.toggle('hidden', view !== 'player');
  }

  // ─── Landing Page ──────────────────────────────────────────────────────────
  $('#btn-create-room').addEventListener('click', () => {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    socket.emit('room:create', { mode }, (res) => {
      if (res.success) {
        role = 'host';
        roomState = res.state;
        $('#host-room-link').value = `${window.location.origin}/room/${encodeURIComponent(res.code)}`;
        showView('host');
        renderHostDashboard();
      }
    });
  });

  $('#btn-copy-room-link').addEventListener('click', async () => {
    const button = $('#btn-copy-room-link');
    try {
      await navigator.clipboard.writeText($('#host-room-link').value);
      button.textContent = 'Copied!';
    } catch {
      $('#host-room-link').select();
      document.execCommand('copy');
      button.textContent = 'Copied!';
    }
    setTimeout(() => { button.textContent = 'Copy Link'; }, 1800);
  });

  $('#btn-join-room').addEventListener('click', joinRoom);
  $('#input-player-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
  $('#input-room-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#input-player-name').focus(); });
  $('#input-room-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });

  function joinRoom() {
    const code = linkedRoomCode || $('#input-room-code').value.trim();
    const name = $('#input-player-name').value.trim();
    const errEl = $('#join-error');
    errEl.textContent = '';
    if (!code) { errEl.textContent = 'Please enter a room code.'; return; }
    if (!name) { errEl.textContent = 'Please enter your name.'; return; }
    socket.emit('room:join', { code, name }, (res) => {
      if (res.success) {
        role = 'player';
        myName = name;
        roomState = res.state;
        showView('player');
        renderPlayerView();
      } else {
        errEl.textContent = res.error || 'Failed to join room.';
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOST DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Buzzer Controls ──
  $('#btn-open-buzzer').addEventListener('click', () => { socket.emit('buzzer:open'); });
  $('#btn-close-buzzer').addEventListener('click', () => { socket.emit('buzzer:close'); });
  $('#btn-correct').addEventListener('click', () => {
    $('#btn-correct').disabled = true;
    $('#btn-incorrect').disabled = true;
    socket.emit('answer:correct');
  });
  $('#btn-incorrect').addEventListener('click', () => {
    $('#btn-correct').disabled = true;
    $('#btn-incorrect').disabled = true;
    socket.emit('answer:incorrect');
  });
  $('#btn-next-question').addEventListener('click', () => { socket.emit('question:next'); });
  $('#btn-reset-scores').addEventListener('click', () => {
    if (confirm('Reset all scores and question count?')) socket.emit('scores:reset');
  });
  $('#btn-leave-room').addEventListener('click', () => {
    if (confirm('End this session? All players will be disconnected.')) location.reload();
  });

  // ── Mode Toggle ──
  $('#btn-mode-bee').addEventListener('click', () => { socket.emit('room:set-mode', { mode: 'bee' }); });
  $('#btn-mode-bowl').addEventListener('click', () => { socket.emit('room:set-mode', { mode: 'bowl' }); });

  // ── 3-Buzz Rule Setting Toggle ──
  $('#toggle-three-buzz').addEventListener('change', (e) => {
    socket.emit('room:set-three-buzz-rule', { enabled: e.target.checked });
  });

  // ── Team Management ──
  $('#btn-add-team').addEventListener('click', () => {
    const name = $('#input-team-name').value.trim();
    if (name) {
      socket.emit('team:add', { name }, () => { $('#input-team-name').value = ''; });
    }
  });
  $('#input-team-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btn-add-team').click();
  });

  function renderHostDashboard() {
    if (!roomState) return;
    const s = roomState;

    // Header
    $('#host-room-code').textContent = s.code;
    $('#host-mode-badge').textContent = s.mode.toUpperCase();
    $('#host-mode-badge').className = 'mode-badge mode-' + s.mode;
    $('#host-question-num').textContent = 'Q' + s.questionNumber;

    // Mode buttons
    $('#btn-mode-bee').classList.toggle('active', s.mode === 'bee');
    $('#btn-mode-bowl').classList.toggle('active', s.mode === 'bowl');

    // 3-Buzz rule setting visibility & state (Bee mode only)
    const threeBuzzCard = $('#setting-three-buzz-card');
    if (threeBuzzCard) {
      threeBuzzCard.classList.toggle('hidden', s.mode !== 'bee');
      $('#toggle-three-buzz').checked = s.threeBuzzRule !== false;
    }

    // Team panel title
    $('#teams-panel-title').textContent = s.mode === 'bowl' ? 'Teams & Players' : 'Players';
    $('#team-management').classList.toggle('hidden', s.mode !== 'bowl');

    // Buzzer control buttons
    const openBtn = $('#btn-open-buzzer');
    const closeBtn = $('#btn-close-buzzer');
    if (s.buzzerOpen) {
      openBtn.classList.add('hidden');
      closeBtn.classList.remove('hidden');
    } else {
      openBtn.classList.remove('hidden');
      closeBtn.classList.add('hidden');
    }

    // Buzz result area
    const resultArea = $('#buzz-result-area');
    if (s.buzzQueue.length > 0) {
      resultArea.classList.remove('hidden');
      $('#btn-correct').disabled = false;
      $('#btn-incorrect').disabled = false;
      
      // Dynamic button labels based on mode and incorrect count
      if (s.mode === 'bee') {
        $('#btn-correct').textContent = 'Correct (+1)';
        const count = s.questionIncorrectCount || 0;
        if (s.threeBuzzRule !== false) {
          if (count === 2) {
            $('#btn-incorrect').textContent = 'Incorrect (-1 pt & Next Q)';
          } else {
            $('#btn-incorrect').textContent = `Incorrect (Lock Out, ${count + 1}/3)`;
          }
        } else {
          $('#btn-incorrect').textContent = 'Incorrect (Lock Out)';
        }
      } else {
        $('#btn-correct').textContent = 'Correct (+10)';
        $('#btn-incorrect').textContent = 'Incorrect (Lock Out)';
      }

      const top = s.buzzQueue[0];
      $('#buzz-player-name').textContent = top.playerName;
      $('#buzz-adj-time').textContent = top.adjustedTime.toFixed(1);
      $('#buzz-raw-time').textContent = top.rawTime.toFixed(1);
      $('#buzz-rtt').textContent = top.rtt.toFixed(1);
    } else {
      resultArea.classList.add('hidden');
    }

    // Buzz queue list
    const queueEl = $('#buzz-queue-list');
    if (s.buzzQueue.length === 0) {
      queueEl.innerHTML = '<p class="empty-state">No buzzes yet</p>';
    } else {
      queueEl.innerHTML = s.buzzQueue.map((b, i) => `
        <div class="queue-entry ${i === 0 ? 'first' : ''}">
          <span class="queue-rank">#${i + 1}</span>
          <span class="queue-name">${esc(b.playerName)}</span>
          <span class="queue-time">${b.adjustedTime.toFixed(1)}ms</span>
          <span class="queue-detail">raw ${b.rawTime.toFixed(1)}ms · rtt ${b.rtt.toFixed(1)}ms</span>
        </div>
      `).join('');
    }

    // Lockout list
    const lockEl = $('#lockout-list');
    const questionLocks = new Set(s.questionLockedOutPlayers || []);
    const questionTeamLocks = new Set(s.questionLockedOutTeams || []);
    const individuallyUnlocked = new Set(s.questionUnlockedPlayers || []);
    if (s.lockedOutPlayers.length === 0) {
      lockEl.innerHTML = '<p class="empty-state">None</p>';
    } else {
      const manualLocks = new Set(s.manuallyLockedOutPlayers || []);
      const names = s.lockedOutPlayers.map(pid => {
        const p = s.players.find(pl => pl.id === pid);
        if (!p) return pid;
        const reasons = [];
        if (manualLocks.has(pid)) reasons.push('manual');
        if (questionLocks.has(pid)) reasons.push('this question');
        return `${esc(p.name)} (${reasons.join(', ')})`;
      });
      lockEl.innerHTML = names.map(n => `<span class="lockout-tag">Locked: ${n}</span>`).join(' ');
    }

    // Teams list (Bowl mode)
    if (s.mode === 'bowl') {
      const teamsEl = $('#teams-list');
      if (s.teams.length === 0) {
        teamsEl.innerHTML = '<p class="empty-state">No teams yet. Add teams above.</p>';
      } else {
        teamsEl.innerHTML = s.teams.map(t => {
          const members = s.players.filter(p => p.teamId === t.id);
          const isLockedOut = s.lockedOutTeams.includes(t.id);
          return `
            <div class="team-card ${isLockedOut ? 'locked-out' : ''}">
              <div class="team-card-header">
                <strong>${esc(t.name)}</strong>
                <span class="team-score">${t.score} pts</span>
                <button class="btn btn-xs btn-danger" onclick="removeTeam('${t.id}')">Delete</button>
              </div>
              <div class="team-members">
                ${members.length === 0 ? '<em class="muted">No members</em>' :
                  members.map(m => `<span class="member-tag">${esc(m.name)}</span>`).join(' ')}
              </div>
              ${isLockedOut ? '<div class="team-lockout-badge">LOCKED OUT</div>' : ''}
            </div>
          `;
        }).join('');
      }
    }

    // Players list
    const playersEl = $('#players-list');
    if (s.players.length === 0) {
      playersEl.innerHTML = '<p class="empty-state">No players have joined yet.<br>Share the room code above.</p>';
    } else {
      playersEl.innerHTML = s.players.map(p => {
        const team = s.teams.find(t => t.id === p.teamId);
        const isLocked = s.lockedOutPlayers.includes(p.id)
          || (s.mode === 'bowl' && questionTeamLocks.has(p.teamId) && !individuallyUnlocked.has(p.id));
        const isManuallyLocked = (s.manuallyLockedOutPlayers || []).includes(p.id);
        const isQuestionLocked = questionLocks.has(p.id)
          || (s.mode === 'bowl' && questionTeamLocks.has(p.teamId) && !individuallyUnlocked.has(p.id));
        return `
          <div class="player-card ${isLocked ? 'locked-out' : ''}">
            <div class="player-card-info">
              <strong>${esc(p.name)}</strong>
              ${team ? `<span class="player-team-tag">${esc(team.name)}</span>` : ''}
              <span class="player-rtt-tag">${p.rtt}ms</span>
              ${isLocked ? `<span class="player-lockout-tag">[${isManuallyLocked ? 'Manual Lockout' : 'Locked'}]</span>` : ''}
            </div>
            <div class="player-card-actions">
              ${isQuestionLocked ? `<button class="btn btn-xs btn-outline" onclick="unlockPlayerForQuestion('${p.id}')">Unlock This Question</button>` : ''}
              <button class="btn btn-xs ${isManuallyLocked ? 'btn-outline' : 'btn-danger-outline'}" onclick="setManualLockout('${p.id}', ${!isManuallyLocked})">${isManuallyLocked ? 'Unlock' : 'Lock Out'}</button>
              ${s.mode === 'bowl' ? `
                <select class="input input-sm" onchange="assignTeam('${p.id}', this.value)">
                  <option value="">No team</option>
                  ${s.teams.map(t => `<option value="${t.id}" ${p.teamId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                </select>
              ` : ''}
              <button class="btn btn-xs btn-danger" onclick="kickPlayer('${p.id}')">Kick</button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Scoreboard
    renderScoreboard($('#scoreboard'), s);
  }

  // Global functions for inline event handlers
  window.removeTeam = (teamId) => { socket.emit('team:remove', { teamId }); };
  window.assignTeam = (playerId, teamId) => { socket.emit('player:assign-team', { playerId, teamId: teamId || null }); };
  window.setManualLockout = (playerId, locked) => { socket.emit('player:set-manual-lockout', { playerId, locked }); };
  window.unlockPlayerForQuestion = (playerId) => { socket.emit('player:unlock-question', { playerId }); };
  window.kickPlayer = (playerId) => { if (confirm('Kick this player?')) socket.emit('player:kick', { playerId }); };

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAYER VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  const buzzBtn = $('#btn-buzz');
  let canBuzz = false;

  buzzBtn.addEventListener('click', doBuzz);
  document.addEventListener('keydown', (e) => {
    if (role !== 'player') return;
    if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); doBuzz(); }
  });

  function doBuzz() {
    if (!canBuzz) return;
    canBuzz = false;
    buzzBtn.disabled = true;
    buzzBtn.classList.add('pressed');
    socket.emit('buzzer:buzz');
    SoundFX.buzzIn();
  }

  function renderPlayerView() {
    if (!roomState) return;
    const s = roomState;

    $('#player-my-name').textContent = myName;
    const myPlayer = s.players.find(p => p.id === mySocketId);
    const myTeam = s.mode === 'bowl' ? s.teams.find(team => team.id === myPlayer?.teamId) : null;
    const teamEl = $('#player-my-team');
    teamEl.textContent = myTeam ? myTeam.name : '';
    teamEl.classList.toggle('hidden', !myTeam);
    $('#player-room-code').textContent = s.code;
    $('#player-question-num').textContent = 'Question ' + s.questionNumber;

    const statusEl = $('#status-text');
    const feedbackEl = $('#player-feedback');
    const feedbackContent = $('#feedback-content');

    // Check if I'm locked out
    const amLockedOut = s.lockedOutPlayers.includes(mySocketId);
    const personallyUnlocked = (s.questionUnlockedPlayers || []).includes(mySocketId);
    const teamLockedOut = s.mode === 'bowl' && myPlayer?.teamId && s.lockedOutTeams.includes(myPlayer.teamId) && !personallyUnlocked;

    if (s.buzzerOpen && !amLockedOut && !teamLockedOut) {
      canBuzz = true;
      buzzBtn.disabled = false;
      buzzBtn.classList.remove('disabled', 'pressed');
      buzzBtn.classList.add('active');
      statusEl.textContent = 'BUZZER IS OPEN — GO!';
      statusEl.parentElement.className = 'buzzer-status open';
    } else if (amLockedOut || teamLockedOut) {
      canBuzz = false;
      buzzBtn.disabled = true;
      buzzBtn.classList.add('disabled');
      buzzBtn.classList.remove('active', 'pressed');
      const manuallyLocked = (s.manuallyLockedOutPlayers || []).includes(mySocketId);
      statusEl.textContent = manuallyLocked
        ? 'The host has manually locked you out'
        : teamLockedOut ? 'Your team is locked out this question' : 'You are locked out this question';
      statusEl.parentElement.className = 'buzzer-status locked-out';
    } else if (s.currentBuzzPlayerId) {
      canBuzz = false;
      buzzBtn.disabled = true;
      buzzBtn.classList.add('disabled');
      buzzBtn.classList.remove('active', 'pressed');
      const buzzer = s.buzzQueue[0];
      if (s.currentBuzzPlayerId === mySocketId) {
        statusEl.textContent = 'YOU BUZZED IN! Waiting for ruling...';
        statusEl.parentElement.className = 'buzzer-status you-buzzed';
      } else {
        statusEl.textContent = `${buzzer?.playerName || 'Someone'} buzzed in`;
        statusEl.parentElement.className = 'buzzer-status someone-buzzed';
      }
    } else {
      canBuzz = false;
      buzzBtn.disabled = true;
      buzzBtn.classList.add('disabled');
      buzzBtn.classList.remove('active', 'pressed');
      statusEl.textContent = 'Waiting for host to open buzzer...';
      statusEl.parentElement.className = 'buzzer-status waiting';
    }

    // Player scoreboard
    renderScoreboard($('#player-scoreboard'), s);
  }

  // ─── Latency Calibration ──────────────────────────────────────────────────
  socket.on('calibration:ping', (serverTime) => {
    socket.emit('calibration:pong', serverTime);
  });

  socket.on('calibration:update', ({ rtt, samples }) => {
    if (role !== 'player') return;
    const rttEl = $('#player-rtt');
    const dotEl = $('#latency-dot');
    rttEl.textContent = rtt.toFixed(1) + ' ms';
    if (rtt < 50) { dotEl.className = 'latency-dot green'; }
    else if (rtt < 150) { dotEl.className = 'latency-dot yellow'; }
    else { dotEl.className = 'latency-dot red'; }
  });

  // ─── Room State Updates ───────────────────────────────────────────────────
  socket.on('room:state', (state) => {
    roomState = state;
    if (role === 'host') renderHostDashboard();
    else if (role === 'player') renderPlayerView();
  });

  socket.on('buzzer:opened', () => {
    if (role === 'player') SoundFX.buzzerOpen();
    if (role === 'host') SoundFX.buzzerOpen();
  });

  socket.on('buzzer:buzzed', ({ queue, recognized }) => {
    if (role === 'host') SoundFX.buzzIn();
  });

  socket.on('answer:result', ({ correct, player, penalty, thirdIncorrect, points }) => {
    if (correct) {
      SoundFX.correct();
      const pts = points ? ` (+${points})` : '';
      if (role === 'player') showPlayerFeedback(`${player.playerName} answered correctly!${pts}`, 'correct');
    } else {
      SoundFX.incorrect();
      if (role === 'player') {
        if (thirdIncorrect) {
          showPlayerFeedback(`3rd incorrect guess! ${player.playerName} lost 1 point (-1). Moving to next question.`, 'incorrect');
        } else {
          showPlayerFeedback(`${player.playerName} answered incorrectly — locked out`, 'incorrect');
        }
      }
    }
  });

  socket.on('buzzer:rejected', ({ reason }) => {
    SoundFX.lockout();
    showPlayerFeedback(reason, 'lockout');
  });

  socket.on('room:kicked', () => {
    alert('You have been removed from the room.');
    location.reload();
  });

  socket.on('room:destroyed', ({ reason }) => {
    alert('Room closed: ' + reason);
    location.reload();
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function showPlayerFeedback(msg, type) {
    const el = $('#player-feedback');
    const content = $('#feedback-content');
    content.textContent = msg;
    el.className = 'player-feedback ' + type;
    el.classList.remove('hidden');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('hidden'), 3000);
  }

  function renderScoreboard(container, state) {
    if (state.mode === 'bee') {
      const sorted = [...state.players].sort((a, b) => b.score - a.score);
      if (sorted.length === 0) {
        container.innerHTML = '<p class="empty-state">No players</p>';
        return;
      }
      container.innerHTML = sorted.map((p, i) => `
        <div class="score-row ${p.id === mySocketId ? 'me' : ''}">
          <span class="score-rank">${i + 1}.</span>
          <span class="score-name">${esc(p.name)}</span>
          <span class="score-value">${p.score}</span>
        </div>
      `).join('');
    } else {
      const sorted = [...state.teams].sort((a, b) => b.score - a.score);
      if (sorted.length === 0) {
        container.innerHTML = '<p class="empty-state">No teams</p>';
        return;
      }
      container.innerHTML = sorted.map((t, i) => {
        const members = state.players.filter(p => p.teamId === t.id);
        return `
          <div class="score-row team-score">
            <span class="score-rank">${i + 1}.</span>
            <span class="score-name">${esc(t.name)}<small class="score-members">${members.map(m => esc(m.name)).join(', ')}</small></span>
            <span class="score-value">${t.score}</span>
          </div>
        `;
      }).join('');
    }
  }

  function esc(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }
})();
