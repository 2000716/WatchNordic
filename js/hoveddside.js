  <script>
  fetch('meny.html')
    .then(response => {
      if (!response.ok) throw new Error('Fant ikke meny.html');
      return response.text();
    })
    .then(data => {
      document.getElementById('nav-placeholder').outerHTML = data;
      if (typeof initNav === 'function') initNav(); // Kjører meny-JS på nytt
    })
    .catch(err => console.error('Feil ved lasting av meny:', err));
</script>

    <script src="meny.js"></script>
    <script src="lader.js"></script>
<script type="module">
  // ==================== HJELPEFUNKSJONER FOR SIKKERHET & PARSING ==================== //
  function sikkerJSONParse(str, fallback = null) {
    if (!str || typeof str !== "string") return fallback;
    try {
      return JSON.parse(str);
    } catch (e) {
      console.warn("Sikker JSON-parsing mislyktes:", e);
      return fallback;
    }
  }

  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ==================== CSS INJEKSJON FOR VIAPLAY-LÅSING ==================== //
  try {
    const style = document.createElement('style');
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    style.textContent = `
      .image-gallery, .coming-movies-gallery, .top10-gallery, .continue-image-gallery {
        overflow-x: ${isCoarse ? 'auto' : 'hidden'} !important; 
        scroll-behavior: smooth !important;
        display: flex !important;
        ${isCoarse ? '-webkit-overflow-scrolling: touch !important;' : ''}
      }
    `;
    document.head.appendChild(style);
  } catch (err) {
    console.error("Kunne ikke injisere style-tag:", err);
  }

  // ==================== FIREBASE IMPORT & INITIALISERING ==================== //
  import { auth, db } from "./firebase-oppsett.js";
  import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
  import { doc, updateDoc, onSnapshot, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

  let filmer = {};
  let serier = {};
  let registrertBruker = null;
  let heleProfilArrayet = [];
  let unsubscribeProfileListener = null;
  let bannerTimer = null; // SIKKERHET: Unngår overlappende timere på resize

  function oppdaterMenyProfilVisning(bildeUrl, profilNavn, farge) {
    try {
      const menyProfil = document.getElementById("menyProfilbilde");
      const profilmenyLink = document.getElementById("profilmenyLink");
      const navneEl = document.getElementById("profilNavn");
      const headerProfil = document.getElementById("headerProfilbilde");

      if (menyProfil && bildeUrl) {
        menyProfil.src = escapeHTML(bildeUrl);
        menyProfil.classList.toggle('png-karakter', String(bildeUrl).toLowerCase().endsWith('.png'));
      }

      if (navneEl && profilNavn) navneEl.textContent = profilNavn;
      if (profilmenyLink && farge) profilmenyLink.style.setProperty('--active-color', farge);
      if (headerProfil && bildeUrl) headerProfil.src = escapeHTML(bildeUrl);
    } catch (err) {
      console.error("Feil i oppdaterMenyProfilVisning:", err);
    }
  }

  // ==================== OMDIRIGERING & REALTIDS PROFIL-SYNC ==================== //
  if (auth) {
    onAuthStateChanged(auth, (user) => {
      try {
        if (!user) {
          if (unsubscribeProfileListener) unsubscribeProfileListener();
          const gjeldendeSide = window.location.pathname.split("/").pop();
          if (gjeldendeSide !== "index.html" && gjeldendeSide !== "") {
            window.location.href = "index.html";
          }
        } else {
          registrertBruker = user;

          const cachedeProfilerRaw = localStorage.getItem("watch_nordic_profiles_cache");
          if (cachedeProfilerRaw) {
            heleProfilArrayet = sikkerJSONParse(cachedeProfilerRaw, []);
            renderContinueWatching();
          }

          const userDocRef = doc(db, "users", user.uid);
          if (unsubscribeProfileListener) unsubscribeProfileListener();

          unsubscribeProfileListener = onSnapshot(userDocRef, (docSnap) => {
            try {
              if (docSnap.exists()) {
                const profiler = docSnap.data()?.profiler || [];
                heleProfilArrayet = Array.isArray(profiler) ? profiler : [];
                
                localStorage.setItem("watch_nordic_profiles_cache", JSON.stringify(heleProfilArrayet));

                const aktivProfilIndex = parseInt(localStorage.getItem("aktivProfilIndex"), 10) || 0;
                const gjeldendeProfil = heleProfilArrayet[aktivProfilIndex] || heleProfilArrayet[0];

                if (gjeldendeProfil) {
                  const bildeUrl = gjeldendeProfil.bilde || "";
                  const profilNavn = gjeldendeProfil.navn || "";
                  const farge = gjeldendeProfil.farge || "";
                  const nyIsKids = gjeldendeProfil.isKids === true;
                  const nyMaks = String(gjeldendeProfil.maksAldersgrense || "12");

                  oppdaterMenyProfilVisning(bildeUrl, profilNavn, farge);

                  if (bildeUrl) localStorage.setItem("profilbilde", bildeUrl);
                  if (profilNavn) {
                    localStorage.setItem("profilnavn", profilNavn);
                    localStorage.setItem("aktivProfil", profilNavn);
                  }

                  const gammelIsKids = localStorage.getItem("isKids") === "true";
                  const gammelMaks = localStorage.getItem("maksAldersgrense") || "12";

                  if (gammelIsKids !== nyIsKids || gammelMaks !== nyMaks) {
                    localStorage.setItem("isKids", nyIsKids ? "true" : "false");
                    localStorage.setItem("maksAldersgrense", nyMaks);
                    window.location.reload();
                    return;
                  }
                }

                renderContinueWatching();
              }
            } catch (snapErr) {
              console.error("Feil ved prosessering av docSnap:", snapErr);
            }
          }, (error) => {
            console.error("Feil ved realtidslytting på brukerprofiler:", error);
          });
        }
      } catch (authErr) {
        console.error("Kritisk feil i auth-state endring:", authErr);
      }
    });
  }

  // ==================== ALDERSFILTER & BARNE-PROFIL LOGIKK ==================== //
  const erInnloggetSomBarn = localStorage.getItem("isKids") === "true";
  const maksAldersgrense = localStorage.getItem("maksAldersgrense") || "12";

  function sjekkAldersgrense(item) {
    if (!item || !Array.isArray(item.metadata)) return false;
    const maksTall = (maksAldersgrense === "A" || maksAldersgrense === "Alle") ? 0 : (parseInt(maksAldersgrense, 10) || 0);
    let varensAlder = 0;
    
    item.metadata.forEach(meta => {
      if (typeof meta !== "string") return;
      const renTekst = meta.toLowerCase();
      if (renTekst.includes("18")) varensAlder = 18;
      else if (renTekst.includes("16")) varensAlder = 16;
      else if (renTekst.includes("15")) varensAlder = 15;
      else if (renTekst.includes("12")) varensAlder = 12;
      else if (renTekst.includes("9")) varensAlder = 9;
      else if (renTekst.includes("6")) varensAlder = 6;
    });
    return varensAlder <= maksTall;
  }

  function erEgnetForBarn(item) {
    if (!item || !Array.isArray(item.metadata)) return false;
    return item.metadata.some(meta => {
      if (typeof meta !== "string") return false;
      const m = meta.toLowerCase();
      return m.includes("barn") || m.includes("familie") || m.includes("animasjon") || m === "alle";
    });
  }

  window.gåTilKonto = function() {
    window.location.href = "konto.html";
  };

  const lagretBilde = localStorage.getItem("profilbilde");
  const lagretNavn = localStorage.getItem("profilnavn");
  if (lagretBilde) {
    oppdaterMenyProfilVisning(lagretBilde, lagretNavn);
  }

  // ==================== HERO-BANNER ==================== //
  function hentBannerInnhold() {
    let bannerInnhold = [];
    try {
      Object.keys(filmer || {}).forEach(key => {
        const item = filmer[key];
        if (item && (item.banner || item.bannerMobil)) {
          if (erInnloggetSomBarn && (!erEgnetForBarn(item) || !sjekkAldersgrense(item))) return;
          bannerInnhold.push({ ...item, key, type: "film" });
        }
      });
      Object.keys(serier || {}).forEach(key => {
        const item = serier[key];
        if (item && (item.banner || item.bannerMobil)) {
          if (erInnloggetSomBarn && (!erEgnetForBarn(item) || !sjekkAldersgrense(item))) return;
          bannerInnhold.push({ ...item, key, type: "serie" });
        }
      });
    } catch (e) {
      console.error("Feil i hentBannerInnhold:", e);
    }
    return bannerInnhold;
  }

  function oppdaterBanner() {
    try {
      if (bannerTimer) clearTimeout(bannerTimer);

      const innhold = hentBannerInnhold();
      const heroSection = document.querySelector(".hero-banner");
      if (innhold.length === 0) {
        if (heroSection) heroSection.style.display = "none";
        return;
      }

      const film = innhold[new Date().getHours() % innhold.length];
      if (!film) return;

      const erMobil = window.innerWidth <= 768;

      const bilde = document.getElementById("banner-bilde");
      const video = document.getElementById("banner-video");
      const logo = document.getElementById("banner-logo");
      const beskrivelse = document.getElementById("banner-beskrivelse");
      const metadata = document.getElementById("banner-metadata");
      const seNa = document.getElementById("banner-se-na");
      const addBtn = document.getElementById("banner-add");

      if (bilde) {
        bilde.src = escapeHTML(erMobil ? (film.bannerMobil || film.banner) : film.banner);
        bilde.style.display = "block";
      }

      if (video) {
        if (film.trailer) {
          video.src = escapeHTML(film.trailer);
          video.load();
          video.muted = true;
        } else {
          video.removeAttribute("src");
        }
        video.style.display = "none";
      }

      let titleElement = document.getElementById("banner-title");
      if (!titleElement && logo && logo.parentNode) {
        titleElement = document.createElement("h1");
        titleElement.id = "banner-title";
        titleElement.className = "banner-title";
        logo.parentNode.insertBefore(titleElement, logo.nextSibling);
      }

      if (logo) {
        if (film.logo) {
          logo.src = escapeHTML(film.logo);
          logo.style.display = "block";
          if (titleElement) titleElement.style.display = "none";
        } else {
          logo.style.display = "none";
          if (titleElement) {
            titleElement.textContent = film.tittel || "";
            titleElement.style.display = "block";
          }
        }
      }

      if (beskrivelse) beskrivelse.textContent = film.beskrivelse || "";
      if (metadata) metadata.textContent = Array.isArray(film.metadata) ? film.metadata.join(" • ") : "";

      if (seNa) {
        seNa.onclick = () => { window.location.href = `film.html?navn=${encodeURIComponent(film.key)}`; };
      }

      if (addBtn && film.tittel) {
        const key = film.tittel.toLowerCase().replace(/\s+/g, '-');
        let liste = sikkerJSONParse(localStorage.getItem("minListe"), []);
        addBtn.innerHTML = liste.includes(key) ? '<i class="fas fa-check"></i>' : '<i class="fas fa-plus"></i>';

        addBtn.onclick = () => {
          let currentListe = sikkerJSONParse(localStorage.getItem("minListe"), []);
          if (currentListe.includes(key)) {
            currentListe = currentListe.filter(item => item !== key);
          } else {
            currentListe.push(key);
          }
          localStorage.setItem("minListe", JSON.stringify(currentListe));
          addBtn.innerHTML = currentListe.includes(key) ? '<i class="fas fa-check"></i>' : '<i class="fas fa-plus"></i>';
        };
      }

      bannerTimer = setTimeout(() => {
        if (!film.trailer || !video || !bilde) return;
        bilde.style.display = "none";
        video.style.display = "block";
        video.currentTime = 0;
        video.play().catch((err) => console.log("Auto-play hindret av nettleser:", err));
        video.onended = () => {
          video.style.display = "none";
          bilde.style.display = "block";
        };
      }, 5000);
    } catch (err) {
      console.error("Feil i oppdaterBanner:", err);
    }
  }

  window.addEventListener("resize", oppdaterBanner);

  // ==================== GALLERIPILER LOGIKK ==================== //
  function oppdaterAlleGalleripiler() {
    try {
      if (window.matchMedia("(pointer: coarse)").matches) return;

      document.querySelectorAll(".gallery-wrapper, .continue-gallery-wrapper").forEach(wrapper => {
        const gallery = wrapper.querySelector(".image-gallery, .coming-movies-gallery, .top10-gallery, .continue-image-gallery");
        const left = wrapper.querySelector(".scroll-button.left");
        const right = wrapper.querySelector(".scroll-button.right");
        const fadeL = wrapper.querySelector(".fade-left");
        const fadeR = wrapper.querySelector(".fade-right");
        if (!gallery) return;

        const max = gallery.scrollWidth - gallery.clientWidth;
        const pos = gallery.scrollLeft;
        
        const kanScrolle = max > 5;
        const erHeltTilVenstre = pos <= 2;
        const erHeltTilHoyre = Math.ceil(pos) >= max - 2;

        const skjulVenstre = !kanScrolle || erHeltTilVenstre;
        if (left) {
          left.classList.toggle("hidden", skjulVenstre);
          left.disabled = skjulVenstre;
        }
        if (fadeL) fadeL.classList.toggle("fade-hidden", skjulVenstre);

        const skjulHoyre = !kanScrolle || erHeltTilHoyre;
        if (right) {
          right.classList.toggle("hidden", skjulHoyre);
          right.disabled = skjulHoyre;
        }
        if (fadeR) fadeR.classList.toggle("fade-hidden", skjulHoyre);
      });
    } catch (err) {
      console.error("Feil ved oppdatering av galleripiler:", err);
    }
  }

  function initGalleripiler() {
    document.querySelectorAll(".gallery-wrapper, .continue-gallery-wrapper").forEach(wrapper => {
      const gallery = wrapper.querySelector(".image-gallery, .coming-movies-gallery, .top10-gallery, .continue-image-gallery");
      const left = wrapper.querySelector(".scroll-button.left");
      const right = wrapper.querySelector(".scroll-button.right");
      if (!gallery) return;

      if (left && !left.dataset.bound) {
        left.dataset.bound = "true";
        left.addEventListener("click", () => {
          const steg = gallery.clientWidth > 0 ? gallery.clientWidth * 0.90 : 400;
          gallery.scrollBy({ left: -steg, behavior: "smooth" });
          setTimeout(oppdaterAlleGalleripiler, 400);
        });
      }

      if (right && !right.dataset.bound) {
        right.dataset.bound = "true";
        right.addEventListener("click", () => {
          const steg = gallery.clientWidth > 0 ? gallery.clientWidth * 0.90 : 400;
          gallery.scrollBy({ left: steg, behavior: "smooth" });
          setTimeout(oppdaterAlleGalleripiler, 400);
        });
      }

      if (!gallery.dataset.bound) {
        gallery.dataset.bound = "true";
        gallery.addEventListener("scroll", oppdaterAlleGalleripiler, { passive: true });
      }
    });
  }

  window.addEventListener("resize", oppdaterAlleGalleripiler);

  // ==================== DYNAMISK GALLERI GENERATOR ==================== //
  function createGalleryItem(itemKey, item) {
    const link = document.createElement("a");
    link.href = `film.html?navn=${encodeURIComponent(itemKey)}`;
    link.classList.add("gallery-item");
    
    if (!item) return link;

    const erMobil = window.innerWidth <= 768;
    const bildeKilde = erMobil 
      ? (item.posterVertikal || item.poster || item.bilde || "")
      : (item.poster || item.bilde || "");

    const tittelTekst = escapeHTML(item.tittel || 'Mangler tittel');
    const metaTekst = escapeHTML((Array.isArray(item.metadata) ? item.metadata : []).join(" • "));

    link.innerHTML = `
      ${bildeKilde ? `<img src="${escapeHTML(bildeKilde)}" alt="${tittelTekst}" loading="lazy">` : `<div style="width:100%; height:100%; background:#1a2629; display:flex; align-items:center; justify-content:center; padding:10px; text-align:center; font-size:12px; color:#fff;">${tittelTekst}</div>`}
      <div class="image-overlay">
        <div class="overlay-content">
          <div class="overlay-title">${tittelTekst}</div>
          <div class="overlay-meta" style="display: none;">${metaTekst}</div>
        </div>
      </div>
    `;
    
    link.setAttribute('data-metadata', metaTekst);
    
    return link;
  }

  // ==================== HJELPEFUNKSJON FOR SEKSJONER & TITTEL ==================== //
  function sjekkOgSkjulSeksjon(seksjonId, galleryId) {
    const seksjon = document.getElementById(seksjonId);
    const gallery = document.getElementById(galleryId);
    if (!seksjon) return;

    if (!gallery || gallery.children.length === 0) {
      seksjon.style.display = "none";
    } else {
      seksjon.style.display = "block";
    }
  }

  // ==================== RENDERING FUNKSJONER ==================== //
  function renderNyligLagtTil(seksjonId, galleryId, limit = 5) {
    const gallery = document.getElementById(galleryId);
    if (!gallery) return;
    gallery.innerHTML = "";
    const currentDate = new Date();
    let altInnhold = [];

    Object.keys(filmer || {}).forEach(key => {
      const film = filmer[key];
      if (!film) return;
      if (erInnloggetSomBarn && (!erEgnetForBarn(film) || !sjekkAldersgrense(film))) return;
      if (!film.publishDate || new Date(film.publishDate) <= currentDate) {
        altInnhold.push({ key, data: film });
      }
    });

    Object.keys(serier || {}).forEach(key => {
      const serie = serier[key];
      if (!serie) return;
      if (erInnloggetSomBarn && (!erEgnetForBarn(serie) || !sjekkAldersgrense(serie))) return;
      if (!serie.publishDate || new Date(serie.publishDate) <= currentDate) {
        altInnhold.push({ key, data: serie });
      }
    });

    altInnhold.sort((a, b) => new Date(b.data.publishDate || 0) - new Date(a.data.publishDate || 0));
    altInnhold.slice(0, limit).forEach(item => {
      gallery.appendChild(createGalleryItem(item.key, item.data));
    });

    sjekkOgSkjulSeksjon(seksjonId, galleryId);
  }

  function renderFilmGallery(seksjonId, galleryId, filterFunction, limit = null) {
    const gallery = document.getElementById(galleryId);
    if (!gallery) return;
    gallery.innerHTML = "";
    const currentDate = new Date();
    let filmKeys = Object.keys(filmer || {}).filter(key => {
      const film = filmer[key];
      if (!film) return false;
      if (!film.publishDate) return true;
      return new Date(film.publishDate) <= currentDate;
    });

    if (filterFunction) filmKeys = filmKeys.filter(filterFunction);
    filmKeys.sort((a, b) => new Date(filmer[b]?.publishDate || 0) - new Date(filmer[a]?.publishDate || 0));
    if (limit) filmKeys = filmKeys.slice(0, limit);

    filmKeys.forEach(key => {
      gallery.appendChild(createGalleryItem(key, filmer[key]));
    });

    sjekkOgSkjulSeksjon(seksjonId, galleryId);
  }

  function renderSeries(seksjonId, galleryId) {
    const gallery = document.getElementById(galleryId);
    if (!gallery) return;
    gallery.innerHTML = "";

    let serieKeys = Object.keys(serier || {}).filter(key => {
      const serie = serier[key];
      if (!serie) return false;
      if (erInnloggetSomBarn && (!erEgnetForBarn(serie) || !sjekkAldersgrense(serie))) return false;
      return true;
    });

    serieKeys.sort((a, b) => new Date(serier[b]?.publishDate || 0) - new Date(serier[a]?.publishDate || 0));

    serieKeys.forEach((key) => {
      gallery.appendChild(createGalleryItem(key, serier[key]));
    });

    sjekkOgSkjulSeksjon(seksjonId, galleryId);
  }

  function renderTop10(seksjonId, galleryId) {
    const gallery = document.getElementById(galleryId);
    if (!gallery) return;
    gallery.innerHTML = "";
    let filmKeys = Object.keys(filmer || {}).filter(key => {
      const film = filmer[key];
      if (!film) return false;
      if (!film.publishDate) return true;
      return new Date(film.publishDate) <= new Date();
    });

    if (erInnloggetSomBarn) {
      filmKeys = filmKeys.filter(key => erEgnetForBarn(filmer[key]) && sjekkAldersgrense(filmer[key]));
    }

    const today = new Date();
    const seed = today.getFullYear() * 1000 + today.getMonth() * 50 + today.getDate();
    function seededRandom(s) {
      const x = Math.sin(s++) * 10000;
      return x - Math.floor(x);
    }

    filmKeys.sort((a, b) => seededRandom(seed + a.length) - seededRandom(seed + b.length));
    filmKeys.slice(0, 10).forEach((key, index) => {
      const film = filmer[key];
      if (!film) return;
      const wrapper = document.createElement("a");
      wrapper.href = `film.html?navn=${encodeURIComponent(key)}`;
      wrapper.classList.add("top10-item");

      const bildeKilde = film.posterVertikal || film.poster || "";

      const img = document.createElement("img");
      if (bildeKilde) {
        img.src = escapeHTML(bildeKilde);
        img.loading = "lazy";
      }
      img.alt = escapeHTML(film.tittel || "Topp 10");

      const number = document.createElement("div");
      number.classList.add("top10-number");
      number.textContent = index + 1;

      wrapper.appendChild(img);
      wrapper.appendChild(number);
      gallery.appendChild(wrapper);
    });

    sjekkOgSkjulSeksjon(seksjonId, galleryId);
  }

  function renderDokumentarSerier(seksjonId, galleryId) {
    const gallery = document.getElementById(galleryId);
    if (!gallery) return;
    gallery.innerHTML = "";

    let serieKeys = Object.keys(serier || {}).filter(key => {
      const serie = serier[key];
      if (!serie) return false;
      if (erInnloggetSomBarn && (!erEgnetForBarn(serie) || !sjekkAldersgrense(serie))) return false;
      return Array.isArray(serie.metadata) && serie.metadata.some(meta => typeof meta === "string" && meta.toLowerCase().includes("dokumentar"));
    });

    serieKeys.sort((a, b) => new Date(serier[b]?.publishDate || 0) - new Date(serier[a]?.publishDate || 0));

    serieKeys.forEach((key) => {
      gallery.appendChild(createGalleryItem(key, serier[key]));
    });

    sjekkOgSkjulSeksjon(seksjonId, galleryId);
  }

// ==================== OPTIMALISERT FORTSETT Å SE ==================== //
function renderContinueWatching() {
  try {
    const section = document.getElementById("fortsett-section");
    const gallery = document.getElementById("fortsett-galleri");
    if (!section || !gallery) return;

    gallery.innerHTML = "";

    const cacheData = localStorage.getItem("watch_nordic_profiles_cache");
    if (cacheData) {
      heleProfilArrayet = sikkerJSONParse(cacheData, []);
    }

    const aktivIndex = parseInt(localStorage.getItem("aktivProfilIndex"), 10) || 0;
    const aktivNavn = localStorage.getItem("aktivProfil");
    const profil = heleProfilArrayet[aktivIndex] || heleProfilArrayet.find(p => p && p.navn === aktivNavn);

    if (!profil || !profil.fremdrift || typeof profil.fremdrift !== "object" || Object.keys(profil.fremdrift).length === 0) {
      section.style.display = "none";
      return;
    }

    // Hjelpefunksjon for å hente sist oppdaterte tidsstempel for et element
    const hentTid = (data) => {
      if (!data || typeof data !== "object") return 0;
      if (typeof data.lastUpdated === "number") return data.lastUpdated;
      if (typeof data.timestamp === "number") return data.timestamp;
      const ISOtid = data.sistOppdatert || data.sistSett || data.lastUpdated;
      if (ISOtid) {
        const parsed = new Date(ISOtid).getTime();
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    // Sikre bakoverkompatibilitet hvis skjultFortsett tidligere var et Array
    if (!profil.skjultFortsett || typeof profil.skjultFortsett !== "object") {
      profil.skjultFortsett = {};
    } else if (Array.isArray(profil.skjultFortsett)) {
      const gammelArray = profil.skjultFortsett;
      profil.skjultFortsett = {};
      gammelArray.forEach(id => {
        profil.skjultFortsett[id] = hentTid(profil.fremdrift[id]) || 1;
      });
    }

    let fantInnhold = false;

    const sorterteFilmIder = Object.keys(profil.fremdrift).sort((a, b) => {
      const dataA = profil.fremdrift[a];
      const dataB = profil.fremdrift[b];
      return hentTid(dataB) - hentTid(dataA);
    });

    sorterteFilmIder.forEach((filmId) => {
      const dbData = profil.fremdrift[filmId];
      const progressVerdi = typeof dbData === "object" && dbData !== null ? (dbData.percent || 0) : Number(dbData || 0);
      const erFerdig = typeof dbData === "object" && dbData !== null && dbData.status === "ferdig";

      // Sjekk om tittelen er skjult
      const skjultTid = profil.skjultFortsett[filmId] || 0;
      const sistOppdatertTid = hentTid(dbData);

      if (skjultTid > 0) {
        // Hvis brukeren har sett videre ETTER at den ble skjult, vis den igjen!
        if (sistOppdatertTid > skjultTid) {
          delete profil.skjultFortsett[filmId];
          localStorage.setItem("watch_nordic_profiles_cache", JSON.stringify(heleProfilArrayet));
        } else {
          // Fortsatt skjult og ikke spilt av på nytt -> hopp over
          return;
        }
      }

      if (progressVerdi > 96 || erFerdig) return;

      let metadataMatch = null;
      let urlParamNavn = "";
      let spillType = "film";
      let sesongNr = "";
      let episodeNr = "";

      if (filmId.startsWith("film-")) {
        urlParamNavn = filmId.replace("film-", "");
        if (filmer[urlParamNavn]) {
          metadataMatch = filmer[urlParamNavn];
          spillType = "film";
        }
      } else if (filmId.startsWith("serie-")) {
        const deler = filmId.split("-"); 
        urlParamNavn = deler[1];
        sesongNr = deler[2] ? deler[2].replace("s", "") : "1";
        episodeNr = deler[3] ? deler[3].replace("e", "") : "1";

        if (serier[urlParamNavn]) {
          metadataMatch = serier[urlParamNavn];
          spillType = "serie";
        }
      }

      if (!metadataMatch) return;

      if (erInnloggetSomBarn) {
        if (!erEgnetForBarn(metadataMatch) || !sjekkAldersgrense(metadataMatch)) return;
      }

      fantInnhold = true;

      const hrefUrl = spillType === "serie"
        ? `film-mal.html?navn=${encodeURIComponent(urlParamNavn)}&sesong=${encodeURIComponent(sesongNr)}&episode=${encodeURIComponent(episodeNr)}&returUrl=${encodeURIComponent("Hovedside.html")}`
        : `film-mal.html?navn=${encodeURIComponent(urlParamNavn)}&returUrl=${encodeURIComponent("Hovedside.html")}`;

      let bildeKilde = metadataMatch.poster || metadataMatch.bilde || "";
      if (spillType === "serie" && metadataMatch.sesonger && metadataMatch.sesonger[sesongNr]) {
        const epInfo = metadataMatch.sesonger[sesongNr].find(e => String(e.episode) === String(episodeNr));
        if (epInfo && epInfo.bilde) {
          bildeKilde = epInfo.bilde;
        }
      }

      const link = document.createElement("a");
      link.href = hrefUrl;
      link.classList.add("continue-item");

      const episodeTekst = spillType === "serie" && sesongNr && episodeNr
        ? ` • S${sesongNr}E${episodeNr}` 
        : "";

      const tittelClean = escapeHTML(metadataMatch.tittel || "");

      link.innerHTML = `
        <div class="continue-media-wrap">
          ${bildeKilde 
            ? `<img src="${escapeHTML(bildeKilde)}" alt="${tittelClean}" loading="lazy">` 
            : `<div style="width:100%; height:100%; background:#1a2629; display:flex; align-items:center; justify-content:center; padding:10px; text-align:center; font-size:12px; color:#fff;">${tittelClean || 'Mangler bilde'}</div>`
          }
          <button class="delete-progress-btn" title="Skjul fra Fortsett å se" type="button" aria-label="Skjul fra visning">
            <i class="fas fa-trash-alt"></i>
          </button>
          <div class="progress-bar" style="--progress: ${Math.min(100, Math.max(0, progressVerdi))}%;"></div>
        </div>
        <span class="continue-title">${tittelClean}${escapeHTML(episodeTekst)}</span>
      `;

      const deleteBtn = link.querySelector(".delete-progress-btn");
      deleteBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!profil.skjultFortsett || typeof profil.skjultFortsett !== "object" || Array.isArray(profil.skjultFortsett)) {
          profil.skjultFortsett = {};
        }

        // Sett nøyaktig tidsstempel for når knappen ble trykket
        profil.skjultFortsett[filmId] = Date.now();

        localStorage.setItem("watch_nordic_profiles_cache", JSON.stringify(heleProfilArrayet));

        if (registrertBruker) {
          try {
            const userDocRef = doc(db, "users", registrertBruker.uid);
            await updateDoc(userDocRef, {
              profiler: heleProfilArrayet
            });
          } catch (err) {
            console.error("Feil ved skjuling av tittel i Firebase:", err);
          }
        }

        link.style.transition = "all 0.3s ease";
        link.style.transform = "scale(0.8)";
        link.style.opacity = "0";
        setTimeout(() => {
          link.remove();
          if (gallery.children.length === 0) {
            section.style.display = "none";
          } else {
            oppdaterAlleGalleripiler();
          }
        }, 300);
      });

      gallery.appendChild(link);
    });

    if (fantInnhold) {
      section.style.display = "block";
      initGalleripiler();
      oppdaterAlleGalleripiler();
    } else {
      section.style.display = "none";
    }
  } catch (err) {
    console.error("Feil i renderContinueWatching:", err);
  }
}
  // ==================== FIRESTORE DATAHENTING MED CACHE ==================== //
  async function hentDataFraFirestore() {
    const cacheKeyFilmer = "watch_nordic_filmer_cache";
    const cacheKeySerier = "watch_nordic_serier_cache";

    const lagredeFilmer = localStorage.getItem(cacheKeyFilmer);
    const lagredeSerier = localStorage.getItem(cacheKeySerier);

    if (lagredeFilmer && lagredeSerier) {
      filmer = sikkerJSONParse(lagredeFilmer, {});
      serier = sikkerJSONParse(lagredeSerier, {});
      byggSiden();
    }

    try {
      const [filmerSnap, serierSnap] = await Promise.all([
        getDocs(collection(db, "filmer")),
        getDocs(collection(db, "serier"))
      ]);

      const nyeFilmer = {};
      filmerSnap.forEach(docSnap => { nyeFilmer[docSnap.id] = docSnap.data(); });

      const nyeSerier = {};
      serierSnap.forEach(docSnap => { nyeSerier[docSnap.id] = docSnap.data(); });

      localStorage.setItem(cacheKeyFilmer, JSON.stringify(nyeFilmer));
      localStorage.setItem(cacheKeySerier, JSON.stringify(nyeSerier));

      filmer = nyeFilmer;
      serier = nyeSerier;
      
      byggSiden();
    } catch (feil) {
      console.error("Feil ved henting av data fra Firestore:", feil);
    }
  }

  function byggSiden() {
    try {
      if (erInnloggetSomBarn) {
        renderNyligLagtTil("nye-filmer-seksjon", "nye-filmer-galleri", 5);
        renderTop10("topp10-seksjon", "topp10-filmer-galleri");
        renderFilmGallery("alle-filmer-seksjon", "filmer-galleri", (key) => erEgnetForBarn(filmer[key]) && sjekkAldersgrense(filmer[key]), 20);
        renderSeries("serier-seksjon", "serier-galleri");
        renderDokumentarSerier("dokumentar-seksjon", "dokumentarserier-galleri");
        
        const barnSeksjon = document.getElementById("barn-seksjon");
        if (barnSeksjon) barnSeksjon.style.display = "block";
        renderFilmGallery("barn-seksjon", "barn-galleri", (key) => erEgnetForBarn(filmer[key]) && sjekkAldersgrense(filmer[key]));
      } else {
        const barnSeksjon = document.getElementById("barn-seksjon");
        if (barnSeksjon) barnSeksjon.style.display = "block";

        renderNyligLagtTil("nye-filmer-seksjon", "nye-filmer-galleri", 5); 
        renderTop10("topp10-seksjon", "topp10-filmer-galleri");
        renderFilmGallery("alle-filmer-seksjon", "filmer-galleri", null, 20);
        renderSeries("serier-seksjon", "serier-galleri");
        renderDokumentarSerier("dokumentar-seksjon", "dokumentarserier-galleri");
      }

      renderContinueWatching();
      oppdaterBanner();
      initGalleripiler();
      oppdaterAlleGalleripiler();
    } catch (err) {
      console.error("Feil i byggSiden:", err);
    }
  }

  // Start henting av data
  hentDataFraFirestore();

  // ==================== NAV SCROLL EFFECT ==================== //
  let ticking = false;
  function oppdaterNavScroll() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const navbar = document.querySelector("nav") || document.querySelector("header");
        if (navbar) {
          if (window.scrollY > 50) {
            navbar.classList.add("scrolled");
          } else {
            navbar.classList.remove("scrolled");
          }
        }
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener("scroll", oppdaterNavScroll, { passive: true });
</script>
