(function (root) {
  'use strict';
  const labels = { fit: 'Passend', review: 'Angaben prüfen', outside: 'Außerhalb Gebiet', excluded: 'Ausgeschlossen' };
  function assess(l) {
    if (l.exclusion === 'only') return { kind: 'excluded', reason: 'Duschwandinstallation gehört nicht zum Leistungsangebot.' };
    if (l.exclusion === 'mixed') return { kind: 'review', reason: 'Renovierung separat von der Duschwandinstallation prüfen.' };
    if (l.distance != null && l.verified && l.distance > 10) return { kind: 'outside', reason: 'Außerhalb des bestätigten 10-km-Umkreises.' };
    if (!l.area || l.distance == null || !l.verified) return { kind: 'review', reason: 'Ort und Entfernung zu Charlottenburg bestätigen.' };
    if (l.incomplete || l.work === 'unknown') return { kind: 'review', reason: 'Beschreibung und Leistungsumfang vervollständigen.' };
    if (l.work === 'other') return { kind: 'review', reason: 'Leistung außerhalb des Schwerpunkts Renovierung prüfen.' };
    return { kind: 'fit', reason: 'Renovierungsarbeiten innerhalb des bestätigten Einsatzgebiets.' };
  }
  function normalize(text) { return text.toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss'); }
  function matches(l, q) {
    const haystack = normalize([l.id, l.title, l.contact, l.area, l.description, ...l.scope, ...l.messages.map(m => m.text)].join(' '));
    return normalize(q).split(/\s+/).filter(Boolean).every(t => haystack.includes(t));
  }
  function parseImport(text) {
    if (new TextEncoder().encode(text).length > 5 * 1024 * 1024) throw Error('Die Datei darf höchstens 5 MB groß sein.');
    const payload = JSON.parse(text);
    const input = Array.isArray(payload) ? payload : payload?.leads;
    if (!Array.isArray(input) || !input.length || input.length > 500) throw Error('Erwartet werden 1–500 Anfragen als Liste oder als Werkraum-Export mit „leads“.');
    const ids = new Set();
    const stringFields = ['id','title','contact','area','date','desired','work','exclusion','description'];
    return input.map((lead, i) => {
      const fail = () => { throw Error(`Anfrage ${i + 1}: Ungültige oder fehlende Angaben.`); };
      if (!lead || stringFields.some(k => typeof lead[k] !== 'string')) fail();
      if (!lead.id.trim() || !lead.title.trim() || ids.has(lead.id)) fail();
      if (['verified','incomplete'].some(k => typeof lead[k] !== 'boolean')) fail();
      if (['distance','budget'].some(k => lead[k] != null && (typeof lead[k] !== 'number' || !Number.isFinite(lead[k]) || lead[k] < 0))) fail();
      if (!['renovation','other','unknown'].includes(lead.work) || !['none','only','mixed'].includes(lead.exclusion)) fail();
      if (['scope','missing'].some(k => !Array.isArray(lead[k]) || lead[k].some(v => typeof v !== 'string'))) fail();
      if (!Array.isArray(lead.messages) || lead.messages.some(m => !m || ['sender','date','text'].some(k => typeof m[k] !== 'string'))) fail();
      ids.add(lead.id);
      // Import only the shared schema, never session links, tokens or arbitrary fields.
      return Object.fromEntries([...stringFields, 'verified','incomplete','distance','budget','scope','missing','messages'].map(k => [k, k === 'messages' ? lead.messages.map(m => ({ sender: m.sender, date: m.date, text: m.text })) : lead[k] ?? null]));
    });
  }
  function merge(previous, incoming) {
    const ids = new Set(incoming.map(l => l.id));
    return [...incoming, ...previous.filter(l => !ids.has(l.id))];
  }
  function candidate(lead, managerID, projectID) {
    return {
      id: `werkraum-${lead.id}`, source: 'MyHammer', externalID: lead.id, proposedProjectID: projectID,
      title: lead.title, customerName: lead.contact, city: lead.area, postalCode: '', region: 'Berlin / Brandenburg',
      schedule: lead.desired, compensation: 0, heatPump: 'Renovierung / Ausbau', propertyType: 'Bestand · Angaben prüfen',
      coordinatorID: managerID || null, status: 'Prüfung nötig',
      validationNotes: ['Adresse und Ausführungstermin bestätigen', 'Auftrag und Vergütung separat vereinbaren; Kundenbudget ist kein Auftragspreis', ...lead.missing]
    };
  }
  const api = { labels, assess, matches, parseImport, merge, candidate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WerkraumCore = api;
})(globalThis);
