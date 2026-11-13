// Sugestões de substituição: calcula porções equivalentes a partir dos valores
// cadastrados (fontes identificadas) e ordena pela semelhança nutricional e
// pelo efeito no total do dia frente às metas. Regras determinísticas, sem
// modelo de linguagem: nenhum valor nutricional é inventado.

import { MACROS, nutrientsFor, refOf, hasValues, categoryOf, addN, zero } from './nutrition.js';
import { foodById, planForWeekday, mealNutrients, mealsForWeekday, hasGoals as hasGoalsSet } from './model.js';

const WEIGHT = { kcal: 1, protein: 1, carbs: 1, fat: 1 };

export function diffN(a, b) {
  return { kcal: b.kcal - a.kcal, protein: b.protein - a.protein, carbs: b.carbs - a.carbs, fat: b.fat - a.fat };
}

/** Porção prática: múltiplos de 5 g/ml (1 g abaixo de 20), meia unidade nas demais unidades. */
export function roundPortion(amount, unit) {
  if (!(amount > 0)) return 0;
  if (unit === 'g' || unit === 'ml') {
    if (amount < 20) return Math.max(1, Math.round(amount));
    return Math.round(amount / 5) * 5;
  }
  return Math.max(0.5, Math.round(amount * 2) / 2);
}

/** Quantidade do candidato que iguala o macro principal da categoria do alimento original. */
export function equivalentPortion(origFood, origAmount, cand) {
  const main = categoryOf(origFood.category).main;
  const n0 = nutrientsFor(refOf(origFood), origAmount);
  const pick = (m) => {
    const per = cand[m] / cand.refAmount;
    return n0[m] > 0 && per > 0 ? n0[m] / per : null;
  };
  const raw = pick(main) ?? pick('kcal');
  if (raw == null) return { amount: null, basis: null };
  return { amount: roundPortion(raw, cand.unit), basis: pick(main) != null ? main : 'kcal' };
}

const KCAL_PER_G = { kcal: 1, protein: 4, carbs: 4, fat: 9 };

/** Distância nutricional: cada diferença convertida em kcal e dividida pelas kcal do original. */
function similarity(n0, n) {
  const base = Math.max(n0.kcal, 50);
  return MACROS.reduce((acc, m) => acc + (WEIGHT[m] * Math.abs(n[m] - n0[m]) * KCAL_PER_G[m]) / base, 0);
}

/** Variação da distância às metas (negativa = aproxima o dia das metas). */
function goalEffect(dayPlan, n0, n, goals) {
  const base = Math.max(n0.kcal, 50);
  let delta = 0;
  let any = false;
  const after = addN(diffN(n0, n), dayPlan);
  for (const m of MACROS) {
    const g = goals?.[m];
    if (g == null) continue;
    any = true;
    delta += ((Math.abs(after[m] - g) - Math.abs(dayPlan[m] - g)) * KCAL_PER_G[m]) / base;
  }
  return { delta: any ? delta : 0, after, any };
}

const MACRO_WORD = { kcal: 'calorias', protein: 'proteínas', carbs: 'carboidratos', fat: 'gorduras' };

function explain(c, n0) {
  const parts = [];
  if (c.basis) {
    parts.push(c.basis === 'kcal'
      ? `Porção com as mesmas calorias (≈${Math.round(n0.kcal)} kcal).`
      : `Porção com a mesma quantidade de ${MACRO_WORD[c.basis]} (≈${Math.round(n0[c.basis])} g).`);
  }
  const notable = MACROS.filter((m) => Math.abs(c.diff[m]) >= (m === 'kcal' ? 25 : 3));
  if (notable.length === 0) parts.push('Perfil nutricional muito parecido.');
  else {
    parts.push(notable.map((m) => `${c.diff[m] > 0 ? '+' : '−'}${Math.round(Math.abs(c.diff[m]))}${m === 'kcal' ? ' kcal' : ` g de ${MACRO_WORD[m]}`}`).join(', ') + '.');
  }
  if (c.goal.any) {
    if (c.goal.delta < -0.05) parts.push('Aproxima o total do dia das suas metas.');
    else if (c.goal.delta > 0.05) parts.push('Afasta o total do dia das suas metas.');
  }
  return parts.join(' ');
}

/**
 * Opções e sugestões para um item de refeição.
 * Retorna { original, planOptions, suggestions, unavailable, error }.
 *  - planOptions: substituições prescritas no plano (quantidade do plano).
 *  - suggestions: alimentos da mesma categoria com porção calculada, ordenados.
 *  - unavailable: candidatos sem valores nutricionais (não entram no cálculo).
 */
export function optionsFor(core, meal, item, { weekday = 0, limit = 6 } = {}) {
  const orig = foodById(core, item.foodId);
  if (!orig) return { error: 'O alimento deste item foi excluído do cadastro.', planOptions: [], suggestions: [], unavailable: [] };
  const n0 = nutrientsFor(refOf(orig), item.amount);
  const origOk = hasValues(orig);
  const dayPlan = meal.days.includes(weekday) ? planForWeekday(core, weekday) : addN(planForWeekday(core, weekday), n0);
  // Com alimentos sem valores no dia, o total planejado está subestimado: as metas não entram na ordenação.
  const dayIncomplete = mealsForWeekday(core, weekday).some((m) => mealNutrients(core, m).incomplete > 0);
  const goals = dayIncomplete ? null : core.goals;

  const build = (food, amount, from) => {
    const n = nutrientsFor(refOf(food), amount);
    const diff = diffN(n0, n);
    const goal = goalEffect(dayPlan, n0, n, goals);
    const c = {
      food, amount, from, n, diff, goal,
      score: similarity(n0, n) + 0.5 * goal.delta,
      complete: hasValues(food),
    };
    return c;
  };

  const unavailable = [];
  const planOptions = [];
  for (const s of item.subs || []) {
    const f = foodById(core, s.foodId);
    if (!f) continue;
    const c = build(f, s.amount, 'plano');
    c.note = s.note || '';
    if (!c.complete) { unavailable.push(c); continue; }
    if (origOk) c.reason = explain({ ...c, basis: null }, n0);
    planOptions.push(c);
  }

  const suggestions = [];
  if (origOk) {
    const taken = new Set([orig.id, ...(item.subs || []).map((s) => s.foodId)]);
    for (const f of core.foods) {
      if (taken.has(f.id) || f.category !== orig.category) continue;
      if (!hasValues(f)) { unavailable.push({ food: f, from: 'app', complete: false }); continue; }
      const { amount, basis } = equivalentPortion(orig, item.amount, f);
      if (!(amount > 0) || (f.unit === 'g' && amount > 1000)) continue;
      const c = build(f, amount, 'app');
      c.basis = basis;
      c.reason = explain(c, n0);
      suggestions.push(c);
    }
    suggestions.sort((a, b) => a.score - b.score);
    planOptions.sort((a, b) => a.score - b.score);
  }

  return {
    original: { food: orig, amount: item.amount, n: n0, complete: origOk },
    goalsIgnored: dayIncomplete && hasGoalsSet(core.goals),
    planOptions,
    suggestions: suggestions.slice(0, limit),
    unavailable,
    error: origOk ? null : 'Este alimento está sem valores nutricionais: não é possível calcular sugestões equivalentes. Preencha os valores pelo rótulo.',
  };
}

/** Comparação detalhada para o painel antes de confirmar uma troca. */
export function compareSwap(core, meal, item, newFood, newAmount, weekday) {
  const orig = foodById(core, item.foodId);
  const n0 = orig ? nutrientsFor(refOf(orig), item.amount) : zero();
  const n = nutrientsFor(refOf(newFood), newAmount);
  const diff = diffN(n0, n);
  const mealBefore = mealNutrients(core, meal).total;
  const mealAfter = addN(mealBefore, diff);
  const dayBefore = planForWeekday(core, weekday);
  const dayAfter = meal.days.includes(weekday) ? addN(dayBefore, diff) : dayBefore;
  return { orig, n0, n, diff, mealBefore, mealAfter, dayBefore, dayAfter, goals: core.goals };
}
