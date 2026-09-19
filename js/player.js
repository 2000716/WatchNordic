export function initPlayer(router) {
  const backBtn = document.getElementById('player-back-btn');
  const videoElement = document.getElementById('main-video-player');

  // Oppdater videokilde når avspilleren åpnes
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#player') {
      const movie = router.state.selectedMovie;

      if (videoElement && movie?.videoUrl) {
        videoElement.src = movie.videoUrl;
        videoElement.play().catch(() => {
          console.log('Autoplay forhindret av nettleseren.');
        });
      }
    } else {
      // Pause video hvis brukeren navigerer bort
      if (videoElement) {
        videoElement.pause();
      }
    }
  });

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      router.navigateTo('filmlayout');
    });
  }
}
