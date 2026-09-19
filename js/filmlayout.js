export function initFilmlayout(router) {
  const playBtn = document.getElementById('play-movie-btn');

  // Oppdaterer visningen dynamisk når brukeren går inn på filmlayout
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#filmlayout' && router.state.selectedMovie) {
      const movie = router.state.selectedMovie;

      const titleEl = document.getElementById('film-detail-title');
      const descEl = document.getElementById('film-detail-desc');
      const bannerEl = document.getElementById('film-detail-banner');

      if (titleEl) titleEl.textContent = movie.title;
      if (descEl) descEl.textContent = movie.description;
      if (bannerEl && movie.banner) bannerEl.src = movie.banner;
    }
  });

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      router.navigateTo('player');
    });
  }
}
