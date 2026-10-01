// Extracted without behavior changes; see Docs/Modules for ownership.
const availableLanguages = [
  { code: 'de', title: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', title: 'Englisch', flag: '🇬🇧' },
  { code: 'pl', title: 'Polnisch', flag: '🇵🇱' },
  { code: 'cs', title: 'Tschechisch', flag: '🇨🇿' },
  { code: 'sk', title: 'Slowakisch', flag: '🇸🇰' },
  { code: 'sl', title: 'Slowenisch', flag: '🇸🇮' },
  { code: 'hu', title: 'Ungarisch', flag: '🇭🇺' },
  { code: 'uk', title: 'Ukrainisch', flag: '🇺🇦' },
  { code: 'ru', title: 'Russisch', flag: '🇷🇺' }
];

function renderLanguageControl() {
  const selected = availableLanguages.find((language) => language.code === state.language) || availableLanguages[0];
  state.language = selected.code;
  document.documentElement.lang = selected.code;
  document.getElementById('languageCurrentFlag').textContent = selected.flag;
  document.getElementById('languageCurrent').textContent = selected.title;
  document.querySelectorAll('[data-language]').forEach((button) => {
    const isSelected = button.dataset.language === selected.code;
    button.classList.toggle('active', isSelected);
    button.setAttribute('aria-checked', String(isSelected));
    button.querySelector('.language-option-check').textContent = isSelected ? '✓' : '';
  });
}

function applyAppearance() {
  document.documentElement.dataset.theme = appearance;
  const switchesToLight = appearance === 'dark';
  const button = document.getElementById('appearanceToggle');
  const iconNode = document.getElementById('appearanceIcon');
  const label = switchesToLight ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren';
  button.setAttribute('aria-label', label);
  button.title = label;
  iconNode.innerHTML = icon(switchesToLight ? 'sun' : 'moon', 18);
  document.querySelector('meta[name="theme-color"]').content = switchesToLight ? '#040506' : '#f3f6f8';
}

function toggleAppearance() {
  appearance = appearance === 'dark' ? 'light' : 'dark';
  localStorage.setItem('gep-flex-appearance', appearance);
  applyAppearance();
}

function toggleLanguageMenu(forceOpen) {
  const menu = document.getElementById('languageMenu');
  const button = document.getElementById('languageMenuButton');
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : menu.hidden;
  menu.hidden = !shouldOpen;
  button.setAttribute('aria-expanded', String(shouldOpen));
}

function selectLanguage(code) {
  const selected = availableLanguages.find((language) => language.code === code);
  if (!selected) return;
  state.language = selected.code;
  localStorage.setItem(AdminPreview.storageKey, JSON.stringify(state));
  renderLanguageControl();
  toggleLanguageMenu(false);
  showToast('Sprache ausgewaehlt', `${selected.flag} ${selected.title}`, 'success');
}
