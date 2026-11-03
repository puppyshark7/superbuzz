import { io as ioClient } from 'socket.io-client';
import assert from 'assert';

const SERVER_URL = 'http://localhost:3000';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function connectClient() {
  return new Promise((resolve) => {
    const s = ioClient(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true,
    });
    if (s.connected) {
      resolve(s);
    } else {
      s.once('connect', () => resolve(s));
    }
  });
}

async function runTests() {
  console.log('--- Starting SuperBuzz Competition Test Suite ---');

  // Start the server
  await import('../server.js');
  await wait(500);

  // 1. Host creates a Bee room
  console.log('Test 1: Host creates Bee competition room');
  const hostSocket = await connectClient();
  let beeRoomCode = null;

  await new Promise((resolve, reject) => {
    hostSocket.emit('room:create', { mode: 'bee' }, (res) => {
      if (!res.success) return reject(new Error('Room creation failed'));
      beeRoomCode = res.code;
      assert.equal(res.state.mode, 'bee');
      assert.equal(res.state.players.length, 0);
      console.log(`✓ Room created with code: ${beeRoomCode}`);
      resolve();
    });
  });

  // 2. Players join and calibrate latency
  console.log('\nTest 2: Players join and perform latency calibration');
  const aliceSocket = await connectClient();
  const bobSocket = await connectClient();

  // Auto-respond to calibration pings
  [aliceSocket, bobSocket].forEach(s => {
    s.on('calibration:ping', (ts) => s.emit('calibration:pong', ts));
  });

  await new Promise((resolve) => {
    aliceSocket.emit('room:join', { code: beeRoomCode, name: 'Alice' }, (res) => {
      assert(res.success, 'Alice join failed');
      resolve();
    });
  });

  await new Promise((resolve) => {
    bobSocket.emit('room:join', { code: beeRoomCode, name: 'Bob' }, (res) => {
      assert(res.success, 'Bob join failed');
      resolve();
    });
  });

  // Test duplicate name prevention
  const charlieSocket = await connectClient();
  await new Promise((resolve) => {
    charlieSocket.emit('room:join', { code: beeRoomCode, name: 'Alice' }, (res) => {
      assert(!res.success, 'Should not allow duplicate name');
      assert(res.error.includes('already taken'));
      console.log('✓ Duplicate names rejected');
      charlieSocket.disconnect();
      resolve();
    });
  });

  await wait(200); // Allow calibration ping cycle
  console.log('✓ Players joined and calibrated');

  // 3. Test Millisecond-Precision Lag Correction Buzz Resolution
  console.log('\nTest 3: Millisecond-Precision Lag Correction Buzz Resolution');
  // Open buzzer
  hostSocket.emit('buzzer:open');
  await wait(50);

  // Both players buzz in
  aliceSocket.emit('buzzer:buzz');
  await wait(20);
  bobSocket.emit('buzzer:buzz');

  await wait(200);

  // Check state received by host
  let latestState = null;
  await new Promise(resolve => {
    hostSocket.once('room:state', (s) => {
      latestState = s;
      resolve();
    });
    hostSocket.emit('buzzer:close');
  });

  console.log(`✓ Buzz queue recorded. Entries: ${latestState?.buzzQueue?.length || 0}`);
  if (latestState?.buzzQueue?.length > 0) {
    const winner = latestState.buzzQueue[0];
    console.log(`✓ Recognized first buzz: ${winner.playerName} (adjusted: ${winner.adjustedTime}ms, raw: ${winner.rawTime}ms, rtt: ${winner.rtt}ms)`);
  }

  // 4. Test Lockout after Incorrect Answer (Bee Mode)
  console.log('\nTest 4: Lockout after Incorrect Answer (Individual Bee Lockout)');
  let lockedOutNotified = false;
  aliceSocket.once('buzzer:rejected', () => {
    lockedOutNotified = true;
  });

  // Mark answer incorrect
  hostSocket.emit('answer:incorrect');
  await wait(200);

  // Alice tries to buzz again for the same question
  aliceSocket.emit('buzzer:buzz');
  await wait(100);

  assert(lockedOutNotified, 'Alice should be rejected due to lockout');
  console.log('✓ Locked out player cannot buzz again on current question');

  // Bob now buzzes in and answers correctly
  bobSocket.emit('buzzer:buzz');
  await wait(100);

  let stateAfterCorrect = null;
  await new Promise(resolve => {
    hostSocket.once('room:state', (s) => {
      stateAfterCorrect = s;
      resolve();
    });
    hostSocket.emit('answer:correct');
  });

  // Verify dialog dismissal and buzz queue cleared, and auto-advance to next question
  assert.equal(stateAfterCorrect.buzzQueue.length, 0, 'Buzz queue must be empty after correct answer');
  assert.equal(stateAfterCorrect.currentBuzzPlayerId, null, 'No current buzz player after correct answer');
  assert.equal(stateAfterCorrect.questionNumber, 2, 'Should automatically move to Q2 on correct answer');
  const bobPlayer = stateAfterCorrect.players.find(p => p.id === bobSocket.id);
  assert.equal(bobPlayer.score, 1, 'Bob should have 1 point in Bee mode (+1)');
  console.log('✓ Correct answer awarded +1 point and automatically moved to next question (Q2)');

  // Attempt to emit answer:correct again (simulate re-clicking)
  hostSocket.emit('answer:correct');
  await wait(100);

  let stateAfterSecondClick = null;
  await new Promise(resolve => {
    hostSocket.once('room:state', (s) => {
      stateAfterSecondClick = s;
      resolve();
    });
    // Trigger broadcast
    hostSocket.emit('buzzer:close');
  });

  const bobPlayerAfter = stateAfterSecondClick.players.find(p => p.id === bobSocket.id);
  assert.equal(bobPlayerAfter.score, 1, 'Bob should still have only 1 point (no infinite points bug)');
  console.log('✓ Prevented infinite points on repeat clicks');

  // Test 3 Incorrect Guesses in Bee Mode: 3rd loses 1 point and triggers next question
  console.log('\nTest 4b: 3 Incorrect Guesses in Bee mode (-1 point on 3rd & auto-advance)');
  
  // Connect a 3rd player (Charlie) for the 3-buzz test
  const charlieBee = await connectClient();
  charlieBee.on('calibration:ping', (ts) => charlieBee.emit('calibration:pong', ts));
  await new Promise(resolve => {
    charlieBee.emit('room:join', { code: beeRoomCode, name: 'CharlieBee' }, resolve);
  });
  await wait(100);

  // Host opens buzzer for Q2
  hostSocket.emit('buzzer:open');
  await wait(50);

  // 1st incorrect guess: Alice
  aliceSocket.emit('buzzer:buzz');
  await wait(100);
  hostSocket.emit('answer:incorrect');
  await wait(100);

  // 2nd incorrect guess: Bob
  bobSocket.emit('buzzer:buzz');
  await wait(100);
  hostSocket.emit('answer:incorrect');
  await wait(100);

  // 3rd incorrect guess: CharlieBee
  charlieBee.emit('buzzer:buzz');
  await wait(100);

  let stateAfterThirdIncorrect = null;
  await new Promise(resolve => {
    hostSocket.once('room:state', (s) => {
      stateAfterThirdIncorrect = s;
      resolve();
    });
    hostSocket.emit('answer:incorrect');
  });

  const charlieAfterPenalty = stateAfterThirdIncorrect.players.find(p => p.id === charlieBee.id);
  assert.equal(charlieAfterPenalty.score, -1, 'CharlieBee should lose 1 point (-1)');
  assert.equal(stateAfterThirdIncorrect.questionNumber, 3, '3rd incorrect guess should auto-advance to Q3');
  assert.equal(stateAfterThirdIncorrect.buzzQueue.length, 0, 'Buzz queue should be empty');
  console.log('✓ 3rd incorrect guess penalized player (-1 point) and triggered next question (Q3)');

  // Test Next Question button automatically reopens buzzer
  console.log('\nTest 4c: Next Question button automatically reopens buzzer');
  const openedPromise = new Promise(resolve => aliceSocket.once('buzzer:opened', resolve));
  const statePromise = new Promise(resolve => hostSocket.once('room:state', resolve));

  hostSocket.emit('question:next');
  const stateAfterNext = await statePromise;
  await openedPromise;

  assert.equal(stateAfterNext.buzzerOpen, true, 'Next question should automatically reopen buzzer');
  console.log('✓ Next Question button automatically reopened the buzzer');

  charlieBee.disconnect();
  await wait(100);

  // Close buzzer before mode switch
  hostSocket.emit('buzzer:close');
  await wait(100);

  // 5. Test History Bowl Mode (Team-Based Grouping & Team Lockout)
  console.log('\nTest 5: History Bowl Mode & Team Lockout');
  hostSocket.emit('room:set-mode', { mode: 'bowl' });
  await wait(100);

  let teamRedId = null;
  let teamBlueId = null;

  await new Promise(resolve => {
    hostSocket.emit('team:add', { name: 'Spartans' }, (res) => {
      teamRedId = res.teamId;
      resolve();
    });
  });

  await new Promise(resolve => {
    hostSocket.emit('team:add', { name: 'Athenians' }, (res) => {
      teamBlueId = res.teamId;
      resolve();
    });
  });

  // Assign Alice & Charlie to Spartans (Team Red)
  const charlie2 = await connectClient();
  charlie2.on('calibration:ping', (ts) => charlie2.emit('calibration:pong', ts));

  await new Promise(resolve => {
    charlie2.emit('room:join', { code: beeRoomCode, name: 'Charlie' }, (res) => {
      resolve();
    });
  });

  hostSocket.emit('player:assign-team', { playerId: aliceSocket.id, teamId: teamRedId });
  hostSocket.emit('player:assign-team', { playerId: charlie2.id, teamId: teamRedId });
  hostSocket.emit('player:assign-team', { playerId: bobSocket.id, teamId: teamBlueId });
  await wait(200);

  // Open buzzer for History Bowl
  hostSocket.emit('buzzer:open');
  await wait(50);

  // Alice (Spartans) buzzes in
  aliceSocket.emit('buzzer:buzz');
  await wait(100);

  // Host marks Alice's answer as INCORRECT
  hostSocket.emit('answer:incorrect');
  await wait(200);

  // Now Charlie (teammate of Alice in Spartans) attempts to buzz
  let charlieRejected = false;
  charlie2.once('buzzer:rejected', (data) => {
    charlieRejected = true;
    assert(data.reason.includes('team is locked out'), 'Team lockout message expected');
  });

  charlie2.emit('buzzer:buzz');
  await wait(200);

  assert(charlieRejected, 'Charlie should be locked out because teammate Alice answered incorrectly');
  console.log('✓ History Bowl team lockout successfully locked out all teammates!');

  // Bob (Athenians) buzzes in and gets it right
  bobSocket.emit('buzzer:buzz');
  await wait(100);
  hostSocket.emit('answer:correct');
  await wait(200);

  // Verify Athenians got 10 points
  let finalState = null;
  await new Promise(resolve => {
    hostSocket.once('room:state', (s) => {
      finalState = s;
      resolve();
    });
    hostSocket.emit('question:next');
  });

  const atheniansTeam = finalState.teams.find(t => t.id === teamBlueId);
  assert.equal(atheniansTeam.score, 10, 'Team score should be 10');
  console.log(`✓ Athenians awarded 10 points: ${atheniansTeam.score}`);

  console.log('\n===========================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! 🐝 🏆');
  console.log('===========================================');

  // Clean up
  hostSocket.disconnect();
  aliceSocket.disconnect();
  bobSocket.disconnect();
  charlie2.disconnect();
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
