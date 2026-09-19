export function initKonto(router) {
  const logoutBtn = document.getElementById('logout-btn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      // Nullstill profil- og filmtilstand
      router.setProfile(null);
      router.setSelectedMovie(null);

      // Naviger tilbake til intro
      router.navigateTo('intro');
    });
  }
}
