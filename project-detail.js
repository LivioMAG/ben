document.addEventListener('DOMContentLoaded', () => {
  const backButton = document.getElementById('backIconButton');
  const meta = document.getElementById('projectMeta');

  const params = new URLSearchParams(window.location.search);
  const commission = String(params.get('commission') || '').trim();
  const propertyName = String(params.get('name') || '').trim();

  if (meta) {
    meta.textContent = [commission, propertyName].filter(Boolean).join(' · ');
  }

  backButton?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = './index.html';
  });
});
