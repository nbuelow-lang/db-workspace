// Extracted without behavior changes; see Docs/Modules for ownership.
function projectNet(project) {
  return project.price - project.material - project.travel;
}

function projectAIScore(project) {
  if (Number.isFinite(project.aiScore)) return Math.max(0, Math.min(100, Math.round(project.aiScore)));
  let score = 68;
  score += Math.round((Number(project.readiness) || 0) * 0.18);
  if (project.distance <= 80) score += 7;
  else if (project.distance <= 150) score += 4;
  if (project.price >= 8000) score += 4;
  if (project.duration && /3/.test(project.duration)) score += 3;
  if (project.standard) score += 3;
  if (/Sonderfall|Hybrid|Einrohr/i.test(project.complexity + ' ' + project.title)) score -= 8;
  if ((project.risks || []).some(risk => /offen|komplex|eng|Uebernachtung|Übernachtung/i.test(risk))) score -= 5;
  return Math.max(54, Math.min(98, score));
}

function projectAITone(project) {
  const score = projectAIScore(project);
  if (score >= 90) return 'green';
  if (score >= 80) return 'blue';
  if (score >= 70) return 'amber';
  return 'red';
}

function projectAITitle(project) {
  const score = projectAIScore(project);
  if (score >= 90) return 'Top Match';
  if (score >= 80) return 'Sehr passend';
  if (score >= 70) return 'Vorab pruefen';
  return 'Risiko klaeren';
}

function projectAISummary(project) {
  if (project.aiSummary) return project.aiSummary;
  const score = projectAIScore(project);
  if (score >= 90) return 'Hohe Baustellenreife, klarer Umfang und gute Kalkulationsbasis.';
  if (score >= 80) return 'Solider Fit mit wenigen Punkten fuer die technische Rueckfrage.';
  if (score >= 70) return 'Interessant, aber Termin, Risiko oder Umfang vor Angebot klaeren.';
  return 'Nur nach Projektkoordination und sauberer Risikoannahme anbieten.';
}

function projectAIFactors(project) {
  if (Array.isArray(project.aiFactors) && project.aiFactors.length) return project.aiFactors;
  const factors = [`${project.readiness}% Baustellenreife`, `${project.distance} km`, money(project.price)];
  if (project.standard) factors.push('Standardpaket');
  if (project.scope) factors.push(project.scope);
  if ((project.risks || []).length) factors.push((project.risks || [])[0]);
  return factors;
}

function averageAIScore(items) {
  if (!items.length) return 0;
  return Math.round(items.reduce((sum, project) => sum + projectAIScore(project), 0) / items.length);
}
