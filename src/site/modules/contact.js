/**
 * Kontaktformular (form[data-contact]).
 * Noch ohne Versanddienst: zeigt nach dem Absenden den Hinweis .form-status.
 */
export function initContact() {
  const form = document.querySelector('form[data-contact]');
  if (!form) return;

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const note = form.querySelector('.form-status');
    if (note) note.hidden = false;
  });
}
