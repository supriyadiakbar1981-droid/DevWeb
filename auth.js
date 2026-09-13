import {
  auth, db, onAuthStateChanged, signOut, ADMIN_EMAIL, ADMIN_DEFAULT_PASSWORD
} from "./firebase-config.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, getDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { goOnline, goOffline, watchPresenceFor } from "./presence.js";

// ---------- Register ----------
export async function registerUser(username, email, password) {
  username = username.trim();
  if (username.length < 3) throw new Error("Username minimal 3 karakter.");
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: username });
  await setDoc(doc(db, "users", cred.user.uid), {
    username,
    email,
    points: 0,
    isBlocked: false,
    isAdmin: false,
    createdAt: serverTimestamp()
  });
  return cred.user;
}

// ---------- Login (user biasa) ----------
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, "users", cred.user.uid));
  if (snap.exists() && snap.data().isBlocked) {
    await signOut(auth);
    throw new Error("Akun kamu diblokir admin. Hubungi admin untuk info lebih lanjut.");
  }
  return cred.user;
}

// ---------- Login admin (username: admin / password: admin12345) ----------
// Pertama kali dipanggil dengan kredensial default, akun admin akan
// dibuat otomatis di Firebase Auth + ditandai isAdmin:true di Firestore.
export async function loginAdmin(username, password) {
  if (username.trim().toLowerCase() !== "admin") {
    throw new Error("Login admin hanya untuk username 'admin'.");
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (!snap.exists() || !snap.data().isAdmin) {
      // pastikan flag admin selalu benar
      await setDoc(doc(db, "users", cred.user.uid), {
        username: "admin", email: ADMIN_EMAIL, isAdmin: true,
        isBlocked: false, points: snap.exists() ? (snap.data().points || 0) : 0
      }, { merge: true });
    }
    return cred.user;
  } catch (err) {
    if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
      if (password !== ADMIN_DEFAULT_PASSWORD) {
        throw new Error("Username atau password admin salah.");
      }
      // Bootstrap akun admin pertama kali.
      const cred = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_DEFAULT_PASSWORD);
      await updateProfile(cred.user, { displayName: "admin" });
      await setDoc(doc(db, "users", cred.user.uid), {
        username: "admin",
        email: ADMIN_EMAIL,
        points: 0,
        isBlocked: false,
        isAdmin: true,
        createdAt: serverTimestamp()
      });
      return cred.user;
    }
    throw err;
  }
}

export async function logoutUser() {
  try { await goOffline(); } catch (e) { /* ignore */ }
  await signOut(auth);
}

// ---------- Guards ----------
// Menjamin user login, tidak diblokir, dan memantau status blokir real-time.
export function requireAuth(onReady, redirectTo = "login.html") {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = redirectTo; return; }
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) { window.location.href = redirectTo; return; }
    if (snap.data().isBlocked) {
      alert("Akun kamu diblokir admin.");
      await logoutUser();
      window.location.href = redirectTo;
      return;
    }
    goOnline(user.uid, snap.data().username);
    // Pantau perubahan blokir / poin secara real-time
    onSnapshot(ref, (s) => {
      if (!s.exists()) return;
      if (s.data().isBlocked) {
        alert("Akun kamu baru saja diblokir admin.");
        logoutUser().then(() => window.location.href = redirectTo);
      }
    });
    onReady(user, ref, snap.data());
  });
}

export function requireAdmin(onReady, redirectTo = "admin-login.html") {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = redirectTo; return; }
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists() || !snap.data().isAdmin) {
      window.location.href = redirectTo; return;
    }
    goOnline(user.uid, "admin");
    onReady(user, ref, snap.data());
  });
}
