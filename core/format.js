// Extracted without behavior changes; see Docs/Modules for ownership.
const swiftReferenceDateOffset = 978307200;

function money(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function escapeAttr(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function initials(name) { return name.split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]).join('').toUpperCase(); }
