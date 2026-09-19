export function initHvemSerPa(router) {
  const profileCards = document.querySelectorAll('.profile-card');

  profileCards.forEach(card => {
    card.addEventListener('click', () => {
      const name = card.dataset.name || 'Bruker';
      const avatar = card.querySelector('img')?.src || '';

      // Lagre valgt profil i appens state
      router.setProfile({ name, avatar });

      // Naviger videre til hovedsiden
      router.navigateTo('hovedside');
    });
  });
}
