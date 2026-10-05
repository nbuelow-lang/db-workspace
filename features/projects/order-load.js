// Load arithmetic for the house-connection survey. A working aid, not an assessment:
// no simultaneity factors, cos φ = 1, symmetrical three-phase load where stated.
const OrderLoad = (() => {
  const threePhase = Math.sqrt(3) * 400;
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const round = (value, digits = 1) => value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

  function compute(survey = {}) {
    const heaterKw = number(survey.heizstab_kw) ?? 0;
    const heaterSingle = survey.heizstab_anschluss === '1 × 230 V';
    const heaterA = heaterSingle ? heaterKw * 1000 / 230 : heaterKw * 1000 / threePhase;
    const fuseA = number(survey.hak_sicherung_a);
    const consumers = (survey.verbraucher || []).filter(row => number(row.kw) != null);
    const kw = rows => rows.reduce((sum, row) => sum + row.kw, 0);
    const three = consumers.filter(row => row.phases === 3), single = consumers.filter(row => row.phases === 1);
    const installedKw = kw(consumers);
    // Worst phase: all single-phase loads assumed on the same conductor as a single-phase heater.
    const worstPhaseA = kw(three) * 1000 / threePhase + kw(single) * 1000 / 230 + heaterA;
    const measuredKw = number(survey.messung_max_kw);
    const capacityKw = fuseA ? threePhase * fuseA / 1000 : null;
    const share = value => capacityKw && value != null ? value / capacityKw : null;
    const missing = [];
    if (!fuseA) missing.push('Hausanschlusssicherung');
    if (!heaterKw) missing.push('Heizstab-Leistung');
    if (measuredKw == null) missing.push('gemessene Maximalleistung');
    return {
      heaterKw, heaterSingle, heaterA: round(heaterA), fuseA, capacityKw: round(capacityKw),
      installedKw: round(installedKw), worstKw: round(installedKw + heaterKw), worstShare: share(installedKw + heaterKw),
      worstPhaseA: round(worstPhaseA), worstPhaseShare: fuseA ? worstPhaseA / fuseA : null,
      measuredKw, measuredPlusKw: measuredKw == null ? null : round(measuredKw + heaterKw), measuredShare: share(measuredKw == null ? null : measuredKw + heaterKw),
      missing
    };
  }
  return {compute};
})();
if (typeof module !== 'undefined') module.exports = OrderLoad;
