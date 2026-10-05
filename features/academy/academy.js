// Bülow & Dolz Academy (web): short guides for the workflows the platform supports today.
// Technical training content is not included; it needs approved content from Lucas-René Dolz.
const academyGuides = [
  {id:'auftrag', icon:'hard-hat', title:'Auftrag anlegen und vor Ort aufnehmen', roles:['Geschäftsführung','Elektromeister','Vertrieb','Montage'], server:true, view:'orders', steps:[
    'Aufträge öffnen und „Neuer Auftrag“ wählen: Titel, Kunde und Ort eintragen.',
    'Den Schritt „Aufnahme vor Ort“ einer Person zuweisen und eine Fälligkeit setzen.',
    'Vor Ort die Aufnahme Hausanschluss ausfüllen und Fotos von Hausanschlusskasten, Zählerschrank, Typenschild und Speicher hochladen.',
    '„Aufnahme speichern“ tippen. Ohne Netz bleibt der Entwurf auf dem Gerät erhalten.']},
  {id:'netz', icon:'zap', title:'Leistungsbilanz und Netzbetreiber', roles:['Elektromeister','Geschäftsführung'], server:true, view:'orders', steps:[
    'Die Rechenhilfe in der Leistungsbilanz prüfen; die Bewertung trifft nur der Elektromeister.',
    'Bei „Netzbetreiber anfragen“ den Netzbetreiber-Vorgang vorbereiten und Unterlagen hochladen.',
    'Nach der Einreichung Datum, Aktenzeichen und Wiedervorlage eintragen.',
    'Die Montage lässt sich erst nach Zustimmung oder begründeter Entscheidung des Elektromeisters starten.']},
  {id:'protokoll', icon:'gauge', title:'Erstprüfung und Prüfprotokoll', roles:['Montage','Elektromeister'], server:true, view:'orders', steps:[
    'Nach der Montage im Auftrag „Protokoll beginnen“ wählen.',
    'Besichtigen und Erproben bewerten, Messwerte je Stromkreis eintragen.',
    'Abweichungen vom Orientierungswert mit einer Begründung versehen.',
    '„Zur Freigabe übergeben“ – der Elektromeister prüft und schließt ab.']},
  {id:'abnahme', icon:'clipboard-check', title:'Abnahme', roles:['Montage','Elektromeister'], server:true, view:'orders', steps:[
    'Die Abnahme anfordern, sobald das Prüfprotokoll ohne Mängel abgeschlossen ist.',
    'Der Elektromeister gibt frei oder meldet einen Mangel mit Begründung.',
    'Nach der Nacharbeit die Abnahme erneut anfordern.']},
  {id:'app', icon:'grid', title:'Alltag in der App', roles:['Alle'], server:false, view:'dashboard', steps:[
    'Die Glocke oben zeigt Mitteilungen; der Assistenz-Knopf unten rechts zeigt die nächsten Aufgaben.',
    'Den Balken unten nach oben ziehen führt zum Startbildschirm, der Pfeil links eine Seite zurück.',
    'Die Sprache lässt sich oben rechts unter „Language“ umstellen.']}
];

function renderAcademy() {
  const t = (text, vars) => I18n.t(text, vars);
  setPageMeta('BÜLOW & DOLZ', t('Academy'));
  const available = guide => !guide.server || ServerOrders.enabled;
  return `<div class="academy-page">
    <section class="academy-hero"><span class="eyebrow">${t('BÜLOW & DOLZ ACADEMY')}</span><h2>${t('Leitfäden für eure Abläufe')}</h2>
      <p>${t('Kurz erklärt, wie ihr die Plattform im Alltag nutzt – vom Auftrag bis zur Abnahme.')}</p></section>
    <div class="academy-guides">${academyGuides.map(guide => `<article class="academy-guide" id="academy-${guide.id}">
      <header><span class="academy-icon" aria-hidden="true">${icon(guide.icon,20)}</span><div><h3>${escapeAttr(t(guide.title))}</h3>
        <p class="academy-roles">${guide.roles.map(role => `<span>${escapeAttr(t(role))}</span>`).join('')}</p></div></header>
      <ol>${guide.steps.map(step => `<li>${escapeAttr(t(step))}</li>`).join('')}</ol>
      ${available(guide) ? `<button class="button outline small" data-action="goto" data-target="${guide.view}">${t('Öffnen')} ${icon('arrow-right',14)}</button>` : `<p class="academy-hint">${t('Nur im Server-Arbeitsplatz verfügbar.')}</p>`}
    </article>`).join('')}</div>
    <section class="academy-hero academy-training"><h3>${t('Fachschulungen')}</h3>
      <p>${t('Folgen. Inhalte und Freigabe legt Lucas-René Dolz fest; bis dahin gelten die Unterlagen eurer Schulungen und Normen.')}</p></section>
  </div>`;
}
