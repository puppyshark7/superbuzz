# SuperBuzz — IAC History Bee & Bowl Competition Buzzer

A modern, real-time, low-latency web buzzer system specifically designed for **International Academic Competitions (IAC) History Bee & Bowl** tournaments.

Built with **Node.js, Express, Socket.IO, and Web Audio API**, SuperBuzz features millisecond-precision lag calibration to ensure fair competition regardless of internet connection differences.

---

## Key Features

### 🐝 History Bee & 🏆 History Bowl Modes
- **History Bee (Individual Competition)**:
  - Players compete individually for personal score tallies.
  - **Scoring**: Correct answer awards **+1 point** and automatically advances to the next question.
  - **3rd Incorrect Penalty & Auto-Advance**: Players who buzz and guess incorrectly are locked out for that question. On the **3rd incorrect buzz**, that third player loses a point (**-1 point**), which automatically ends the question and advances to the next question!
- **History Bowl (Team Competition)**:
  - Players are grouped into teams (e.g., school teams, historical factions).
  - **Scoring**: Correct answer awards **+10 points** to the team and auto-advances.
  - **Full Team Lockout**: If any member of a team buzzes in and answers incorrectly, their entire team is locked out for the rest of that question, preventing unfair second chances from teammates.

### ⏱️ Millisecond-Precision Lag Correction
Internet connection differences (such as ping disparity) can give players with lower ping an unfair advantage in buzzer races. SuperBuzz eliminates this with an active round-trip latency calibration system:
1. **Periodic High-Resolution RTT Sampling**: The server exchanges millisecond-timestamped calibration pings (`performance.now()`) with each client every 3 seconds.
2. **Median Filtering**: Rolling samples are filtered using a median calculation to reject outlier jitter spikes.
3. **Reaction Time Deduction**:
   $$\text{Adjusted Time} = \text{Raw Server Elapsed Time} - \text{Client RTT}$$
   When a buzz event arrives at the server, SuperBuzz computes the participant's physical button press time relative to when the buzzer was opened, eliminating network latency bias.
4. **Authoritative Buzz Queue**: Buzzes are inserted into an ordered queue according to their adjusted reaction time. The host can see both the raw arrival time, client RTT, and adjusted time down to tenths of a millisecond.

### 🔊 Audio & Visual Feedback
- Synthesized Web Audio API sound effects for buzzer opening, buzz-in, correct (+10 pts), incorrect/lockout, and question advancement (no audio assets required).
- Responsive giant buzzer button with keyboard binding (`Space` or click/touch).
- Live latency indicator (green/amber/red with real-time ping readout).
- Host dashboard featuring full game control, live buzz queue, team assignment, kick controls, and live scoreboards.

---

## Getting Started

### Prerequisites
- Node.js (v18 or newer recommended)

### Installation & Launch

```bash
# Install dependencies
npm install

# Start the server
npm start
# or
npm run dev
```

Open your browser to:
```
http://localhost:3000
```

### Running Tests
An automated end-to-end integration test is included:
```bash
npm test
```
The test suite validates room creation, connection calibration, lag-adjusted buzz resolution, individual Bee lockouts, and full Bowl team lockouts.

---

## How to Play

### As Host:
1. Select **History Bee** or **History Bowl** and click **Create Room**.
2. Share the 5-character **Room Code** with competitors.
3. For History Bowl, add team names and assign players to their respective teams.
4. Click **▶ Open Buzzer** when reading the tossup question.
5. Review the recognized buzz in the timing panel (adjusted time, raw time, RTT).
6. Click **✓ Correct (+10)** to award points and automatically advance to the next question, or **✗ Incorrect (Lock Out)** to lock out and reopen the buzzer for remaining players.
7. Click **Next Question →** at any time to advance to the next question and automatically reopen the buzzer in one click.

### As Player:
1. Enter the **Room Code** and your **Name**, then click **Join Room**.
2. Watch the status panel. When the buzzer turns red and says **BUZZ**, press the `Space` bar or click/tap the buzzer button.
3. Keep an eye on your latency indicator in the top right to verify connection quality.

---

## Deployment Guide

SuperBuzz is a lightweight Node.js + Express + Socket.IO server with zero build steps or bundlers required. It listens on `process.env.PORT || 3000`.

### Option 1: Render (Recommended — Free & Easy)
1. Push this repository to GitHub.
2. Sign in to [render.com](https://render.com) and click **New +** &rarr; **Web Service**.
3. Connect your repository.
4. Settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Click **Deploy Web Service**. Render provides a free `https://your-app.onrender.com` URL with automatic SSL and WebSocket support.

### Option 2: Railway
1. Push your code to GitHub.
2. Go to [railway.app](https://railway.app) and select **New Project** &rarr; **Deploy from GitHub repo**.
3. Railway automatically detects `npm start` and deploys it immediately with an assigned HTTPS domain.

### Option 3: Instant Public URL for Practices (Localtunnel / Ngrok)
To host a scrimmage directly from your laptop without deploying to the cloud:
```bash
# In terminal 1:
npm start

# In terminal 2:
npx localtunnel --port 3000
```
This gives you an instant public URL (e.g. `https://quiet-bee-42.loca.lt`) to share with competitors.

### Option 4: Linux VPS (Ubuntu / Debian / DigitalOcean)
```bash
git clone <repo-url> superbuzz
cd superbuzz
npm install --production

# Run with PM2 for background process management & auto-restart
npm install -g pm2
pm2 start server.js --name "superbuzz"
pm2 save
pm2 startup
```
Use Nginx as a reverse proxy with WebSocket support (`proxy_set_header Upgrade $http_upgrade;`) and Let's Encrypt (`certbot`) for free SSL.
