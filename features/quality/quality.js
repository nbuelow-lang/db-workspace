// Extracted without behavior changes; see Docs/Modules for ownership.
function renderQualityDashboard({preview=false} = {}) {
  if (!preview) setPageMeta('BÜLOW & DOLZ QUALITY', 'Bauleitung / QM');
  return `
    <section class="hero">
      <div class="hero-grid">
        <div>
          <span class="eyebrow" style="color:#ffffff">SHK + ELEKTRO QUALITAET</span>
          <h2>Abnehmen, freigeben, lernen.<br>Einheitlich in jedem Projekt.</h2>
          <p>Die Ansicht für Bauleitung und Qualitätsmanagement bündelt Foto-Gates, Messprotokolle, technische Abweichungen und dokumentierte Abnahmen.</p>
          <div class="hero-actions"><button class="button white" data-action="goto" data-target="acceptance">${icon('clipboard-check',16)} Abnahmequeue</button><button class="button ghost-white" data-action="goto" data-target="projects">${icon('layers',16)} Aktive Projekte</button></div>
        </div>
        <div class="hero-status">
          <div class="hero-status-card"><div class="row"><strong>Abnahme-SLA diese Woche</strong><span>91% &lt; 48 h</span></div><div class="progress"><span style="width:91%"></span></div></div>
          <div class="hero-mini-grid"><div class="hero-mini"><strong>12</strong><span>offene Pruefungen</span></div><div class="hero-mini"><strong>3</strong><span>vor Ort heute</span></div><div class="hero-mini"><strong>7</strong><span>digital pruefbar</span></div><div class="hero-mini"><strong>2</strong><span>Eskalationen</span></div></div>
        </div>
      </div>
    </section>
    <section class="section grid four">
      ${metricCard('clipboard-check', '12', 'Offene Abnahmen', '5 heute', 'blue')}
      ${metricCard('camera', '38', 'Foto-Gates zu pruefen', '7 kritisch', 'amber')}
      ${metricCard('check-circle', '93%', 'Erstabnahmequote', '+2 Pkt.', 'green')}
      ${metricCard('alert', '2', 'Sicherheitskritisch', 'Sofort', 'red')}
    </section>
    <section class="section">
      <div class="section-header"><div><h2>Naechste Abnahmen</h2><p>Gemeinsame SHK-/Elektro-Freigabe mit dokumentierter Entscheidung.</p></div><button class="button secondary small" data-action="goto" data-target="acceptance">Alle Abnahmen</button></div>
      <div class="grid" style="gap:12px">${ServerAcceptance.enabled ? ServerAcceptance.cards(2) : acceptanceQueue.slice(0, 2).map(acceptanceCard).join('')}</div>
    </section>
  `;
}

function renderAcceptance() {
  if (ServerAcceptance.enabled) return ServerAcceptance.renderView();
  setPageMeta('BÜLOW & DOLZ QUALITY', state.role === 'partner' ? 'Abnahmen & Freigaben' : 'Abnahmequeue');
  return `
    <section class="section" style="margin-top:0">
      <div class="section-header"><div><h2>${state.role === 'partner' ? 'Ihre geplanten Abnahmen' : 'Technische Abnahmequeue'}</h2><p>Separate SHK- und Elektroentscheidung mit gemeinsamen Projektstatus.</p></div><span class="status-pill blue">${acceptanceQueue.length} offen</span></div>
      <div class="notice warning" style="margin-bottom:15px"><span class="notice-icon">${icon('shield')}</span><div><strong>QM-Abnahme = dokumentierte technische Freigabe im Bülow & Dolz Prozess.</strong><p>Die App bildet Prüfung, Nachweise und Freigabe ab. Die rechtliche Zulassung des ausführenden Unternehmens wird im Onboarding separat geprüft und nicht durch eine nachträgliche Freigabe ersetzt.</p></div></div>
      <div class="grid" style="gap:13px">${acceptanceQueue.map(acceptanceCard).join('')}</div>
    </section>
  `;
}

function acceptanceCard(item) {
  const done = item.checks.filter(([, ok]) => ok).length;
  return `<article class="card acceptance-card"><div class="acceptance-main"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div><span class="eyebrow">${item.id}</span><h3>${item.city} - ${item.partner}</h3><p>${icon('calendar',12)} ${item.slot}</p></div><span class="status-pill ${done === item.checks.length ? 'green' : done >= 4 ? 'amber' : 'red'}">${item.status}</span></div><div class="acceptance-checks">${item.checks.map(([text, ok]) => `<div class="check-item ${ok ? 'ok' : ''}"><span class="check-state">${icon(ok ? 'check' : 'clock',13)}</span><span>${text}</span></div>`).join('')}</div></div><aside class="acceptance-side"><div class="masters"><div class="master-badge"><span class="mini-avatar">SHK</span><div><strong>${item.masterShk}</strong><span>SHK Qualität</span></div></div><div class="master-badge"><span class="mini-avatar">EL</span><div><strong>${item.masterEl}</strong><span>Elektro Qualität</span></div></div></div><div class="progress" style="background:var(--surface-3);margin:0"><span style="width:${Math.round(done/item.checks.length*100)}%;background:var(--green)"></span></div><button class="button ${state.role === 'partner' ? 'outline' : 'primary'} small full" data-action="acceptance-details" data-acceptance="${item.id}">${state.role === 'partner' ? 'Status ansehen' : 'Prüfung öffnen'}</button></aside></article>`;
}

function showAcceptanceDetails(id) {
  if (ServerAcceptance.enabled) { ServerAcceptance.open(id); return; }
  const item = acceptanceQueue.find((row) => row.id === id);
  if (!item) return;
  const done = item.checks.filter(([, ok]) => ok).length;
  openModal({
    eyebrow: item.id,
    title: `Abnahme ${item.city}`,
    body: `
      <div class="detail-grid"><div class="detail-block"><span>Partner</span><strong>${item.partner}</strong></div><div class="detail-block"><span>Termin</span><strong>${item.slot}</strong></div><div class="detail-block"><span>SHK Freigabe</span><strong>${item.masterShk}</strong></div><div class="detail-block"><span>Elektro Freigabe</span><strong>${item.masterEl}</strong></div></div>
      <div class="section"><div class="section-header"><div><h3>Pruefstatus ${done}/${item.checks.length}</h3></div></div><div class="scope-list">${item.checks.map(([text, ok]) => `<div class="scope-item"><span class="bullet-icon" style="background:${ok ? 'var(--green-soft)' : 'var(--amber-soft)'};color:${ok ? 'var(--green)' : 'var(--amber)'}">${icon(ok ? 'check' : 'clock',12)}</span><span>${text}</span></div>`).join('')}</div></div>
      <div class="field section"><label>Pruefnotiz</label><textarea placeholder="Sachliche Feststellung, Quelle im Projektstandard und erforderlicher Sollzustand"></textarea></div>
      <div class="notice info section"><span class="notice-icon">${icon('signature')}</span><div><strong>Zwei Freigaben, ein Projektstatus</strong><p>SHK und Elektro werden fachlich separat entschieden. Erst wenn beide erforderlichen Bereiche freigegeben sind, wird das Projekt zur Uebergabe freigeschaltet.</p></div></div>
    `,
    footer: state.role === 'partner' ? `<button class="button primary" data-action="close-modal">Verstanden</button>` : `<button class="button danger" data-action="raise-defect" data-acceptance="${item.id}">Mangel anlegen</button><button class="button success" data-action="approve-acceptance" data-acceptance="${item.id}">${icon('check',15)} Bereich freigeben</button>`
  });
}
