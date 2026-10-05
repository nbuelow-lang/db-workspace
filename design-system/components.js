// Extracted without behavior changes; see Docs/Modules for ownership.
function metricCard(iconName, value, label, trend, tone) {
  return `<article class="card metric-card"><span class="metric-icon ${tone}">${icon(iconName)}</span><div class="metric-copy"><strong>${value}</strong><span>${label}</span></div><span class="metric-trend">${trend}</span></article>`;
}

function miniFunnel(label, value, percent) { return `<div class="detail-block"><span>${label}</span><strong>${value}</strong><span style="margin-top:4px;color:var(--blue-2)">${percent}</span></div>`; }

function timelineItem(iconName, title, text, time, status) { return `<div class="timeline-item ${status}"><span class="timeline-dot">${icon(iconName,16)}</span><div class="timeline-copy"><strong>${title}</strong><span>${text}</span></div><time>${time}</time></div>`; }

function activityItem(iconName, title, text, time) { return `<div class="activity-item"><span class="activity-icon">${icon(iconName,18)}</span><div class="activity-copy"><strong>${title}</strong><span>${text}</span></div><time>${time}</time></div>`; }

function formHeader(number, title, text) { return `<div class="form-header"><div><span class="eyebrow">STUFE ${number}</span><h2>${title}</h2><p>${text}</p></div><span class="status-pill ${state.onboarding.completed.includes(Number(number)) ? 'green' : 'blue'}">${state.onboarding.completed.includes(Number(number)) ? 'Erledigt' : 'In Bearbeitung'}</span></div>`; }

function field(label, model, value = '', type = 'text', required = false) { return `<div class="field"><label>${label}${required ? ' *' : ''}</label><input type="${type}" value="${escapeAttr(value)}" data-model="${model}" ${required ? 'required' : ''}></div>`; }

function selectField(label, model, options, selected) { return `<div class="field"><label>${label}</label><select data-model="${model}">${options.map(([value, text]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${text}</option>`).join('')}</select></div>`; }

function uploadTile(title, subtitle, ok) { return `<button class="upload-tile" data-action="mock-upload"><span class="upload-icon">${icon(ok ? 'file-check' : 'upload',18)}</span><span class="upload-copy"><strong>${title}</strong><span>${subtitle}</span></span><span class="upload-state ${ok ? 'ok' : ''}">${ok ? 'Geprueft' : 'Hochladen'}</span></button>`; }

function teamCard(title, members, tags, capacity) { return `<article class="team-card"><div class="team-card-header"><div><h4>${title}</h4><span class="card-subtitle">${capacity}</span></div><span class="status-pill green">Aktiv</span></div><div class="team-members">${members.map(m => `<span class="mini-avatar">${m}</span>`).join('')}</div><div class="team-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div></article>`; }

function trainingCard(title, text, progress, status) { return `<article class="training-card"><div class="training-cover"><strong>${title}</strong></div><div class="training-body"><p>${text}</p><div class="training-footer"><div class="training-progress"><span style="width:${progress}%"></span></div><strong>${progress}%</strong></div><button class="button ${progress === 0 ? 'outline' : 'secondary'} small full" style="margin-top:11px" data-action="training">${progress === 100 ? 'Ergebnis ansehen' : progress === 0 ? 'Voraussetzung offen' : 'Fortsetzen'}</button></div></article>`; }

function pilotCard(title, city, status, progress, tone) { return `<article class="card pad" style="box-shadow:none"><div style="display:flex;justify-content:space-between;gap:10px"><div><span class="eyebrow">${title}</span><h3 class="card-title" style="margin-top:5px">${city}</h3></div><span class="status-pill ${tone}">${status}</span></div><div class="progress" style="background:var(--surface-3);margin-top:16px"><span style="width:${progress}%;background:${tone === 'green' ? 'var(--green)' : tone === 'amber' ? 'var(--amber)' : 'var(--blue-2)'}"></span></div><p class="card-subtitle" style="margin-top:9px">${progress}% Pruefpfad abgeschlossen</p></article>`; }

function criteria(text, ok) { return `<div class="check-item ${ok ? 'ok' : ''}"><span class="check-state">${icon(ok ? 'check' : 'clock',13)}</span><span>${text}</span></div>`; }

function emptyState(iconName, title, text) { return `<div class="card empty-state"><span class="empty-icon">${icon(iconName,28)}</span><h3>${title}</h3><p>${text}</p></div>`; }

function openModal({ eyebrow = 'BÜLOW & DOLZ', title = 'Details', body = '', footer = '' }) {
  document.getElementById('modalBackdrop').classList.remove('is-nc');
  document.getElementById('modalEyebrow').textContent = eyebrow;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalFooter').innerHTML = footer;
  document.getElementById('modalBackdrop').hidden = false;
  hydrateIcons(document.getElementById('modal'));
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const wasNotificationCenter = Boolean(document.querySelector('.nc-center, .nc-detail'));
  stopRealtimeTranslation();
  document.getElementById('modalBackdrop').hidden = true;
  document.getElementById('modalBackdrop').classList.remove('is-nc', 'nc-enter');
  document.body.style.overflow = '';
  currentModalProject = null;
  if (wasNotificationCenter) document.getElementById('notificationButton')?.focus({preventScroll:true});
}

function showToast(title, text, tone = '') {
  const region = document.getElementById('toastRegion');
  const toast = document.createElement('div');
  toast.className = `toast ${tone}`;
  toast.innerHTML = `<span class="toast-icon">${icon(tone === 'warning' ? 'alert' : 'check',15)}</span><div><strong>${title}</strong><span>${text}</span></div><button aria-label="Schliessen">${icon('x',14)}</button>`;
  toast.querySelector('button').addEventListener('click', () => toast.remove());
  region.appendChild(toast);
  setTimeout(() => toast.remove(), 4800);
}
