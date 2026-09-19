export function initInnlogging(router) {
  const loginForm = document.getElementById('login-form');

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const emailInput = document.getElementById('login-email');
      const passwordInput = document.getElementById('login-password');

      if (emailInput.value.trim() !== '' && passwordInput.value.trim() !== '') {
        // Simulerer vellykket innlogging
        router.navigateTo('hvem-ser-pa');
      } else {
        alert('Vennligst fyll ut både e-post og passord.');
      }
    });
  }
}
