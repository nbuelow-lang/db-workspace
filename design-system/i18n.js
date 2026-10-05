// Interface translation. German source text is the key; missing entries fall back to German.
// Only Ukrainian is translated so far (for the site team); stored data is never translated.
const I18n = (() => {
  const locales = {de:'de-DE', en:'en-GB', pl:'pl-PL', cs:'cs-CZ', sk:'sk-SK', sl:'sl-SI', hu:'hu-HU', uk:'uk-UA', ru:'ru-RU'};
  // German needs entries only where a count changes the wording.
  const dictionaries = {de:{'{n} Mitteilungen':['{n} Mitteilung','{n} Mitteilungen'], 'Wartet seit {n} Tagen auf Antwort':['Wartet seit {n} Tag auf Antwort','Wartet seit {n} Tagen auf Antwort'],
    '{n} Dateien in „Netzbetreiber“':['{n} Datei in „Netzbetreiber“','{n} Dateien in „Netzbetreiber“'], '{n} Stromkreise':['{n} Stromkreis','{n} Stromkreise'], '{n} Aufträge':['{n} Auftrag','{n} Aufträge'], '{phase}: {n} Aufträge':['{phase}: {n} Auftrag','{phase}: {n} Aufträge'], '{n} abgeschlossen':['{n} abgeschlossen','{n} abgeschlossen'], '{n} Kunden':['{n} Kunde','{n} Kunden'], '{n} weitere':['{n} weitere','{n} weitere']}, uk: typeof I18N_UK !== 'undefined' ? I18N_UK : {}};
  const missing = new Set();
  const lang = () => (typeof state !== 'undefined' && state?.language) || 'de';
  const locale = () => locales[lang()] || 'de-DE';

  function t(text, vars) {
    const dictionary = dictionaries[lang()];
    let result = text;
    if (dictionary && text) {
      if (Object.hasOwn(dictionary, text)) result = dictionary[text];
      else if (lang() !== 'de') missing.add(text);
    }
    // Plural entries: [one, few, many] chosen by the language's plural rules for {n}.
    if (Array.isArray(result)) {
      const form = new Intl.PluralRules(locale()).select(Number(vars?.n));
      result = result[{one:0, few:1}[form] ?? 2] ?? result[result.length - 1];
    }
    return vars ? result.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(vars, key) ? String(vars[key]) : match) : result;
  }

  // Static markup: elements with data-i18n keep their German source in the attribute.
  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
    root.querySelectorAll('[data-i18n-label]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.i18nLabel)); });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(node => { node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder)); });
    document.documentElement.lang = lang();
  }

  return {t, apply, lang, locale, translated:() => lang() === 'de' || Object.hasOwn(dictionaries, lang()), missing:() => [...missing]};
})();
if (typeof module !== 'undefined') module.exports = I18n;
