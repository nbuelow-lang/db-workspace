// Extracted without behavior changes; see Docs/Modules for ownership.
function renderPartners() {
  setPageMeta('BÜLOW & DOLZ NETWORK', 'Partner-Pipeline');
  if (state.role === 'partner') {
    return `<section class="section" style="margin-top:0">${emptyState('lock','Nur fuer Bülow & Dolz Netzwerkmanagement','Wechseln Sie oben zur Demo-Rolle "Bülow & Dolz Admin", um Partner-Pipeline, Qualifizierung und Kapazitaetsplanung zu sehen.')}<div class="notice info" style="margin-top:15px"><span class="notice-icon">${icon('info')}</span><div><strong>Partner sehen nur ihr eigenes Profil.</strong><p>Unternehmensdaten anderer Bewerber, Preise und Qualitaetswerte bleiben vertraulich.</p></div></div></section>`;
  }
  return `
    <section class="section" style="margin-top:0">
      <div class="section-header"><div><h2>Partner gewinnen und entwickeln</h2><p>Vom Erstkontakt ueber Compliance und Pilotanlagen bis zum Certified-Status.</p></div><button class="button primary small" data-action="invite-partner">${icon('mail',14)} Partner einladen</button></div>
      <div class="grid four">
        ${metricCard('users','37','Unternehmen gesamt','+9 / Monat','blue')}
        ${metricCard('award','18','Certified Partner','108 Montagen','green')}
        ${metricCard('book','31','Teams in Academy','62 Personen','amber')}
        ${metricCard('bar-chart','214','Monatskapazitaet','Ziel 720','green')}
      </div>
      <section class="section"><div class="section-header"><div><h3>Pipeline nach Stufe</h3><p>Operative Arbeitsansicht fuer Partner-Akquise und Onboarding.</p></div></div><div class="kanban">
        ${kanbanColumn('Erstkontakt', partnerPipeline.filter(p => p.status === 'Erstgespraech' || p.status === 'Dokumente'))}
        ${kanbanColumn('Assessment', partnerPipeline.filter(p => p.status === 'Assessment'))}
        ${kanbanColumn('Pilot', partnerPipeline.filter(p => p.status === 'Pilot'))}
        ${kanbanColumn('Certified', partnerPipeline.filter(p => p.status === 'Certified'))}
      </div></section>
      <section class="section"><div class="section-header"><div><h3>Alle Unternehmen</h3><p>Compliance, Kapazitaet und Qualitaet im Vergleich.</p></div></div>${partnerTable(partnerPipeline)}</section>
    </section>
  `;
}

function kanbanColumn(title, items) { return `<div class="kanban-column"><div class="kanban-header"><strong>${title}</strong><span class="kanban-count">${items.length}</span></div>${items.length ? items.map(p => `<article class="kanban-card"><h4>${p.name}</h4><p>${p.country} - ${p.teams} Teams - ${p.capacity} Montagen/Monat</p><div class="meta"><span class="status-pill ${p.compliance === 'Vollstaendig' ? 'green' : p.compliance === 'Fehlt' ? 'red' : 'amber'}">${p.compliance}</span><button class="icon-button" data-action="partner-details" data-partner="${p.name}" style="width:29px;height:29px">${icon('arrow-up-right',14)}</button></div></article>`).join('') : `<div class="empty-state" style="padding:25px 8px"><p>Keine Partner in dieser Stufe.</p></div>`}</div>`; }

function partnerTable(items) { return `<div class="table-wrap"><table><thead><tr><th>Unternehmen</th><th>Status</th><th>Teams</th><th>Kapazitaet / Monat</th><th>Compliance</th><th>Qualitaet</th><th></th></tr></thead><tbody>${items.map(p => `<tr><td><div class="company-cell"><span class="company-logo">${initials(p.name)}</span><div><strong>${p.name}</strong><span>${p.country} - ${p.contact}</span></div></div></td><td><span class="status-pill ${p.status === 'Certified' ? 'green' : p.status === 'Pilot' ? 'blue' : 'amber'}">${p.status}</span></td><td>${p.teams}</td><td><strong>${p.capacity}</strong></td><td><span class="status-pill ${p.compliance === 'Vollstaendig' ? 'green' : p.compliance === 'Fehlt' ? 'red' : 'amber'}">${p.compliance}</span></td><td>${p.quality ? `${p.quality}%` : '-'}</td><td><button class="icon-button" data-action="partner-details" data-partner="${p.name}" style="width:31px;height:31px">${icon('arrow-up-right',14)}</button></td></tr>`).join('')}</tbody></table></div>`; }

function showPartnerDetails(name) {
  const partner = partnerPipeline.find((p) => p.name === name);
  if (!partner) return;
  openModal({
    eyebrow: 'PARTNERPROFIL', title: partner.name,
    body: `<div class="detail-grid"><div class="detail-block"><span>Land</span><strong>${partner.country}</strong></div><div class="detail-block"><span>Status</span><strong>${partner.status}</strong></div><div class="detail-block"><span>Teams</span><strong>${partner.teams}</strong></div><div class="detail-block"><span>Kapazitaet</span><strong>${partner.capacity} / Monat</strong></div><div class="detail-block"><span>Compliance</span><strong>${partner.compliance}</strong></div><div class="detail-block"><span>Qualitaet</span><strong>${partner.quality ? `${partner.quality}%` : 'Noch ohne Wert'}</strong></div></div><div class="section notice info"><span class="notice-icon">${icon('shield')}</span><div><strong>Naechster Prozessschritt</strong><p>${partner.status === 'Certified' ? 'Volumenplanung und regionale Kontingente festlegen.' : partner.status === 'Pilot' ? 'Pilotanlagen auswerten und Freigabeentscheidung vorbereiten.' : 'Dokumente vervollstaendigen und technisches Assessment terminieren.'}</p></div></div>`,
    footer: `<button class="button outline" data-action="close-modal">Schliessen</button><button class="button primary" data-action="partner-next">Naechsten Schritt starten</button>`
  });
}
