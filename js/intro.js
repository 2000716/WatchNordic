export function initIntro(router) {
  const ctaBtn = document.getElementById('intro-cta-btn');
  const loginLink = document.getElementById('intro-login-link');

  if (ctaBtn) {
    ctaBtn.addEventListener('click', () => {
      router.navigateTo('innlogging');
    });
  }

  if (loginLink) {
    loginLink.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigateTo('innlogging');
    });
  }
}
