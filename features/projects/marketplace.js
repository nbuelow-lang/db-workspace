// Extracted without behavior changes; see Docs/Modules for ownership.
function renderMarketplace() {
  setPageMeta('BÜLOW & DOLZ MARKET', 'Bauvorhaben-Marktplatz');
  const filtered = filterProjects().sort((a, b) => projectAIScore(b) - projectAIScore(a) || a.distance - b.distance);
  const accepted = acceptedProjectIDs();
  const filteredAvailable = filtered.filter(project => !accepted.has(project.id));
  const filteredAccepted = filtered.filter(project => accepted.has(project.id));
  const topProject = filteredAvailable[0];
  return `
    <section class="section" style="margin-top:0">
      <div class="section-header">
        <div><h2>KI-priorisierte Bauvorhaben</h2><p>Der Marktplatz sortiert nach Baustellenreife, Entfernung, Verguetung, Umfang und bekannten Risiken.</p></div>
        <span class="status-pill green">${filteredAvailable.length} verfuegbar</span>
      </div>
      <div class="grid three" style="margin-bottom:15px">
        ${metricCard('briefcase', String(filteredAvailable.length), 'Verfuegbare Bauvorhaben', money(filteredAvailable.reduce((sum, project) => sum + project.price, 0)), 'blue')}
        ${metricCard('check-circle', String(filteredAccepted.length), 'Angenommene Bauvorhaben', money(filteredAccepted.reduce((sum, project) => sum + project.price, 0)), 'green')}
        ${metricCard('gauge', `${averageAIScore(filteredAvailable)}%`, 'Ø KI-Score', topProject ? `${topProject.city} fuehrt` : 'Keine Projekte', 'amber')}
      </div>
      ${topProject ? `<div class="notice info" style="margin-bottom:15px"><span class="notice-icon">${icon('gauge')}</span><div><strong>KI-Empfehlung: ${topProject.city} mit ${projectAIScore(topProject)}% Score.</strong><p>${projectAISummary(topProject)}</p></div></div>` : ''}
      <div class="market-toolbar">
        <div class="search-field"><span class="search-icon">${icon('search')}</span><input id="marketSearch" placeholder="Ort, Projekt-ID oder Stichwort" value="${escapeAttr(state.filters.search)}"></div>
        <select class="filter-select" id="regionFilter"><option value="all">Alle Regionen</option>${[...new Set(projects.map(p => p.region))].map(r => `<option value="${r}" ${state.filters.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
        <select class="filter-select" id="scopeFilter"><option value="all">Alle Pakete</option><option value="Turnkey" ${state.filters.scope === 'Turnkey' ? 'selected' : ''}>Turnkey</option><option value="SHK-Core" ${state.filters.scope === 'SHK-Core' ? 'selected' : ''}>SHK-Core</option></select>
        <button class="button outline small" data-action="reset-filters">${icon('refresh',14)} Zuruecksetzen</button>
      </div>
      ${filtered.length ? `<div class="project-grid">${filtered.map(projectCard).join('')}</div>` : emptyState('search', 'Keine passenden Bauvorhaben', 'Aendern Sie Region oder Suchbegriff. Neue Projekte werden laufend eingestellt.')}
    </section>
  `;
}

function filterProjects() {
  const search = (state.filters.search || '').toLowerCase();
  return projects.filter((project) => {
    const matchesSearch = !search || [project.id, project.city, project.region, project.title, ...project.tags].join(' ').toLowerCase().includes(search);
    const matchesRegion = state.filters.region === 'all' || project.region === state.filters.region;
    const matchesScope = state.filters.scope === 'all' || project.scope === state.filters.scope;
    return matchesSearch && matchesRegion && matchesScope;
  });
}

function projectCard(project) {
  const bid = state.bids.find((item) => item.projectId === project.id);
  const accepted = activeProjects.some(item => item.id === project.id);
  const aiTone = projectAITone(project);
  return `<article class="project-card">
    <div class="project-visual">
      <div class="top"><span class="project-code">${project.id}</span><span class="status-pill ${accepted || project.standard ? 'green' : 'amber'}">${accepted ? 'Angenommen' : project.complexity}</span></div>
      <h3>${escapeAttr(project.title)}</h3>
      <span class="project-location">${icon('map-pin',14)} ${escapeAttr(project.postal)} ${escapeAttr(project.city)}</span>
    </div>
    <div class="project-card-body">
      <div class="project-price-row"><div class="project-price"><strong>${money(project.price)}</strong><span>netto Projektverguetung</span></div><div class="readiness"><strong>${project.readiness}%</strong><span>Baustellenreife</span></div></div>
      <div class="project-finance"><div><strong>${money(project.material)}</strong><span>Materialannahme</span></div><div><strong>${money(project.travel)}</strong><span>Fahrtansatz</span></div><div><strong>${money(projectNet(project))}</strong><span>Rest vor Lohn/Overhead</span></div></div>
      <div class="project-ai">
        <div class="project-ai-head"><span class="project-ai-title">${icon('gauge',14)} ${projectAITitle(project)}</span><span class="ai-score-pill ${aiTone}">KI ${projectAIScore(project)}%</span></div>
        <p>${projectAISummary(project)}</p>
        <div class="ai-factors">${projectAIFactors(project).slice(0,3).map(factor => `<span class="tag">${escapeAttr(factor)}</span>`).join('')}</div>
      </div>
      <div class="project-meta"><span class="tag">${icon('calendar',11)} Start ${escapeAttr(project.start)}</span><span class="tag">${icon('clock',11)} ${project.duration}</span><span class="tag">${project.scope}</span></div>
      <div class="project-footer"><button class="button outline small" data-action="project-details" data-project="${project.id}">Details</button>${accepted ? `<button class="button secondary small" data-action="goto" data-target="projects">Angenommen</button>` : `<button class="button ${bid ? 'secondary' : 'primary'} small" data-action="bid" data-project="${project.id}">${bid ? 'Angebot gesendet' : 'Bieten'}</button>`}</div>
    </div>
  </article>`;
}
