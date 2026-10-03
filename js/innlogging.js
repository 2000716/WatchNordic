  import { auth, db } from "./firebase-oppsett.js";
  import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence,
    onAuthStateChanged
  } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
  import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

  // MÅLSIDE ETTER INNLOGGING / REGISTRERING:
  const MAALSIDE = "hvem-ser-på.html";

  let registreringsmodus = false;
  let naavaarendeSteg = 1;
  let erSendt = false;

  // Henting av HTML-elementer
  const epostInput = document.getElementById("epost");
  const passordInput = document.getElementById("passord");
  const feilmelding = document.getElementById("feilmelding");
  const authForm = document.getElementById("authForm");
  const nesteKnapp = document.getElementById("nesteKnapp");
  const submitKnapp = document.getElementById("submitKnapp");
  const changeEmailBtn = document.getElementById("changeEmailBtn");
  const passwordToggle = document.getElementById("passwordToggle");
  const toggleTextContainer = document.getElementById("toggleText");

  function settFeilmelding(melding = "") {
    if (feilmelding) feilmelding.textContent = melding;
  }

  function settLaster(laster) {
    erSendt = laster;
    if (submitKnapp) {
      submitKnapp.disabled = laster;
      submitKnapp.style.opacity = laster ? "0.6" : "1";
    }
    if (nesteKnapp) {
      nesteKnapp.disabled = laster;
      nesteKnapp.style.opacity = laster ? "0.6" : "1";
    }
  }

  // --- HANDTERING AV HENDELSER ---
  if (epostInput) {
    epostInput.addEventListener("input", () => settFeilmelding(""));
    epostInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        validerOgGaVidere();
      }
    });
  }

  if (passordInput) {
    passordInput.addEventListener("input", () => settFeilmelding(""));
  }

  if (nesteKnapp) {
    nesteKnapp.addEventListener("click", (e) => {
      e.preventDefault();
      validerOgGaVidere();
    });
  }

  if (changeEmailBtn) {
    changeEmailBtn.addEventListener("click", (e) => {
      e.preventDefault();
      gaaTilSteg1();
    });
  }

  if (passwordToggle && passordInput) {
    passwordToggle.addEventListener("click", () => {
      const erSynlig = passordInput.type === "text";
      passordInput.type = erSynlig ? "password" : "text";
      passwordToggle.textContent = erSynlig ? "Vis" : "Skjul";
      passwordToggle.setAttribute("aria-label", erSynlig ? "Vis passord" : "Skjul passord");
      passordInput.focus();
    });
  }

  // EVENT DELEGATION FOR BYTTE MELLOM INNLOGGING OG REGISTRERING
  if (toggleTextContainer) {
    toggleTextContainer.addEventListener("click", (e) => {
      if (e.target && e.target.id === "toggleModeLink") {
        e.preventDefault();
        if (registreringsmodus) {
          visInnlogging();
        } else {
          visRegistrering();
        }
      }
    });
  }

  function validerOgGaVidere() {
    if (!epostInput) return;
    
    const epostVerdi = epostInput.value.trim();
    const epostRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!epostVerdi || !epostRegex.test(epostVerdi)) {
      settFeilmelding("Vennligst oppgi en gyldig e-postadresse.");
      return;
    }
    
    settFeilmelding("");
    skiftStegMedAnimasjon(1, 2);
  }

  function gaaTilSteg1() {
    settFeilmelding("");
    skiftStegMedAnimasjon(2, 1);
  }

  function skiftStegMedAnimasjon(fraStegNr, tilStegNr) {
    const fraElement = document.getElementById(`steg${fraStegNr}`);
    const tilElement = document.getElementById(`steg${tilStegNr}`);
    const formSubtitle = document.getElementById("formSubtitle");
    const visEpostTekst = document.getElementById("visEpostTekst");

    if (!fraElement || !tilElement) return;

    fraElement.classList.add("animating-out");

    setTimeout(() => {
      fraElement.style.display = "none";
      fraElement.classList.remove("animating-out");

      tilElement.style.display = "block";
      tilElement.classList.add("animating-in");

      naavaarendeSteg = tilStegNr;

      if (tilStegNr === 2) {
        if (visEpostTekst && epostInput) visEpostTekst.textContent = epostInput.value.trim();
        if (passordInput) {
          passordInput.required = true;
          if (!('ontouchstart' in window)) passordInput.focus();
        }
        if (formSubtitle) {
          formSubtitle.textContent = registreringsmodus 
            ? "Velg et passord for å opprette kontoen" 
            : "Skriv inn passordet ditt";
        }
      } else {
        if (passordInput) passordInput.required = false;
        if (epostInput && !('ontouchstart' in window)) epostInput.focus();
        if (formSubtitle) {
          formSubtitle.textContent = registreringsmodus 
            ? "Skriv inn e-post for å opprette konto" 
            : "Skriv inn e-postadressen din for å fortsette";
        }
      }

      requestAnimationFrame(() => {
        tilElement.classList.remove("animating-in");
      });

    }, 250);
  }

  // Sjekk om bruker allerede er innlogget
  onAuthStateChanged(auth, (user) => {
    if (user && window.location.pathname.toLowerCase().includes("innlogging")) {
      window.location.replace(MAALSIDE);
    }
  });

  // --- FIREBASE AUTENTISERING & FIRESTORE-OPERASJONER ---
  if (authForm) {
    authForm.addEventListener("submit", async function(event) {
      event.preventDefault(); 
      
      if (erSendt) return;

      if (naavaarendeSteg === 1) {
        validerOgGaVidere();
        return;
      }

      const epost = epostInput ? epostInput.value.trim().toLowerCase() : "";
      const passord = passordInput ? passordInput.value.trim() : "";
      const navnEl = document.getElementById("navn");
      const navn = (navnEl && navnEl.value.trim()) ? navnEl.value.trim() : "Hovedprofil";
      
      if (registreringsmodus && passord.length < 6) {
        settFeilmelding("Passordet må bestå av minst 6 tegn.");
        return;
      }

      settLaster(true);
      settFeilmelding("Vennligst vent..."); 

      try {
        await setPersistence(auth, browserLocalPersistence);

        const standardProfil = [
          {
            navn: navn,
            bilde: "https://static.wixstatic.com/media/fd2fb2_39376e4ee55b460ab7a3ebbfcf35fef7~mv2.png",
            isKids: false,
            maksAldersgrense: "12"
          }
        ];

        if (registreringsmodus) {
          // --- REGISTRERING ---
          const userCredential = await createUserWithEmailAndPassword(auth, epost, passord);
          const user = userCredential.user;

          await setDoc(doc(db, "users", user.uid), {
            epost: epost,
            profiler: standardProfil,
            opprettetDato: new Date().toISOString(),
            sistOppdatert: new Date().toISOString()
          });

          window.location.replace(MAALSIDE);

        } else {
          // --- INNLOGGING ---
          const userCredential = await signInWithEmailAndPassword(auth, epost, passord);
          const user = userCredential.user;

          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);

          if (!docSnap.exists()) {
            await setDoc(docRef, {
              epost: epost,
              profiler: standardProfil,
              sistOppdatert: new Date().toISOString()
            });
          }

          window.location.replace(MAALSIDE);
        }
      } catch (error) {
        settLaster(false);
        console.error("Auth-feil:", error.code, error.message);

        switch (error.code) {
          case 'auth/email-already-in-use':
            settFeilmelding("Denne e-postadressen er allerede i bruk.");
            break;
          case 'auth/invalid-credential':
          case 'auth/wrong-password':
          case 'auth/user-not-found':
            settFeilmelding("Feil e-post eller passord.");
            break;
          case 'auth/invalid-email':
            settFeilmelding("Ugyldig format på e-postadressen.");
            break;
          case 'auth/weak-password':
            settFeilmelding("Passordet må ha minst 6 tegn.");
            break;
          case 'auth/too-many-requests':
            settFeilmelding("For mange forsøk. Prøv igjen om et øyeblikk.");
            break;
          case 'auth/network-request-failed':
            settFeilmelding("Nettverksfeil. Sjekk internettforbindelsen din.");
            break;
          default:
            settFeilmelding("Kunne ikke logge inn. Prøv igjen.");
            break;
        }
      }
    });
  }

  // --- BYTT MELLOM INNLOGGING OG REGISTRERING ---
  function visRegistrering() {
    registreringsmodus = true;
    settFeilmelding("");
    
    const title = document.getElementById("formTitle");
    const submit = document.getElementById("submitKnapp");
    const forgot = document.getElementById("forgotContainer");
    const toggle = document.getElementById("toggleText");
    const navnGruppe = document.getElementById("navnGruppe");
    const formSubtitle = document.getElementById("formSubtitle");

    if (title) title.textContent = "Registrer deg";
    if (submit) submit.textContent = "Opprett konto";
    if (forgot) forgot.style.display = "none";
    if (toggle) toggle.innerHTML = 'Allerede medlem? <a href="#" id="toggleModeLink">Logg inn</a>';
    if (navnGruppe) navnGruppe.style.display = "block";
    if (passordInput) passordInput.setAttribute("autocomplete", "new-password");

    if (formSubtitle) {
      formSubtitle.textContent = (naavaarendeSteg === 1) 
        ? "Skriv inn e-post for å opprette konto" 
        : "Velg et passord for å opprette kontoen";
    }
  }

  function visInnlogging() {
    registreringsmodus = false;
    settFeilmelding("");

    const title = document.getElementById("formTitle");
    const submit = document.getElementById("submitKnapp");
    const forgot = document.getElementById("forgotContainer");
    const toggle = document.getElementById("toggleText");
    const navnGruppe = document.getElementById("navnGruppe");
    const formSubtitle = document.getElementById("formSubtitle");

    if (title) title.textContent = "Logg inn";
    if (submit) submit.textContent = "Logg inn";
    if (forgot) forgot.style.display = "block";
    if (toggle) toggle.innerHTML = 'Er du ikke medlem? <a href="#" id="toggleModeLink">Registrer deg</a>';
    if (navnGruppe) navnGruppe.style.display = "none";
    if (passordInput) passordInput.setAttribute("autocomplete", "current-password");

    if (formSubtitle) {
      formSubtitle.textContent = (naavaarendeSteg === 1) 
        ? "Skriv inn e-postadressen din for å fortsette" 
        : "Skriv inn passordet ditt";
    }
  }
</script>
