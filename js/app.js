import { initIntro } from './intro.js';
import { initInnlogging } from './innlogging.js';
import { initHvemSerPa } from './hvem-ser-på.js';
import { initHovedside } from './hoveddside.js';
import { initFilmlayout } from './filmlayout.js';
import { initKonto } from './konto.js';
import { initPlayer } from './player.js';
import { initMeny } from './meny.js';

class SPARouter {
  constructor() {
    // Kobling mellom URL-hash (#) og ID på seksjonene i HTML
    this.routes = {
      'intro': 'view-intro',
      'innlogging': 'view-innlogging',
      'hvem-ser-pa': 'view-hvem-ser-pa',
      'hovedside': 'view-hovedside',
      'filmlayout': 'view-filmlayout',
      'konto': 'view-konto',
      'player': 'view-player'
    };

    this.defaultRoute = 'intro';
    
    // Felles app-tilstand
    this.state = {
      activeProfile: null,
      currentMovie: null
    };

    this.init();
  }

  init() {
    // Initialiser toppmenyen / navigasjonen en gang
    initMeny(this);

    // Initialiser alle enkeltvisninger og send inn router-instansen
    initIntro(this);
    initInnlogging(this);
    initHvemSerPa(this);
    initHovedside(this);
    initFilmlayout(this);
    initKonto(this);
    initPlayer(this);

    // Lytt på endringer i hash (#) i URL-en
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('DOMContentLoaded', () => this.handleRoute());
  }

  handleRoute() {
    // Hent ut hash uten "#" (f.eks. "#hovedside" -> "hovedside")
    const hash = window.location.hash.replace('#', '').trim();
    
    // Finn riktig routeKey eller bruk standard
    const routeKey = this.routes[hash] ? hash : this.defaultRoute;
    const targetViewId = this.routes[routeKey];

    this.renderView(targetViewId);
    this.updateActiveMenuLink(routeKey);
  }

  renderView(viewId) {
    // Skjul alle visninger og vis kun den aktive
    const pages = document.querySelectorAll('.view-page');

    pages.forEach(page => {
      if (page.id === viewId) {
        page.classList.remove('hidden');
        page.classList.add('active');
        page.removeAttribute('aria-hidden');
      } else {
        page.classList.add('hidden');
        page.classList.remove('active');
        page.setAttribute('aria-hidden', 'true');
      }
    });

    // Skjul toppmenyen på landingssider/spiller, vis på app-sider
    const globalHeader = document.getElementById('global-header');
    const hideHeaderOn = ['view-intro', 'view-innlogging', 'view-hvem-ser-pa', 'view-player'];

    if (globalHeader) {
      if (hideHeaderOn.includes(viewId)) {
        globalHeader.style.display = 'none';
      } else {
        globalHeader.style.display = 'flex';
      }
    }

    // Rull opp til toppen ved bytte av side
    window.scrollTo(0, 0);
  }

  updateActiveMenuLink(activeRoute) {
    // Marker aktiv fane i menyen
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
      const href = link.getAttribute('href')?.replace('#', '');
      if (href === activeRoute) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // Metoder for å programmatisk skifte side eller endre profil
  navigateTo(routeKey) {
    window.location.hash = routeKey;
  }

  setProfile(profileData) {
    this.state.activeProfile = profileData;
    // Oppdater ev. profilbilde/navn i meny.js
    const avatar = document.getElementById('menu-avatar');
    if (avatar && profileData?.avatar) {
      avatar.src = profileData.avatar;
    }
  }
}

// Start applikasjonen
const router = new SPARouter();
export default router;
