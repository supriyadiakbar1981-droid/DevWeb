import { requireAdmin, logoutUser } from "./auth.js";
import { db } from "./firebase-config.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { watchAllPresence } from "./presence.js";
import {
  adminAddPoints, adminSetBlocked, watchPendingTopups, approveTopup, rejectTopup
} from "./points.js";

let presenceMap = {};
let usersList = [];

requireAdmin(() => {
  watchAllPresence((p) => {
    presenceMap = p;
    renderUsers();
    updateStats();
  });

  onSnapshot(collection(db, "users"), (snap) => {
    usersList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsers();
    updateStats();
  });

  watchPendingTopups(renderPendingTopups);
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await logoutUser();
  window.location.href = "admin-login.html";
});

function isOnline(uid) {
  return presenceMap[uid]?.state === "online";
}

function updateStats() {
  document.getElementById("statTotal").textContent = usersList.length;
  document.getElementById("statOnline").textContent = usersList.filter(u => isOnline(u.id)).length;
}

function renderUsers() {
  const body = document.getElementById("usersBody");
  if (!usersList.length) { body.innerHTML = `<tr><td colspan="6">Belum ada user.</td></tr>`; return; }

  const sorted = [...usersList].sort((a, b) => {
    const aOn = isOnline(a.id) ? 1 : 0, bOn = isOnline(b.id) ? 1 : 0;
    return bOn - aOn;
  });

  body.innerHTML = sorted.map(u => `
    <tr>
      <td><span class="status-dot ${isOnline(u.id) ? "online" : "offline"}"></span>${isOnline(u.id) ? "Online" : "Offline"}</td>
      <td>${escapeHtml(u.username)}${u.isAdmin ? ` <span class="badge badge-duel">admin</span>` : ""}${u.isBlocked ? ` <span class="badge" style="background:var(--danger);color:var(--ink);">diblokir</span>` : ""}</td>
      <td>${escapeHtml(u.email || "-")}</td>
      <td style="font-weight:800; color:var(--lime);">${u.points || 0}</td>
      <td>
        ${u.isAdmin ? "-" : `
          <div class="field-row" style="min-width:170px;">
            <input type="number" min="1" placeholder="jml" class="fill-input" style="padding:8px;" data-uid="${u.id}">
            <button class="btn btn-sm btn-primary fill-btn" data-uid="${u.id}">Isi</button>
          </div>
        `}
      </td>
      <td>
        ${u.isAdmin ? "-" : `
          <button class="btn btn-sm ${u.isBlocked ? "" : "btn-danger"} block-btn" data-uid="${u.id}" data-blocked="${u.isBlocked ? "1" : "0"}">
            ${u.isBlocked ? "Buka Blokir" : "Blokir"}
          </button>
        `}
      </td>
    </tr>
  `).join("");

  body.querySelectorAll(".fill-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.uid;
      const input = body.querySelector(`.fill-input[data-uid="${uid}"]`);
      const amount = Number(input.value);
      if (!amount || amount <= 0) { input.focus(); return; }
      btn.disabled = true; btn.textContent = "...";
      try {
        await adminAddPoints(uid, amount);
        input.value = "";
      } catch (e) { alert(e.message); }
      btn.disabled = false; btn.textContent = "Isi";
    });
  });

  body.querySelectorAll(".block-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.uid;
      const currentlyBlocked = btn.dataset.blocked === "1";
      btn.disabled = true;
      try { await adminSetBlocked(uid, !currentlyBlocked); }
      catch (e) { alert(e.message); }
      btn.disabled = false;
    });
  });
}

function renderPendingTopups(list) {
  document.getElementById("statPending").textContent = list.length;
  const el = document.getElementById("pendingTopups");
  if (!list.length) { el.innerHTML = `<div class="empty">Tidak ada permintaan top up pending.</div>`; return; }

  el.innerHTML = list.map(r => `
    <div class="card" style="padding:14px 18px; margin-top:${list.indexOf(r) === 0 ? "0" : "12px"};">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <strong>${escapeHtml(r.username)}</strong> minta <strong style="color:var(--lime);">${r.amount} poin</strong>
          ${r.note ? `<div class="help">"${escapeHtml(r.note)}"</div>` : ""}
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-sm btn-primary approve-btn" data-id="${r.id}" data-uid="${r.uid}" data-amount="${r.amount}">Setujui & Isi Poin</button>
          <button class="btn btn-sm btn-ghost reject-btn" data-id="${r.id}">Tolak</button>
        </div>
      </div>
    </div>
  `).join("");

  el.querySelectorAll(".approve-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true; btn.textContent = "Memproses...";
      try { await approveTopup(btn.dataset.id, btn.dataset.uid, Number(btn.dataset.amount)); }
      catch (e) { alert(e.message); btn.disabled = false; btn.textContent = "Setujui & Isi Poin"; }
    });
  });
  el.querySelectorAll(".reject-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try { await rejectTopup(btn.dataset.id); } catch (e) { alert(e.message); }
      btn.disabled = false;
    });
  });
}

function escapeHtml(s) {
  return (s || "").toString().replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
