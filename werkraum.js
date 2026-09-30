const werkraumURL = 'https://buelow-soehne-werkraum.nicolai-buelow.chatgpt.site/';
let werkraumQuery = '';
let werkraumFilter = 'all';
const canUseWerkraum = () => ['admin', 'pm', 'quality'].includes(state.role);
const werkraumMoney = value => value == null ? 'Nicht angegeben' : money(value);

function renderWerkraum() {
  setPageMeta('BÜLOW & DOLZ · WERKRAUM', 'Anfragen & Aufträge');
  if (!canUseWerkraum()) return emptyState('lock', 'Interner Arbeitsbereich', 'Der Werkraum ist für das interne Bülow & Dolz Team vorgesehen.');
  const leads = state.werkraumLeads || [];
  const fits = leads.filter(l => WerkraumCore.assess(l).kind === 'fit').length;
  return `<div class="werkraum-head">
    <div><h2>Bülow & Dolz</h2><p>Elektrotechnik, Installation und Projektsteuerung</p></div>
    <a class="button primary" href="${werkraumURL}" target="_blank" rel="noopener noreferrer">${icon('mail',16)} <span>MyHammer & Live-Werkraum</span> ${icon('arrow-up-right',14)}</a>
  </div>
  <p class="werkraum-connection">Anfragen hier: übernommener Datenstand · Live-Werkraum: eigene Anmeldung und bestehender MyHammer-Konnektor</p>
  <div class="werkraum-metrics">
    <div><strong>${leads.length}</strong><span>Anfragen übernommen</span></div>
    <div><strong>${fits}</strong><span>Passende Anfragen</span></div>
    <div><strong>${(state.operations?.importCandidates || []).filter(c => c.source === 'MyHammer').length}</strong><span>In Projektplanung</span></div>
  </div>
  <div class="werkraum-toolbar">
    <label class="werkraum-search"><span class="sr-only">Anfragen und Nachrichten suchen</span><input id="werkraumSearch" type="search" placeholder="Anfragen und Nachrichten suchen" value="${escapeAttr(werkraumQuery)}"></label>
    <label><span class="sr-only">Eignung</span><select id="werkraumFilter"><option value="all">Alle Anfragen</option>${Object.entries(WerkraumCore.labels).map(([id, label]) => `<option value="${id}" ${werkraumFilter === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <button class="button outline" data-action="werkraum-import">${icon('upload',16)} Importieren</button>
    <button class="icon-button" data-action="werkraum-export" title="Anfragen als JSON exportieren" aria-label="Anfragen exportieren">${icon('file',16)}</button>
    <input type="file" id="werkraumFile" accept="application/json,.json" hidden>
  </div>
  <div id="werkraumResults">${werkraumRows()}</div>
  <div class="werkraum-rules"><h3>Einsatzprofil</h3><p>Renovierung und Ausbau · Charlottenburg, 10 km bestätigter Umkreis · Keine Duschwandinstallation</p><p>Unbestätigte Entfernungen und unvollständige Beschreibungen bleiben zur Prüfung offen.</p></div>`;
}

function werkraumRows() {
  const leads = (state.werkraumLeads || []).filter(l => WerkraumCore.matches(l, werkraumQuery) && (werkraumFilter === 'all' || WerkraumCore.assess(l).kind === werkraumFilter));
  if (!leads.length) return emptyState('briefcase', (state.werkraumLeads || []).length ? 'Keine Treffer' : 'Noch keine Anfragen übernommen', 'Live-Werkraum öffnen oder einen Werkraum-Export im JSON-Format importieren.');
  return `<div class="werkraum-list">${leads.map(l => {
    const fit = WerkraumCore.assess(l);
    return `<button class="werkraum-row" data-action="werkraum-detail" data-lead="${escapeAttr(l.id)}">
      <span class="werkraum-main"><strong>${escapeAttr(l.title)}</strong><span>${escapeAttr(l.contact)} · ${escapeAttr(l.area || 'Ort offen')}</span><small>${escapeAttr(l.id)} · ${escapeAttr(l.desired)}</small></span>
      <span class="werkraum-fit ${fit.kind}">${WerkraumCore.labels[fit.kind]}</span>
      <span class="werkraum-budget"><strong>${werkraumMoney(l.budget)}</strong><small>Kundenbudget</small></span>
      ${icon('arrow-right',18)}</button>`;
  }).join('')}</div>`;
}

function showWerkraumLead(id) {
  const lead = (state.werkraumLeads || []).find(l => l.id === id);
  if (!lead || !canUseWerkraum()) return;
  const fit = WerkraumCore.assess(lead);
  const planned = (state.operations?.importCandidates || []).some(c => c.id === `werkraum-${id}`);
  openModal({ eyebrow: `BÜLOW & DOLZ WERKRAUM · ${id}`, title: lead.title,
    body: `<div class="notice info"><div><strong>${WerkraumCore.labels[fit.kind]}</strong><p>${escapeAttr(fit.reason)}</p></div></div>
      <div class="detail-grid"><div class="detail-block"><span>Kontakt</span><strong>${escapeAttr(lead.contact)}</strong></div><div class="detail-block"><span>Kundenbudget, kein Auftragspreis</span><strong>${werkraumMoney(lead.budget)}</strong></div></div>
      <h3>Leistungsumfang</h3><p class="werkraum-description">${escapeAttr(lead.description)}</p>
      <ul>${lead.scope.map(s => `<li>${escapeAttr(s)}</li>`).join('')}</ul>
      ${lead.missing.length ? `<h3>Noch zu klären</h3><ul>${lead.missing.map(s => `<li>${escapeAttr(s)}</li>`).join('')}</ul>` : ''}
      <h3>Übernommene Nachrichten</h3>${lead.messages.map(m => `<div class="werkraum-message"><small>${escapeAttr(m.sender)} · ${escapeAttr(m.date)}</small><p>${escapeAttr(m.text)}</p></div>`).join('') || '<p>Keine Nachrichten im Export.</p>'}`,
    footer: `<button class="button outline" data-action="close-modal">Schließen</button>${state.role === 'admin' ? `<button class="button primary" data-action="werkraum-plan" data-lead="${escapeAttr(id)}" ${planned || fit.kind === 'excluded' ? 'disabled' : ''}>${planned ? 'In Projektplanung' : 'Zur Projektplanung übernehmen'}</button>` : ''}`
  });
}

function werkraumAction(action, target) {
  if (!canUseWerkraum()) return;
  if (action === 'werkraum-import') document.getElementById('werkraumFile')?.click();
  if (action === 'werkraum-detail') showWerkraumLead(target.dataset.lead);
  if (action === 'werkraum-plan' && state.role === 'admin') {
    const lead = (state.werkraumLeads || []).find(l => l.id === target.dataset.lead);
    if (!lead || WerkraumCore.assess(lead).kind === 'excluded') return;
    if (state.operations.importCandidates.some(c => c.id === `werkraum-${lead.id}`)) return;
    state.operations.importCandidates.unshift(WerkraumCore.candidate(lead, state.operations.projectManagers[0]?.id, `BF-${crypto.randomUUID().slice(0,8)}`));
    state.operations.importSource = 'MyHammer';
    saveState(); closeModal(); setView('imports');
    showToast('Projektentwurf angelegt', 'Adresse, Termin und vereinbarte Vergütung vor der Übernahme prüfen.', 'success');
  }
  if (action === 'werkraum-export') {
    const blob = new Blob([JSON.stringify({ leads: state.werkraumLeads || [] }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'buelow-flex-anfragen.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

document.addEventListener('input', event => {
  if (event.target.id !== 'werkraumSearch') return;
  werkraumQuery = event.target.value;
  document.getElementById('werkraumResults').innerHTML = werkraumRows();
});
document.addEventListener('change', async event => {
  if (event.target.id === 'werkraumFilter') {
    werkraumFilter = event.target.value;
    document.getElementById('werkraumResults').innerHTML = werkraumRows();
  }
  if (event.target.id !== 'werkraumFile' || !canUseWerkraum()) return;
  const file = event.target.files?.[0]; if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw Error('Maximal 5 MB pro Import.');
    const incoming = WerkraumCore.parseImport(await file.text());
    state.werkraumLeads = WerkraumCore.merge(state.werkraumLeads || [], incoming);
    saveState(); render();
    showToast('Anfragen übernommen', `${incoming.length} Anfragen gespeichert. Bestehende IDs wurden aktualisiert.`, 'success');
  } catch (error) { showToast('Import nicht möglich', error.message, 'warning'); }
});
