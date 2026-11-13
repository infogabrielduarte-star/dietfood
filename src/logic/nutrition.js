// Cálculo nutricional e formatação (sem dependências de React Native).

export const MACROS = ['kcal', 'protein', 'carbs', 'fat'];

export const MACRO_LABEL = {
  kcal: 'Calorias',
  protein: 'Proteínas',
  carbs: 'Carboidratos',
  fat: 'Gorduras',
};

export const MACRO_SHORT = { kcal: 'kcal', protein: 'P', carbs: 'C', fat: 'G' };
export const MACRO_UNIT = { kcal: 'kcal', protein: 'g', carbs: 'g', fat: 'g' };

export const UNITS = ['g', 'ml', 'unid', 'fatia', 'colher', 'xícara', 'scoop', 'porção'];

export const PREPARATIONS = [
  { value: 'na', label: 'Não se aplica' },
  { value: 'cru', label: 'Cru' },
  { value: 'cozido', label: 'Cozido' },
];

export const SOURCES = [
  { value: 'rotulo', label: 'Rótulo' },
  { value: 'tabela', label: 'Tabela de composição' },
  { value: 'manual', label: 'Outra / manual' },
];

export const zero = () => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

/** Referência nutricional de um alimento (o que é copiado nos registros). */
export function refOf(food) {
  return {
    refAmount: food.refAmount,
    kcal: food.kcal,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
  };
}

/** Valor calculado = valor de referência × (quantidade ÷ porção de referência). */
export function nutrientsFor(ref, amount) {
  if (!ref || !(ref.refAmount > 0) || !(amount >= 0)) return zero();
  const f = amount / ref.refAmount;
  // Valor indisponível (null) não é inventado: conta como 0 e a tela avisa que o total é parcial.
  return {
    kcal: (ref.kcal ?? 0) * f,
    protein: (ref.protein ?? 0) * f,
    carbs: (ref.carbs ?? 0) * f,
    fat: (ref.fat ?? 0) * f,
  };
}

/** true quando os quatro valores nutricionais existem. */
export function hasValues(x) {
  return !!x && MACROS.every((m) => typeof x[m] === 'number' && isFinite(x[m]));
}

export const CATEGORIES = [
  { value: 'proteina', label: 'Proteína', main: 'protein' },
  { value: 'carboidrato', label: 'Carboidrato', main: 'carbs' },
  { value: 'leguminosa', label: 'Leguminosa', main: 'carbs' },
  { value: 'fruta', label: 'Fruta', main: 'carbs' },
  { value: 'laticinio', label: 'Laticínio', main: 'protein' },
  { value: 'gordura', label: 'Gordura', main: 'fat' },
  { value: 'vegetal', label: 'Vegetal', main: 'kcal' },
  { value: 'doce', label: 'Doce', main: 'kcal' },
  { value: 'outro', label: 'Outro', main: 'kcal' },
];
export const categoryOf = (v) => CATEGORIES.find((c) => c.value === v) || CATEGORIES[CATEGORIES.length - 1];

export function addN(a, b) {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function sumN(list) {
  return list.reduce(addN, zero());
}

/** Arredonda como é exibido: kcal inteiro, gramas com 1 casa. */
export function roundFor(macro, n) {
  return macro === 'kcal' ? Math.round(n) : Math.round(n * 10) / 10;
}

/** Meta ultrapassada, comparando os valores como aparecem na tela. */
export function isOver(macro, consumed, goal) {
  if (goal == null) return false;
  return roundFor(macro, consumed) > roundFor(macro, goal);
}

/** Formata número no padrão brasileiro sem depender de Intl. */
export function formatNumber(n, decimals = 0) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  const factor = 10 ** decimals;
  const rounded = Math.round(Math.abs(n) * factor) / factor;
  const neg = n < 0 && rounded !== 0;
  let [int, dec] = rounded.toFixed(decimals).split('.');
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (dec) dec = dec.replace(/0+$/, '');
  return (neg ? '-' : '') + int + (dec ? ',' + dec : '');
}

export const fmtKcal = (n) => formatNumber(n, 0);
export const fmtG = (n) => formatNumber(n, 1);
export const fmtAmount = (n) => formatNumber(n, 2);
export const fmtMacro = (macro, n) => (macro === 'kcal' ? fmtKcal(n) : fmtG(n));

/**
 * Converte texto digitado em número. Aceita vírgula ou ponto decimal.
 * Retorna NaN para texto vazio ou inválido (nunca inventa um valor).
 */
export function parseNumber(text) {
  if (typeof text === 'number') return text;
  let s = String(text ?? '').trim().replace(/\s+/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  // "2.000" no padrão brasileiro é dois mil, não dois.
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

/** kcal estimadas pelos fatores de Atwater (4/4/9). */
export function kcalFromMacros(protein, carbs, fat) {
  return protein * 4 + carbs * 4 + fat * 9;
}
