// Extracted without behavior changes; see Docs/Modules for ownership.
const defaultState = {
  role: 'partner',
  view: 'dashboard',
  language: 'de',
  session: {
    authenticated: false,
    email: '',
    error: ''
  },
  initialSetup: {
    completed: false,
    stage: 0,
    mode: 'create',
    email: '',
    role: '',
    fullName: '',
    phone: '',
    companyName: '',
    referenceCode: '',
    integrations: [],
    error: ''
  },
  onboarding: {
    currentStep: 3,
    completed: [1, 2],
    data: {
      company: 'SunKraft Instalacje Sp. z o.o.',
      country: 'PL',
      legalForm: 'Sp. z o.o.',
      taxId: 'DEMO – keine echte Steuer-ID',
      contact: 'Krzysztof Nowak',
      email: 'partner@example.invalid',
      phone: '',
      qualification: 'eu-service',
      capacity: 12,
      maxDistance: 220,
      regions: ['Berlin', 'Brandenburg', 'Sachsen'],
      languages: ['Deutsch', 'Polski', 'English']
    }
  },
  filters: { search: '', region: 'all', scope: 'all', date: 'all' },
  bids: [],
  notifications: [
    { id: 'notification-web-project', kind: 'project', title: 'Neue Projekte in Berlin', text: '3 Standardanlagen passen zu Ihrem Profil.', time: 'vor 8 Min.', isRead: false, priority: 'Wichtig', deliveryStatus: 'Zugestellt' },
    { id: 'notification-web-document', kind: 'document', title: 'Dokument geprueft', text: 'Betriebshaftpflicht wurde freigegeben.', time: 'vor 2 Std.', isRead: false, priority: 'Normal', deliveryStatus: 'Zugestellt' },
    { id: 'notification-web-academy', kind: 'academy', title: 'Academy', text: 'Modul R290-Sicherheit ist jetzt verfuegbar.', time: 'gestern', isRead: true, priority: 'Normal', deliveryStatus: 'Gelesen' }
  ],
  operations: {
    importSource: 'Pipedrive',
    activeChatProjectID: 'GEP-26-01794',
    projectEdits: {},
    projectManagers: [
      { id: 'pm-nicolai', name: 'Nicolai Bülow', title: 'Projektorganisation', email: 'organisation@example.invalid', phone: '', region: 'Deutschland', availability: 'Verfügbar' },
      { id: 'pm-laura', name: 'Demo-Koordination Nord', title: 'Projektkoordination Nord', email: 'nord@example.invalid', phone: '', region: 'Niedersachsen', availability: 'Im Projekt' },
      { id: 'pm-jonas', name: 'Demo-Koordination West', title: 'Projektmanagement West', email: 'west@example.invalid', phone: '', region: 'NRW', availability: 'Verfügbar' },
      { id: 'pm-anna', name: 'Demo-Koordination Mitte', title: 'Projektkoordination Mitte', email: 'mitte@example.invalid', phone: '', region: 'Hessen / NRW', availability: 'Abwesend' }
    ],
    importCandidates: [
      { id: 'import-pd-90821', source: 'Pipedrive', externalID: 'PD-90821', proposedProjectID: 'GEP-26-01912', title: 'Einfamilienhaus Linden-Süd', customerName: 'Familie Seidel', city: 'Hannover', postalCode: '30449', region: 'Niedersachsen', schedule: '22.–24. Sep', compensation: 7500, heatPump: 'Monoblock, 10 kW', propertyType: 'Einfamilienhaus · Bestand', coordinatorID: 'pm-laura', status: 'Importbereit', validationNotes: [] },
      { id: 'import-pd-90844', source: 'Pipedrive', externalID: 'PD-90844', proposedProjectID: 'GEP-26-01882', title: 'Neubau am Maschsee', customerName: 'Familie Berger', city: 'Hannover', postalCode: '30173', region: 'Niedersachsen', schedule: '10.–12. Sep', compensation: 7500, heatPump: 'Monoblock, 11 kW', propertyType: 'Einfamilienhaus · Neubau', coordinatorID: 'pm-laura', status: 'Mögliches Duplikat', validationNotes: ['Projekt-ID existiert bereits', 'Adresse stimmt mit GEP-26-01882 überein'] },
      { id: 'import-loc-4418', source: 'Locatick', externalID: 'LOC-4418', proposedProjectID: 'GEP-26-01918', title: 'Modernisierung Geismar', customerName: 'Kunde aus Locatick', city: 'Göttingen', postalCode: '37083', region: 'Niedersachsen', schedule: '29. Sep–01. Okt', compensation: 0, heatPump: 'Luft-Wasser-Wärmepumpe, 12 kW', propertyType: 'Einfamilienhaus · Bestand', coordinatorID: 'pm-nicolai', status: 'Prüfung nötig', validationNotes: ['Projektvergütung fehlt', 'Leistungsumfang muss bestätigt werden'] },
      { id: 'import-loc-4426', source: 'Locatick', externalID: 'LOC-4426', proposedProjectID: 'GEP-26-01924', title: 'Doppelhaushälfte Lehndorf', customerName: 'Familie Kranz', city: 'Braunschweig', postalCode: '38116', region: 'Niedersachsen', schedule: '05.–07. Okt', compensation: 8100, heatPump: 'Split-Wärmepumpe, 9 kW', propertyType: 'Doppelhaushälfte · Bestand', coordinatorID: 'pm-nicolai', status: 'Importbereit', validationNotes: [] }
    ],
    projectMessages: [
      { id: 'message-01794-1', projectID: 'GEP-26-01794', senderName: 'Laura Peters', senderRole: 'Projektkoordination', body: 'Guten Morgen, bitte die Hydraulikfotos vor der Dämmung hochladen. Dann kann ich Gate 3 direkt prüfen.', sentAt: Date.now() / 1000 - swiftReferenceDateOffset - 7200, isRead: false },
      { id: 'message-01794-2', projectID: 'GEP-26-01794', senderName: 'Nicolai Bülow', senderRole: 'Montagepartner', body: 'Verstanden. Die Fotos kommen heute bis 14 Uhr zusammen mit den Messwerten.', sentAt: Date.now() / 1000 - swiftReferenceDateOffset - 6300, isRead: true },
      { id: 'message-01852-1', projectID: 'GEP-26-01852', senderName: 'Jonas Richter', senderRole: 'Projektmanager', body: 'Der Kundentermin ist bestätigt. Gebt mir bitte kurz Rückmeldung, ob Team West den Start halten kann.', sentAt: Date.now() / 1000 - swiftReferenceDateOffset - 86400, isRead: false }
    ]
  },
  copilotTasks: [
    { id:'copilot-photo-01794', projectID:'GEP-26-01794', title:'Hydraulik vor Dämmung dokumentieren', detail:'Gate 3 benötigt noch drei klar erkennbare Aufnahmen und die Messwerte.', nextStep:'Pflichtmotive öffnen', priority:'Hoch', status:'In Arbeit', dueLabel:'Heute, 14:00' },
    { id:'copilot-start-01852', projectID:'GEP-26-01852', title:'Startbestätigung vom Team einholen', detail:'Kundentermin bestätigt, finale Team-Rückmeldung fehlt.', nextStep:'Team West erinnern', priority:'Normal', status:'Vorgeschlagen', dueLabel:'Heute' }
  ],
  photoGateAssessments: [
    { id:'gate-01794-3', projectID:'GEP-26-01794', gateName:'Gate 3 · Hydraulik', capturedPhotos:5, requiredPhotos:8, qualityScore:72, status:'QM-Prüfung nötig', findings:['Rohrführung teilweise verdeckt','Typenschild nicht vollständig lesbar'], reviewedBy:null },
    { id:'gate-01852-1', projectID:'GEP-26-01852', gateName:'Gate 1 · Baustellenstart', capturedPhotos:6, requiredPhotos:6, qualityScore:96, status:'Bestanden', findings:[], reviewedBy:'Bauleitung / QM' }
  ],
  autopilotProposals: [
    { id:'auto-remind-01794', projectID:'GEP-26-01794', title:'Foto-Erinnerung auslösen', rationale:'Gate 3 ist in 90 Minuten fällig und noch nicht vollständig.', impact:'Team Nord erhält eine dringende Projektmitteilung.', status:'Vorgeschlagen' },
    { id:'auto-pm-01852', projectID:'GEP-26-01852', title:'PM-Rückfrage vorbereiten', rationale:'Starttermin bestätigt, Teamstatus seit 18 Stunden unverändert.', impact:'Nachricht wird als Entwurf im Projektchat hinterlegt.', status:'Vorgemerkt' }
  ],
  teamMatchSuggestions: [
    { id:'match-01874-sued', projectID:'GEP-26-01874', teamID:'team-sued', score:94, factors:['Region Kassel','3 Personen verfügbar','Qualitätsprofil 96 %'], status:'Vorgeschlagen' },
    { id:'match-01861-west', projectID:'GEP-26-01861', teamID:'team-west', score:88, factors:['NRW-Abdeckung','Elektrofachkraft im Team','Startfenster passend'], status:'Vorgeschlagen' }
  ],
  deploymentPlans: [
    { id:'deploy-01874', projectID:'GEP-26-01874', teamID:'team-sued', dateLabel:'07.–09. Sep', timeWindow:'07:30–16:30', travelMinutes:42, conflict:null, status:'Vorgeschlagen' },
    { id:'deploy-01861', projectID:'GEP-26-01861', teamID:'team-west', dateLabel:'02.–04. Sep', timeWindow:'08:00–17:00', travelMinutes:96, conflict:'Rückfahrt kollidiert mit Folgetermin', status:'In Arbeit' }
  ],
  deviationCases: [
    { id:'dev-01794-insulation', projectID:'GEP-26-01794', title:'Dämmung vor Fotofreigabe begonnen', detail:'Betroffener Leitungsabschnitt gestoppt; QM-Entscheidung erforderlich.', priority:'Kritisch', owner:'Laura Peters', deadline:'Heute, 13:30', source:'Foto-Gate', status:'Eskaliert' },
    { id:'dev-01852-access', projectID:'GEP-26-01852', title:'Zufahrt für Materialtransport eingeschränkt', detail:'Alternative Anlieferzone mit Kunde abstimmen.', priority:'Normal', owner:'Jonas Richter', deadline:'Morgen', source:'Baustellen-Copilot', status:'In Arbeit' }
  ],
  automatedInvoices: [
    { id:'invoice-01794', projectID:'GEP-26-01794', amount:7500, qualityScore:91, generatedAt:Date.now()/1000-swiftReferenceDateOffset, status:'Wartet auf Abnahme' },
    { id:'invoice-01730', projectID:'GEP-26-01730', amount:7500, qualityScore:97, generatedAt:Date.now()/1000-swiftReferenceDateOffset-172800, status:'Abrechnungsbereit' }
  ],
  academyRecommendations: [
    { id:'academy-team-nord-photo', teamID:'team-nord', lessonID:'photo-required', title:'Pflichtmotive auffrischen', reason:'Zwei Foto-Gates mit nicht lesbaren Typenschildern in den letzten 30 Tagen.', priority:'Hoch', status:'Vorgeschlagen' },
    { id:'academy-team-west-customer', teamID:'team-west', lessonID:'customer-issues', title:'Abweichungen beim Kunden klären', reason:'Empfohlen vor dem nächsten Bestandsprojekt.', priority:'Normal', status:'Vorgemerkt' }
  ],
  offlineModeEnabled: false,
  pendingOfflineChanges: 0
};

const projects = [
  {
    id: 'GF-2608-1842', city: 'Potsdam', region: 'Brandenburg', postal: '14467', start: '18.08.2026',
    price: 7500, material: 2320, travel: 180, distance: 84, readiness: 96, complexity: 'Standard', scope: 'Turnkey',
    title: 'Einfamilienhaus - R290 11 kW', duration: '3-4 Tage', bids: 4, color: 'blue',
    tags: ['Fundament fertig', 'Hydraulikschema A', 'Elektro inklusive'],
    tasks: ['Rueckbau Gastherme', 'Ausseneinheit und Speicher montieren', 'Hydraulik, Daemmung und Inbetriebnahme', 'Elektroanschluss gemaess Projektpaket'],
    docs: ['Projektsteckbrief', 'Heizlast / Abgleich', 'Hydraulikschema', 'Elektroschema', 'Bestandsfotos'],
    risks: ['Kernbohrung durch 36 cm Mauerwerk', 'Zufahrt nur bis 3,5 t'],
    standard: true
  },
  {
    id: 'GF-2608-1856', city: 'Leipzig', region: 'Sachsen', postal: '04109', start: '20.08.2026',
    price: 7850, material: 2480, travel: 260, distance: 162, readiness: 89, complexity: 'Mittel', scope: 'SHK-Core',
    title: 'Doppelhaushälfte - 14,8 kW', duration: '4 Tage', bids: 2, color: 'cyan',
    tags: ['SHK-Core', 'Elektro durch Bülow', '2 Heizkreise'],
    tasks: ['Rueckbau Oelkessel ohne Tank', 'Hydraulischer Aufbau mit 2 Heizkreisen', 'Speicher und 3-Wegeventil', 'Foto-Gates 1 bis 4'],
    docs: ['Projektsteckbrief', 'Hydraulikschema B2', 'Bestandsfotos', 'Materialliste'],
    risks: ['Enger Kellerzugang', 'Zweiter Heizkreis mit Mischer'],
    standard: false
  },
  {
    id: 'GF-2608-1871', city: 'Magdeburg', region: 'Sachsen-Anhalt', postal: '39104', start: '22.08.2026',
    price: 7500, material: 2190, travel: 210, distance: 148, readiness: 100, complexity: 'Standard', scope: 'Turnkey',
    title: 'Bungalow - R290 8,3 kW', duration: '3 Tage', bids: 6, color: 'green',
    tags: ['Baustelle bereit', 'Kurzer Leitungsweg', 'Standard A'],
    tasks: ['Rueckbau Gastherme', 'Fertigsockel setzen', 'Standard-Hydraulik A', 'Elektro und IBN'],
    docs: ['Projektsteckbrief', 'Heizlast / Abgleich', 'Hydraulikschema', 'Foto-Sollstandard'],
    risks: ['Keine besonderen Risiken gemeldet'],
    standard: true
  },
  {
    id: 'GF-2608-1902', city: 'Dresden', region: 'Sachsen', postal: '01067', start: '25.08.2026',
    price: 8650, material: 2910, travel: 320, distance: 224, readiness: 82, complexity: 'Sonderfall', scope: 'Turnkey',
    title: 'Altbau - Hybridanlage', duration: '5 Tage', bids: 1, color: 'amber',
    tags: ['Hybrid', 'Gas bleibt', 'Zusatzleistung'],
    tasks: ['Bestehenden Gaswaermeerzeuger erhalten', 'Hydraulische Trennung', 'Bivalenzregelung', 'Gemeinsame Funktionspruefung'],
    docs: ['Hybridschema H1', 'Signalplan', 'Bestandsaufnahme', 'Zusatzleistungskatalog'],
    risks: ['Komplexe Regelung', 'Abnahme nur mit Bülow & Dolz Qualitätsfreigabe'],
    standard: false
  },
  {
    id: 'GF-2609-1933', city: 'Cottbus', region: 'Brandenburg', postal: '03046', start: '01.09.2026',
    price: 7500, material: 2380, travel: 190, distance: 117, readiness: 92, complexity: 'Standard', scope: 'Turnkey',
    title: 'Einfamilienhaus - 11,4 kW', duration: '3-4 Tage', bids: 3, color: 'blue',
    tags: ['Standard A', 'FBH', 'Fundament bauseits'],
    tasks: ['Rueckbau Gastherme', 'WP / Speicher', 'Hydraulik', 'Elektro / Abnahme'],
    docs: ['Projektsteckbrief', 'Montagepaket', 'Bestandsfotos'],
    risks: ['Aussenleitung 7 m statt Standard 5 m'],
    standard: true
  },
  {
    id: 'GF-2609-1940', city: 'Berlin', region: 'Berlin', postal: '12623', start: '02.09.2026',
    price: 8050, material: 2640, travel: 80, distance: 28, readiness: 94, complexity: 'Mittel', scope: 'SHK-Core',
    title: 'Reihenendhaus - Heizkoerper', duration: '4 Tage', bids: 5, color: 'cyan',
    tags: ['Heizkoerper', 'SHK-Core', 'Elektro Bülow & Dolz'],
    tasks: ['Rueckbau', 'Puffer / WW-Speicher', 'Heizkoerperventile', 'Hydraulischer Abgleich praktisch'],
    docs: ['Projektsteckbrief', 'Heizkoerperliste', 'Hydraulikschema'],
    risks: ['Mehrere Ventiltausche'],
    standard: false
  },
  {
    id: 'GF-2609-1977', city: 'Erfurt', region: 'Thueringen', postal: '99084', start: '08.09.2026',
    price: 7500, material: 2260, travel: 350, distance: 268, readiness: 91, complexity: 'Standard', scope: 'Turnkey',
    title: 'Neubau - R290 8,3 kW', duration: '3 Tage', bids: 2, color: 'green',
    tags: ['Neubau', 'FBH', 'Keine Altanlage'],
    tasks: ['Ausseneinheit', 'Speicher / Hydraulik', 'Elektro', 'IBN / Dokumentation'],
    docs: ['Projektsteckbrief', 'Hydraulikschema', 'Elektroschema'],
    risks: ['Anfahrt mit Uebernachtung'],
    standard: true
  },
  {
    id: 'GF-2609-1991', city: 'Halle', region: 'Sachsen-Anhalt', postal: '06108', start: '10.09.2026',
    price: 8300, material: 2760, travel: 280, distance: 176, readiness: 78, complexity: 'Mittel', scope: 'Turnkey',
    title: 'Einfamilienhaus - Einrohrsystem', duration: '5 Tage', bids: 0, color: 'amber',
    tags: ['Einrohrsystem', 'Vorpruefung', 'Zusatzleistung'],
    tasks: ['Rueckbau Gastherme', 'Bypass-Loesung', 'Pumpe je Strang', 'Einregulierung / Abnahme'],
    docs: ['Projektsteckbrief', 'Bestandsfotos', 'Planungshinweis'],
    risks: ['Freigabe des Umbaus noch offen'],
    standard: false
  }
];

const activeProjects = [
  { id: 'GF-2608-1751', city: 'Berlin-Koepenick', title: 'R290 11,4 kW', stage: 'Rohmontage', date: '12.-15.08.', price: 7500, gates: 2, status: 'active' },
  { id: 'GF-2608-1739', city: 'Oranienburg', title: 'R290 8,3 kW', stage: 'Abnahme geplant', date: '16.08.', price: 7500, gates: 4, status: 'review' },
  { id: 'GF-2608-1692', city: 'Falkensee', title: 'R290 14,8 kW', stage: 'Dokumentation', date: '09.-13.08.', price: 8050, gates: 4, status: 'docs' },
  { id: 'GF-2607-1607', city: 'Potsdam', title: 'R290 11,4 kW', stage: 'Abgeschlossen', date: '29.07.-02.08.', price: 7500, gates: 4, status: 'done' }
];

const acceptanceQueue = [
  {
    id: 'GF-2608-1739', city: 'Oranienburg', partner: 'SunKraft Instalacje', slot: '16.08.2026, 09:30',
    checks: [
      ['Foto-Gates vollstaendig', true], ['Hydraulikschema umgesetzt', true], ['Elektroprotokoll hochgeladen', true],
      ['3-Wegeventil Funktion', true], ['Daemmung Endzustand', false], ['Kundenunterlagen', false]
    ], masterShk: 'M. Berger', masterEl: 'A. Yilmaz', status: 'Termin bestaetigt'
  },
  {
    id: 'GF-2608-1692', city: 'Falkensee', partner: 'SunKraft Instalacje', slot: 'Heute, digital',
    checks: [
      ['Foto-Gates vollstaendig', true], ['Hydraulikschema umgesetzt', true], ['Elektroprotokoll hochgeladen', false],
      ['3-Wegeventil Funktion', true], ['Daemmung Endzustand', true], ['Kundenunterlagen', true]
    ], masterShk: 'M. Berger', masterEl: 'A. Yilmaz', status: 'Elektro offen'
  },
  {
    id: 'GF-2608-1688', city: 'Berlin-Spandau', partner: 'Baltic Heat Team', slot: '17.08.2026, 13:00',
    checks: [
      ['Foto-Gates vollstaendig', true], ['Hydraulikschema umgesetzt', false], ['Elektroprotokoll hochgeladen', true],
      ['3-Wegeventil Funktion', false], ['Daemmung Endzustand', false], ['Kundenunterlagen', false]
    ], masterShk: 'M. Berger', masterEl: 'A. Yilmaz', status: 'Vorpruefung'
  }
];

const partnerPipeline = [
  { name: 'TermoPro Sp. z o.o.', country: 'PL', contact: 'Marek Z.', teams: 4, capacity: 20, status: 'Assessment', compliance: 'Vollstaendig', quality: 86 },
  { name: 'Baltic Heat Team OUE', country: 'EE', contact: 'Andres K.', teams: 3, capacity: 15, status: 'Pilot', compliance: 'A1 offen', quality: 91 },
  { name: 'ThermoCraft s.r.o.', country: 'CZ', contact: 'Jan P.', teams: 6, capacity: 30, status: 'Dokumente', compliance: 'Pruefung', quality: 0 },
  { name: 'NordHaus Technik GmbH', country: 'DE', contact: 'F. Weber', teams: 2, capacity: 10, status: 'Certified', compliance: 'Vollstaendig', quality: 95 },
  { name: 'Install Energy SRL', country: 'RO', contact: 'Mihai D.', teams: 5, capacity: 25, status: 'Erstgespraech', compliance: 'Fehlt', quality: 0 }
];
