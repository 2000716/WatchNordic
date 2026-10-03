    import { auth, db } from "./firebase-oppsett.js";
    import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
    import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

    const MAX_PROFILER = 5;
    const container = document.getElementById("profiles");
    const modal = document.getElementById("addProfileModal");
    const pinModal = document.getElementById("pinModal");
    const pinProfileName = document.getElementById("pinProfileName");
    const pinInput = document.getElementById("pinInput");
    const pinError = document.getElementById("pinError");
    const newProfileNameInput = document.getElementById("newProfileName");
    const isKidsProfileInput = document.getElementById("isKidsProfile");
    const kontoLink = document.getElementById("kontoLink");

    // Standard nøytral grå profilikon (SVG) dersom profilbilde ikke er valgt
    const standardBilde = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231a292c'/><circle cx='50' cy='38' r='22' fill='%23708083'/><path d='M 18 88 C 18 68, 32 58, 50 58 C 68 58, 82 68, 82 88 Z' fill='%23708083'/></svg>";
    
    // Sett inn bildelenken du ønsker å bruke for barneprofilen her
    const barnBilde = "https://res.cloudinary.com/ocv4zhpk/image/upload/v1785856036/Marshmellows_edited_omilcb.png"; 

    let profiler = [];
    let docRef = null;
    let pendingProfileIndex = null;

    const cachedProfiles = localStorage.getItem("watch_nordic_profiles_cache");
    if (cachedProfiles) {
      try {
        profiler = JSON.parse(cachedProfiles);
        renderProfiler(); 
      } catch (e) {
        console.error("Kunne ikke lese profil-cache:", e);
      }
    }

    onAuthStateChanged(auth, (user) => {
      if (user) {
        docRef = doc(db, "users", user.uid);
        hentProfiler();
      } else {
        window.location.href = "Innlogging.html";
      }
    });

    async function hentProfiler() {
      try {
        const docSnap = await getDoc(docRef);
        let databaseEndret = false;
        
        if (docSnap.exists() && docSnap.data().profiler) {
          profiler = docSnap.data().profiler;
        } else {
          profiler = [];
        }

        if (profiler.length === 0) {
          profiler.push({
            navn: "Hovedprofil",
            bilde: standardBilde,
            pin: null,
            isKids: false,
            maksAldersgrense: "18"
          });
          databaseEndret = true;
        }

        const harBarneprofil = profiler.some(p => p.isKids === true);
        if (!harBarneprofil && profiler.length < MAX_PROFILER) {
          profiler.push({
            navn: "Barn",
            bilde: barnBilde,
            pin: null,
            isKids: true,
            maksAldersgrense: "12"
          });
          databaseEndret = true;
        }

        if (databaseEndret || !docSnap.exists()) {
          await setDoc(docRef, { profiler: profiler }, { merge: true });
        }
        
        localStorage.setItem("watch_nordic_profiles_cache", JSON.stringify(profiler));
        renderProfiler();
      } catch (error) {
        console.error("Feil ved henting av profiler fra Firestore:", error);
      }
    }

    function renderProfiler() {
      container.innerHTML = "";

      profiler.forEach((profil, index) => {
        const div = document.createElement("div");
        div.className = "profile" + (profil.isKids ? " kids-profile" : "");

        const kidsBadgeHtml = profil.isKids ? `<br><span class="kids-badge">Kids</span>` : '';
        const lockHtml = profil.pin ? `<div class="profile-lock"><i class="fa-solid fa-lock"></i> Kode</div>` : '';

        div.innerHTML = `
          <div class="avatar">
            <img src="${profil.bilde || (profil.isKids ? barnBilde : standardBilde)}" alt="${profil.navn}">
          </div>
          <div class="name">${profil.navn}${kidsBadgeHtml}</div>
          ${lockHtml}
          <div class="action-btn edit-btn" title="Endre navn og bilde">
            <i class="fa-solid fa-pen"></i>
          </div>
        `;

        div.addEventListener("click", () => {
          velgProfil(index);
        });

        const editBtn = div.querySelector(".edit-btn");
        if (editBtn) {
          editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            window.location.href = `konto.html?index=${index}`;
          });
        }

        container.appendChild(div);
      });

      if (profiler.length < MAX_PROFILER) {
        const addDiv = document.createElement("div");
        addDiv.className = "profile add-profile";
        addDiv.innerHTML = `
          <div class="avatar"><i class="fa-solid fa-plus"></i></div>
          <div class="name">Legg til profil</div>
        `;
        addDiv.addEventListener("click", åpneModal);
        container.appendChild(addDiv);
      }
    }

    function fortsettProfilvalg(index) {
      const profil = profiler[index];
      localStorage.setItem("aktivProfilIndex", index);
      localStorage.setItem("profilnavn", profil.navn || "");
      localStorage.setItem("aktivProfil", profil.navn || "");
      localStorage.setItem("profilbilde", profil.bilde || (profil.isKids ? barnBilde : standardBilde));
      localStorage.setItem("isKids", profil.isKids ? "true" : "false");
      localStorage.setItem("maksAldersgrense", profil.maksAldersgrense || "12");

      kontoLink.href = `konto.html?index=${index}`;

      document.body.style.opacity = "0";
      setTimeout(() => {
        window.location.href = `Hovedside.html?index=${index}`;
      }, 400);
    }

    function velgProfil(index) {
      const profil = profiler[index];

      if (profil.pin) {
        pendingProfileIndex = index;
        pinProfileName.textContent = profil.navn;
        pinInput.value = "";
        pinError.textContent = "";
        pinModal.classList.add("active");
        return;
      }

      fortsettProfilvalg(index);
    }

    function lukkPinModal() {
      pinModal.classList.remove("active");
      pendingProfileIndex = null;
      pinInput.value = "";
      pinError.textContent = "";
    }

    function åpneModal() {
      newProfileNameInput.value = "";
      isKidsProfileInput.checked = false;
      modal.classList.add("active");
      newProfileNameInput.focus();
    }

    function lukkModal() {
      modal.classList.remove("active");
    }

    async function lagreNyProfil() {
      const navn = newProfileNameInput.value.trim();
      const erBarn = isKidsProfileInput.checked;

      if (!navn) return alert("Profilen må ha et navn!");
      if (profiler.length >= MAX_PROFILER) return lukkModal();

      profiler.push({
        navn: navn,
        bilde: erBarn ? barnBilde : standardBilde, 
        pin: null,
        isKids: erBarn,
        maksAldersgrense: erBarn ? "12" : "18"
      });

      await setDoc(docRef, { profiler: profiler }, { merge: true });
      localStorage.setItem("watch_nordic_profiles_cache", JSON.stringify(profiler));
      
      lukkModal();
      renderProfiler();
    }

    document.querySelectorAll(".pin-key[data-value]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (pinInput.value.length >= 4) return;
        pinInput.value += btn.dataset.value;
        pinError.textContent = "";
      });
    });

    document.getElementById("pinKeyBack").addEventListener("click", () => {
      pinInput.value = pinInput.value.slice(0, -1);
      pinError.textContent = "";
    });

    document.getElementById("pinKeyClear").addEventListener("click", () => {
      pinInput.value = "";
      pinError.textContent = "";
    });

    document.getElementById("btnConfirmPin").addEventListener("click", () => {
      const profil = profiler[pendingProfileIndex];
      if (!profil) return;

      if (pinInput.value === profil.pin) {
        lukkPinModal();
        fortsettProfilvalg(pendingProfileIndex);
      } else {
        pinError.textContent = "Feil kode. Prøv igjen.";
        pinInput.value = "";
      }
    });

    document.getElementById("btnClosePin").addEventListener("click", lukkPinModal);
    document.getElementById("btnCreateProfile").addEventListener("click", lagreNyProfil);
    document.getElementById("btnCloseModal").addEventListener("click", lukkModal);

    newProfileNameInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") lagreNyProfil();
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) lukkModal();
    });

    pinModal.addEventListener("click", (e) => {
      if (e.target === pinModal) lukkPinModal();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("active")) lukkModal();
      if (e.key === "Escape" && pinModal.classList.contains("active")) lukkPinModal();
      if (e.key === "Enter" && pinModal.classList.contains("active")) {
        e.preventDefault();
        document.getElementById("btnConfirmPin").click();
      }
    });

  export function initHvemSerPa(router = null) {
    return true;
  }
