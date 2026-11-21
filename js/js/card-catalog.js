
export function initializeSearch({ onSearch }) {
  const input = document.getElementById('query');
  const button = document.getElementById('submitSearch');

  if (!input || !button) {
    console.error('Elementos da busca não encontrados.');
    return;
  }

  function search() {
    const query = input.value.trim();

    if (!query) {
      input.focus();
      return;
    }

    onSearch(query);
  }

  button.addEventListener('click', search);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      search();
    }
  });
}