export function initMeny(router) {
  const menuAvatar = document.getElementById('menu-avatar');
  const searchInput = document.getElementById('global-search-input');

  if (menuAvatar) {
    menuAvatar.addEventListener('click', () => {
      router.navigateTo('konto');
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();

      // Dersom brukeren søker, kan du filtrere filmene på hovedsiden
      const movieCards = document.querySelectorAll('.movie-card');
      movieCards.forEach(card => {
        const title = (card.dataset.title || card.textContent).toLowerCase();
        if (title.includes(query)) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }
}
