// Bülow Gebäudetechnik – interactions. The page works without this file; it only adds the experience on top.
(() => {
  // Company contact details – the only place they need to be entered. Empty values hide the matching UI.
  const CONTACT = {
    phone: '',  // e.g. '030 1234567'
    email: '',  // address the request wizard sends to, e.g. 'anfrage@…'
    region: '', // e.g. 'Berlin und Umgebung'
  };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  $('#year').textContent = new Date().getFullYear();

  // Fill or hide contact details depending on what is configured above.
  const fill = (key, value) => $$(`[data-contact="${key}"]`).forEach(el => { el.textContent = value; el.classList.remove('ph'); });
  if (CONTACT.phone) {
    fill('phone', CONTACT.phone);
    $$('[data-contact="phone-link"]').forEach(a => { a.href = 'tel:' + CONTACT.phone.replace(/[^+\d]/g, ''); a.hidden = false; });
    $$('[data-contact="no-phone"]').forEach(el => { el.hidden = true; });
  }
  if (CONTACT.email) {
    fill('email', CONTACT.email);
    $$('[data-contact="email-link"]').forEach(a => { a.href = 'mailto:' + CONTACT.email; });
  }
  if (CONTACT.region) fill('region', CONTACT.region);
  Object.keys(CONTACT).forEach(key => { if (!CONTACT[key]) $$(`[data-contact-row="${key}"]`).forEach(row => { row.hidden = true; }); });

  // Mobile quick-contact bar: visible once the hero is behind you, hidden again at the contact section.
  const bar = $('#action-bar'), hero = $('.hero'), contactSection = $('#kontakt');
  if (bar && 'IntersectionObserver' in window) {
    const state = { hero: true, contact: false };
    const update = () => bar.classList.toggle('show', !state.hero && !state.contact);
    new IntersectionObserver(([e]) => { state.hero = e.isIntersecting; update(); }).observe(hero);
    new IntersectionObserver(([e]) => { state.contact = e.isIntersecting; update(); }, { rootMargin: '0px 0px -30% 0px' }).observe(contactSection);
  }

  // Scroll reveal
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => io.observe(el));
  } else reveals.forEach(el => el.classList.add('in'));

  // Rename pill: strike through the old name once the page is up.
  const rename = $('.rename');
  if (rename && !reduceMotion) {
    rename.style.setProperty('--strike', '0');
    requestAnimationFrame(() => requestAnimationFrame(() => rename.style.setProperty('--strike', '1')));
  }

  // House: wires draw in, windows light up, hotspots pick a service.
  const house = $('#house'), caption = $('#house-caption');
  const wires = Object.fromEntries($$('.wire', house).map(path => {
    path.style.setProperty('--len', Math.ceil(path.getTotalLength()));
    return [path.dataset.wire, path];
  }));
  setTimeout(() => house.classList.add('powered'), reduceMotion ? 0 : 250);

  const pulse = $('.pulse', house);
  let pulseFrame = null;
  function runPulse(path) {
    cancelAnimationFrame(pulseFrame);
    if (!path || reduceMotion) { pulse.style.opacity = 0; return; }
    const length = path.getTotalLength(), duration = Math.max(700, length * 3.2);
    let start = null;
    const step = now => {
      start ??= now;
      const t = ((now - start) % (duration + 500)) / duration;
      const point = path.getPointAtLength(Math.min(t, 1) * length);
      pulse.setAttribute('cx', point.x); pulse.setAttribute('cy', point.y);
      pulse.style.opacity = t > 1 ? 0 : 1;
      pulseFrame = requestAnimationFrame(step);
    };
    pulseFrame = requestAnimationFrame(step);
  }

  // Services: tabs, panels and hotspots share one selection.
  const tabs = $$('.service-tabs [role="tab"]');
  const panels = $$('.service');
  const hotspots = $$('.hotspot', house);

  function select(service, { fromHouse = false } = {}) {
    hotspots.forEach(h => h.setAttribute('aria-pressed', String(h.dataset.service === service)));
    Object.entries(wires).forEach(([key, path]) => path.classList.toggle('active', key === service));
    runPulse(wires[service]);
    tabs.forEach(tab => {
      const on = tab.dataset.service === service;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    panels.forEach(panel => {
      const on = panel.id === 'svc-' + service;
      if (on && panel.hidden) { panel.classList.remove('enter'); void panel.offsetWidth; panel.classList.add('enter'); }
      panel.hidden = !on;
    });
    const panel = $('#svc-' + service);
    if (fromHouse && panel) caption.innerHTML = `<b>${panel.dataset.title}</b> – ${panel.dataset.short} <a href="#leistungen">Mehr erfahren ↓</a>`;
  }

  hotspots.forEach(h => h.addEventListener('click', () => select(h.dataset.service, { fromHouse: true })));
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab.dataset.service));
    tab.addEventListener('keydown', event => {
      const delta = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
      if (!delta) return;
      event.preventDefault();
      const next = tabs[(i + delta + tabs.length) % tabs.length];
      next.focus(); select(next.dataset.service);
    });
  });
  // Initial state: first tab open, house without a highlighted wire until someone picks one.
  panels.forEach(panel => { panel.hidden = panel.id !== 'svc-elektro'; });

  // Request wizard
  const form = $('#anfrage'), note = $('#request-note');
  const steps = $$('fieldset', form), bars = $$('.wizard-progress span', form);
  const back = $('[data-back]', form), next = $('[data-next]', form), submit = $('[data-submit]', form);
  let current = 0;

  const values = name => $$(`[name="${name}"]:checked`, form).map(input => input.value);

  function show(index, { focus = true } = {}) {
    current = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach((fieldset, i) => {
      const on = i === current;
      if (on && fieldset.hidden) { fieldset.classList.remove('enter'); void fieldset.offsetWidth; fieldset.classList.add('enter'); }
      fieldset.hidden = !on;
    });
    bars.forEach((bar, i) => bar.classList.toggle('done', i <= current));
    back.hidden = current === 0;
    next.hidden = current === steps.length - 1;
    submit.hidden = current !== steps.length - 1;
    note.textContent = 'Der Assistent öffnet Ihr E-Mail-Programm mit einer vorausgefüllten Nachricht.';
    if (current === steps.length - 1) {
      const parts = [['Anliegen', values('topic').join(', ')], ['Dringlichkeit', values('urgency')[0]], ['Objekt', values('property')[0]]].filter(([, v]) => v);
      $('#summary').innerHTML = parts.map(([k, v]) => `${k}: <b>${v}</b>`).join(' · ');
    }
    if (focus) {
      const legend = $('legend', steps[current]);
      legend.tabIndex = -1; legend.focus({ preventScroll: true });
      if (form.getBoundingClientRect().top < 70) form.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }

  next.addEventListener('click', () => {
    if (current === 0 && !values('topic').length) { note.textContent = 'Bitte wählen Sie mindestens ein Anliegen aus.'; return; }
    show(current + 1);
  });
  back.addEventListener('click', () => show(current - 1));
  // Single-choice steps move on by themselves.
  steps.forEach((fieldset, i) => fieldset.addEventListener('change', event => {
    if (event.target.type === 'radio' && i === current) setTimeout(() => show(current + 1), reduceMotion ? 0 : 280);
  }));

  // The preferred time only matters for a call back.
  const replyTime = $('[data-reply-time]', form);
  const syncReply = () => { replyTime.hidden = values('reply')[0] !== 'Rückruf'; };
  $$('[name="reply"]', form).forEach(input => input.addEventListener('change', syncReply));
  syncReply();

  // Audience links preselect the property type and start with the first question.
  $$('[data-property]').forEach(link => link.addEventListener('click', () => {
    $$('[name="property"]', form).forEach(input => { input.checked = input.value === link.dataset.property; });
    show(0, { focus: false });
  }));

  // "Dazu anfragen" on a service preselects it and starts at the next question.
  $$('[data-request]').forEach(link => link.addEventListener('click', () => {
    $$('[name="topic"]', form).forEach(input => { if (input.value === link.dataset.request) input.checked = true; });
    show(1, { focus: false });
  }));

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (!CONTACT.email) {
      note.textContent = CONTACT.phone
        ? `Die Anfrage per E-Mail wird gerade eingerichtet. Rufen Sie uns gern direkt an: ${CONTACT.phone}`
        : 'Die Anfrage per E-Mail wird gerade eingerichtet. Bitte versuchen Sie es in Kürze erneut.';
      return;
    }
    const data = new FormData(form);
    const body = [
      `Anliegen: ${values('topic').join(', ') || '–'}`,
      `Dringlichkeit: ${values('urgency')[0] || '–'}`,
      `Objekt: ${values('property')[0] || '–'}`,
      '',
      `Name: ${data.get('name')}`,
      `Kontakt: ${data.get('contact')}`,
      `PLZ / Ort: ${data.get('place') || '–'}`,
      `Rückmeldung per: ${values('reply')[0] || '–'}${values('reply')[0] === 'Rückruf' ? ` (${values('time')[0] || 'egal'})` : ''}`,
      '',
      data.get('message') || ''
    ].join('\n');
    const subject = 'Anfrage: ' + (values('topic')[0] || 'Allgemein');
    location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  show(0, { focus: false });
})();
