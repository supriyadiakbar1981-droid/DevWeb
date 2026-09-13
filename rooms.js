import { db, COST_CREATE_ROOM } from "./firebase-config.js";
import {
  collection, addDoc, doc, getDoc, getDocs, onSnapshot, query, where,
  serverTimestamp, runTransaction, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { deductPoints } from "./points.js";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

// type: 'tebak-kata' | 'tebak-gambar' | 'kuis-tim' | 'duel'
// opts: { subType, questionSetId, questionSetTitle, maxPlayers }
export async function createRoom(uid, username, type, opts, isAdmin) {
  if (!isAdmin) await deductPoints(uid, COST_CREATE_ROOM, "Buat room " + type);

  let code, exists = true, tries = 0;
  do {
    code = genCode();
    const q = query(collection(db, "rooms"), where("code", "==", code), limit(1));
    const snap = await getDocs(q);
    exists = !snap.empty;
    tries++;
  } while (exists && tries < 8);

  const room = {
    code,
    hostUid: uid,
    hostName: username,
    type,
    subType: opts.subType || null,
    questionSetId: opts.questionSetId,
    questionSetTitle: opts.questionSetTitle || "",
    maxPlayers: opts.maxPlayers || null,
    status: "waiting",
    currentIndex: 0,
    roundWinnerUid: null,
    roundAnswers: {},
    teamScores: { A: 0, B: 0 },
    players: {
      [uid]: { username, score: 0, team: type === "kuis-tim" ? "A" : null, isHost: true }
    },
    createdAt: serverTimestamp(),
    roundStartedAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, "rooms"), room);
  return { id: ref.id, code };
}

export async function findRoomByCode(code) {
  const q = query(collection(db, "rooms"), where("code", "==", code.toUpperCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function joinRoom(roomId, uid, username) {
  const ref = doc(db, "rooms", roomId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Room tidak ditemukan.");
    const data = snap.data();
    if (data.status === "finished") throw new Error("Room sudah selesai.");
    const players = data.players || {};
    if (players[uid]) return; // sudah join
    const count = Object.keys(players).length;
    if (data.maxPlayers && count >= data.maxPlayers) {
      throw new Error("Room sudah penuh (" + data.maxPlayers + " pemain).");
    }
    let team = null;
    if (data.type === "kuis-tim") {
      const aCount = Object.values(players).filter(p => p.team === "A").length;
      const bCount = Object.values(players).filter(p => p.team === "B").length;
      team = aCount <= bCount ? "A" : "B";
    }
    players[uid] = { username, score: 0, team, isHost: false };
    tx.update(ref, { players });
  });
}

export function watchRoom(roomId, callback) {
  return onSnapshot(doc(db, "rooms", roomId), (snap) => {
    if (!snap.exists()) { callback(null); return; }
    callback({ id: snap.id, ...snap.data() });
  });
}

export async function startGame(roomId) {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "rooms", roomId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Room tidak ditemukan.");
    const players = snap.data().players || {};
    if (Object.keys(players).length < 2) throw new Error("Minimal 2 pemain untuk mulai.");
    tx.update(ref, {
      status: "playing", currentIndex: 0, roundWinnerUid: null,
      roundAnswers: {}, teamScores: { A: 0, B: 0 }, roundStartedAt: serverTimestamp()
    });
  });
}

function normalize(s) {
  return (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

// Tebak Kata / Tebak Gambar / Duel: jawaban benar pertama menang ronde.
export async function submitGuess(roomId, uid, guessText, correctAnswer, currentIndex) {
  const accepted = normalize(correctAnswer).split("|").map(s => s.trim());
  const isCorrect = accepted.includes(normalize(guessText));
  if (!isCorrect) return false;

  const ref = doc(db, "rooms", roomId);
  let won = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== "playing") return;
    if (data.currentIndex !== currentIndex) return; // ronde sudah lewat
    if (data.roundWinnerUid) return; // sudah ada pemenang ronde ini
    const players = data.players || {};
    if (!players[uid]) return;
    players[uid].score = (players[uid].score || 0) + 10;
    won = true;
    tx.update(ref, { roundWinnerUid: uid, players });
  });
  return won;
}

// Kuis Tim: pilihan ganda, tiap pemain jawab sekali per ronde.
export async function submitKuisAnswer(roomId, uid, optionIndex, correctIndex, currentIndex) {
  const ref = doc(db, "rooms", roomId);
  let result = null;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== "playing" || data.currentIndex !== currentIndex) return;
    const roundAnswers = data.roundAnswers || {};
    const key = currentIndex + "_" + uid;
    if (roundAnswers[key]) return; // sudah jawab ronde ini
    const players = data.players || {};
    const team = players[uid]?.team || "A";
    const isCorrect = Number(optionIndex) === Number(correctIndex);
    roundAnswers[key] = { optionIndex, isCorrect };
    const teamScores = data.teamScores || { A: 0, B: 0 };
    if (isCorrect) {
      players[uid].score = (players[uid].score || 0) + 10;
      teamScores[team] = (teamScores[team] || 0) + 10;
    }
    result = isCorrect;
    tx.update(ref, { roundAnswers, players, teamScores });
  });
  return result;
}

export async function nextRound(roomId, totalItems) {
  const ref = doc(db, "rooms", roomId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const nextIndex = snap.data().currentIndex + 1;
    if (nextIndex >= totalItems) {
      tx.update(ref, { status: "finished" });
    } else {
      tx.update(ref, {
        currentIndex: nextIndex, roundWinnerUid: null, roundStartedAt: serverTimestamp()
      });
    }
  });
}

export function watchPublicRooms(callback) {
  const q = query(collection(db, "rooms"), where("status", "==", "waiting"), limit(20));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function getRoom(roomId) {
  const snap = await getDoc(doc(db, "rooms", roomId));
  if (!snap.exists()) throw new Error("Room tidak ditemukan.");
  return { id: snap.id, ...snap.data() };
}
