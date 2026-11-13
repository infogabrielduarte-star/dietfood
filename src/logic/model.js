// Regras de negócio puras. Cada operação recebe o estado e devolve
// { state, changed: { core?: true, days?: [datas] }, result? } sem mutar o original.
// Erros de validação são lançados como ValidationError.

import {
  MACROS, UNITS, PREPARATIONS, SOURCES, CATEGORIES, refOf, nutrientsFor, sumN, zero,
  parseNumber, kcalFromMacros, isOver, hasValues,
} from './nutrition.js';
import { isValidTime, timeToMinutes, weekdayOf, isValidKey } from './dates.js';

export const SCHEMA = 1;

export class ValidationError extends Error {
  constructor(errors, message) {
    super(message || Object.values(errors)[0] || 'Dados inválidos');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

let counter = 0;
export function newId(prefix = 'id') {
  counter = (counter + 1) % 1e6;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyCore() {
  return {
    schema: SCHEMA,
    goals: { kcal: null, protein: null, carbs: null, fat: null },
    goalsDemo: false,
    foods: [],
    meals: [],
  };
}

export function emptyState() {
  return { core: emptyCore(), days: {} };
}

export function emptyDay(date) {
  return { date, entries: [], planSnap: null, goalsSnap: null };
}

const ok = (state, changed = {}, result) => ({ state, changed, result });

// ---------- Consultas ----------

export function foodById(core, id) {
  return core.foods.find((f) => f.id === id) || null;
}

/** Refeições com horário vêm em ordem de horário; sem horário, na ordem do plano. */
export function sortMeals(meals) {
  const key = (m) => {
    const t = timeToMinutes(m.time);
    return t != null ? [0, t] : [1, m.order ?? 9999];
  };
  return [...meals].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || a.name.localeCompare(b.name);
  });
}

export function mealsForWeekday(core, wd) {
  return sortMeals(core.meals.filter((m) => m.days.includes(wd)));
}

/** Nutrientes de uma refeição planejada, por alimento e no total. */
export function mealNutrients(core, meal) {
  let missing = 0;
  let incomplete = 0;
  const items = meal.items.map((item) => {
    const food = foodById(core, item.foodId);
    if (!food) missing += 1;
    else if (!hasValues(food)) incomplete += 1;
    const n = food ? nutrientsFor(refOf(food), item.amount) : zero();
    return { item, food, n, complete: !!food && hasValues(food) };
  });
  return { items, total: sumN(items.map((i) => i.n)), missing, incomplete };
}

/** Alimentos usados na dieta (inclusive substituições) que ainda não têm valores. */
export function foodsWithoutValues(core) {
  return core.foods.filter((f) => !hasValues(f));
}

export function entryIncomplete(entry) {
  return entry.items.filter((i) => !hasValues(i.ref)).length;
}

export function planForWeekday(core, wd) {
  const meals = mealsForWeekday(core, wd);
  return sumN(meals.map((m) => mealNutrients(core, m).total));
}

export function entryNutrients(entry) {
  return sumN(entry.items.map((it) => nutrientsFor(it.ref, it.amount)));
}

export function dayConsumed(day) {
  if (!day) return zero();
  return sumN(day.entries.map(entryNutrients));
}

export function entryForMeal(day, mealId) {
  return day ? day.entries.find((e) => e.mealId === mealId) || null : null;
}

export function hasGoals(goals) {
  return MACROS.some((m) => goals[m] != null);
}

/** Situação do dia frente às metas: 'empty' | 'ok' | 'over' | 'nogoal'. */
export function dayStatus(day, goals) {
  if (!day || day.entries.length === 0) return 'empty';
  if (!goals || !hasGoals(goals)) return 'nogoal';
  const c = dayConsumed(day);
  return MACROS.some((m) => isOver(m, c[m], goals[m])) ? 'over' : 'ok';
}

export function foodUsage(core, foodId) {
  return core.meals.filter(
    (m) => m.items.some((i) => i.foodId === foodId || (i.subs || []).some((s) => s.foodId === foodId)),
  );
}

export function hasDemo(state) {
  const { core } = state;
  return core.goalsDemo || core.foods.some((f) => f.demo) || core.meals.some((m) => m.demo);
}

// ---------- Alimentos ----------

/** Valida um formulário de alimento (valores em texto). Não preenche nada sozinho. */
export function validateFood(input, core, editingId = null) {
  const errors = {};
  const warnings = [];
  const name = String(input.name || '').trim();
  if (!name) errors.name = 'Informe o nome do alimento.';
  else if (name.length > 60) errors.name = 'Use no máximo 60 caracteres.';

  const preparation = PREPARATIONS.some((p) => p.value === input.preparation) ? input.preparation : 'na';
  if (name && core.foods.some((f) => f.id !== editingId
      && f.name.trim().toLowerCase() === name.toLowerCase() && (f.preparation || 'na') === preparation)) {
    errors.name = 'Já existe um alimento com esse nome e preparo.';
  }

  if (!UNITS.includes(input.unit)) errors.unit = 'Escolha a unidade.';
  const refAmount = parseNumber(input.refAmount);
  if (!(refAmount > 0)) errors.refAmount = 'Informe a porção de referência (maior que zero).';
  else if (refAmount > 100000) errors.refAmount = 'Valor muito alto.';

  const values = {};
  for (const m of MACROS) {
    const v = parseNumber(input[m]);
    if (Number.isNaN(v)) errors[m] = 'Obrigatório. Se o rótulo indicar zero, digite 0.';
    else if (v < 0) errors[m] = 'Não pode ser negativo.';
    else if (v > (m === 'kcal' ? 100000 : 10000)) errors[m] = 'Valor muito alto.';
    values[m] = v;
  }
  if (!SOURCES.some((s) => s.value === input.source)) errors.source = 'Indique a fonte dos valores.';
  const category = CATEGORIES.some((c) => c.value === input.category) ? input.category : 'outro';

  if (Object.keys(errors).length === 0) {
    const est = kcalFromMacros(values.protein, values.carbs, values.fat);
    const diff = Math.abs(est - values.kcal);
    if (diff > 20 && diff / Math.max(est, values.kcal) > 0.2) {
      warnings.push(
        `As calorias informadas (${Math.round(values.kcal)} kcal) diferem bastante do estimado pelos macros (${Math.round(est)} kcal). Confira os valores.`,
      );
    }
  }

  const value = {
    name,
    preparation,
    unit: input.unit,
    refAmount,
    ...values,
    source: input.source,
    sourceNote: String(input.sourceNote || '').trim().slice(0, 80),
    category,
  };
  return { value, errors, warnings };
}

export function saveFood(state, input, editingId = null) {
  const { value, errors } = validateFood(input, state.core, editingId);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const foods = [...state.core.foods];
  let food;
  if (editingId) {
    const idx = foods.findIndex((f) => f.id === editingId);
    if (idx < 0) throw new ValidationError({ form: 'Alimento não encontrado.' });
    const prev = foods[idx];
    const valuesChanged = ['refAmount', ...MACROS].some((k) => prev[k] !== value[k]);
    // Se você corrigiu os números (ex.: pelo rótulo), deixam de ser estimados.
    food = { ...prev, ...value, ...(valuesChanged ? { estimated: false, dataNote: '' } : {}) };
    foods[idx] = food;
  } else {
    food = { id: newId('food'), ...value, demo: false, estimated: false };
    foods.push(food);
  }
  return ok({ ...state, core: { ...state.core, foods } }, { core: true }, food);
}

export function deleteFood(state, foodId) {
  const used = foodUsage(state.core, foodId);
  if (used.length) {
    throw new ValidationError(
      { form: `Este alimento está em: ${used.map((m) => m.name).join(', ')}. Remova-o dessas refeições antes de excluir.` },
    );
  }
  const foods = state.core.foods.filter((f) => f.id !== foodId);
  return ok({ ...state, core: { ...state.core, foods } }, { core: true });
}

// ---------- Refeições ----------

/**
 * Valida o rascunho de refeição. Quantidades chegam como texto.
 * draft = { name, time, days:[0..6], notes, items:[{ id, foodId, amount, note, subs:[{ id, foodId, amount }] }] }
 */
export function validateMeal(draft, core) {
  const errors = {};
  const name = String(draft.name || '').trim();
  if (!name) errors.name = 'Informe o nome da refeição.';
  else if (name.length > 50) errors.name = 'Use no máximo 50 caracteres.';
  const time = String(draft.time || '').trim() ? draft.time : null;
  if (time != null && !isValidTime(time)) errors.time = 'Use o formato HH:MM (ex.: 07:30) ou deixe em branco.';
  const days = [...new Set(draft.days || [])].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (days.length === 0) errors.days = 'Escolha pelo menos um dia da semana.';
  if (!draft.items || draft.items.length === 0) errors.items = 'Adicione pelo menos um alimento.';

  const items = (draft.items || []).map((it) => {
    const amount = parseNumber(it.amount);
    if (!it.foodId || !foodById(core, it.foodId)) errors[`item:${it.id}:food`] = 'Escolha o alimento.';
    if (!(amount > 0)) errors[`item:${it.id}:amount`] = 'Quantidade maior que zero.';
    const subs = (it.subs || []).map((s) => {
      const sa = parseNumber(s.amount);
      if (!s.foodId || !foodById(core, s.foodId)) errors[`sub:${s.id}:food`] = 'Escolha o alimento substituto.';
      if (!(sa > 0)) errors[`sub:${s.id}:amount`] = 'Quantidade maior que zero.';
      return { id: s.id || newId('sub'), foodId: s.foodId, amount: sa, note: String(s.note || '').trim().slice(0, 60) };
    });
    return {
      id: it.id || newId('item'),
      foodId: it.foodId,
      amount,
      note: String(it.note || '').trim().slice(0, 60),
      subs,
    };
  });

  return {
    value: { name, time, days, items, notes: String(draft.notes || '').trim().slice(0, 1000) },
    errors,
  };
}

export function saveMeal(state, draft, editingId = null) {
  const { value, errors } = validateMeal(draft, state.core);
  if (Object.keys(errors).length) {
    throw new ValidationError(errors, 'Revise os campos destacados.');
  }
  const meals = [...state.core.meals];
  let meal;
  if (editingId) {
    const idx = meals.findIndex((m) => m.id === editingId);
    if (idx < 0) throw new ValidationError({ form: 'Refeição não encontrada.' });
    meal = { ...meals[idx], ...value };
    meals[idx] = meal;
  } else {
    meal = { id: newId('meal'), ...value, demo: false, order: meals.length };
    meals.push(meal);
  }
  return ok({ ...state, core: { ...state.core, meals } }, { core: true }, meal);
}

/** Exclui a refeição, ou só a remove de um dia (onlyDay) quando ela se repete em outros dias. */
export function deleteMeal(state, mealId, onlyDay = null) {
  let meals = state.core.meals;
  const meal = meals.find((m) => m.id === mealId);
  if (!meal) return ok(state);
  if (onlyDay != null && meal.days.length > 1) {
    meals = meals.map((m) => (m.id === mealId ? { ...m, days: m.days.filter((d) => d !== onlyDay) } : m));
  } else {
    meals = meals.filter((m) => m.id !== mealId);
  }
  return ok({ ...state, core: { ...state.core, meals } }, { core: true });
}

function cloneMealItems(items) {
  return items.map((it) => ({
    ...it,
    id: newId('item'),
    subs: (it.subs || []).map((s) => ({ ...s, id: newId('sub') })),
  }));
}

/** Copia as refeições de um dia para outros. mode: 'add' | 'replace'. */
export function copyDay(state, fromWd, toWds, mode = 'add') {
  const targets = [...new Set(toWds)].filter((d) => d !== fromWd && d >= 0 && d <= 6);
  if (targets.length === 0) throw new ValidationError({ days: 'Escolha pelo menos um dia de destino.' });
  const source = mealsForWeekday(state.core, fromWd);
  if (source.length === 0) throw new ValidationError({ form: 'Não há refeições neste dia para copiar.' });
  let meals = state.core.meals;
  if (mode === 'replace') {
    meals = meals
      .map((m) => ({ ...m, days: m.days.filter((d) => !targets.includes(d)) }))
      .filter((m) => m.days.length > 0);
  }
  const copies = [];
  for (const wd of targets) {
    for (const m of source) {
      copies.push({ ...m, id: newId('meal'), days: [wd], items: cloneMealItems(m.items), reference: m.reference || null });
    }
  }
  return ok({ ...state, core: { ...state.core, meals: [...meals, ...copies] } }, { core: true }, copies.length);
}

export function mealDraftFrom(meal, overrides = {}) {
  return {
    name: meal.name,
    time: meal.time || '',
    days: [...meal.days],
    notes: meal.notes || '',
    items: meal.items.map((it) => ({
      id: newId('item'),
      foodId: it.foodId,
      amount: String(it.amount).replace('.', ','),
      note: it.note || '',
      subs: (it.subs || []).map((s) => ({ id: newId('sub'), foodId: s.foodId, amount: String(s.amount).replace('.', ','), note: s.note || '' })),
    })),
    ...overrides,
  };
}

// ---------- Metas ----------

const GOAL_MAX = { kcal: 20000, protein: 2000, carbs: 3000, fat: 1000 };

export function validateGoals(input) {
  const errors = {};
  const goals = {};
  for (const m of MACROS) {
    const raw = String(input[m] ?? '').trim();
    if (!raw) { goals[m] = null; continue; }
    const v = parseNumber(raw);
    if (Number.isNaN(v)) errors[m] = 'Número inválido.';
    else if (v < 0) errors[m] = 'Não pode ser negativo.';
    else if (v > GOAL_MAX[m]) errors[m] = 'Valor muito alto.';
    goals[m] = v;
  }
  return { goals, errors };
}

export function setGoals(state, input) {
  const { goals, errors } = validateGoals(input);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return ok({ ...state, core: { ...state.core, goals, goalsDemo: false, goalsSource: 'Definidas por você' } }, { core: true });
}

// ---------- Registros de consumo ----------

/** Cópia fixa do alimento no momento do registro: a dieta pode mudar depois sem afetar o histórico. */
export function snapshotItem(food, amount, extra = {}) {
  return {
    id: newId('ci'),
    foodId: food.id,
    name: food.name,
    preparation: food.preparation || 'na',
    unit: food.unit,
    amount,
    ref: refOf(food),
    demo: !!food.demo,
    source: food.sourceNote || '',
    ...extra,
  };
}

function putDay(state, date, day) {
  return { ...state, days: { ...state.days, [date]: day } };
}

/** Registro rápido: "Comi conforme a dieta". Bloqueia duplicidade. */
export function registerAsPlanned(state, date, mealId, time) {
  if (!isValidKey(date)) throw new ValidationError({ form: 'Data inválida.' });
  const meal = state.core.meals.find((m) => m.id === mealId);
  if (!meal) throw new ValidationError({ form: 'Refeição não encontrada na dieta.' });
  const day = state.days[date] || emptyDay(date);
  if (entryForMeal(day, mealId)) {
    throw new ValidationError({ duplicate: 'Esta refeição já foi registrada neste dia.' });
  }
  const items = [];
  for (const it of meal.items) {
    const food = foodById(state.core, it.foodId);
    if (food) items.push(snapshotItem(food, it.amount, { planItemId: it.id }));
  }
  if (items.length === 0) throw new ValidationError({ form: 'A refeição não tem alimentos válidos para registrar.' });
  const now = Date.now();
  const entry = {
    id: newId('entry'),
    mealId,
    name: meal.name,
    time: time || meal.time || '12:00',
    kind: 'plan',
    createdAt: now,
    updatedAt: now,
    items,
  };
  const next = putDay(state, date, { ...day, entries: [...day.entries, entry] });
  return ok(next, { days: [date] }, entry);
}

/**
 * Salva um registro novo ou editado.
 * entryInput = { id?, mealId|null, name, time, kind, items:[snapshotItem com amount numérico] }
 */
export function saveEntry(state, date, entryInput) {
  if (!isValidKey(date)) throw new ValidationError({ form: 'Data inválida.' });
  const errors = {};
  const name = String(entryInput.name || '').trim();
  if (!name) errors.name = 'Informe um nome para o registro.';
  if (!isValidTime(entryInput.time)) errors.time = 'Horário no formato HH:MM.';
  const items = entryInput.items || [];
  if (items.length === 0) errors.items = 'Inclua pelo menos um alimento. Para apagar o registro, use "Desfazer registro".';
  items.forEach((it) => {
    if (!(it.amount > 0)) errors[`amount:${it.id}`] = 'Quantidade maior que zero.';
    if (!it.ref || !(it.ref.refAmount > 0)) errors[`amount:${it.id}`] = 'Alimento sem referência nutricional.';
  });
  if (Object.keys(errors).length) throw new ValidationError(errors, 'Revise os campos destacados.');

  const day = state.days[date] || emptyDay(date);
  const now = Date.now();
  let entries;
  let entry;
  const idx = entryInput.id ? day.entries.findIndex((e) => e.id === entryInput.id) : -1;
  if (idx >= 0) {
    entry = { ...day.entries[idx], name, time: entryInput.time, items, updatedAt: now };
    entries = day.entries.map((e, i) => (i === idx ? entry : e));
  } else {
    if (entryInput.mealId && entryForMeal(day, entryInput.mealId)) {
      throw new ValidationError({ duplicate: 'Esta refeição já foi registrada neste dia.' });
    }
    entry = {
      id: entryInput.id || newId('entry'),
      mealId: entryInput.mealId || null,
      name,
      time: entryInput.time,
      kind: entryInput.mealId ? 'plan' : 'extra',
      createdAt: entryInput.createdAt || now,
      updatedAt: now,
      items,
    };
    entries = [...day.entries, entry];
  }
  return ok(putDay(state, date, { ...day, entries }), { days: [date] }, entry);
}

export function deleteEntry(state, date, entryId) {
  const day = state.days[date];
  if (!day) return ok(state);
  const removed = day.entries.find((e) => e.id === entryId) || null;
  if (!removed) return ok(state);
  const entries = day.entries.filter((e) => e.id !== entryId);
  return ok(putDay(state, date, { ...day, entries }), { days: [date] }, removed);
}

export function sortEntries(entries) {
  return [...entries].sort(
    (a, b) => (timeToMinutes(a.time) ?? 0) - (timeToMinutes(b.time) ?? 0) || a.createdAt - b.createdAt,
  );
}

/**
 * Mantém o retrato do dia de hoje (planejado e metas) atualizado.
 * Dias passados conservam o retrato que tinham.
 */
export function refreshTodaySnapshot(state, today) {
  const day = state.days[today];
  if (!day) return { state, changed: false };
  const planSnap = planForWeekday(state.core, weekdayOf(today));
  const goalsSnap = { ...state.core.goals };
  const same = (a, b) => a && b && MACROS.every((m) => a[m] === b[m]);
  if (same(day.planSnap, planSnap) && same(day.goalsSnap, goalsSnap)) return { state, changed: false };
  return { state: putDay(state, today, { ...day, planSnap, goalsSnap }), changed: true };
}

// ---------- Dados de demonstração ----------

import { DEMO_FOODS, DEMO_MEALS, DEMO_GOALS } from './demo.js';

export function loadDemo(state) {
  const core = state.core;
  const foodIds = new Set(core.foods.map((f) => f.id));
  const mealIds = new Set(core.meals.map((m) => m.id));
  const foods = [...core.foods, ...DEMO_FOODS.filter((f) => !foodIds.has(f.id)).map((f) => ({ ...f, demo: true }))];
  const meals = [...core.meals, ...DEMO_MEALS.filter((m) => !mealIds.has(m.id)).map((m) => ({ ...m, demo: true }))];
  const useDemoGoals = !hasGoals(core.goals);
  const next = {
    ...core,
    foods,
    meals,
    goals: useDemoGoals ? { ...DEMO_GOALS } : core.goals,
    goalsDemo: useDemoGoals ? true : core.goalsDemo,
  };
  return ok({ ...state, core: next }, { core: true });
}

/** Remove tudo o que é demonstração, inclusive itens de demonstração em registros. */
export function removeDemo(state) {
  const demoFoodIds = new Set(state.core.foods.filter((f) => f.demo).map((f) => f.id));
  const meals = state.core.meals
    .filter((m) => !m.demo)
    .map((m) => ({
      ...m,
      items: m.items
        .filter((i) => !demoFoodIds.has(i.foodId))
        .map((i) => ({ ...i, subs: (i.subs || []).filter((s) => !demoFoodIds.has(s.foodId)) })),
    }));
  const core = {
    ...state.core,
    foods: state.core.foods.filter((f) => !f.demo),
    meals,
    goals: state.core.goalsDemo ? emptyCore().goals : state.core.goals,
    goalsDemo: false,
  };
  const days = { ...state.days };
  const changedDays = [];
  for (const [date, day] of Object.entries(state.days)) {
    if (!day.entries.some((e) => e.items.some((i) => i.demo))) continue;
    const entries = day.entries
      .map((e) => ({ ...e, items: e.items.filter((i) => !i.demo) }))
      .filter((e) => e.items.length > 0);
    days[date] = { ...day, entries };
    changedDays.push(date);
  }
  return ok({ core, days }, { core: true, days: changedDays });
}

// ---------- Cópia de segurança ----------

export function exportData(state, now = new Date()) {
  return JSON.stringify({
    app: 'dietfood',
    schema: SCHEMA,
    exportedAt: now.toISOString(),
    core: state.core,
    days: Object.values(state.days),
  });
}

const isNum = (v) => typeof v === 'number' && isFinite(v) && v >= 0;

/** Lê e valida um backup. Lança ValidationError com a causa. */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(String(text || '').trim());
  } catch {
    throw new ValidationError({ form: 'O texto colado não é um backup válido (JSON inválido).' });
  }
  if (!data || data.app !== 'dietfood' || !data.core) {
    throw new ValidationError({ form: 'Este arquivo não é um backup do Dietfood.' });
  }
  if (data.schema > SCHEMA) {
    throw new ValidationError({ form: 'Backup criado por uma versão mais nova do Dietfood.' });
  }
  const c = data.core;
  if (!Array.isArray(c.foods) || !Array.isArray(c.meals) || !c.goals) {
    throw new ValidationError({ form: 'Backup incompleto: faltam alimentos, refeições ou metas.' });
  }
  for (const f of c.foods) {
    if (!f.id || !f.name || !(f.refAmount > 0) || !MACROS.every((m) => f[m] === null || isNum(f[m]))) {
      throw new ValidationError({ form: `Alimento inválido no backup: ${f.name || f.id || '?'}.` });
    }
  }
  for (const m of c.meals) {
    if (!m.id || !m.name || !Array.isArray(m.items) || !Array.isArray(m.days)) {
      throw new ValidationError({ form: `Refeição inválida no backup: ${m.name || m.id || '?'}.` });
    }
  }
  const days = {};
  for (const d of Array.isArray(data.days) ? data.days : []) {
    if (!d || !isValidKey(d.date) || !Array.isArray(d.entries)) {
      throw new ValidationError({ form: 'Há um dia inválido no histórico do backup.' });
    }
    for (const e of d.entries) {
      if (!Array.isArray(e.items) || e.items.some((i) => !i.ref || !(i.ref.refAmount > 0) || !isNum(i.amount))) {
        throw new ValidationError({ form: `Registro inválido em ${d.date}.` });
      }
    }
    days[d.date] = d;
  }
  const core = { ...emptyCore(), ...c, goals: { ...emptyCore().goals, ...c.goals } };
  return { core, days };
}

// ---------- Trocas (substituições) ----------

/**
 * Troca um alimento na DIETA PLANEJADA. O alimento anterior vira uma opção de
 * substituição do item, para não se perder. Registros já feitos não mudam.
 */
export function swapInPlan(state, mealId, itemId, newFoodId, newAmount) {
  const food = foodById(state.core, newFoodId);
  if (!food) throw new ValidationError({ form: 'Alimento não encontrado.' });
  if (!(newAmount > 0)) throw new ValidationError({ amount: 'Quantidade maior que zero.' });
  let found = false;
  const meals = state.core.meals.map((m) => {
    if (m.id !== mealId) return m;
    return {
      ...m,
      items: m.items.map((it) => {
        if (it.id !== itemId) return it;
        found = true;
        const subs = (it.subs || []).filter((x) => x.foodId !== newFoodId);
        if (it.foodId !== newFoodId) subs.unshift({ id: newId('sub'), foodId: it.foodId, amount: it.amount });
        return { ...it, foodId: newFoodId, amount: newAmount, note: it.foodId === newFoodId ? it.note : '', subs };
      }),
    };
  });
  if (!found) throw new ValidationError({ form: 'Item da refeição não encontrado.' });
  return ok({ ...state, core: { ...state.core, meals } }, { core: true });
}

/**
 * Usa a troca só no CONSUMO de uma data. Se a refeição ainda não foi registrada,
 * registra a refeição com a troca; se já foi, troca o item no registro existente.
 */
export function registerWithSwap(state, date, mealId, itemId, newFoodId, newAmount, time) {
  const meal = state.core.meals.find((m) => m.id === mealId);
  const item = meal?.items.find((i) => i.id === itemId);
  const food = foodById(state.core, newFoodId);
  if (!meal || !item || !food) throw new ValidationError({ form: 'Refeição ou alimento não encontrado.' });
  if (!(newAmount > 0)) throw new ValidationError({ amount: 'Quantidade maior que zero.' });
  const orig = foodById(state.core, item.foodId);
  const swapped = snapshotItem(food, newAmount, {
    planItemId: itemId,
    ...(item.foodId !== newFoodId && orig ? { substitutedFor: orig.name } : {}),
  });
  const day = state.days[date] || emptyDay(date);
  const existing = entryForMeal(day, mealId);
  if (existing) {
    let idx = existing.items.findIndex((i) => i.planItemId === itemId);
    if (idx < 0) idx = existing.items.findIndex((i) => !i.planItemId && i.foodId === item.foodId && !i.substitutedFor);
    const items = idx < 0 ? [...existing.items, swapped] : existing.items.map((it, i) => (i === idx ? swapped : it));
    return saveEntry(state, date, { ...existing, items });
  }
  const items = [];
  for (const it of meal.items) {
    if (it.id === itemId) { items.push(swapped); continue; }
    const f = foodById(state.core, it.foodId);
    if (f) items.push(snapshotItem(f, it.amount, { planItemId: it.id }));
  }
  return saveEntry(state, date, { mealId, name: meal.name, time: time || meal.time || '12:00', items });
}

// ---------- Importação do plano alimentar ----------

/**
 * Adiciona alimentos, refeições e metas de um plano (sem duplicar o que já existe).
 * Se o plano já foi importado numa versão anterior (plan.id diferente), atualiza as
 * refeições do plano para a versão nova (mantendo os horários que você definiu),
 * completa valores nutricionais que estavam pendentes e retira os alimentos removidos.
 * Registros de consumo (histórico) nunca são alterados.
 */
export function importPlan(state, plan, { setGoalsFromPlan = true } = {}) {
  const core = state.core;
  const upgrade = !!core.planImported && core.planImported !== plan.id;
  const removed = new Set(plan.removedFoodIds || []);
  const planFoods = new Map(plan.foods.map((f) => [f.id, f]));
  const planMeals = new Map(plan.meals.map((m) => [m.id, m]));

  let foods = core.foods.map((f) => {
    const pf = planFoods.get(f.id);
    return pf && !hasValues(f) && hasValues(pf) ? { ...f, ...pf } : f; // completa pendências
  });
  const have = new Set(foods.map((f) => f.id));
  foods = [...foods, ...plan.foods.filter((f) => !have.has(f.id)).map((f) => ({ demo: false, ...f }))];

  const base = core.meals.length;
  let meals = core.meals.map((m) => {
    const pm = planMeals.get(m.id);
    if (!pm) return m;
    if (upgrade) return { ...m, ...pm, time: m.time || pm.time, days: m.days, order: m.order };
    return !m.time && pm.time ? { ...m, time: pm.time } : m;
  });
  const mealIds = new Set(meals.map((m) => m.id));
  meals = [...meals, ...plan.meals.filter((m) => !mealIds.has(m.id)).map((m, i) => ({ demo: false, order: base + i, ...m }))];

  // Alimentos removidos: saem das substituições; itens principais só saem se o plano novo não os usa.
  if (removed.size) {
    meals = meals.map((m) => ({
      ...m,
      items: m.items
        .filter((it) => !removed.has(it.foodId))
        .map((it) => ({ ...it, subs: (it.subs || []).filter((s) => !removed.has(s.foodId)) })),
    }));
    foods = foods.filter((f) => !removed.has(f.id));
  }

  const replaceGoals = setGoalsFromPlan && (!hasGoals(core.goals) || core.goalsDemo);
  return ok({
    ...state,
    core: {
      ...core,
      foods,
      meals,
      goals: replaceGoals ? { ...plan.goals } : core.goals,
      goalsDemo: replaceGoals ? false : core.goalsDemo,
      goalsSource: replaceGoals ? plan.goalsSource : core.goalsSource,
      planImported: plan.id,
    },
  }, { core: true });
}

/** Troca um item de um registro de consumo já feito (só aquele dia). */
export function swapEntryItem(state, date, entryId, entryItemId, newFoodId, newAmount) {
  const day = state.days[date];
  const entry = day?.entries.find((e) => e.id === entryId);
  const food = foodById(state.core, newFoodId);
  if (!entry || !food) throw new ValidationError({ form: 'Registro ou alimento não encontrado.' });
  if (!(newAmount > 0)) throw new ValidationError({ amount: 'Quantidade maior que zero.' });
  const items = entry.items.map((it) => {
    if (it.id !== entryItemId) return it;
    if (it.foodId === newFoodId) return { ...it, amount: newAmount };
    return snapshotItem(food, newAmount, {
      planItemId: it.planItemId,
      substitutedFor: it.substitutedFor || it.name,
    });
  });
  return saveEntry(state, date, { ...entry, items });
}
