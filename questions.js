import { db, COST_CREATE_QUESTION_SET } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, doc, getDoc, query, orderBy, serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { deductPoints } from "./points.js";

// items format tergantung type:
//  tebak-kata / tebak-gambar -> {question, answer, imageUrl?}
//  kuis-tim                  -> {question, options:[..], correctIndex}
export async function createQuestionSet(uid, username, title, type, items, isAdmin) {
  if (!title.trim()) throw new Error("Judul soal wajib diisi.");
  if (!items.length) throw new Error("Minimal 1 soal.");
  if (!isAdmin) {
    await deductPoints(uid, COST_CREATE_QUESTION_SET, "Buat set soal: " + title);
  }
  const docRef = await addDoc(collection(db, "questionSets"), {
    title: title.trim(),
    type,
    items,
    createdBy: uid,
    createdByName: username,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function listQuestionSets(type) {
  let q;
  if (type) {
    q = query(collection(db, "questionSets"), where("type", "==", type), orderBy("createdAt", "desc"));
  } else {
    q = query(collection(db, "questionSets"), orderBy("createdAt", "desc"));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getQuestionSet(id) {
  const snap = await getDoc(doc(db, "questionSets", id));
  if (!snap.exists()) throw new Error("Set soal tidak ditemukan.");
  return { id: snap.id, ...snap.data() };
}
