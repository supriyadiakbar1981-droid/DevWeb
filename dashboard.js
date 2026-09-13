import { requireAuth, logoutUser } from "./auth.js";
import { COST_CREATE_ROOM } from "./firebase-config.js";
import { requestTopup, watchMyTopupRequests } from "./points.js";
import { listQuestionSets } from "./questions.js";
import { createRoom, findRoomByCode, joinRoom, watchPublicRooms } from "./rooms.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.getElementById("costRoomLabel").textContent = COST_CREATE_ROOM;

let currentUid = null, currentUsername = null, isAdmin = false;
let selectedType = "tebak-kata";
let selectedSubType = "tebak-kata";

requireAuth((user, ref, data) => {
  currentUid = user.uid;
  currentUsername = data.username;
  isAdmin = !!data.isAdmin;
  document.getElementById("usernameLabel").textContent = data.username;
  document.getElementById("avatarLetter").textContent = data.username.charAt(0).toUpperCase();
  document.getElementById("pointsVal").textContent = data.points || 0;

  // live update poin (listener terpisah supaya poin ikut ter-update di UI
  // setiap kali admin mengisi poin, tanpa perlu refresh halaman)
  onSnapshot(ref, (s) => {
    if (s.exists()) document.getElementById("pointsVal").textContent = s.data().points || 0;
  });

  loadQuestionSets();
  watchMyTopupRequests(currentUid, renderTopupHistory);
  watchPublicRooms(renderPublicRooms);
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await logoutUser();
  window.location.href = "index.html";
});

// ---------- Join room ----------
document.getElementById("joinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("joinErr");
  errEl.style.display = "none";
  const code = document.getElementById("joinCode").value.trim().toUpperCase();
  if (!code) return;
  try {
    const room = await findRoomByCode(code);
    if (!room) throw new Error("Kode room tidak ditemukan.");
    await joinRoom(room.id, currentUid, currentUsername);
    window.location.href = `room.html?id=${room.id}`;
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = "block";
  }
});

// ---------- Topup ----------
document.getElementById("topupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const amount = document.getElementById("topupAmount").value;
  const note = document.getElementById("topupNote").value;
  await requestTopup(currentUid, currentUsername, amount, note);
  document.getElementById("topupForm").reset();
  const ok = document.getElementById("topupOk");
  ok.textContent = "Permintaan terkirim! Tunggu admin mengisi poin kamu.";
  ok.style.display = "block";
  setTimeout(() => ok.style.display = "none", 4000);
});

function renderTopupHistory(list) {
  const body = document.getElementById("topupBody");
  if (!list.length) { body.innerHTML = `<tr><td colspan="3">Belum ada permintaan top up.</td></tr>`; return; }
  body.innerHTML = list.map(r => `
    <tr>
      <td>${r.amount} poin</td>
      <td>${escapeHtml(r.note || "-")}</td>
      <td>${statusBadge(r.status)}</td>
    </tr>
  `).join("");
}

function statusBadge(status) {
  if (status === "approved") return `<span class="badge" style="background:var(--good);color:var(--ink);">Disetujui</span>`;
  if (status === "rejected") return `<span class="badge" style="background:var(--danger);color:var(--ink);">Ditolak</span>`;
  return `<span class="badge badge-muted">Menunggu</span>`;
}

// ---------- Create room ----------
document.querySelectorAll("#typeTabs .tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#typeTabs .tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedType = btn.dataset.type;
    document.getElementById("duelSubTypeWrap").style.display = selectedType === "duel" ? "block" : "none";
    loadQuestionSets();
  });
});
document.querySelectorAll("#duelSubTabs .tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#duelSubTabs .tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedSubType = btn.dataset.subtype;
    loadQuestionSets();
  });
});

async function loadQuestionSets() {
  const sel = document.getElementById("questionSetSelect");
  sel.innerHTML = `<option>Memuat...</option>`;
  const typeForSets = selectedType === "duel" ? selectedSubType : selectedType;
  const sets = await listQuestionSets(typeForSets);
  if (!sets.length) {
    sel.innerHTML = `<option value="">-- Belum ada set soal untuk mode ini --</option>`;
    return;
  }
  sel.innerHTML = sets.map(s => `<option value="${s.id}" data-title="${escapeHtml(s.title)}">${escapeHtml(s.title)} (${s.items.length} soal)</option>`).join("");
}

document.getElementById("createRoomBtn").addEventListener("click", async () => {
  const errEl = document.getElementById("createErr");
  errEl.style.display = "none";
  const sel = document.getElementById("questionSetSelect");
  const questionSetId = sel.value;
  if (!questionSetId) {
    errEl.textContent = "Pilih atau buat set soal dulu.";
    errEl.style.display = "block";
    return;
  }
  const questionSetTitle = sel.selectedOptions[0].dataset.title;
  const maxPlayers = selectedType === "duel" ? 2 : null;
  try {
    const { id } = await createRoom(currentUid, currentUsername, selectedType, {
      subType: selectedType === "duel" ? selectedSubType : null,
      questionSetId, questionSetTitle, maxPlayers
    }, isAdmin);
    window.location.href = `room.html?id=${id}`;
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = "block";
  }
});

// ---------- Public rooms ----------
function renderPublicRooms(rooms) {
  const el = document.getElementById("publicRooms");
  if (!rooms.length) { el.innerHTML = `<div class="empty">Belum ada room yang menunggu pemain. Buat satu!</div>`; return; }
  el.innerHTML = `<div class="grid grid-2">` + rooms.map(r => `
    <div class="card" style="padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="badge badge-${r.type === 'kuis-tim' ? 'kuis' : (r.type === 'duel' ? 'duel' : (r.type === 'tebak-gambar' ? 'gambar' : 'kata'))}">${labelType(r.type)}</span>
        <span class="room-code" style="font-size:1rem; padding:4px 10px;">${r.code}</span>
      </div>
      <p style="margin:10px 0 4px; font-weight:700;">${escapeHtml(r.questionSetTitle || "")}</p>
      <p class="help">Host: ${escapeHtml(r.hostName)} · ${Object.keys(r.players || {}).length} pemain</p>
      <button class="btn btn-primary btn-sm btn-block" data-id="${r.id}">Gabung</button>
    </div>
  `).join("") + `</div>`;

  el.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        await joinRoom(btn.dataset.id, currentUid, currentUsername);
        window.location.href = `room.html?id=${btn.dataset.id}`;
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

function labelType(t) {
  return { "tebak-kata": "Tebak Kata", "tebak-gambar": "Tebak Gambar", "kuis-tim": "Kuis Tim", "duel": "Duel 1v1" }[t] || t;
}
function escapeHtml(s) {
  return (s || "").toString().replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
