export function initHovedside(router) {
  const movieCards = document.querySelectorAll('.movie-card');

  movieCards.forEach(card => {
    card.addEventListener('click', () => {
      const movieData = {
        id: card.dataset.id || '1',
        title: card.dataset.title || card.querySelector('.movie-title')?.textContent || 'Film',
        description: card.dataset.description || 'Beskrivelse av filmen...',
        banner: card.querySelector('img')?.src || '',
        videoUrl: card.dataset.video || ''
      };

      // Sett valgt film i global state
      router.setSelectedMovie(movieData);

      // Naviger til detaljvisning
      router.navigateTo('filmlayout');
    });
  });
}
