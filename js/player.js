import { db, auth } from './firebase-oppsett.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// --- CONFIG & CONSTANTS ---
const CONFIG = {
  DEFAULT_RETURN_URL: "Hovedside.html",
  CACHE_KEY_PROFILES: "watch_nordic_profiles_cache",
  KEY_LAST_VOLUME: "video-last-volume",
  KEY_SUBTITLE_SETTING: "global-subtitle-setting",
  PROGRESS_SAVE_INTERVAL_MS: 5000,
  AUTOPLAY_COUNTDOWN_SEC: 8,
  FINISHED_THRESHOLD_PERCENT: 96
};

// --- CENTRAL STATE ---
const state = {
  film: null,
  filmId: "",
  tilbakeUrl: CONFIG.DEFAULT_RETURN_URL,
  isSerie: false,
  currentUser: null,
  heleProfilArrayet: [],
  serieDataGlobal: null,
  isDragging: false,
  hideTimeout: null,
  globalSubtitleSetting: localStorage.getItem(CONFIG.KEY_SUBTITLE_SETTING) || "off",
  subtitlesEnabled: false,
  autoplayTriggered: false,
  autoplayAktiv: false,
  lokalLagringsInterval: null,
  autoplayTimer: null,
  lastVolume: parseFloat(localStorage.getItem(CONFIG.KEY_LAST_VOLUME)) || 1,
  aktivProfilNavn: localStorage.getItem("aktivProfil") || "Hovedprofil",
  hiddenVideo: null,
  hiddenCanvas: null,
  hiddenCtx: null
};

// --- HELPER FUNCTIONS ---
function safeQuerySelector(selector) {
  return document.querySelector(selector) || null;
}

function safeGetElementById(id) {
  return document.getElementById(id) || null;
}

function sanitizeString(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (match) => {
    const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return escapeMap[match];
  });
}

function formatTime(time) {
  if (isNaN(time) || !isFinite(time) || time < 0) return "00:00";
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s < 10 ? '0' + s : s}`;
}

// --- DOM ELEMENTS CACHE ---
const elements = {
  ui: safeGetElementById("ui"),
  playBtn: safeGetElementById("playPauseBtn"),
  muteBtn: safeGetElementById("muteBtn"),
  volumeSlider: safeQuerySelector(".volume-slider"),
  rewindBtn: safeGetElementById("rewindBtn"),
  forwardBtn: safeGetElementById("forwardBtn"),
  progress: safeGetElementById("progress"),
  progressFilled: safeGetElementById("progressFilled"),
  thumb: safeGetElementById("thumb"),
  timeDisplay: safeGetElementById("timeDisplay"),
  captionsBtn: safeGetElementById("captionsBtn"),
  captionMenu: safeGetElementById("captionMenu"),
  fullscreenBtn: safeGetElementById("fullscreenBtn"),
  container: safeGetElementById("container"),
  loadingSpinner: safeGetElementById("loadingSpinner"),
  previewBox: safeGetElementById("previewBox"),
  previewImage: safeGetElementById("previewImage"),
  previewTime: safeGetElementById("previewTime"),
  subtitleOverlay: safeGetElementById("subtitleOverlay"),
  resumeOverlay: safeGetElementById("resumeOverlay"),
  continueBtn: safeGetElementById("continueBtn"),
  restartBtn: safeGetElementById("restartBtn"),
  nextEpisodeBtn: safeGetElementById("nextEpisodeBtn"),
  autoplayOverlay: safeGetElementById("autoplayOverlay"),
  autoplayLogo: safeGetElementById("autoplayLogo"),
  autoplayEpTag: safeGetElementById("autoplayEpTag"),
  autoplayEpTitle: safeGetElementById("autoplayEpTitle"),
  autoplayEpDesc: safeGetElementById("autoplayEpDesc"),
  autoplayPlayNextBtn: safeGetElementById("autoplayPlayNextBtn"),
  autoplayCancelBtn: safeGetElementById("autoplayCancelBtn"),
  skipIntroBtn: safeGetElementById("skipIntroBtn"),
  skipOutroBtn: safeGetElementById("skipOutroBtn"),
  backButton: safeGetElementById("backButton"),
  video: safeGetElementById("video"),
  videoWrapper: safeGetElementById("videoWrapper"),
  audioTracksDiv: safeGetElementById("audioTracks"),
  subtitleTracksDiv: safeGetElementById("subtitleTracks"),
  movieTitleEl: safeQuerySelector(".movie-title")
};

/* ================= 1. INITIALISERING ================= */
export async function initPlayer(router = null) {
  const urlParams = new URLSearchParams(window.location.search);
  const navn = urlParams.get("navn") || urlParams.get("id");
  const sesong = urlParams.get("sesong") || urlParams.get("s");
  const episode = urlParams.get("episode") || urlParams.get("e");
  const returUrlParam = urlParams.get("returUrl");

  if (returUrlParam) {
    state.tilbakeUrl = decodeURIComponent(returUrlParam);
  }

  const mediaKlar = await hentMediaData(navn, sesong, episode, returUrlParam);
  if (!mediaKlar) return;

  oppsettUI();
  oppsettIkoner();
  oppsettVideoSource();
  oppsettEventListeneres();
  oppsettPreviewCanvas();
  
  // Auth listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      state.currentUser = user;
      håndterAuthBruker(user);
    } else {
      window.location.href = "index.html";
    }
  });
}

/* ================= 2. DATA HENTING (FIREBASE) ================= */
async function hentMediaData(navn, sesong, episode, returUrlParam) {
  if (!navn) {
    alert("Ugyldig innhold");
    window.location.href = CONFIG.DEFAULT_RETURN_URL;
    return false;
  }

  try {
    if (sesong && episode) {
      const serieRef = doc(db, "serier", navn);
      const serieSnap = await getDoc(serieRef);

      if (serieSnap.exists()) {
        const serie = serieSnap.data();
        const ep = serie.sesonger?.[sesong]?.episoder?.[episode];

        if (ep) {
          state.serieDataGlobal = serie;
          state.film = {
            ...ep,
            audioLanguages: serie.audioLanguages || [],
            subtitleLanguages: serie.subtitleLanguages || [],
            tittel: `${serie.tittel} – S${String(sesong).padStart(2, '0')}E${String(episode).padStart(2, '0')}: ${ep.tittel}`
          };
          state.filmId = `serie-${navn}-s${sesong}-e${episode}`;
          if (!returUrlParam) state.tilbakeUrl = `film.html?navn=${encodeURIComponent(navn)}`;
          state.isSerie = true;
          return true;
        }
      }
    } else {
      const filmRef = doc(db, "filmer", navn);
      const filmSnap = await getDoc(filmRef);

      if (filmSnap.exists()) {
        state.film = filmSnap.data();
        state.filmId = `film-${navn}`;
        if (!returUrlParam) state.tilbakeUrl = state.film.tilbakeUrl || `film.html?navn=${encodeURIComponent(navn)}`;
        state.isSerie = false;
        return true;
      }
    }
  } catch (err) {
    console.error("Feil ved henting av media fra Firebase:", err);
  }

  alert("Innholdet kunne ikke lastes eller finnes ikke.");
  window.location.href = CONFIG.DEFAULT_RETURN_URL;
  return false;
}

/* ================= 3. UI OG VIDEO SETUP ================= */
function oppsettUI() {
  document.title = state.film.tittel || "Avspiller";
  if (elements.movieTitleEl && state.film?.tittel) {
    elements.movieTitleEl.textContent = state.film.tittel;
  }

  const nesteEpisodeUrl = hentNesteEpisodeUrl();
  if (elements.nextEpisodeBtn) {
    if (state.isSerie && nesteEpisodeUrl) {
      elements.nextEpisodeBtn.style.display = "inline-block";
      elements.nextEpisodeBtn.onclick = () => ryddeOgNeste();
    } else {
      elements.nextEpisodeBtn.style.display = "none";
    }
  }
}

function oppsettIkoner() {
  if (elements.backButton) elements.backButton.innerHTML = '<i class="fa-solid fa-xmark" style="color: #ffffff; font-size: 26px; padding: 5px;"></i>';
  if (elements.rewindBtn) elements.rewindBtn.innerHTML = '<i class="fa-solid fa-rotate-left" style="color: #ffffff; font-size: 22px;"></i>';
  if (elements.forwardBtn) elements.forwardBtn.innerHTML = '<i class="fa-solid fa-rotate-right" style="color: #ffffff; font-size: 22px;"></i>';
  if (elements.captionsBtn) elements.captionsBtn.innerHTML = '<i class="fa-solid fa-closed-captioning" style="color: #ffffff; font-size: 22px;"></i>';
  if (elements.fullscreenBtn) elements.fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand" style="color: #ffffff; font-size: 22px;"></i>';
  if (elements.playBtn) elements.playBtn.innerHTML = '<i class="fa-solid fa-play" style="color: #ffffff; font-size: 26px;"></i>';
  if (elements.muteBtn) elements.muteBtn.innerHTML = '<i class="fa-solid fa-volume-high" style="color: #ffffff; font-size: 22px;"></i>';
}

function oppsettVideoSource() {
  if (!elements.video) return;
  const videoUrl = state.film.videoUrl || state.film.video || state.film.src;
  
  const sourceTag = elements.video.querySelector("source");
  if (sourceTag && videoUrl) {
    sourceTag.src = videoUrl;
  } else if (videoUrl) {
    elements.video.src = videoUrl;
  }

  const trackTag = elements.video.querySelector("track");
  if (trackTag && state.film.subtitleUrl) {
    trackTag.src = state.film.subtitleUrl;
  }

  elements.video.load();
}

function oppsettPreviewCanvas() {
  state.hiddenVideo = document.createElement("video");
  state.hiddenVideo.src = state.film.videoUrl || state.film.video || state.film.src || "";
  state.hiddenVideo.muted = true;
  state.hiddenVideo.crossOrigin = "anonymous";
  state.hiddenVideo.preload = "auto";

  state.hiddenCanvas = document.createElement("canvas");
  state.hiddenCtx = state.hiddenCanvas.getContext("2d");
  state.hiddenCanvas.width = 240;
  state.hiddenCanvas.height = 135;

  state.hiddenVideo.addEventListener("seeked", () => {
    try {
      state.hiddenCtx.drawImage(state.hiddenVideo, 0, 0, state.hiddenCanvas.width, state.hiddenCanvas.height);
      if (elements.previewImage) elements.previewImage.src = state.hiddenCanvas.toDataURL("image/jpeg");
    } catch (err) {
      // Ignorerer CORS/Canvas export feil i preview
    }
  });
}

/* ================= 4. AUTH & PROFIL SYNKRANISERING ================= */
async function håndterAuthBruker(user) {
  const cacheData = localStorage.getItem(CONFIG.CACHE_KEY_PROFILES);
  if (cacheData) {
    try { state.heleProfilArrayet = JSON.parse(cacheData); } catch (e) { state.heleProfilArrayet = []; }
  }

  try {
    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      state.heleProfilArrayet = docSnap.data().profiler || [];
      localStorage.setItem(CONFIG.CACHE_KEY_PROFILES, JSON.stringify(state.heleProfilArrayet));
    }
  } catch (err) {
    console.error("Feil ved profilsynkronisering:", err);
  }

  sjekkLagretFremdrift();
}

function sjekkLagretFremdrift() {
  const profil = state.heleProfilArrayet.find(p => p.navn === state.aktivProfilNavn);
  if (!profil) {
    startVideoFraStart();
    return;
  }

  const fremdriftInfo = profil.fremdrift?.[state.filmId];
  const lagretTid = fremdriftInfo?.currentTime ? parseFloat(fremdriftInfo.currentTime) : 0;

  if (fremdriftInfo && lagretTid > 5 && fremdriftInfo.status !== "ferdig") {
    if (elements.resumeOverlay) elements.resumeOverlay.style.display = "flex";

    if (elements.continueBtn) {
      elements.continueBtn.onclick = () => {
        if (elements.resumeOverlay) elements.resumeOverlay.style.display = "none";
        elements.video.currentTime = lagretTid;
        elements.video.play().catch(() => {});
        oppdaterFremdriftILokalMatrise("paabegynt");
        startLokalLagringsLoop();
      };
    }

    if (elements.restartBtn) {
      elements.restartBtn.onclick = () => {
        if (elements.resumeOverlay) elements.resumeOverlay.style.display = "none";
        startVideoFraStart();
      };
    }
  } else {
    startVideoFraStart();
  }
}

function startVideoFraStart() {
  if (!elements.video) return;
  elements.video.currentTime = 0;
  elements.video.play().catch(() => {});

  setTimeout(() => {
    oppdaterFremdriftILokalMatrise("paabegynt");
  }, 200);

  startLokalLagringsLoop();
}

/* ================= 5. FREMDRIFT OG LAGRING ================= */
function startLokalLagringsLoop() {
  clearInterval(state.lokalLagringsInterval);
  state.lokalLagringsInterval = setInterval(() => {
    oppdaterFremdriftILokalMatrise("paabegynt");
  }, CONFIG.PROGRESS_SAVE_INTERVAL_MS);
}

function oppdaterFremdriftILokalMatrise(status) {
  if (!elements.video || isNaN(elements.video.currentTime) || isNaN(elements.video.duration) || elements.video.duration <= 0) return;

  const percent = parseFloat(((elements.video.currentTime / elements.video.duration) * 100).toFixed(1));
  let profilIdx = state.heleProfilArrayet.findIndex(p => p.navn === state.aktivProfilNavn);
  if (profilIdx === -1) return;

  if (!state.heleProfilArrayet[profilIdx].fremdrift) state.heleProfilArrayet[profilIdx].fremdrift = {};
  if (!state.heleProfilArrayet[profilIdx].historikk) state.heleProfilArrayet[profilIdx].historikk = {};

  const urlParams = new URLSearchParams(window.location.search);
  const navn = urlParams.get("navn") || urlParams.get("id");
  const sesong = urlParams.get("sesong") || urlParams.get("s");
  const episode = urlParams.get("episode") || urlParams.get("e");

  if (status === "ferdig" || percent > CONFIG.FINISHED_THRESHOLD_PERCENT) {
    delete state.heleProfilArrayet[profilIdx].fremdrift[state.filmId];
    state.heleProfilArrayet[profilIdx].historikk[navn] = "ferdig";

    localStorage.removeItem("progress_" + state.filmId);
    localStorage.removeItem("progress_" + navn);
    localStorage.removeItem(`${state.filmId}-lastPosition`);
  } else {
    state.heleProfilArrayet[profilIdx].fremdrift[state.filmId] = {
      currentTime: elements.video.currentTime,
      percent: percent,
      status: "paabegynt",
      lastUpdated: Date.now(),
      sistOppdatert: new Date().toISOString(),
      tittel: state.film.tittel,
      id: state.filmId,
      navn: navn,
      sesong: sesong || null,
      episode: episode || null
    };
    state.heleProfilArrayet[profilIdx].historikk[navn] = "påbegynt";
  }

  localStorage.setItem(CONFIG.CACHE_KEY_PROFILES, JSON.stringify(state.heleProfilArrayet));

  if (state.currentUser) {
    const userDocRef = doc(db, "users", state.currentUser.uid);
    setDoc(userDocRef, { profiler: state.heleProfilArrayet }, { merge: true }).catch(err => {
      console.error("Feil ved bakgrunnssynk til Firebase:", err);
    });
  }
}

async function lagreSistePosisjonEkspress() {
  clearInterval(state.lokalLagringsInterval);
  if (!elements.video) return;
  const erFerdig = (elements.video.currentTime / elements.video.duration) > (CONFIG.FINISHED_THRESHOLD_PERCENT / 100);
  oppdaterFremdriftILokalMatrise(erFerdig ? "ferdig" : "paabegynt");
}

async function ryddeOgNeste() {
  if (elements.video) elements.video.pause();
  clearInterval(state.lokalLagringsInterval);
  clearInterval(state.autoplayTimer);

  oppdaterFremdriftILokalMatrise("ferdig");

  const nesteUrl = hentNesteEpisodeUrl();
  if (state.isSerie && nesteUrl) {
    window.location.href = nesteUrl;
  } else {
    window.location.href = state.tilbakeUrl;
  }
}

/* ================= 6. EVENT LISTENERS OG INTERAKSJONER ================= */
function oppsettEventListeneres() {
  const { video, playBtn, backButton, volumeSlider, muteBtn, rewindBtn, forwardBtn, captionsBtn, fullscreenBtn, progress } = elements;

  if (backButton) {
    backButton.addEventListener("click", async (e) => {
      e.preventDefault();
      await lagreSistePosisjonEkspress();
      window.location.href = state.tilbakeUrl;
    });
  }

  if (video) {
    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('click', () => video.paused ? video.play() : video.pause());
    video.addEventListener('play', () => {
      if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-pause" style="color: #ffffff; font-size: 26px;"></i>';
      showUI();
    });
    video.addEventListener('pause', () => {
      if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play" style="color: #ffffff; font-size: 26px;"></i>';
      showUI();
    });
    video.addEventListener('loadedmetadata', håndterMetadataLoaded);
    video.addEventListener('ended', async () => await ryddeOgNeste());

    if (elements.loadingSpinner) {
      video.addEventListener('waiting', () => elements.loadingSpinner.style.display = 'block');
      video.addEventListener('playing', () => elements.loadingSpinner.style.display = 'none');
    }

    video.addEventListener("timeupdate", sjekkIntroOutroAutoplay);
  }

  if (playBtn) playBtn.addEventListener('click', () => video.paused ? video.play() : video.pause());

  // Tastatursnarveier
  document.addEventListener('keydown', e => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
    if (state.autoplayAktiv) return;
    if (e.code === 'Space') { e.preventDefault(); video.paused ? video.play() : video.pause(); }
    if (e.key === 'ArrowRight') video.currentTime = Math.min(video.duration, video.currentTime + 10);
    if (e.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 10);
  });

  // Volumstyring
  if (volumeSlider) {
    settVolum(state.lastVolume);
    volumeSlider.addEventListener('input', (e) => settVolum(e.target.value));
  }
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      if (video.muted || video.volume === 0) {
        video.muted = false;
        settVolum(state.lastVolume > 0 ? state.lastVolume : 0.5);
      } else {
        video.muted = true;
        if (volumeSlider) {
          volumeSlider.value = 0;
          volumeSlider.style.setProperty('--volume-percent', '0%');
        }
        oppdaterVolumIkon(0, true);
      }
    });
  }

  if (rewindBtn) rewindBtn.addEventListener('click', () => video.currentTime = Math.max(0, video.currentTime - 10));
  if (forwardBtn) forwardBtn.addEventListener('click', () => video.currentTime = Math.min(video.duration, video.currentTime + 10));

  if (captionsBtn) {
    captionsBtn.addEventListener('click', () => {
      if (elements.captionMenu) elements.captionMenu.style.display = elements.captionMenu.style.display === 'block' ? 'none' : 'block';
    });
  }

  // Scrubbing / Progress
  if (progress) {
    progress.addEventListener('mousedown', e => { state.isDragging = true; scrubTo(e); });
    progress.addEventListener("mousemove", showPreview);
    progress.addEventListener("mouseleave", hidePreview);
  }
  document.addEventListener('mouseup', e => {
    if (state.isDragging) {
      const percent = scrubTo(e);
      video.currentTime = percent * video.duration;
      state.isDragging = false;
      hidePreview();
    }
  });
  document.addEventListener('mousemove', e => {
    if (state.isDragging) {
      const percent = scrubTo(e);
      video.currentTime = percent * video.duration;
      showPreview(e);
    }
  });

  // UI Hiding
  document.addEventListener('mousemove', showUI);
  document.addEventListener('keydown', showUI);

  // Fullscreen
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        elements.container.requestFullscreen().catch(console.error);
      } else {
        document.exitFullscreen().catch(console.error);
      }
    });
  }
  document.addEventListener('fullscreenchange', () => {
    if (fullscreenBtn) {
      fullscreenBtn.innerHTML = document.fullscreenElement
        ? '<i class="fa-solid fa-compress" style="color: #ffffff; font-size: 22px;"></i>'
        : '<i class="fa-solid fa-expand" style="color: #ffffff; font-size: 22px;"></i>';
    }
  });

  // Skip buttons
  if (elements.skipIntroBtn) elements.skipIntroBtn.addEventListener("click", () => { video.currentTime = state.film.introEnd; });
  if (elements.skipOutroBtn) elements.skipOutroBtn.addEventListener("click", () => { ryddeOgNeste(); });

  // Unload og cleanup
  window.addEventListener('beforeunload', () => {
    oppdaterFremdriftILokalMatrise((video.currentTime / video.duration) > (CONFIG.FINISHED_THRESHOLD_PERCENT / 100) ? "ferdig" : "paabegynt");
    if (state.currentUser && navigator.sendBeacon) {
      const userDocRef = doc(db, "users", state.currentUser.uid);
      setDoc(userDocRef, { profiler: state.heleProfilArrayet }, { merge: true }).catch(() => {});
    }
  });

  document.addEventListener("contextmenu", e => e.preventDefault());
}

/* ================= 7. KONTROLL-FUNKSJONER ================= */
function updateProgress() {
  const { video, progressFilled, thumb, timeDisplay } = elements;
  if (!video) return;

  if (!state.isDragging && video.duration) {
    const percent = (video.currentTime / video.duration) * 100;
    if (progressFilled) progressFilled.style.width = percent + '%';
    if (thumb) thumb.style.left = percent + '%';
  }
  if (timeDisplay) {
    timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  }
}

function settVolum(volVal) {
  const vol = parseFloat(volVal);
  if (isNaN(vol)) return;

  elements.video.volume = vol;
  elements.video.muted = (vol === 0);

  if (vol > 0) {
    state.lastVolume = vol;
    localStorage.setItem(CONFIG.KEY_LAST_VOLUME, vol);
  }

  if (elements.volumeSlider) {
    elements.volumeSlider.value = vol;
    elements.volumeSlider.style.setProperty('--volume-percent', `${vol * 100}%`);
  }
  oppdaterVolumIkon(vol, elements.video.muted);
}

function oppdaterVolumIkon(vol, isMuted) {
  if (!elements.muteBtn) return;
  if (isMuted || vol === 0) {
    elements.muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark" style="color: #ffffff; font-size: 22px;"></i>';
  } else if (vol < 0.4) {
    elements.muteBtn.innerHTML = '<i class="fa-solid fa-volume-low" style="color: #ffffff; font-size: 22px;"></i>';
  } else {
    elements.muteBtn.innerHTML = '<i class="fa-solid fa-volume-high" style="color: #ffffff; font-size: 22px;"></i>';
  }
}

function showUI() {
  if (state.autoplayAktiv) {
    document.body.classList.remove('no-cursor');
    return;
  }

  if (elements.ui) elements.ui.classList.remove('hidden');
  document.body.classList.remove('no-cursor');
  if (elements.subtitleOverlay) elements.subtitleOverlay.classList.add("subtitle-up");
  clearTimeout(state.hideTimeout);

  state.hideTimeout = setTimeout(() => {
    if (!elements.video.paused && !state.isDragging) {
      if (elements.ui) elements.ui.classList.add('hidden');
      document.body.classList.add('no-cursor');
      if (elements.subtitleOverlay) elements.subtitleOverlay.classList.remove("subtitle-up");
    }
  }, 3000);
}

function scrubTo(e) {
  if (!elements.video.duration || !elements.progress) return 0;
  const rect = elements.progress.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const percent = Math.min(Math.max(0, x / rect.width), 1);
  if (elements.progressFilled) elements.progressFilled.style.width = percent * 100 + '%';
  if (elements.thumb) elements.thumb.style.left = percent * 100 + '%';
  return percent;
}

function showPreview(e) {
  if (!elements.video.duration || !elements.previewBox || !elements.progress) return;
  const rect = elements.progress.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const percent = Math.min(Math.max(0, x / rect.width), 1);
  const time = percent * elements.video.duration;

  elements.previewBox.style.left = `${x - 120}px`;
  elements.previewBox.style.display = "block";
  if (elements.previewTime) elements.previewTime.textContent = formatTime(time);

  if (state.hiddenVideo) state.hiddenVideo.currentTime = time;
}

function hidePreview() {
  if (elements.previewBox) elements.previewBox.style.display = "none";
}

/* ================= 8. AUDIO & LYDSPOR / UNDERTEKSTER ================= */
function håndterMetadataLoaded() {
  updateProgress();
  byggSporMenyer();

  if (state.globalSubtitleSetting !== "off") {
    const aktivKnapp = safeQuerySelector(`#subtitleTracks button[data-lang="${state.globalSubtitleSetting}"]`);
    if (aktivKnapp) {
      aktivKnapp.click();
    } else {
      deaktiverUndertekster();
    }
  } else {
    deaktiverUndertekster();
  }
}

function deaktiverUndertekster() {
  state.subtitlesEnabled = false;
  for (let i = 0; i < elements.video.textTracks.length; i++) {
    elements.video.textTracks[i].mode = "disabled";
  }
  if (elements.subtitleOverlay) elements.subtitleOverlay.textContent = "";
  updateSubtitleButtons("off");
}

function byggSporMenyer() {
  if (elements.audioTracksDiv) {
    elements.audioTracksDiv.innerHTML = "";
    if (state.film.audioLanguages && state.film.audioLanguages.length > 0) {
      state.film.audioLanguages.forEach(lang => {
        const btn = document.createElement("button");
        btn.textContent = sanitizeString(lang.label);
        btn.addEventListener("click", () => { if (elements.captionMenu) elements.captionMenu.style.display = "none"; });
        elements.audioTracksDiv.appendChild(btn);
      });
    } else {
      elements.audioTracksDiv.innerHTML = "<em style='color:gray;'>Standard lydspor</em>";
    }
  }

  if (elements.subtitleTracksDiv) {
    elements.subtitleTracksDiv.innerHTML = "";

    if (state.film.subtitleLanguages && state.film.subtitleLanguages.length > 0) {
      state.film.subtitleLanguages.forEach(sub => {
        const btn = document.createElement("button");
        btn.textContent = sanitizeString(sub.label);
        btn.dataset.lang = sub.code;

        if (state.globalSubtitleSetting === sub.code) btn.classList.add("active");

        btn.addEventListener("click", () => velgUndertekst(sub.code));
        elements.subtitleTracksDiv.appendChild(btn);
      });
    }

    const offBtn = document.createElement("button");
    offBtn.textContent = "Av";
    offBtn.dataset.lang = "off";
    if (state.globalSubtitleSetting === "off") offBtn.classList.add("active");

    offBtn.addEventListener("click", () => velgUndertekst("off"));
    elements.subtitleTracksDiv.appendChild(offBtn);
  }
}

function velgUndertekst(langCode) {
  state.globalSubtitleSetting = langCode;
  localStorage.setItem(CONFIG.KEY_SUBTITLE_SETTING, langCode);

  if (langCode === "off") {
    deaktiverUndertekster();
  } else {
    state.subtitlesEnabled = true;
    for (let i = 0; i < elements.video.textTracks.length; i++) {
      const track = elements.video.textTracks[i];
      if (track.language === langCode || track.label.toLowerCase() === langCode) {
        track.mode = "hidden";
        track.oncuechange = () => {
          if (!state.subtitlesEnabled) { if (elements.subtitleOverlay) elements.subtitleOverlay.textContent = ""; return; }
          const cues = track.activeCues;
          if (elements.subtitleOverlay) {
            elements.subtitleOverlay.textContent = cues && cues.length > 0 ? cues[0].text : "";
          }
        };
      } else {
        track.mode = "disabled";
      }
    }
    updateSubtitleButtons(langCode);
  }

  if (elements.captionMenu) elements.captionMenu.style.display = "none";
}

function updateSubtitleButtons(activeLang) {
  document.querySelectorAll("#subtitleTracks button").forEach(btn => {
    if (btn.dataset.lang === activeLang) { btn.classList.add("active"); } else { btn.classList.remove("active"); }
  });
}

/* ================= 9. AUTOPLAY & INTRO/OUTRO LOGIKK ================= */
function hentNesteEpisodeUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const navn = urlParams.get("navn") || urlParams.get("id");
  const sesong = parseInt(urlParams.get("sesong") || urlParams.get("s"));
  const episode = parseInt(urlParams.get("episode") || urlParams.get("e"));
  const returUrlParam = urlParams.get("returUrl");

  if (state.isSerie && navn && sesong && episode && state.serieDataGlobal) {
    const serie = state.serieDataGlobal;
    const returParam = returUrlParam ? `&returUrl=${encodeURIComponent(returUrlParam)}` : '';

    if (serie.sesonger?.[sesong]?.episoder?.[episode + 1]) {
      return `film-mal.html?navn=${encodeURIComponent(navn)}&sesong=${sesong}&episode=${episode + 1}${returParam}`;
    }
    if (serie.sesonger?.[sesong + 1]?.episoder?.[1]) {
      return `film-mal.html?navn=${encodeURIComponent(navn)}&sesong=${sesong + 1}&episode=1${returParam}`;
    }
  }
  return null;
}

function sjekkIntroOutroAutoplay() {
  const tid = elements.video.currentTime;

  if (state.isSerie && state.film.introStart != null && state.film.introEnd != null) {
    if (tid >= state.film.introStart && tid <= state.film.introEnd) {
      if (elements.skipIntroBtn) elements.skipIntroBtn.style.display = "block";
    } else {
      if (elements.skipIntroBtn) elements.skipIntroBtn.style.display = "none";
    }
  }

  if (elements.video.duration && !isNaN(elements.video.duration)) {
    const triggerTid = state.film.outroStart != null ? state.film.outroStart : (elements.video.duration - 15);
    const nesteUrl = hentNesteEpisodeUrl();
    if (state.isSerie && nesteUrl && tid >= triggerTid && !state.autoplayTriggered && !elements.video.paused) {
      state.autoplayTriggered = true;
      startPremiumAutoplay();
    }
  }
}

function startPremiumAutoplay() {
  if (!elements.autoplayOverlay || !elements.videoWrapper) return;

  state.autoplayAktiv = true;
  document.body.classList.remove('no-cursor');

  if (elements.ui) {
    elements.ui.style.pointerEvents = "none";
    elements.ui.style.display = "none";
  }

  let nesteBildeUrl = "";
  let nesteTittel = "Neste episode";
  let nesteBeskrivelse = "";
  let nesteEpInfoText = "";
  let serieLogoUrl = "";

  const urlParams = new URLSearchParams(window.location.search);
  const navn = urlParams.get("navn") || urlParams.get("id");
  const sesong = parseInt(urlParams.get("sesong") || urlParams.get("s"));
  const episode = parseInt(urlParams.get("episode") || urlParams.get("e"));

  if (state.isSerie && navn && sesong && episode && state.serieDataGlobal) {
    const serie = state.serieDataGlobal;
    serieLogoUrl = serie.logo || "";

    let nesteEpData = serie.sesonger?.[sesong]?.episoder?.[episode + 1] || serie.sesonger?.[sesong + 1]?.episoder?.[1];
    let nesteSNum = serie.sesonger?.[sesong]?.episoder?.[episode + 1] ? sesong : sesong + 1;
    let nesteENum = serie.sesonger?.[sesong]?.episoder?.[episode + 1] ? (episode + 1) : 1;

    if (nesteEpData) {
      nesteBildeUrl = nesteEpData.thumbnail || nesteEpData.bildeUrl || serie.bakgrunnsbilde || serie.bakgrunns || "";
      nesteTittel = nesteEpData.tittel || "Neste episode";
      nesteBeskrivelse = nesteEpData.beskrivelse || "";
      nesteEpInfoText = `S${nesteSNum}:E${nesteENum}`;
    }
  }

  if (elements.container && nesteBildeUrl) {
    elements.container.style.backgroundImage = `url('${nesteBildeUrl}')`;
    elements.container.style.backgroundSize = "cover";
    elements.container.style.backgroundPosition = "center";
  }

  if (elements.autoplayLogo) {
    if (serieLogoUrl) {
      elements.autoplayLogo.src = serieLogoUrl;
      elements.autoplayLogo.style.display = "block";
    } else {
      elements.autoplayLogo.style.display = "none";
    }
  }
  if (elements.autoplayEpTag) elements.autoplayEpTag.textContent = nesteEpInfoText;
  if (elements.autoplayEpTitle) elements.autoplayEpTitle.textContent = nesteTittel;
  if (elements.autoplayEpDesc) elements.autoplayEpDesc.textContent = nesteBeskrivelse;

  if (elements.autoplayPlayNextBtn) elements.autoplayPlayNextBtn.onclick = () => ryddeOgNeste();
  if (elements.autoplayCancelBtn) elements.autoplayCancelBtn.onclick = () => avbrytAutoplay();

  elements.container.classList.add("autoplay-active");
  elements.autoplayOverlay.style.display = "flex";

  let teller = CONFIG.AUTOPLAY_COUNTDOWN_SEC;
  const countdownEl = safeGetElementById("autoplayCountdown");
  const progressPath = safeGetElementById("timerProgress");

  if (countdownEl) countdownEl.textContent = teller;
  if (progressPath) progressPath.style.strokeDasharray = "100, 100";

  state.autoplayTimer = setInterval(() => {
    teller--;
    if (countdownEl) countdownEl.textContent = teller;

    if (progressPath) {
      const prosent = (teller / CONFIG.AUTOPLAY_COUNTDOWN_SEC) * 100;
      progressPath.style.strokeDasharray = `${prosent}, 100`;
    }

    if (teller <= 0) {
      clearInterval(state.autoplayTimer);
      ryddeOgNeste();
    }
  }, 1000);
}

function avbrytAutoplay() {
  state.autoplayAktiv = false;
  clearInterval(state.autoplayTimer);
  if (elements.autoplayOverlay) elements.autoplayOverlay.style.display = "none";

  if (elements.container) {
    elements.container.style.backgroundImage = "";
    elements.container.classList.remove("autoplay-active");
  }

  if (elements.ui) {
    elements.ui.style.pointerEvents = "auto";
    elements.ui.style.display = "";
    showUI();
  }

  if (elements.skipOutroBtn) {
    elements.skipOutroBtn.style.display = "none";
  }
}

// Start spilleren når skriptet evalueres
initPlayer().catch(err => {
  console.error("Kritisk feil ved oppstart av videospiller:", err);
});
