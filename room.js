import { requireAuth } from "./auth.js";
import {
  watchRoom, startGame, submitGuess, submitKuisAnswer, nextRound
} from "./rooms.js";
import { getQuestionSet } from "./questions.js";

const params = new URLSearchParams(window.location.search);
const roomId = params.get("id");
const root = document.getElementById("roomRoot");

let currentUid = null, currentUsername = null;
let questionSet = null;
let items = [];
let lastRenderedIndex = -1;
let lastGuessResult = ""; // "" | "wrong" | pending

if (!roomId) {
  root.innerHTML = `<div class="card" style="margin-top:24px;"><p>Room tidak valid.</p><a class="btn btn-primary" href="dashboard.html">Kembali</a></div>`;
} else {
  requireAuth((user, ref, data) => {
    currentUid = user.uid;
    currentUsername = data.username;
    document.getElementById("usernameLabel").textContent = data.username;
    document.getElementById("avatarLetter").textContent = data.username.charAt(0).toUpperCase();

    watchRoom(roomId, async (room) => {
      if (!room) {
        root.innerHTML = `<div class="card" style="margin-top:24px;"><p>Room tidak ditemukan atau sudah dihapus.</p><a class="btn btn-primary" href="dashboard.html">Kembali ke Dashboard</a></div>`;
        return;
      }
      if (!questionSet && room.questionSetId) {
        try {
          questionSet = await getQuestionSet(room.questionSetId);
          items = questionSet.items || [];
        } catch (e) {
          root.innerHTML = `<div class="card" style="margin-top:24px;"><p>Gagal memuat set soal: ${e.message}</p></div>`;
          return;
        }
      }
      render(room);
    });
  });
}

function render(room) {
  if (room.currentIndex !== lastRenderedIndex) {
    lastGuessResult = "";
    lastRenderedIndex = room.currentIndex;
  }
  if (room.status === "waiting") renderWaiting(room);
  else if (room.status === "playing") renderPlaying(room);
  else renderFinished(room);
}

function isImageMode(room) {
  return room.type === "tebak-gambar" || (room.type === "duel" && room.subType === "tebak-gambar");
}
function isTextMode(room) {
  return room.type === "tebak-kata" || (room.type === "duel" && room.subType === "tebak-kata");
}
function labelType(room) {
  const map = { "tebak-kata": "Tebak Kata", "tebak-gambar": "Tebak Gambar", "kuis-tim": "Kuis Tim", "duel": "Duel 1v1" };
  return map[room.type] || room.type;
}

// ---------------- WAITING ----------------
function renderWaiting(room) {
  const players = Object.entries(room.players || {});
  const isHost = room.hostUid === currentUid;
  root.innerHTML = `
    <div class="card" style="margin-top:24px; text-align:center;">
      <span class="badge badge-duel">${labelType(room)}</span>
      <h2>${escapeHtml(room.questionSetTitle || "")}</h2>
      <p class="help">Bagikan kode ini ke temanmu:</p>
      <div class="room-code">${room.code}</div>
      ${room.maxPlayers ? `<p class="help" style="margin-top:10px;">Room ini maksimal ${room.maxPlayers} pemain.</p>` : ""}
    </div>

    <div class="card">
      <h3>Pemain (${players.length}${room.maxPlayers ? "/" + room.maxPlayers : ""})</h3>
      <div class="scoreboard" style="justify-content:flex-start;">
        ${players.map(([uid, p]) => `
          <div class="score-chip">
            ${p.isHost ? "👑 " : ""}${escapeHtml(p.username)}
            ${p.team ? `<span class="badge badge-muted" style="margin-left:4px;">Tim ${p.team}</span>` : ""}
          </div>`).join("")}
      </div>

      ${isHost ? `
        <button class="btn btn-primary btn-block" id="startBtn" style="margin-top:16px;" ${players.length < 2 ? "disabled" : ""}>
          ${players.length < 2 ? "Menunggu pemain lain..." : "Mulai Permainan"}
        </button>
        <div class="err" id="startErr" style="display:none;"></div>
      ` : `<p class="help" style="margin-top:16px;">Menunggu host memulai permainan...</p>`}
    </div>
  `;

  if (isHost) {
    document.getElementById("startBtn").addEventListener("click", async () => {
      try { await startGame(roomId); }
      catch (e) {
        const el = document.getElementById("startErr");
        el.textContent = e.message; el.style.display = "block";
      }
    });
  }
}

// ---------------- PLAYING ----------------
function renderPlaying(room) {
  const item = items[room.currentIndex];
  const isHost = room.hostUid === currentUid;
  const players = Object.entries(room.players || {}).sort((a, b) => (b[1].score || 0) - (a[1].score || 0));

  let stageHtml = "";
  if (room.type === "kuis-tim") {
    stageHtml = renderKuisStage(room, item);
  } else {
    stageHtml = renderGuessStage(room, item);
  }

  root.innerHTML = `
    <div class="card" style="margin-top:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="badge badge-duel">${labelType(room)}</span>
        <span class="help">Soal ${room.currentIndex + 1} / ${items.length}</span>
      </div>

      ${room.type === "kuis-tim" ? `
        <div class="scoreboard">
          <div class="score-chip">Tim A <span class="n">${room.teamScores?.A || 0}</span></div>
          <div class="score-chip">Tim B <span class="n">${room.teamScores?.B || 0}</span></div>
        </div>
      ` : `
        <div class="scoreboard">
          ${players.map(([uid, p]) => `<div class="score-chip">${escapeHtml(p.username)} <span class="n">${p.score || 0}</span></div>`).join("")}
        </div>
      `}

      <div class="game-stage">${stageHtml}</div>

      ${isHost ? `<button class="btn btn-primary btn-block" id="nextBtn">Ronde Berikutnya →</button>` : ""}
    </div>
  `;

  if (room.type === "kuis-tim") wireKuisStage(room, item);
  else wireGuessStage(room, item);

  if (isHost) {
    document.getElementById("nextBtn").addEventListener("click", async () => {
      await nextRound(roomId, items.length);
    });
  }
}

function renderGuessStage(room, item) {
  const imageMode = isImageMode(room);
  const winnerUid = room.roundWinnerUid;
  const winnerName = winnerUid ? (room.players[winnerUid]?.username || "?") : null;

  return `
    <div class="question-box">
      ${imageMode ? `<img src="${escapeAttr(item.imageUrl)}" alt="soal">` : ""}
      ${item.question ? `<div style="font-size:${imageMode ? "1rem" : "inherit"}; margin-top:${imageMode ? "12px" : "0"};">${escapeHtml(item.question)}</div>` : ""}
    </div>
    ${winnerUid ? `
      <p class="ok" style="font-size:1.1rem;">🎉 ${escapeHtml(winnerName)} menjawab benar duluan!</p>
    ` : `
      <div class="field-row" style="max-width:420px; margin:0 auto;">
        <input type="text" id="guessInput" placeholder="Ketik jawabanmu...">
        <button class="btn btn-primary" id="guessBtn">Jawab</button>
      </div>
      <div id="guessMsg" class="err" style="display:none;"></div>
    `}
  `;
}

function wireGuessStage(room, item) {
  if (room.roundWinnerUid) return;
  const input = document.getElementById("guessInput");
  const btn = document.getElementById("guessBtn");
  const msg = document.getElementById("guessMsg");
  const submit = async () => {
    const val = input.value.trim();
    if (!val) return;
    btn.disabled = true;
    try {
      const won = await submitGuess(roomId, currentUid, val, item.answer, room.currentIndex);
      if (!won) {
        msg.textContent = "Belum tepat, coba lagi!";
        msg.style.display = "block";
        setTimeout(() => msg.style.display = "none", 1500);
      }
    } finally {
      btn.disabled = false;
      input.value = "";
      input.focus();
    }
  };
  btn.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
}

function renderKuisStage(room, item) {
  const key = room.currentIndex + "_" + currentUid;
  const already = room.roundAnswers && room.roundAnswers[key];
  return `
    <div class="question-box">${escapeHtml(item.question)}</div>
    <div class="grid grid-2" style="max-width:520px; margin:0 auto;">
      ${item.options.map((opt, i) => `
        <button class="btn ${already && already.optionIndex === i ? (already.isCorrect ? "btn-primary" : "btn-danger") : ""} kuis-opt" data-i="${i}" ${already ? "disabled" : ""}>
          ${escapeHtml(opt)}
        </button>
      `).join("")}
    </div>
    ${already ? `<p class="${already.isCorrect ? "ok" : "err"}" style="margin-top:14px;">${already.isCorrect ? "Jawaban kamu benar! ✅" : "Jawaban kamu salah. ❌"}</p>` : `<p class="help" style="margin-top:14px;">Pilih salah satu jawaban di atas.</p>`}
  `;
}

function wireKuisStage(room, item) {
  const key = room.currentIndex + "_" + currentUid;
  if (room.roundAnswers && room.roundAnswers[key]) return;
  document.querySelectorAll(".kuis-opt").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".kuis-opt").forEach(b => b.disabled = true);
      await submitKuisAnswer(roomId, currentUid, Number(btn.dataset.i), item.correctIndex, room.currentIndex);
    });
  });
}

// ---------------- FINISHED ----------------
function renderFinished(room) {
  const players = Object.entries(room.players || {}).sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
  let winnerHtml = "";

  if (room.type === "kuis-tim") {
    const a = room.teamScores?.A || 0, b = room.teamScores?.B || 0;
    const winner = a === b ? "Seri!" : (a > b ? "Tim A Menang! 🏆" : "Tim B Menang! 🏆");
    winnerHtml = `<h2>${winner}</h2><p style="font-family:var(--font-display); font-size:1.6rem;">Tim A: ${a} &nbsp;vs&nbsp; Tim B: ${b}</p>`;
  } else {
    const top = players[0];
    winnerHtml = top ? `<h2>🏆 ${escapeHtml(top[1].username)} Menang!</h2><p class="help">Skor: ${top[1].score || 0}</p>` : `<h2>Permainan Selesai</h2>`;
  }

  root.innerHTML = `
    <div class="card" style="margin-top:24px; text-align:center;">
      <span class="badge badge-duel">${labelType(room)} · Selesai</span>
      ${winnerHtml}
    </div>
    <div class="card">
      <h3>Skor Akhir</h3>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>#</th><th>Pemain</th><th>Skor</th></tr></thead>
          <tbody>
            ${players.map(([uid, p], i) => `<tr><td>${i + 1}</td><td>${escapeHtml(p.username)}</td><td>${p.score || 0}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <a class="btn btn-primary btn-block" href="dashboard.html" style="margin-top:16px;">Kembali ke Dashboard</a>
    </div>
  `;
}

function escapeHtml(s) {
  return (s || "").toString().replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function escapeAttr(s) { return escapeHtml(s); }
