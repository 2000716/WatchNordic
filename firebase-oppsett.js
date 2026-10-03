// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBfx4N8CtU3-35hkYnVY7dd5uh8HpdZHS4",
  authDomain: "watch-nordic-2d684.firebaseapp.com",
  projectId: "watch-nordic-2d684",
  storageBucket: "watch-nordic-2d684.firebasestorage.app",
  messagingSenderId: "911952762062",
  appId: "1:911952762062:web:677ff6e6f4e059f4be2c9f",
  measurementId: "G-XKTV0TGGSH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
