import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBfx4N8CtU3-35hkYnVY7dd5uh8HpdZHS4",
  authDomain: "watch-nordic-2d684.firebaseapp.com",
  projectId: "watch-nordic-2d684",
  storageBucket: "watch-nordic-2d684.firebasestorage.app",
  messagingSenderId: "911952762062",
  appId: "1:911952762062:web:677ff6e6f4e059f4be2c9f",
  measurementId: "G-XKTV0TGGSH"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
