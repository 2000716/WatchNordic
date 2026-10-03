    import { auth, db } from "./firebase-oppsett.js";
    import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
    import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

    // Standard nøytralt profilbilde hvis bilde mangler eller feiler
    const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 24 24' fill='%23a0acae'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.04-4.84-2.6.03-.99 2.02-1.9 4.84-1.9s4.81.91 4.84 1.9C15.8 18.96 14.03 20 12 20z'/></svg>";

    const urlParams = new URLSearchParams(window.location.search);
    let aktivProfilIndex = parseInt(urlParams.get('index')) || 0;

    const navnDisplay = document.getElementById("navnDisplay");
    const navnView = document.getElementById("navnView");
    const epostView = document.getElementById("epostView");
    const profilbildeEl = document.getElementById("profilbilde");

    // Sett opp feilhåndtering for profilbilde
    profilbildeEl.onerror = () => {
      profilbildeEl.src = DEFAULT_AVATAR;
    };

    // Navn-endring elementer
    const endreNavnKnapp = document.getElementById("endreNavnKnapp");
    const editNavnBox = document.getElementById("editNavnBox");
    const nyttNavnInput = document.getElementById("nyttNavnInput");
    const lagreNavnBtn = document.getElementById("lagreNavnBtn");
    const avbrytNavnBtn = document.getElementById("avbrytNavnBtn");

    // PIN elementer
    const pinToggleBtn = document.getElementById("pinToggleBtn");
    const pinToggleText = pinToggleBtn.querySelector(".pin-toggle-text");
    const editPinBox = document.getElementById("editPinBox");
    const nyPinInput = document.getElementById("nyPinInput");
    const lagrePinBtn = document.getElementById("lagrePinBtn");
    const avbrytPinBtn = document.getElementById("avbrytPinBtn");

    let profiler = [];
    let globalEpost = ""; 
    let docRef = null;
    let currentUser = null;

    // Lokal cache-sjekk
    const cachedProfiles = localStorage.getItem("watch_nordic_profiles_cache");
    const cachedEmail = localStorage.getItem("watch_nordic_email_cache");
    if (cachedProfiles && cachedEmail) {
      try {
        profiler = JSON.parse(cachedProfiles);
        globalEpost = cachedEmail;
        if (profiler[aktivProfilIndex]) byggProfilgrensesnitt();
      } catch (error) {
        console.warn("Kunne ikke lese lokal profilcache:", error);
      }
    }

    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUser = user;
        docRef = doc(db, "users", user.uid);
        globalEpost = user.email || globalEpost;
        hentKontodata();
      } else {
        currentUser = null;
        window.location.href = "index.html";
      }
    });

    document.getElementById("avatarContainer").addEventListener("click", () => {
      window.location.href = `VelgProfilbilde.html?index=${aktivProfilIndex}`;
    });

    document.getElementById("navHovedsideBtn").addEventListener("click", () => {
      window.location.href = `hvem-ser-på.html?index=${aktivProfilIndex}`;
    });

    document.getElementById("navLoggUtBtn").addEventListener("click", loggUt);
    document.getElementById("sletteKnapp").addEventListener("click", slettProfil);
    document.getElementById("loggutAlleBtn").addEventListener("click", async () => {
      try {
        await signOut(auth);
        localStorage.removeItem("watch_nordic_profiles_cache");
        localStorage.removeItem("watch_nordic_email_cache");
        window.location.href = "index.html";
      } catch (error) {
        console.error("Kunne ikke logge ut alle enheter:", error);
        alert("Kunne ikke logge ut akkurat nå. Prøv igjen.");
      }
    });

    /* --- Endre Navn Logikk --- */
    endreNavnKnapp.addEventListener("click", () => {
      nyttNavnInput.value = profiler[aktivProfilIndex]?.navn || "";
      editNavnBox.classList.remove("hidden");
      endreNavnKnapp.classList.add("hidden");
      nyttNavnInput.focus();
    });

    avbrytNavnBtn.addEventListener("click", () => {
      editNavnBox.classList.add("hidden");
      endreNavnKnapp.classList.remove("hidden");
    });

    lagreNavnBtn.addEventListener("click", async () => {
      if (!profiler[aktivProfilIndex]) return;
      const nyttNavn = nyttNavnInput.value.trim();
      if (nyttNavn && nyttNavn !== profiler[aktivProfilIndex].navn) {
        profiler[aktivProfilIndex].navn = nyttNavn;
        await oppdaterProfilData();
        byggProfilgrensesnitt();
      }
      editNavnBox.classList.add("hidden");
      endreNavnKnapp.classList.remove("hidden");
    });

    /* --- PIN Toggle Logikk --- */
    pinToggleBtn.addEventListener("click", async () => {
      if (!profiler[aktivProfilIndex]) return;

      if (pinToggleBtn.classList.contains("active")) {
        profiler[aktivProfilIndex].pin = null;
        await oppdaterProfilData();
        byggProfilgrensesnitt();
        return;
      }

      nyPinInput.value = "";
      editPinBox.classList.remove("hidden");
      nyPinInput.focus();
    });

    avbrytPinBtn.addEventListener("click", () => {
      editPinBox.classList.add("hidden");
      const harPin = Boolean(profiler[aktivProfilIndex]?.pin);
      pinToggleBtn.classList.toggle("active", harPin);
      pinToggleBtn.setAttribute("aria-pressed", harPin ? "true" : "false");
      pinToggleText.textContent = harPin ? "Kode på" : "Kode av";
    });

    lagrePinBtn.addEventListener("click", async () => {
      if (!profiler[aktivProfilIndex]) return;
      const nyPin = nyPinInput.value.trim();
      if (!nyPin) {
        alert("Skriv inn en kode først.");
        return;
      }
      profiler[aktivProfilIndex].pin = nyPin;
      await oppdaterProfilData();
      byggProfilgrensesnitt();
      editPinBox.classList.add("hidden");
    });

    /* --- Firebase & Hjelpefunksjoner --- */
    async function hentKontodata() {
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          profiler = Array.isArray(data.profiler) ? data.profiler : [];
          globalEpost = data.epost || globalEpost;
          lagreILokalStorage();
          byggProfilgrensesnitt();
        } else {
          profiler = []; 
        }
      } catch (e) {
        console.error("Feil ved henting av data:", e);
      }
    }

    function byggProfilgrensesnitt() {
      const gjeldendeProfil = profiler[aktivProfilIndex];
      if (!gjeldendeProfil) return;

      navnDisplay.innerText = gjeldendeProfil.navn;
      navnView.innerText = gjeldendeProfil.navn;
      epostView.innerText = globalEpost;

      // Sett bilde med fallback
      if (gjeldendeProfil.bilde && gjeldendeProfil.bilde.trim() !== "") {
        profilbildeEl.src = gjeldendeProfil.bilde;
      } else {
        profilbildeEl.src = DEFAULT_AVATAR;
      }

      const harPin = Boolean(gjeldendeProfil.pin);
      document.getElementById("pinView").innerText = harPin ? "Kode satt" : "Ingen kode satt";
      
      pinToggleBtn.classList.toggle("active", harPin);
      pinToggleBtn.setAttribute("aria-pressed", harPin ? "true" : "false");
      pinToggleText.textContent = harPin ? "Kode på" : "Kode av";
      
      editPinBox.classList.add("hidden");

      if (gjeldendeProfil.isKids) {
        endreNavnKnapp.classList.add("hidden");
      } else {
        endreNavnKnapp.classList.remove("hidden");
      }
    }

    async function slettProfil() {
      if (!profiler[aktivProfilIndex]) return;

      if (profiler.length <= 1) {
        alert("Du kan ikke slette den eneste profilen på kontoen.");
        return;
      }

      if (confirm(`Er du sikker på at du vil slette profilen "${profiler[aktivProfilIndex].navn}" permanent?`)) {
        profiler.splice(aktivProfilIndex, 1);
        await oppdaterProfilData();
        window.location.href = "hvem-ser-på.html?index=0";
      }
    }

    async function oppdaterProfilData() {
      if (!docRef || !currentUser) return;
      await setDoc(docRef, {
        profiler: profiler,
        epost: globalEpost,
        sistOppdatert: new Date().toISOString()
      }, { merge: true });
      lagreILokalStorage();
    }

    function lagreILokalStorage() {
      localStorage.setItem("watch_nordic_profiles_cache", JSON.stringify(profiler));
      localStorage.setItem("watch_nordic_email_cache", globalEpost);
    }

    async function loggUt() {
      try {
        await signOut(auth);
        localStorage.removeItem("watch_nordic_profiles_cache");
        localStorage.removeItem("watch_nordic_email_cache");
        window.location.href = "index.html";
      } catch (error) {
        console.error("Kunne ikke logge ut:", error);
        alert("Kunne ikke logge ut akkurat nå. Prøv igjen.");
      }
    }
  </script>
