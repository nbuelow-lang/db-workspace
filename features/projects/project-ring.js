// Projekte (server mode): interactive phase ring over the real job files (Backend/orders.py).
// Each order sits as an initials dot in the segment of its current step; tapping a segment filters,
// tapping a dot shows the order. Customer mood is an internal team assessment with history.
const ProjectRing = (() => {
  const t = (text, vars) => I18n.t(text, vars);
  const esc = value => escapeAttr(value);
  const SHORT = {aufnahme:'Aufnahme', leistungsbilanz:'Bilanz', netzbetreiber:'Netz', angebot:'Angebot', montage:'Montage', pruefung:'Prüfung', abnahme:'Abnahme'};
  const FACE = {zufrieden:'face-happy', neutral:'face-neutral', angespannt:'face-sad'};
  const C = 200, R_OUT = 176, R_IN = 112, BOX = 500, PAD = 50;
  let phaseFilter = '', moodFilter = 'all', selected = '', saving = false;

  const done = status => ['erledigt','entfaellt'].includes(status);
  function phaseOf(order, steps) { return steps.find(step => !done(order.steps[step.id]?.status))?.id || 'fertig'; }
  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  const moodKey = order => order.mood?.value || 'none';
  function moodChip(mood) {
    const key = mood?.value;
    return `<span class="pr-mood-chip mood-${key || 'none'}">${icon(FACE[key] || 'face-neutral', 14)} ${esc(t(key ? ServerOrders.snapshot().schema?.moods?.[key] || key : 'Stimmung offen'))}</span>`;
  }
  const point = (angle, radius) => [C + radius * Math.cos(angle), C + radius * Math.sin(angle)];
  const pct = value => `${((value + PAD) / BOX * 100).toFixed(3)}%`;

  function segmentPath(start, end) {
    const [x1, y1] = point(start, R_OUT), [x2, y2] = point(end, R_OUT), [x3, y3] = point(end, R_IN), [x4, y4] = point(start, R_IN);
    const large = end - start > Math.PI ? 1 : 0;
    return `M${x1} ${y1}A${R_OUT} ${R_OUT} 0 ${large} 1 ${x2} ${y2}L${x3} ${y3}A${R_IN} ${R_IN} 0 ${large} 0 ${x4} ${y4}Z`;
  }

  // Dots on the band: two rows, as many as fit along the arc; the rest is shown as "+n".
  function dotPositions(count, start, end) {
    const rows = [R_OUT - 20, R_IN + 20], spots = [];
    for (const radius of rows) {
      const fit = Math.max(1, Math.floor(((end - start) * radius) / 38));
      for (let i = 0; i < fit; i++) spots.push([start + (end - start) * (i + .5) / fit, radius]);
    }
    return spots.slice(0, count);
  }

  function ringMarkup(list, steps) {
    const gap = .035, span = (Math.PI * 2) / steps.length;
    let svg = '', dots = '', labels = '';
    steps.forEach((step, index) => {
      const start = -Math.PI / 2 + index * span + gap / 2, end = start + span - gap, mid = (start + end) / 2;
      const inPhase = list.filter(order => phaseOf(order, steps) === step.id);
      const blocked = inPhase.some(order => order.steps[step.id]?.status === 'blockiert');
      const name = t(SHORT[step.id] || step.label);
      svg += `<path class="pr-seg ${phaseFilter === step.id ? 'is-active' : ''} ${inPhase.length ? 'has-orders' : ''} ${blocked ? 'is-blocked' : ''}" d="${segmentPath(start, end)}" data-phase="${step.id}" role="button" tabindex="0" aria-pressed="${phaseFilter === step.id}" aria-label="${esc(t('{phase}: {n} Aufträge', {phase:t(step.label), n:inPhase.length}))}"></path>`;
      const [lx, ly] = point(mid, R_OUT + 32);
      labels += `<span class="pr-label ${phaseFilter === step.id ? 'is-active' : ''}" style="left:${pct(lx)};top:${pct(ly)}">${esc(name)}<b>${inPhase.length}</b></span>`;
      const spots = dotPositions(inPhase.length, start + .04, end - .04);
      inPhase.slice(0, spots.length).forEach((order, i) => {
        const [x, y] = point(spots[i][0], spots[i][1]);
        const key = moodKey(order);
        dots += `<button type="button" class="pr-dot mood-${key} ${selected === order.id ? 'is-selected' : ''}" style="left:${pct(x)};top:${pct(y)}" data-action="pr-select" data-order="${esc(order.id)}" aria-label="${esc(`${order.customer?.name || ''} · ${order.title} · ${t(step.label)}`)}" aria-pressed="${selected === order.id}">${esc(initials(order.customer?.name))}${key !== 'none' ? `<i>${icon(FACE[key], 11)}</i>` : ''}</button>`;
      });
      if (inPhase.length > spots.length) {
        const [x, y] = point(mid, (R_OUT + R_IN) / 2);
        dots += `<button type="button" class="pr-more" style="left:${pct(x)};top:${pct(y)}" data-action="pr-phase" data-phase="${step.id}">+${inPhase.length - spots.length}</button>`;
      }
    });
    const finished = list.filter(order => phaseOf(order, steps) === 'fertig').length, active = list.length - finished;
    return `<div class="pr-ring">
      <svg viewBox="${-PAD} ${-PAD} ${BOX} ${BOX}" aria-hidden="false" role="group" aria-label="${esc(t('Phasen-Ring'))}">${svg}</svg>
      ${labels}${dots}
      <div class="pr-center"><strong>${active}</strong><span>${t('in Arbeit')}</span>${finished ? `<small>${t('{n} abgeschlossen', {n:finished})}</small>` : ''}</div>
    </div>`;
  }

  function cardMarkup(order, steps, schema) {
    const phase = phaseOf(order, steps), step = steps.find(item => item.id === phase), entry = step ? order.steps[step.id] : null;
    const person = username => schema.people.find(p => p.username === username)?.name || '';
    return `<article class="pr-card">
      <div class="pr-card-head"><span class="pr-avatar mood-${moodKey(order)}">${esc(initials(order.customer?.name))}</span>
        <div><span class="eyebrow">${esc(order.id)}</span><h3>${esc(order.title)}</h3><p>${esc(order.customer?.name || '')} · ${esc(order.address?.city || '')}</p></div>
        <button type="button" class="so-icon-button" data-action="pr-select" data-order="" aria-label="${esc(t('Auswahl aufheben'))}">${icon('x',16)}</button></div>
      <dl class="so-dl">
        <div class="so-dl-row"><dt>${t('Phase')}</dt><dd>${esc(step ? t(step.label) : t('Alle Schritte erledigt'))}</dd></div>
        ${entry?.assignee ? `<div class="so-dl-row"><dt>${t('Zuständig')}</dt><dd>${esc(person(entry.assignee))}</dd></div>` : ''}
        ${entry?.due ? `<div class="so-dl-row"><dt>${t('Fällig am')}</dt><dd>${esc(new Date(entry.due + 'T12:00:00').toLocaleDateString(I18n.locale()))}</dd></div>` : ''}
        <div class="so-dl-row"><dt>${t('Kundenstimmung')}</dt><dd>${moodChip(order.mood)}</dd></div>
        ${order.mood?.note ? `<div class="so-dl-row"><dt>${t('Notiz')}</dt><dd>${esc(order.mood.note)}</dd></div>` : ''}
      </dl>
      <div class="pr-card-actions"><button class="button primary small" data-action="pr-open" data-order="${esc(order.id)}">${t('Auftrag öffnen')} ${icon('arrow-right',14)}</button>
        <button class="button outline small" data-action="pr-mood" data-order="${esc(order.id)}">${icon(FACE[order.mood?.value] || 'face-neutral',14)} ${t('Stimmung')}</button></div>
    </article>`;
  }

  function rowMarkup(order, steps) {
    const phase = phaseOf(order, steps), step = steps.find(item => item.id === phase);
    const total = steps.length, finished = steps.filter(item => done(order.steps[item.id]?.status)).length;
    return `<button type="button" class="pr-row ${selected === order.id ? 'is-selected' : ''}" data-action="pr-select" data-order="${esc(order.id)}">
      <span class="pr-avatar mood-${moodKey(order)}">${esc(initials(order.customer?.name))}</span>
      <span class="pr-row-copy"><strong>${esc(order.customer?.name || '')}</strong><small>${esc(order.title)} · ${esc(order.address?.city || '')}</small></span>
      <span class="pr-row-meta"><span class="pr-phase">${esc(step ? t(SHORT[step.id] || step.label) : t('Fertig'))}</span><span class="pr-steps">${finished}/${total}</span>${order.mood?.value ? `<span class="pr-face mood-${order.mood.value}" title="${esc(t(order.mood.value === 'zufrieden' ? 'Zufrieden' : order.mood.value === 'neutral' ? 'Neutral' : 'Angespannt'))}">${icon(FACE[order.mood.value],18)}</span>` : ''}</span>
    </button>`;
  }

  function render() {
    setPageMeta('BÜLOW & DOLZ', t('Projekte'));
    const {orders, schema, phase, loadError} = ServerOrders.snapshot();
    const head = `<div class="section-header"><div><h2>${t('Projekte')}</h2><p>${t('Alle Aufträge im Phasen-Ring. Segment antippen filtert, Kreis antippen zeigt den Auftrag.')}</p></div></div>`;
    if (phase !== 'ready' || !schema) return `<section class="section pr-view" style="margin-top:0">${head}<div class="card so-placeholder" ${loadError ? 'role="alert"' : 'role="status"'}>${esc(loadError || t('Aufträge werden vom Server geladen …'))}</div></section>`;
    const steps = schema.steps;
    if (selected && !orders.some(order => order.id === selected)) selected = '';
    const moods = [['all','Alle'], ['zufrieden','Zufrieden'], ['neutral','Neutral'], ['angespannt','Angespannt'], ['none','Ohne Angabe']];
    const visible = orders.filter(order => (!phaseFilter || phaseOf(order, steps) === phaseFilter) && (moodFilter === 'all' || moodKey(order) === moodFilter));
    const chosen = orders.find(order => order.id === selected);
    const phaseName = phaseFilter ? t(steps.find(step => step.id === phaseFilter)?.label || '') : '';
    return `<section class="section pr-view" style="margin-top:0">${head}
      ${orders.length ? `<div class="pr-layout">
        <div class="pr-ring-wrap">${ringMarkup(orders, steps)}</div>
        <div class="pr-side">
          ${chosen ? cardMarkup(chosen, steps, schema) : `<p class="so-hint pr-tip">${t('Tipp: Ein Kreis zeigt Kundin oder Kunde mit Initialen; die Farbe ist die Stimmung, die euer Team einträgt.')}</p>`}
          <div class="pr-filters" role="group" aria-label="${esc(t('Kundenstimmung'))}">${moods.map(([key, label]) => `<button type="button" class="${moodFilter === key ? 'active' : ''}" data-action="pr-mood-filter" data-mood="${key}" aria-pressed="${moodFilter === key}">${key !== 'all' && key !== 'none' ? icon(FACE[key], 14) : ''}${t(label)}</button>`).join('')}</div>
          <div class="pr-list-head"><strong>${phaseFilter ? esc(phaseName) : t('Alle Phasen')}</strong><span>${t('{n} Aufträge', {n:visible.length})}</span>${phaseFilter ? `<button type="button" class="text-button" data-action="pr-phase" data-phase="">${t('Filter aufheben')}</button>` : ''}</div>
          <div class="pr-list">${visible.map(order => rowMarkup(order, steps)).join('') || `<p class="workspace-empty">${t('Keine Aufträge für diesen Filter.')}</p>`}</div>
        </div></div>` : emptyState('layers', t('Noch kein Auftrag'), t('Sobald Aufträge angelegt sind, erscheinen sie hier im Phasen-Ring.'))}
      <p class="assist-note">${icon('info',14)} ${t('Die Stimmung ist eine interne Einschätzung eures Teams und für Kunden nicht sichtbar.')}</p>
    </section>`;
  }

  function showMood(id) {
    const order = ServerOrders.snapshot().orders.find(item => item.id === id);
    if (!order) return;
    const current = order.mood?.value || '';
    openModal({
      eyebrow: `${order.id} · ${t('KUNDENSTIMMUNG')}`, title: order.customer?.name || order.title,
      body: `<fieldset class="pr-mood-choice"><legend>${t('Wie ist die Stimmung beim Kunden?')}</legend>${['zufrieden','neutral','angespannt'].map(key => `<label class="mood-${key}"><input type="radio" name="prMood" value="${key}" ${current === key ? 'checked' : ''}>${icon(FACE[key], 34)}<span>${t(key === 'zufrieden' ? 'Zufrieden' : key === 'neutral' ? 'Neutral' : 'Angespannt')}</span></label>`).join('')}</fieldset>
        <div class="field"><label for="prMoodNote">${t('Notiz')} <span>(${t('Pflicht bei „Angespannt“')})</span></label><textarea id="prMoodNote" rows="3" maxlength="500">${esc(order.mood?.note || '')}</textarea></div>
        ${order.mood?.name ? `<p class="so-hint">${t('Zuletzt gesetzt von {name} · {time}', {name:esc(order.mood.name), time:new Date(order.mood.at).toLocaleString(I18n.locale())})}</p>` : ''}
        <p class="so-hint">${t('Interne Einschätzung, für Kunden nicht sichtbar. Jede Änderung steht im Verlauf des Auftrags.')}</p>
        <p class="sa-feedback" id="prMoodFeedback" role="alert" hidden></p>`,
      footer: `<button class="button outline" data-action="close-modal">${t('Abbrechen')}</button><button class="button primary" data-action="pr-save-mood" data-order="${esc(order.id)}" data-version="${order.moodVersion || 0}">${icon('check',15)} ${t('Speichern')}</button>`
    });
  }

  function feedback(text, tone = 'error') {
    const node = document.getElementById('prMoodFeedback');
    if (node) { node.hidden = !text; node.textContent = text; node.dataset.tone = tone; }
  }

  async function saveMood(target) {
    if (saving) return;
    const mood = document.querySelector('[name=prMood]:checked')?.value, note = document.getElementById('prMoodNote').value;
    if (!mood) { feedback(t('Bitte eine Stimmung wählen.')); return; }
    if (mood === 'angespannt' && note.trim().length < 3) { feedback(t('Bitte eine Begründung eintragen.')); document.getElementById('prMoodNote').focus(); return; }
    saving = true; target.disabled = true; feedback(t('Wird gespeichert …'), 'info');
    try {
      await ServerOrders.saveMood(target.dataset.order, Number(target.dataset.version), mood, note);
      closeModal(); window.render();
      showToast(t('Stimmung gespeichert'), esc(t(mood === 'zufrieden' ? 'Zufrieden' : mood === 'neutral' ? 'Neutral' : 'Angespannt')), 'success');
    } catch (error) {
      const fresh = ServerOrders.snapshot().orders.find(item => item.id === target.dataset.order);
      if (error.order && fresh) target.dataset.version = fresh.moodVersion || 0;
      feedback(error.order ? `${error.message} ${t('Aktueller Stand wurde geladen; erneut speichern übernimmt deine Eingaben.')}` : error.message);
    } finally { saving = false; target.disabled = false; }
  }

  function action(name, target) {
    if (name === 'pr-select') { selected = selected === target.dataset.order ? '' : target.dataset.order || ''; window.render(); document.querySelector(selected ? `.pr-dot[data-order="${CSS.escape(selected)}"]` : '.pr-ring')?.focus?.({preventScroll:true}); }
    else if (name === 'pr-phase') { phaseFilter = target.dataset.phase === phaseFilter ? '' : target.dataset.phase || ''; window.render(); }
    else if (name === 'pr-mood-filter') { moodFilter = target.dataset.mood; window.render(); }
    else if (name === 'pr-open') ServerOrders.open(target.dataset.order);
    else if (name === 'pr-mood') showMood(target.dataset.order);
    else if (name === 'pr-save-mood') saveMood(target);
  }

  // Segments are SVG paths: Enter/Space and clicks map to the phase filter.
  function start() {
    document.addEventListener('click', event => {
      const seg = event.target.closest?.('.pr-seg');
      if (seg) action('pr-phase', seg);
    });
    document.addEventListener('keydown', event => {
      const seg = event.target.closest?.('.pr-seg');
      if (seg && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); action('pr-phase', seg); document.querySelector(`.pr-seg[data-phase="${seg.dataset.phase}"]`)?.focus(); }
    });
  }

  return {render, action, start, moodChip, phaseOf};
})();
