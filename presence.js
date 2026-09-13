import { rtdb } from "./firebase-config.js";
import {
  ref, onValue, onDisconnect, set, serverTimestamp, remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let myStatusRef = null;

// Dipanggil setelah login sukses. Menulis status online ke RTDB dan
// otomatis set offline kalau koneksi terputus (tutup tab, mati wifi, dll).
export function goOnline(uid, username) {
  const connectedRef = ref(rtdb, ".info/connected");
  myStatusRef = ref(rtdb, "status/" + uid);
  onValue(connectedRef, (snap) => {
    if (snap.val() === false) return;
    onDisconnect(myStatusRef).set({
      state: "offline", username, last_changed: serverTimestamp()
    }).then(() => {
      set(myStatusRef, { state: "online", username, last_changed: serverTimestamp() });
    });
  });
}

export async function goOffline() {
  if (myStatusRef) {
    try { await set(myStatusRef, { state: "offline", last_changed: serverTimestamp() }); }
    catch (e) { /* ignore */ }
  }
}

// Dipakai admin dashboard untuk memantau semua user online secara real-time.
export function watchAllPresence(callback) {
  const statusRoot = ref(rtdb, "status");
  return onValue(statusRoot, (snap) => {
    callback(snap.val() || {});
  });
}

export function watchPresenceFor(uid, callback) {
  return onValue(ref(rtdb, "status/" + uid), (snap) => callback(snap.val()));
}
