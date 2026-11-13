// Datas locais no formato AAAA-MM-DD. Semana começa na segunda (0 = Seg).

export const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export const WEEKDAYS_LONG = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
];
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const pad = (n) => String(n).padStart(2, '0');

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return dateKey(parseKey(key)) === key;
}

export function weekdayOf(key) {
  return (parseKey(key).getDay() + 6) % 7;
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function formatDateLong(key) {
  const d = parseKey(key);
  return `${WEEKDAYS_LONG[weekdayOf(key)]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function formatDateShort(key) {
  const d = parseKey(key);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "13/11/2026" → "2026-11-13" (ou null se inválida). */
export function parseBrDate(text) {
  const m = String(text || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const key = `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return isValidKey(key) ? key : null;
}

export function isValidTime(t) {
  return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

/** Normaliza "730" / "7:30" / "07h30" → "07:30" (ou devolve o texto original). */
export function normalizeTime(text) {
  const s = String(text || '').trim().replace(/h/i, ':');
  let m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) m = s.match(/^(\d{1,2})(\d{2})$/);
  if (!m) {
    const h = s.match(/^(\d{1,2})$/);
    if (h) m = [null, h[1], '00'];
  }
  if (!m) return s;
  const t = `${pad(Number(m[1]))}:${m[2]}`;
  return isValidTime(t) ? t : s;
}

export function timeToMinutes(t) {
  if (!isValidTime(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function nowTime(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function daysLabel(days) {
  if (!days || days.length === 0) return 'Nenhum dia';
  if (days.length === 7) return 'Todos os dias';
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join() === '0,1,2,3,4') return 'Seg a Sex';
  if (sorted.join() === '5,6') return 'Fim de semana';
  return sorted.map((d) => WEEKDAYS[d]).join(', ');
}
