import { db } from "./firebase-config.js";
import {
  doc, runTransaction, collection, addDoc, serverTimestamp,
  updateDoc, onSnapshot, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Kurangi poin user secara atomic. Melempar error kalau poin tidak cukup.
export async function deductPoints(uid, amount, reason) {
  const ref = doc(db, "users", uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("User tidak ditemukan.");
    const current = snap.data().points || 0;
    if (current < amount) throw new Error(`Poin tidak cukup (butuh ${amount}, punya ${current}). Minta admin top up dulu.`);
    tx.update(ref, { points: current - amount });
  });
}

// Dipakai admin: langsung isi poin ke user manapun, real-time.
export async function adminAddPoints(uid, amount) {
  const ref = doc(db, "users", uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("User tidak ditemukan.");
    const current = snap.data().points || 0;
    tx.update(ref, { points: current + Number(amount) });
  });
}

export async function adminSetBlocked(uid, isBlocked) {
  await updateDoc(doc(db, "users", uid), { isBlocked });
}

// ---------- Permintaan top up dari user ----------
export async function requestTopup(uid, username, amount, note) {
  await addDoc(collection(db, "topupRequests"), {
    uid, username,
    amount: Number(amount) || 0,
    note: note || "",
    status: "pending",
    createdAt: serverTimestamp()
  });
}

export function watchMyTopupRequests(uid, callback) {
  const q = query(collection(db, "topupRequests"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function watchPendingTopups(callback) {
  const q = query(collection(db, "topupRequests"), where("status", "==", "pending"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// Admin menyetujui permintaan top up: poin langsung ditambahkan ke user.
export async function approveTopup(requestId, uid, amount) {
  await adminAddPoints(uid, amount);
  await updateDoc(doc(db, "topupRequests", requestId), {
    status: "approved", approvedAt: serverTimestamp()
  });
}

export async function rejectTopup(requestId) {
  await updateDoc(doc(db, "topupRequests", requestId), {
    status: "rejected", rejectedAt: serverTimestamp()
  });
}
