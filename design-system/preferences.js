// Extracted without behavior changes; see Docs/Modules for ownership.
const availableLanguages = [
  { code: 'de', title: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', title: 'English', flag: '🇬🇧' },
  { code: 'pl', title: 'Polski', flag: '🇵🇱' },
  { code: 'cs', title: 'Čeština', flag: '🇨🇿' },
  { code: 'sk', title: 'Slovenčina', flag: '🇸🇰' },
  { code: 'sl', title: 'Slovenščina', flag: '🇸🇮' },
  { code: 'hu', title: 'Magyar', flag: '🇭🇺' },
  { code: 'uk', title: 'Українська', flag: '🇺🇦' },
  { code: 'ru', title: 'Русский', flag: '🇷🇺' }
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
  // Server accounts keep the choice per person on this device; demo state keeps its own store.
  if (BackendWorkspace.enabled) BackendWorkspace.rememberLanguage(selected.code);
  else localStorage.setItem(AdminPreview.storageKey, JSON.stringify(state));
  renderLanguageControl();
  toggleLanguageMenu(false);
  render();
  showToast(`${selected.flag} ${selected.title}`, I18n.translated() ? I18n.t('Sprache ausgewählt') : 'Übersetzung folgt – die Oberfläche bleibt vorerst Deutsch.', 'success');
}
