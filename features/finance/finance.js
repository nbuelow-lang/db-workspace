let lexwareCheckRunning = false;
function renderFinance(role=state.role, {preview=false} = {}) {
  if (!preview) setPageMeta('BÜLOW & DOLZ', 'Finanzen');
  if (!['admin','finance'].includes(state.role)) return emptyState('lock','Finanz-Workspace','Für Kalkulation und Finanzen vorgesehen.');
  return `<div class="werkraum-head"><div><h2>Kalkulation & Finanzen</h2><p>Verantwortlich: Lukas Langer · Wirtschaftsingenieur</p></div>
    <a class="button primary" href="https://app.lexware.de/" target="_blank" rel="noopener noreferrer">${icon('arrow-up-right',16)} Lexware Office öffnen</a></div>
    <section class="werkraum-rules"><h3>Lexware Office</h3><p id="lexwareStatus" role="status">Verbindung noch nicht geprüft. Datenabgleich nicht aktiviert.</p>
    <button class="button outline" data-action="lexware-verify" ${lexwareCheckRunning ? 'disabled' : ''}>${icon('refresh',16)} ${lexwareCheckRunning ? 'Wird geprüft …' : 'Verbindung prüfen'}</button>
    <p>Die Anmeldung bei Lexware öffnet euren vorhandenen Zugang. Die Verbindung zu Flex wird separat am Server eingerichtet.</p>
    <a href="https://app.lexware.de/addons/public-api" target="_blank" rel="noopener noreferrer">API-Verwaltung in Lexware Office ${icon('arrow-up-right',14)}</a></section>
    <section class="werkraum-rules"><h3>Zuständigkeiten</h3>
    <dl class="finance-responsibilities"><dt>Kalkulation und Finanzen</dt><dd>Lukas Langer</dd><dt>Technische Leitung und technische Freigabe</dt><dd>Lucas-René Dolz</dd><dt>Vision, Design und Präsentation</dt><dd>Nicolai Bülow</dd></dl>
    <p>Angebotsfreigabe und Zahlungsberechtigungen sind noch nicht festgelegt.</p></section>`;
}
async function checkLexware() {
  if (AdminPreview.enabled || BackendWorkspace.enabled) { document.getElementById('lexwareStatus').textContent = 'Testmodus: keine Verbindung zu echten Finanzdaten.'; return; }
  if (!['admin','finance'].includes(state.role) || lexwareCheckRunning) return;
  const label = document.getElementById('lexwareStatus');
  const button = document.querySelector('[data-action="lexware-verify"]');
  lexwareCheckRunning = true;
  if (button) button.disabled = true;
  label.textContent = 'Lexware-Zugang wird geprüft …';
  try {
    if (isGitHubPagesHost || location.protocol !== 'http:') throw Error('Die Verbindungsprüfung benötigt den lokalen Flex-Server.');
    const response = await fetch('/api/lexware/verify', {method:'POST', headers:{'X-Flex-Lexware-Check':'1'}, signal:AbortSignal.timeout(15000)});
    const result = await response.json();
    if (!response.ok || result.verified !== true) throw Error(result.message || 'Verbindung nicht bestätigt.');
    label.textContent = result.message;
  } catch (error) {
    label.textContent = error.name === 'TimeoutError' ? 'Zeitüberschreitung. Verbindung nicht bestätigt.' : (error.message === 'Failed to fetch' ? 'Flex-Server nicht erreichbar.' : error.message);
  } finally {
    lexwareCheckRunning = false;
    if (button) button.disabled = false;
    const currentButton = document.querySelector('[data-action="lexware-verify"]');
    if (currentButton) {currentButton.disabled = false; currentButton.innerHTML = `${icon('refresh',16)} Verbindung prüfen`;}
  }
}
