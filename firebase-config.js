// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCusxhIJM-jsgm6AeQVNLskRXPpBKfSuZU",
  authDomain: "kuis-project-ad27e.firebaseapp.com",
  projectId: "kuis-project-ad27e",
  storageBucket: "kuis-project-ad27e.firebasestorage.app",
  messagingSenderId: "1041119039005",
  appId: "1:1041119039005:web:0f535b726dea5c965700f4",
  measurementId: "G-6VK0X4PLCW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);tore.js";
import {
  getDatabase
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export { onAuthStateChanged, signOut };

// Email tetap (fixed) yang dipakai akun admin khusus di Firebase Auth.
// Saat admin login dengan "username: admin", sistem otomatis memetakan
// ke email ini. Lihat README untuk cara membuat akun ini sekali di awal.
export const ADMIN_EMAIL = "admin@rame-partygame.local";
export const ADMIN_DEFAULT_PASSWORD = "admin12345";

// Biaya poin (bisa diubah sesuai selera)
export const COST_CREATE_ROOM = 50;
export const COST_CREATE_QUESTION_SET = 20;
