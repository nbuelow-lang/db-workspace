// Initial verification protocol (Erstprüfung) of a job file: form, read-only view, guide values and print layout.
// Backend/orders.py validates, stores and closes the protocol; ServerOrders handles saving and permissions.
// Guide values come from the server schema and are a marked draft, never an automatic pass/fail.
const OrderInspection = (() => {
  const t = (text, vars) => I18n.t(text, vars);
  const esc = value => escapeAttr(value);
  const RATING = {io:'i. O.', nio:'n. i. O.', entfaellt:'entfällt'};
  const RCD_FIELDS = ['rcdMa', 'tripMs', 'tripMa', 'touchV'];

  // ---------- Pure helpers (also used by Tools/inspection.test.cjs) ----------
  const hasRcd = circuit => Boolean(circuit.rcdType) && circuit.rcdType !== 'keine';
  function zsMax(circuit, limits) {
    const factor = limits.zsFactor[circuit.device];
    return factor && circuit.ratedA ? limits.u0 / (factor * circuit.ratedA) : null;
  }
  const shortCircuit = (circuit, limits) => circuit.zs ? limits.u0 / circuit.zs : null;
  // Mirrors inspection_deviations in Backend/orders.py.
  function deviations(circuit, limits) {
    const found = [], max = zsMax(circuit, limits);
    if (circuit.riso != null && circuit.riso < limits.rIsoMin) found.push('riso');
    if (max != null && circuit.zs != null && circuit.zs > max) found.push('zs');
    if (hasRcd(circuit)) {
      if (circuit.tripMs != null && circuit.tripMs > limits.tripMsMax) found.push('tripMs');
      if (circuit.tripMa != null && circuit.rcdMa && circuit.tripMa > circuit.rcdMa) found.push('tripMa');
      if (circuit.touchV != null && circuit.touchV > limits.touchVMax) found.push('touchV');
    }
    return found;
  }
  function hasDefects(inspection) {
    const ratings = [...Object.values(inspection.visual || {}), ...Object.values(inspection.function || {})];
    return ratings.includes('nio') || (inspection.circuits || []).some(circuit => circuit.result === 'nio');
  }
  function parseNumber(text) {
    const cleaned = String(text ?? '').trim().replace(/\s/g, '').replace(',', '.');
    if (!cleaned) return null;
    return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN;
  }
  const newID = () => Math.random().toString(36).slice(2, 10) || 'k' + Date.now().toString(36);
  const format = (value, digits = 2, locale = 'de-DE') => value == null ? '' : value.toLocaleString(locale, {maximumFractionDigits:digits});

  function defaults(order, username, people) {
    const survey = order.survey || {};
    return {reason:'', testedAt:new Date().toISOString().slice(0, 10), tester:people.some(p => p.username === username) ? username : '',
      instrument:'', instrumentSerial:'', calibratedUntil:null, network:['TN-C','TN-C-S','TN-S','TT'].includes(survey.netzform) ? survey.netzform : '',
      voltage:'230/400 V', visual:{}, function:{}, note:'',
      circuits:[{id:newID(), name:survey.heizstab_kw ? `Heizstab ${String(survey.heizstab_kw).replace('.', ',')} kW` : '', cable:'', device:'', rcdType:''}]};
  }

  // ---------- Text for deviations and missing entries ----------
  function deviationText(key, circuit, cfg) {
    const l = cfg.limits, num = value => format(value, 2, I18n.locale());
    if (key === 'riso') return t('RISO unter {min} MΩ', {min:num(l.rIsoMin)});
    if (key === 'zs') return t('ZS über {max} Ω (Orientierung für {device} {a} A)', {max:num(zsMax(circuit, l)), device:circuit.device, a:num(circuit.ratedA)});
    if (key === 'tripMs') return t('tA über {max} ms', {max:l.tripMsMax});
    if (key === 'tripMa') return t('IΔ über IΔn');
    return t('UB über {max} V', {max:l.touchVMax});
  }
  function missingText(list, limit = 6) {
    const parts = list.slice(0, limit).map(item => item.circuit ? t('Stromkreis {n}: {field}', {n:item.circuit, field:t(item.field)}) : item.count ? `${t(item.field)} (${item.count})` : t(item.field));
    return parts.join(', ') + (list.length > limit ? ` … (+${list.length - limit})` : '');
  }

  // ---------- Form ----------
  function ratingMarkup(group, item, value, options = ['io', 'nio', 'entfaellt']) {
    const name = `si-${group}-${item.id}`;
    return `<fieldset class="si-rating" data-si-rating="${group}" data-item="${esc(item.id)}"><legend>${esc(t(item.label))}</legend><div class="si-seg">${options.map(option =>
      `<label class="si-${option}"><input type="radio" name="${name}" value="${option}" ${value === option ? 'checked' : ''}><span>${t(RATING[option])}</span></label>`).join('')}</div></fieldset>`;
  }

  function measureField(key, circuit, cfg) {
    const measure = cfg.measures[key], value = circuit[key];
    return `<div class="field si-m-${key}"><label>${esc(t(measure.label))} <span>(${esc(measure.unit)})</span><input data-k="${key}" inputmode="decimal" autocomplete="off" value="${value == null ? '' : esc(String(value).replace('.', ','))}"></label></div>`;
  }

  function calcMarkup(circuit, cfg) {
    const ik = shortCircuit(circuit, cfg.limits), max = zsMax(circuit, cfg.limits), num = (v, d) => format(v, d, I18n.locale());
    const parts = [ik ? t('Ik ≈ {a} A', {a:num(ik, 0)}) : '', max ? t('ZS max ≈ {max} Ω (Orientierung)', {max:num(max, 2)}) : ''].filter(Boolean);
    return parts.join(' · ');
  }

  function deviationMarkup(circuit, cfg) {
    const list = deviations(circuit, cfg.limits);
    if (!list.length) return '';
    return `<div class="si-dev" role="note">${icon('alert', 14)}<div><strong>${t('Abweichung vom Orientierungswert')}</strong><p>${list.map(key => esc(deviationText(key, circuit, cfg))).join(' · ')}</p><p>${t('Bei „i. O.“ bitte begründen; die Bewertung trifft die prüfende Elektrofachkraft.')}</p></div></div>`;
  }

  function circuitMarkup(circuit, index, cfg) {
    const select = (key, options, label) => `<div class="field"><label>${t(label)}<select data-k="${key}"><option value="">${t('– bitte wählen –')}</option>${options.map(option => `<option value="${esc(option)}" ${option === circuit[key] ? 'selected' : ''}>${esc(option === 'sonstige' || option === 'keine' ? t(option === 'keine' ? 'kein RCD' : 'sonstige') : option)}</option>`).join('')}</select></label></div>`;
    return `<div class="si-circuit ${hasRcd(circuit) ? '' : 'no-rcd'}" data-si-circuit="${esc(circuit.id)}">
      <div class="si-circuit-head"><strong data-si-number>${t('Stromkreis {n}', {n:index + 1})}</strong><button type="button" class="so-icon-button" data-action="so-test-remove-circuit" aria-label="${esc(t('Stromkreis entfernen'))}">${icon('x', 16)}</button></div>
      <div class="si-fields">
        <div class="field si-wide"><label>${t('Bezeichnung')}<input data-k="name" maxlength="60" autocomplete="off" value="${esc(circuit.name || '')}"></label></div>
        <div class="field"><label>${t('Leitung')} <span>(${t('z. B. NYM-J 5×2,5')})</span><input data-k="cable" maxlength="40" autocomplete="off" value="${esc(circuit.cable || '')}"></label></div>
        ${measureField('crossSection', circuit, cfg)}
        ${select('device', cfg.devices, 'Schutzorgan')}
        ${measureField('ratedA', circuit, cfg)}
        ${select('rcdType', cfg.rcdTypes, 'Fehlerstrom-Schutz')}
        ${['rcdMa', 'rlo', 'riso', 'zs', 'tripMs', 'tripMa', 'touchV'].map(key => measureField(key, circuit, cfg)).join('')}
      </div>
      <p class="si-calc" data-si-calc>${esc(calcMarkup(circuit, cfg))}</p>
      <div data-si-dev>${deviationMarkup(circuit, cfg)}</div>
      ${ratingMarkup(`result-${circuit.id}`, {id:'result', label:'Ergebnis Stromkreis'}, circuit.result, ['io', 'nio'])}
      <div class="field"><label>${t('Notiz / Begründung')}<textarea data-k="note" rows="2" maxlength="500">${esc(circuit.note || '')}</textarea></label></div>
    </div>`;
  }

  function formMarkup(values, {cfg, people, instruments = [], before = '', savebar = ''}) {
    const field = (id, label, input, wide = false) => `<div class="field${wide ? ' so-wide' : ''}"><label for="si-${id}">${t(label)}</label>${input}</div>`;
    const options = (list, value, show = option => option) => `<option value="">${t('– bitte wählen –')}</option>${list.map(option => `<option value="${esc(option)}" ${option === value ? 'selected' : ''}>${esc(show(option))}</option>`).join('')}`;
    return `<form class="so-survey si-form" id="soTestForm" novalidate>${before}
      <fieldset class="so-section"><legend>${t('Allgemein')}</legend><div class="so-grid">
        ${field('reason', 'Anlass', `<select id="si-reason">${options(cfg.reasons, values.reason, option => t(option))}</select>`)}
        ${field('testedAt', 'Prüfdatum', `<input id="si-testedAt" type="date" value="${esc(values.testedAt || '')}">`)}
        ${field('tester', 'Prüfer', `<select id="si-tester">${options(people.map(p => p.username), values.tester, username => people.find(p => p.username === username)?.name || username)}</select>`)}
        ${instruments.length ? field('pick', 'Aus Prüfmitteln übernehmen', `<select id="si-pick"><option value="">${t('– bitte wählen –')}</option>${instruments.map(item => `<option value="${esc(item.id)}" data-name="${esc([item.manufacturer, item.name].filter(Boolean).join(' '))}" data-serial="${esc(item.serial)}" data-until="${esc(item.calibratedUntil)}">${esc(`${item.name} · SN ${item.serial}`)}</option>`).join('')}</select>`, true) : ''}
        ${field('instrument', 'Prüfgerät (Hersteller, Typ)', `<input id="si-instrument" maxlength="80" autocomplete="off" value="${esc(values.instrument || '')}">`)}
        ${field('instrumentSerial', 'Seriennummer', `<input id="si-instrumentSerial" maxlength="40" autocomplete="off" value="${esc(values.instrumentSerial || '')}">`)}
        ${field('calibratedUntil', 'Kalibriert bis', `<input id="si-calibratedUntil" type="date" value="${esc(values.calibratedUntil || '')}">`)}
        <p class="so-hint so-wide si-cal-hint" id="siCalHint" ${values.calibratedUntil && values.testedAt && values.calibratedUntil < values.testedAt ? '' : 'hidden'}>${icon('alert',12)} ${t('Die Kalibrierung ist zum Prüfdatum abgelaufen.')}</p>
        ${field('network', 'Netzform', `<select id="si-network">${options(cfg.networks, values.network)}</select>`)}
        ${field('voltage', 'Nennspannung', `<select id="si-voltage">${options(cfg.voltages, values.voltage)}</select>`)}
      </div></fieldset>
      <fieldset class="so-section"><legend>${t('Besichtigen')}</legend><div class="si-ratings">${cfg.visual.map(item => ratingMarkup('visual', item, values.visual?.[item.id])).join('')}</div></fieldset>
      <fieldset class="so-section"><legend>${t('Erproben')}</legend><div class="si-ratings">${cfg.function.map(item => ratingMarkup('function', item, values.function?.[item.id])).join('')}</div></fieldset>
      <fieldset class="so-section"><legend>${t('Messen')}</legend>
        <div class="si-circuits" id="siCircuits">${(values.circuits || []).map((circuit, index) => circuitMarkup(circuit, index, cfg)).join('')}</div>
        <button type="button" class="so-chip si-add" data-action="so-test-add-circuit">${icon('plus', 12)} ${t('Stromkreis hinzufügen')}</button>
      </fieldset>
      <div class="field so-wide"><label for="si-note">${t('Bemerkungen')}</label><textarea id="si-note" rows="3" maxlength="2000">${esc(values.note || '')}</textarea></div>
      ${savebar}
    </form>`;
  }

  function readCircuit(card, cfg, invalid, index) {
    const circuit = {id:card.dataset.siCircuit};
    card.querySelectorAll('[data-k]').forEach(input => {
      const key = input.dataset.k, measure = cfg.measures[key];
      if (!measure) { circuit[key] = input.value.trim(); return; }
      const value = parseNumber(input.value), bad = value != null && (Number.isNaN(value) || value > measure.max);
      input.setAttribute('aria-invalid', bad);
      if (bad && invalid) invalid.push(t('Stromkreis {n}: {field}', {n:index + 1, field:t(measure.label)}));
      circuit[key] = bad ? null : value;
    });
    circuit.result = card.querySelector(`[name="si-result-${CSS.escape(circuit.id)}-result"]:checked`)?.value || '';
    if (!hasRcd(circuit)) for (const key of RCD_FIELDS) circuit[key] = null;
    return circuit;
  }

  function readForm(form, cfg) {
    const invalid = [], value = id => form.querySelector('#si-' + id).value.trim();
    const ratings = group => Object.fromEntries([...form.querySelectorAll(`[data-si-rating="${group}"]`)]
      .map(node => [node.dataset.item, node.querySelector('input:checked')?.value]).filter(([, rating]) => rating));
    const circuits = [...form.querySelectorAll('[data-si-circuit]')].map((card, index) => readCircuit(card, cfg, invalid, index));
    return {invalid, values:{reason:value('reason'), testedAt:value('testedAt') || null, tester:value('tester'), instrument:value('instrument'),
      instrumentSerial:value('instrumentSerial'), calibratedUntil:value('calibratedUntil') || null, network:value('network'), voltage:value('voltage'),
      visual:ratings('visual'), function:ratings('function'), circuits, note:value('note')}};
  }

  // Takes instrument, serial number and calibration date from the chosen test instrument.
  function pickInstrument(form) {
    const option = form.querySelector('#si-pick')?.selectedOptions[0];
    if (!option?.value) return;
    form.querySelector('#si-instrument').value = option.dataset.name;
    form.querySelector('#si-instrumentSerial').value = option.dataset.serial;
    form.querySelector('#si-calibratedUntil').value = option.dataset.until;
  }
  function updateCalibration(form) {
    const hint = form.querySelector('#siCalHint'), until = form.querySelector('#si-calibratedUntil')?.value, tested = form.querySelector('#si-testedAt')?.value;
    if (hint) hint.hidden = !(until && tested && until < tested);
  }

  // Live hints for one circuit card while typing.
  function updateCircuit(card, cfg) {
    const circuit = readCircuit(card, cfg, null, 0);
    card.classList.toggle('no-rcd', !hasRcd(circuit));
    card.querySelector('[data-si-calc]').textContent = calcMarkup(circuit, cfg);
    const dev = card.querySelector('[data-si-dev]');
    dev.innerHTML = deviationMarkup(circuit, cfg); hydrateIcons(dev);
  }
  function renumber(form) { form.querySelectorAll('[data-si-number]').forEach((node, index) => { node.textContent = t('Stromkreis {n}', {n:index + 1}); }); }

  // ---------- Read-only view ----------
  function readonlyMarkup(ins, {cfg, people, day}) {
    const name = username => people.find(p => p.username === username)?.name || username || '–';
    const row = (label, value) => `<div class="so-dl-row"><dt>${t(label)}</dt><dd>${value || '–'}</dd></div>`;
    const ratings = group => cfg[group].map(item => { const rating = ins[group]?.[item.id]; return `<li class="si-r-${rating || 'open'}"><span>${esc(t(item.label))}</span><b>${rating ? t(RATING[rating]) : '–'}</b></li>`; }).join('');
    const value = (circuit, key) => circuit[key] == null ? '–' : esc(format(circuit[key], 2, I18n.locale()));
    const heads = ['Nr.', 'Stromkreis', 'Schutzorgan', 'RCD', 'RLO Ω', 'RISO MΩ', 'ZS Ω', 'Ik A', 'tA ms', 'IΔ mA', 'UB V', 'Ergebnis'];
    const rows = (ins.circuits || []).map((c, index) => {
      const dev = deviations(c, cfg.limits), mark = key => dev.includes(key) ? ' class="si-out"' : '';
      return `<tr><td>${index + 1}</td><td>${esc(c.name || '–')}${c.cable ? `<small>${esc(c.cable)}${c.crossSection != null ? ` · ${value(c, 'crossSection')} mm²` : ''}</small>` : ''}${c.note ? `<small>${esc(c.note)}</small>` : ''}</td>
        <td>${esc(c.device ? `${c.device === 'sonstige' ? t('sonstige') : c.device} ${c.ratedA != null ? value(c, 'ratedA') + ' A' : ''}` : '–')}</td><td>${hasRcd(c) ? `${esc(c.rcdType)} ${value(c, 'rcdMa')} mA` : '–'}</td>
        <td>${value(c, 'rlo')}</td><td${mark('riso')}>${value(c, 'riso')}</td><td${mark('zs')}>${value(c, 'zs')}</td><td>${c.zs ? esc(format(shortCircuit(c, cfg.limits), 0, I18n.locale())) : '–'}</td>
        <td${mark('tripMs')}>${hasRcd(c) ? value(c, 'tripMs') : '–'}</td><td${mark('tripMa')}>${hasRcd(c) ? value(c, 'tripMa') : '–'}</td><td${mark('touchV')}>${hasRcd(c) ? value(c, 'touchV') : '–'}</td>
        <td class="si-r-${c.result || 'open'}">${c.result ? t(RATING[c.result]) : '–'}</td></tr>`;
    }).join('');
    return `<dl class="so-dl">${row('Anlass', esc(ins.reason ? t(ins.reason) : ''))}${row('Prüfdatum', day(ins.testedAt))}${row('Prüfer', esc(name(ins.tester)))}
        ${row('Prüfgerät', esc([ins.instrument, ins.instrumentSerial && `SN ${ins.instrumentSerial}`].filter(Boolean).join(' · ')))}${row('Kalibriert bis', day(ins.calibratedUntil))}
        ${row('Netzform', esc(ins.network))}${row('Nennspannung', esc(ins.voltage))}</dl>
      <h4 class="si-sub">${t('Besichtigen')}</h4><ul class="si-list">${ratings('visual')}</ul>
      <h4 class="si-sub">${t('Erproben')}</h4><ul class="si-list">${ratings('function')}</ul>
      <h4 class="si-sub">${t('Messen')}</h4>
      ${rows ? `<div class="si-table-wrap" tabindex="0" role="region" aria-label="${esc(t('Messwerte'))}"><table class="si-table"><thead><tr>${heads.map(h => `<th>${esc(t(h))}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="so-hint">${t('Noch keine Stromkreise.')}</p>`}
      ${ins.note ? `<p class="si-note">${esc(ins.note)}</p>` : ''}`;
  }

  function summaryMarkup(ins, cfg) {
    const nio = [...cfg.visual.filter(item => ins.visual?.[item.id] === 'nio'), ...cfg.function.filter(item => ins.function?.[item.id] === 'nio')].map(item => t(item.label));
    (ins.circuits || []).forEach((c, index) => { if (c.result === 'nio') nio.push(t('Stromkreis {n}: {field}', {n:index + 1, field:c.name || '–'})); });
    const dev = (ins.circuits || []).flatMap((c, index) => deviations(c, cfg.limits).map(key => t('Stromkreis {n}: {field}', {n:index + 1, field:deviationText(key, c, cfg)})));
    return `<div class="so-calc"><div class="so-calc-row"><span>${t('Stromkreise')}</span><strong>${(ins.circuits || []).length}</strong></div>
      <div class="so-calc-row"><span>${t('Nicht in Ordnung')}</span><strong>${nio.length ? esc(nio.join(' · ')) : t('keine')}</strong></div>
      <div class="so-calc-row"><span>${t('Abweichungen vom Orientierungswert')}</span><strong>${dev.length ? esc(dev.join(' · ')) : t('keine')}</strong></div></div>`;
  }

  // ---------- Print (always German: the protocol is a document for the customer and the file) ----------
  function printMarkup(order, ins, {cfg, people}) {
    const h = value => esc(value ?? ''), name = username => people.find(p => p.username === username)?.name || username || '';
    const d = value => value ? new Date(value.length === 10 ? value + 'T12:00:00' : value).toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'}) : '';
    const n = (value, digits = 2) => value == null ? '–' : format(value, digits);
    const rating = value => value ? RATING[value] : '–';
    const a = order.address || {}, closed = ins.status === 'abgeschlossen';
    const items = group => cfg[group].map(item => `<tr><td>${h(item.label)}</td><td class="c">${rating(ins[group]?.[item.id])}</td></tr>`).join('');
    const circuits = (ins.circuits || []).map((c, index) => `<tr><td class="c">${index + 1}</td><td>${h(c.name)}${c.note ? `<br><small>${h(c.note)}</small>` : ''}</td><td>${h(c.cable)}${c.crossSection != null ? ` ${n(c.crossSection)} mm²` : ''}</td>
      <td>${h(c.device)} ${c.ratedA != null ? n(c.ratedA) + ' A' : ''}</td><td>${hasRcd(c) ? `${h(c.rcdType)} ${n(c.rcdMa)} mA` : '–'}</td><td class="r">${n(c.rlo)}</td><td class="r">${n(c.riso)}</td><td class="r">${n(c.zs)}</td>
      <td class="r">${c.zs ? n(shortCircuit(c, cfg.limits), 0) : '–'}</td><td class="r">${hasRcd(c) ? n(c.tripMs) : '–'}</td><td class="r">${hasRcd(c) ? n(c.tripMa) : '–'}</td><td class="r">${hasRcd(c) ? n(c.touchV) : '–'}</td><td class="c">${rating(c.result)}</td></tr>`).join('');
    return `<article class="si-doc">
      ${closed ? '' : '<p class="si-doc-draft">ENTWURF – Protokoll nicht abgeschlossen</p>'}
      <header><div><h1>Prüfprotokoll Erstprüfung</h1><p>nach ${h(cfg.standard)} · ${h(order.id)} · Revision ${ins.revision || 1}</p></div><strong>BÜLOW &amp; DOLZ</strong></header>
      <table class="si-doc-kv"><tr><th>Kunde</th><td>${h(order.customer?.name)}</td><th>Anlage</th><td>${h([a.street, [a.postcode, a.city].filter(Boolean).join(' ')].filter(Boolean).join(', '))}</td></tr>
        <tr><th>Auftrag</th><td>${h(order.title)}</td><th>Anlass</th><td>${h(ins.reason)}</td></tr>
        <tr><th>Prüfdatum</th><td>${d(ins.testedAt)}</td><th>Prüfer</th><td>${h(name(ins.tester))}</td></tr>
        <tr><th>Prüfgerät</th><td>${h(ins.instrument)}${ins.instrumentSerial ? ` · SN ${h(ins.instrumentSerial)}` : ''}</td><th>Kalibriert bis</th><td>${d(ins.calibratedUntil)}</td></tr>
        <tr><th>Netzform</th><td>${h(ins.network)}</td><th>Nennspannung</th><td>${h(ins.voltage)}</td></tr></table>
      <div class="si-doc-cols"><table><thead><tr><th>Besichtigen</th><th class="c">Ergebnis</th></tr></thead><tbody>${items('visual')}</tbody></table>
        <table><thead><tr><th>Erproben</th><th class="c">Ergebnis</th></tr></thead><tbody>${items('function')}</tbody></table></div>
      <table class="si-doc-m"><thead><tr><th>Nr.</th><th>Stromkreis</th><th>Leitung</th><th>Schutzorgan</th><th>RCD</th><th>RLO Ω</th><th>RISO MΩ</th><th>ZS Ω</th><th>Ik A</th><th>tA ms</th><th>IΔ mA</th><th>UB V</th><th>Ergebnis</th></tr></thead><tbody>${circuits || '<tr><td colspan="13">Keine Stromkreise erfasst.</td></tr>'}</tbody></table>
      ${ins.note ? `<p><b>Bemerkungen:</b> ${h(ins.note)}</p>` : ''}
      <p class="si-doc-result"><b>Ergebnis:</b> ${closed ? h(cfg.results[ins.result]) : 'offen'}${ins.defects ? ` – ${h(ins.defects)}` : ''}</p>
      <div class="si-doc-sign"><div><span>${h(name(ins.tester))}</span><small>Prüfer · Datum, Unterschrift</small></div>
        <div><span>${closed ? `${h(ins.finalizedName)} · abgeschlossen am ${d(ins.finalizedAt)}` : ''}</span><small>Verantwortliche Elektrofachkraft · Unterschrift</small></div></div>
      <footer>Prüfumfang und Orientierungswerte: ${h(cfg.version)}${cfg.approved ? '' : ' (Entwurf, fachlich noch nicht freigegeben)'} · Ik rechnerisch aus U0 = ${cfg.limits.u0} V und ZS · erstellt ${d(new Date().toISOString())}</footer>
    </article>`;
  }

  function print(order, ins, context) {
    document.getElementById('siPrint')?.remove();
    const node = document.createElement('div');
    node.id = 'siPrint'; node.className = 'si-print'; node.innerHTML = printMarkup(order, ins, context);
    document.body.appendChild(node); document.body.classList.add('si-printing');
    const done = () => { document.body.classList.remove('si-printing'); node.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  }

  return {hasRcd, zsMax, shortCircuit, deviations, hasDefects, parseNumber, defaults, newID, missingText, deviationText, formMarkup, circuitMarkup,
    readForm, updateCircuit, renumber, pickInstrument, updateCalibration, readonlyMarkup, summaryMarkup, printMarkup, print};
})();
if (typeof module !== 'undefined') module.exports = OrderInspection;
