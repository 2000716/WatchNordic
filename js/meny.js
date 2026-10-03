// meny.js
function initNav() {
    const navs = Array.from(document.querySelectorAll('.top-nav, .top-menu'));
  
    const updateNavState = () => {
      const scrolled = window.scrollY > 0;
      document.body.classList.toggle('scrolled-y', scrolled);
  
      navs.forEach((nav) => {
        nav.classList.toggle('scrolled', scrolled);
      });
    };
  
    const activateLink = () => {
      const currentPage = window.location.pathname.split('/').pop().toLowerCase();
      const normalizedCurrent = currentPage || 'hovedside.html';
  
      navs.forEach((nav) => {
        const links = nav.querySelectorAll('.nav-links a');
        links.forEach((link) => {
          const href = (link.getAttribute('href') || '').split('/').pop().toLowerCase();
          const isActive = href && (href === normalizedCurrent || (normalizedCurrent === 'hovedside.html' && href === 'hovedside.html'));
          link.classList.toggle('active', isActive);
        });
      });
    };
  
    // Hent og sett profilbilde automatisk når menyen lastes inn med sikkerhets-sjekk
    const oppdaterProfilBilde = () => {
      const lagretBilde = localStorage.getItem("profilbilde");
      const menyBildeEl = document.getElementById("menyProfilbilde");
  
      if (menyBildeEl) {
        if (lagretBilde && lagretBilde !== "null" && lagretBilde !== "undefined" && lagretBilde.trim() !== "") {
          menyBildeEl.src = lagretBilde;
        } else {
          // Standard reservebilde hvis ingenting er valgt, slik at det aldri blir tomt
          menyBildeEl.src = "https://res.cloudinary.com/ocv4zhpk/image/upload/v1785856037/Muffins_profil_100_k1qd4h.png";
        }
      }
    };
  
  activateLink();
    updateNavState();
    oppdaterProfilBilde();
  
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateNavState();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }
