// ==========================================
// 1. FIREBASE SETUP (CDN IMPORTS)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase Konfigurasjon
const firebaseConfig = {
  apiKey: "AIzaSyBfx4N8CtU3-35hkYnVY7dd5uh8HpdZHS4",
  authDomain: "watch-nordic-2d684.firebaseapp.com",
  projectId: "watch-nordic-2d684",
  storageBucket: "watch-nordic-2d684.firebasestorage.app",
  messagingSenderId: "911952762062",
  appId: "1:911952762062:web:677ff6e6f4e059f4be2c9f",
  measurementId: "G-XKTV0TGGSH"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

// ==========================================
// 2. SPA RUTING & NAVIGASJON (VISNINGER)
// ==========================================
const views = {
  landing: document.getElementById('landing-view'),
  login: document.getElementById('login-view'),
  profiles: document.getElementById('profiles-view'),
  main: document.getElementById('main-view'),
  detail: document.getElementById('detail-view'),
  player: document.getElementById('player-view'),
  account: document.getElementById('account-view')
};

const navbar = document.getElementById('global-navbar');

// Funksjon for å bytte skjermvisning
export function navigateTo(screenId) {
  // Skjul alle visninger
  Object.values(views).forEach(view => {
    if (view) view.classList.remove('active-view');
  });

  // Vis valgt skjerm
  if (views[screenId]) {
    views[screenId].classList.add('active-view');
  }

  // Styr synlighet for toppmenyen (skjul på landing, login og avspiller)
  if (screenId === 'player' || screenId === 'landing' || screenId === 'login') {
    navbar.style.display = 'none';
  } else {
    navbar.style.display = 'flex';
  }

  // Rull øverst på siden ved bytte
  window.scrollTo(0, 0);
}

// ==========================================
// 3. EVENT LISTENERS (KNAPPER OG LOGIKK)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

  // --- Navigasjon i toppmenyen ---
  document.getElementById('nav-logo')?.addEventListener('click', () => navigateTo('main'));
  document.getElementById('nav-home')?.addEventListener('click', (e) => { e.preventDefault(); navigateTo('main'); });
  document.getElementById('nav-originals')?.addEventListener('click', (e) => { e.preventDefault(); navigateTo('main'); });
  document.getElementById('nav-account-link')?.addEventListener('click', (e) => { e.preventDefault(); navigateTo('account'); });

  // --- Startside ---
  document.getElementById('start-trial-btn')?.addEventListener('click', () => navigateTo('login'));

  // --- Profilvalg ("Hvem ser på?") ---
  document.querySelectorAll('.profile-card').forEach(card => {
    card.addEventListener('click', () => {
      navigateTo('main');
    });
  });

  // --- Film / Detaljer / Spiller ---
  document.querySelectorAll('.movie-card').forEach(card => {
    card.addEventListener('click', () => {
      const title = card.getAttribute('data-title');
      const desc = card.getAttribute('data-desc');
      const img = card.getAttribute('data-img');
      openMovieDetail(title, desc, img);
    });
  });

  document.querySelectorAll('.play-btn, #detail-play-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const videoUrl = btn.getAttribute('data-video') || 'https://www.w3schools.com/html/mov_bbb.mp4';
      startVideoPlayer(videoUrl);
    });
  });

  document.getElementById('close-player-btn')?.addEventListener('click', closeVideoPlayer);
  document.getElementById('detail-back-btn')?.addEventListener('click', () => navigateTo('main'));
  document.getElementById('account-back-btn')?.addEventListener('click', () => navigateTo('main'));

  // ==========================================
  // 4. FIREBASE AUTHENTICATION (INNLOGGING)
  // ==========================================
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        await signInWithEmailAndPassword(auth, email, password);
        console.log("Innlogget med Firebase!");
        navigateTo('profiles');
      } catch (error) {
        console.error("Innloggingsfeil:", error.message);
        alert("Innlogging mislyktes: " + error.message);
      }
    });
  }

  // Logg ut
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    try {
      await signOut(auth);
      console.log("Bruker logget ut.");
      navigateTo('landing');
    } catch (error) {
      console.error("Utloggingsfeil:", error);
    }
  });

  // Overvåk autentiseringstilstand
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("Aktiv bruker:", user.email);
      const emailDisplay = document.getElementById('user-email-display');
      if (emailDisplay) emailDisplay.innerText = user.email;
    } else {
      console.log("Ingen bruker er logget inn.");
    }
  });
});

// ==========================================
// 5. HJELPEFUNKSJONER (DETALJER OG SPILLER)
// ==========================================
function openMovieDetail(title, desc, img) {
  document.getElementById('detail-title').innerText = title;
  document.getElementById('detail-description').innerText = desc;
  document.getElementById('detail-bg').style.backgroundImage = `url('${img}')`;
  navigateTo('detail');
}

function startVideoPlayer(videoUrl) {
  const videoPlayer = document.getElementById('main-video-player');
  const videoSource = document.getElementById('video-source');
  
  if (videoPlayer && videoSource) {
    videoSource.src = videoUrl;
    videoPlayer.load();
    navigateTo('player');
    videoPlayer.play();
  }
}

function closeVideoPlayer() {
  const videoPlayer = document.getElementById('main-video-player');
  if (videoPlayer) {
    videoPlayer.pause();
  }
  navigateTo('main');
}
