import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nutrientsFor, parseNumber, formatNumber, isOver, fmtKcal, fmtG,
} from '../src/logic/nutrition.js';
import {
  weekdayOf, addDays, normalizeTime, parseBrDate, isValidKey, daysLabel,
} from '../src/logic/dates.js';
import * as M from '../src/logic/model.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

const foodForm = (o = {}) => ({
  name: 'Arroz', preparation: 'cozido', unit: 'g', refAmount: '100',
  kcal: '128', protein: '2,5', carbs: '28,1', fat: '0,2', source: 'rotulo', ...o,
});

function setup() {
  let s = M.emptyState();
  s = M.saveFood(s, foodForm()).state;
  s = M.saveFood(s, foodForm({ name: 'Frango', kcal: '159', protein: '32', carbs: '0', fat: '2,5' })).state;
  s = M.saveFood(s, foodForm({ name: 'Ovo', preparation: 'na', unit: 'unid', refAmount: '1', kcal: '73', protein: '6,7', carbs: '0,3', fat: '4,8' })).state;
  const [arroz, frango, ovo] = s.core.foods;
  const r = M.saveMeal(s, {
    name: 'Almoço', time: '12:30', days: [0, 1, 2, 3, 4], notes: '',
    items: [
      { id: 'i1', foodId: arroz.id, amount: '150', note: '', subs: [{ id: 's1', foodId: ovo.id, amount: '2' }] },
      { id: 'i2', foodId: frango.id, amount: '120', note: '' },
    ],
  });
  return { s: r.state, meal: r.result, arroz, frango, ovo };
}

test('cálculo proporcional', () => {
  const ref = { refAmount: 100, kcal: 128, protein: 2.5, carbs: 28.1, fat: 0.2 };
  const n = nutrientsFor(ref, 150);
  close(n.kcal, 192); close(n.protein, 3.75); close(n.carbs, 42.15); close(n.fat, 0.3);
  close(nutrientsFor({ refAmount: 1, kcal: 73, protein: 6.7, carbs: 0.3, fat: 4.8 }, 2).kcal, 146);
  assert.equal(nutrientsFor(ref, 0).kcal, 0);
});

test('números em português', () => {
  assert.equal(parseNumber('2,5'), 2.5);
  assert.equal(parseNumber('1.234,5'), 1234.5);
  assert.equal(parseNumber(' 150 '), 150);
  assert.ok(Number.isNaN(parseNumber('')));
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.ok(Number.isNaN(parseNumber('-3')));
  assert.equal(formatNumber(1234.56, 1), '1.234,6');
  assert.equal(fmtKcal(1999.6), '2.000');
  assert.equal(fmtG(3.75), '3,8');
  assert.equal(fmtG(30), '30');
});

test('meta ultrapassada compara valores exibidos', () => {
  assert.equal(isOver('kcal', 2000.4, 2000), false);
  assert.equal(isOver('kcal', 2000.6, 2000), true);
  assert.equal(isOver('protein', 150.04, 150), false);
  assert.equal(isOver('protein', 150.1, 150), true);
  assert.equal(isOver('fat', 999, null), false);
});

test('datas', () => {
  assert.equal(weekdayOf('2026-11-13'), 4); // sexta
  assert.equal(weekdayOf('2026-11-16'), 0); // segunda
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(normalizeTime('730'), '07:30');
  assert.equal(normalizeTime('7h30'), '07:30');
  assert.equal(normalizeTime('25:00'), '25:00');
  assert.equal(parseBrDate('13/11/2026'), '2026-11-13');
  assert.equal(parseBrDate('31/02/2026'), null);
  assert.equal(isValidKey('2026-02-30'), false);
  assert.equal(daysLabel([0, 1, 2, 3, 4]), 'Seg a Sex');
});

test('validação de alimento', () => {
  const s = M.emptyState();
  const r = M.validateFood(foodForm({ name: '', kcal: '', refAmount: '0' }), s.core);
  assert.ok(r.errors.name && r.errors.kcal && r.errors.refAmount);
  const w = M.validateFood(foodForm({ kcal: '500' }), s.core);
  assert.equal(Object.keys(w.errors).length, 0);
  assert.equal(w.warnings.length, 1);
  const { s: s2 } = setup();
  assert.ok(M.validateFood(foodForm(), s2.core).errors.name, 'duplicado');
  assert.ok(!M.validateFood(foodForm({ preparation: 'cru' }), s2.core).errors.name, 'cru ≠ cozido');
});

test('totais de refeição e do dia planejado', () => {
  const { s, meal } = setup();
  const mn = M.mealNutrients(s.core, meal);
  close(mn.total.kcal, 192 + 190.8);
  close(mn.total.protein, 3.75 + 38.4);
  close(M.planForWeekday(s.core, 0).kcal, 382.8);
  assert.equal(M.planForWeekday(s.core, 5).kcal, 0); // sábado sem a refeição
});

test('validação de refeição', () => {
  const { s, arroz } = setup();
  assert.throws(() => M.saveMeal(s, { name: '', time: '25:00', days: [], items: [] }), (e) => {
    assert.ok(e.errors.name && e.errors.time && e.errors.days && e.errors.items);
    return true;
  });
  assert.throws(() => M.saveMeal(s, {
    name: 'X', time: '10:00', days: [1], items: [{ id: 'a', foodId: arroz.id, amount: '0' }],
  }), (e) => !!e.errors['item:a:amount']);
});

test('registro rápido, duplicidade e desfazer', () => {
  const { s, meal } = setup();
  const date = '2026-11-16';
  const r = M.registerAsPlanned(s, date, meal.id, '12:40');
  close(M.dayConsumed(r.state.days[date]).kcal, 382.8);
  assert.throws(() => M.registerAsPlanned(r.state, date, meal.id), (e) => !!e.errors.duplicate);
  assert.throws(() => M.saveEntry(r.state, date, { mealId: meal.id, name: 'A', time: '12:00', items: r.result.items }),
    (e) => !!e.errors.duplicate);
  const u = M.deleteEntry(r.state, date, r.result.id);
  assert.equal(M.dayConsumed(u.state.days[date]).kcal, 0);
  // desfazer a exclusão restaura o mesmo registro
  const back = M.saveEntry(u.state, date, u.result);
  close(M.dayConsumed(back.state.days[date]).kcal, 382.8);
});

test('ajuste de porção, substituição e extra recalculam o total', () => {
  const { s, meal, ovo, frango } = setup();
  const date = '2026-11-16';
  const r = M.registerAsPlanned(s, date, meal.id);
  const e = r.result;
  const items = [
    M.snapshotItem(ovo, 2, { substitutedFor: 'Arroz' }), // substitui o arroz
    { ...e.items[1], amount: 60 }, // metade do frango
    M.snapshotItem(frango, 50), // extra
  ];
  const r2 = M.saveEntry(r.state, date, { ...e, items });
  close(M.dayConsumed(r2.state.days[date]).kcal, 146 + 95.4 + 79.5);
  assert.equal(r2.state.days[date].entries.length, 1);
});

test('editar a dieta não altera o histórico', () => {
  const { s, meal, arroz } = setup();
  const date = '2026-11-16';
  const r = M.registerAsPlanned(s, date, meal.id);
  const before = M.dayConsumed(r.state.days[date]).kcal;
  let s2 = M.saveFood(r.state, foodForm({ kcal: '999' }), arroz.id).state;
  s2 = M.deleteMeal(s2, meal.id).state;
  close(M.dayConsumed(s2.days[date]).kcal, before);
  assert.equal(s2.days[date].entries[0].items[0].name, 'Arroz');
});

test('alimento em uso não pode ser excluído', () => {
  const { s, arroz, ovo } = setup();
  assert.throws(() => M.deleteFood(s, arroz.id));
  assert.throws(() => M.deleteFood(s, ovo.id)); // usado como substituição
});

test('retrato do dia de hoje acompanha dieta e metas', () => {
  const { s, meal } = setup();
  const today = '2026-11-16';
  let st = M.registerAsPlanned(s, today, meal.id).state;
  let r = M.refreshTodaySnapshot(st, today);
  assert.equal(r.changed, true);
  close(r.state.days[today].planSnap.kcal, 382.8);
  assert.equal(M.refreshTodaySnapshot(r.state, today).changed, false);
  st = M.setGoals(r.state, { kcal: '2000', protein: '', carbs: '', fat: '' }).state;
  r = M.refreshTodaySnapshot(st, today);
  assert.equal(r.state.days[today].goalsSnap.kcal, 2000);
});

test('copiar dia (adicionar e substituir)', () => {
  const { s } = setup();
  const add = M.copyDay(s, 0, [5, 6], 'add');
  assert.equal(add.result, 2);
  assert.equal(M.mealsForWeekday(add.state.core, 5).length, 1);
  const rep = M.copyDay(add.state, 0, [1], 'replace');
  assert.equal(M.mealsForWeekday(rep.state.core, 1).length, 1);
  assert.equal(M.mealsForWeekday(rep.state.core, 0).length, 1);
  assert.throws(() => M.copyDay(s, 6, [1]));
});

test('excluir refeição só de um dia', () => {
  const { s, meal } = setup();
  const r = M.deleteMeal(s, meal.id, 2);
  assert.deepEqual(r.state.core.meals[0].days, [0, 1, 3, 4]);
});

test('metas: vazio = sem meta, inválido = erro', () => {
  const v = M.validateGoals({ kcal: '2.000', protein: '', carbs: 'x', fat: '-1' });
  assert.equal(v.goals.kcal, 2000); // "2.000" = dois mil
  assert.equal(parseNumber('1.5'), 1.5);
  assert.equal(v.goals.protein, null);
  assert.ok(v.errors.carbs && v.errors.fat);
});

test('demonstração: carregar e remover sem tocar nos dados reais', () => {
  const { s, meal } = setup();
  let st = M.loadDemo(s).state;
  assert.ok(M.hasDemo(st));
  assert.equal(st.core.goalsDemo, true);
  const demoMeal = st.core.meals.find((m) => m.demo);
  st = M.registerAsPlanned(st, '2026-11-16', demoMeal.id).state;
  st = M.registerAsPlanned(st, '2026-11-16', meal.id).state;
  const r = M.removeDemo(st);
  assert.equal(M.hasDemo(r.state), false);
  assert.equal(r.state.core.meals.length, 1);
  assert.equal(r.state.core.foods.length, 3);
  assert.equal(r.state.days['2026-11-16'].entries.length, 1);
  assert.equal(r.state.core.goals.kcal, null);
});

test('backup: exportar e importar', () => {
  const { s, meal } = setup();
  const st = M.registerAsPlanned(s, '2026-11-16', meal.id).state;
  const json = M.exportData(st);
  const back = M.parseImport(json);
  assert.deepEqual(back.core, st.core);
  assert.deepEqual(back.days, st.days);
  assert.throws(() => M.parseImport('{oops'));
  assert.throws(() => M.parseImport('{"app":"outro"}'));
});

test('situação do dia', () => {
  const { s, meal } = setup();
  const st = M.registerAsPlanned(s, '2026-11-16', meal.id).state;
  const day = st.days['2026-11-16'];
  assert.equal(M.dayStatus(day, { kcal: 300, protein: null, carbs: null, fat: null }), 'over');
  assert.equal(M.dayStatus(day, { kcal: 2000, protein: null, carbs: null, fat: null }), 'ok');
  assert.equal(M.dayStatus(day, M.emptyCore().goals), 'nogoal');
  assert.equal(M.dayStatus(undefined, {}), 'empty');
});

// ---------- Plano de exemplo, sugestões e trocas ----------
import { PLAN } from '../src/data/planoAlimentar.js';
import { optionsFor, compareSwap, roundPortion, equivalentPortion } from '../src/logic/suggest.js';
import { hasValues } from '../src/logic/nutrition.js';

test('plano importado: refeições completas batem com o relatório do plano (macros ±1,5 g)', () => {
  const st = M.importPlan(M.emptyState(), PLAN).state;
  assert.equal(st.core.meals.length, 6);
  assert.equal(st.core.goals.kcal, 3500);
  for (const m of st.core.meals) {
    const mn = M.mealNutrients(st.core, m);
    if (mn.incomplete || !m.reference) continue;
    for (const k of ['protein', 'carbs', 'fat']) {
      assert.ok(Math.abs(mn.total[k] - m.reference[k]) <= 1.5, `${m.name} ${k}: ${mn.total[k]} vs ${m.reference[k]}`);
    }
  }
  // importar de novo não duplica
  const again = M.importPlan(st, PLAN).state;
  assert.equal(again.core.meals.length, 6);
  assert.equal(again.core.foods.length, st.core.foods.length);
});

test('todos os alimentos do plano têm valores e fonte; nenhum removido aparece', () => {
  const st = M.importPlan(M.emptyState(), PLAN).state;
  for (const f of st.core.foods) {
    assert.ok(hasValues(f), `${f.name} sem valores`);
    assert.ok(f.sourceNote, `${f.name} sem fonte`);
  }
  const used = new Set(st.core.meals.flatMap((m) => m.items.flatMap((i) => [i.foodId, ...(i.subs || []).map((s) => s.foodId)])));
  for (const id of PLAN.removedFoodIds) {
    assert.ok(!used.has(id), `${id} ainda usado`);
    assert.ok(!st.core.foods.some((f) => f.id === id), `${id} ainda no cadastro`);
  }
  const iog = st.core.meals.find((m) => m.id === 'plan-m-iogurte');
  assert.deepEqual(iog.items.map((i) => [i.foodId, i.amount]).slice(-2), [['plan-frango-desfiado', 75], ['plan-aveia', 30]]);
  const ceia = st.core.meals.find((m) => m.id === 'plan-m-ceia');
  assert.ok(ceia.items.some((i) => i.foodId === 'plan-requeijao' && i.amount === 30));
});

test('valor desconhecido não é tratado como zero silenciosamente', () => {
  let st = M.emptyState();
  st = { ...st, core: { ...st.core, foods: [{ id: 'x', name: 'X', unit: 'g', refAmount: 100, kcal: null, protein: null, carbs: null, fat: null }] } };
  st = M.saveMeal(st, { name: 'M', time: '', days: [0], items: [{ id: 'a', foodId: 'x', amount: '50' }] }).state;
  const mn = M.mealNutrients(st.core, st.core.meals[0]);
  assert.equal(mn.incomplete, 1);
  const r = M.registerAsPlanned(st, '2026-11-16', st.core.meals[0].id, '10:00');
  assert.equal(M.entryIncomplete(r.result), 1);
});

test('atualização de um plano já importado (v1 → v2)', () => {
  // simula o plano antigo: whey/pasta/geleia presentes e Rap10 sem valores
  const v1foods = [...PLAN.foods.map((f) => (f.id === 'plan-rap10' ? { ...f, kcal: null, protein: null, carbs: null, fat: null } : f)),
    { id: 'plan-whey', name: 'Whey', unit: 'g', refAmount: 30, kcal: null, protein: null, carbs: null, fat: null },
    { id: 'plan-geleia', name: 'Geleia', unit: 'g', refAmount: 100, kcal: null, protein: null, carbs: null, fat: null }];
  const v1meals = PLAN.meals.map((m) => (m.id === 'plan-m-cafe'
    ? { ...m, time: '05:30', items: m.items.map((it, i) => (i === 0 ? { ...it, subs: [{ id: 'w', foodId: 'plan-whey', amount: 30 }, ...it.subs] } : it)) }
    : m.id === 'plan-m-ceia' ? { ...m, items: [...m.items, { id: 'g', foodId: 'plan-geleia', amount: 20, subs: [] }] } : m));
  let st = M.importPlan(M.emptyState(), { ...PLAN, id: 'v1', foods: v1foods, meals: v1meals, removedFoodIds: [] }).state;
  st = M.registerAsPlanned(st, '2026-11-12', 'plan-m-ceia', '22:00').state;
  const hist = JSON.stringify(st.days);
  st = M.importPlan(st, PLAN).state;
  assert.equal(st.core.planImported, PLAN.id);
  assert.ok(!st.core.foods.some((f) => f.id === 'plan-whey' || f.id === 'plan-geleia'));
  assert.ok(hasValues(st.core.foods.find((f) => f.id === 'plan-rap10')));
  const cafe = st.core.meals.find((m) => m.id === 'plan-m-cafe');
  assert.equal(cafe.time, '05:30'); // horário editado mantido
  assert.ok(!cafe.items[0].subs.some((s) => s.foodId === 'plan-whey'));
  assert.ok(!st.core.meals.find((m) => m.id === 'plan-m-ceia').items.some((i) => i.foodId === 'plan-geleia'));
  assert.equal(JSON.stringify(st.days), hist); // histórico intacto
});

test('porção equivalente e arredondamento', () => {
  assert.equal(roundPortion(247, 'g'), 245);
  assert.equal(roundPortion(12.4, 'g'), 12);
  assert.equal(roundPortion(1.3, 'unid'), 1.5);
  const st = M.importPlan(M.emptyState(), PLAN).state;
  const f = (id) => st.core.foods.find((x) => x.id === `plan-${id}`);
  // 250 g de arroz (70,25 g carbo) ≈ 233 g de mandioca → 235 g
  const e = equivalentPortion(f('arroz'), 250, f('mandioca'));
  assert.equal(e.basis, 'carbs');
  assert.equal(e.amount, 235);
});

test('opções do plano e sugestões do app para o arroz do almoço', () => {
  const st = M.importPlan(M.emptyState(), PLAN).state;
  const meal = st.core.meals.find((m) => m.id === 'plan-m-almoco');
  const item = meal.items[0];
  const o = optionsFor(st.core, meal, item, { weekday: 4 });
  assert.equal(o.error, null);
  assert.equal(o.planOptions.length, 5);
  assert.ok(o.suggestions.length > 0);
  assert.ok(o.suggestions.every((c) => c.food.category === 'carboidrato' && c.complete));
  assert.ok(o.suggestions.every((c) => !item.subs.some((s) => s.foodId === c.food.id)));
  for (let i = 1; i < o.suggestions.length; i++) assert.ok(o.suggestions[i - 1].score <= o.suggestions[i].score);
  assert.ok(o.suggestions[0].reason.length > 10);
  assert.equal(o.unavailable.length, 0);
});

test('comparação mostra diferenças da refeição e do dia', () => {
  const st = M.importPlan(M.emptyState(), PLAN).state;
  const meal = st.core.meals.find((m) => m.id === 'plan-m-almoco');
  const item = meal.items[0];
  const mand = st.core.foods.find((x) => x.id === 'plan-mandioca');
  const c = compareSwap(st.core, meal, item, mand, 250, 4);
  close(c.n0.kcal, 320); close(c.n.kcal, 312.5); close(c.diff.kcal, -7.5);
  close(c.mealAfter.kcal - c.mealBefore.kcal, -7.5);
  close(c.dayAfter.kcal - c.dayBefore.kcal, -7.5);
});

test('trocar na dieta preserva o anterior como opção e não mexe no histórico', () => {
  let st = M.importPlan(M.emptyState(), PLAN).state;
  const meal = st.core.meals.find((m) => m.id === 'plan-m-almoco');
  st = M.registerAsPlanned(st, '2026-11-12', meal.id, '12:30').state;
  const before = M.dayConsumed(st.days['2026-11-12']).kcal;
  st = M.swapInPlan(st, meal.id, meal.items[0].id, 'plan-mandioca', 235).state;
  const it = st.core.meals.find((m) => m.id === meal.id).items[0];
  assert.equal(it.foodId, 'plan-mandioca');
  assert.equal(it.amount, 235);
  assert.ok(it.subs.some((s) => s.foodId === 'plan-arroz' && s.amount === 250));
  assert.ok(!it.subs.some((s) => s.foodId === 'plan-mandioca'));
  assert.equal(M.dayConsumed(st.days['2026-11-12']).kcal, before);
});

test('usar a troca só no consumo de hoje', () => {
  let st = M.importPlan(M.emptyState(), PLAN).state;
  const meal = st.core.meals.find((m) => m.id === 'plan-m-almoco');
  const date = '2026-11-13';
  // ainda não registrada: registra a refeição já com a troca
  st = M.registerWithSwap(st, date, meal.id, meal.items[0].id, 'plan-mandioca', 250, '12:30').state;
  const e = st.days[date].entries[0];
  assert.equal(e.items[0].foodId, 'plan-mandioca');
  assert.equal(e.items[0].substitutedFor, 'Arroz branco');
  close(M.dayConsumed(st.days[date]).kcal, 312.5 + 115.5 + 159 + 44.2);
  // a dieta planejada continua com arroz
  assert.equal(st.core.meals.find((m) => m.id === meal.id).items[0].foodId, 'plan-arroz');
  // já registrada: troca o frango no registro existente, sem duplicar
  st = M.registerWithSwap(st, date, meal.id, meal.items[2].id, 'plan-patinho', 100).state;
  assert.equal(st.days[date].entries.length, 1);
  assert.equal(st.days[date].entries[0].items[2].foodId, 'plan-patinho');
  // trocar de novo o mesmo item substitui só ele (sem duplicar) e o feijão continua igual
  st = M.registerWithSwap(st, date, meal.id, meal.items[0].id, 'plan-macarrao', 250).state;
  const items = st.days[date].entries[0].items;
  assert.equal(items.length, 4);
  assert.equal(items[0].foodId, 'plan-macarrao');
  assert.equal(items[1].foodId, 'plan-feijao-preto');
  assert.equal(items[1].amount, 150);
  // só a quantidade: troca o mesmo alimento com outra quantidade
  st = M.registerWithSwap(st, date, meal.id, meal.items[1].id, 'plan-feijao-preto', 100).state;
  assert.equal(st.days[date].entries[0].items[1].amount, 100);
  assert.equal(st.days[date].entries[0].items[1].substitutedFor, undefined);
});

test('refeição sem horário é válida e segue a ordem do plano', () => {
  const st = M.importPlan(M.emptyState(), PLAN).state;
  const names = M.mealsForWeekday(st.core, 0).map((m) => m.name);
  assert.deepEqual(names.slice(0, 2), ['Café da manhã', 'Almoço']);
  assert.equal(names[4], 'Ceia');
  assert.equal(names[5], 'Lanche – Iogurte com frutas/mingau'); // sem horário vem por último
  const r = M.saveMeal(st, { name: 'X', time: '', days: [0], items: [{ id: 'a', foodId: 'plan-arroz', amount: '10' }] });
  assert.equal(r.result.time, null);
});

test('metas entram na ordenação quando o dia está completo', () => {
  let st = M.importPlan(M.emptyState(), PLAN).state;
  // completa os alimentos sem valores (como se viessem do rótulo)
  for (const f of st.core.foods.filter((x) => !hasValues(x))) {
    st = M.saveFood(st, { ...f, kcal: '100', protein: '5', carbs: '15', fat: '2', refAmount: String(f.refAmount), source: 'rotulo' }, f.id).state;
  }
  const meal = st.core.meals.find((m) => m.id === 'plan-m-almoco');
  const o = optionsFor(st.core, meal, meal.items[0], { weekday: 4 });
  assert.equal(o.goalsIgnored, false);
  assert.ok(o.planOptions.every((c) => c.goal.any));
});

test('horários do plano: café 07:00 e almoço 12:00, sem sobrescrever horário já editado', () => {
  let st = M.importPlan(M.emptyState(), PLAN).state;
  const t = (id) => st.core.meals.find((m) => m.id === id).time;
  assert.equal(t('plan-m-cafe'), '07:00');
  assert.equal(t('plan-m-almoco'), '12:00');
  assert.equal(t('plan-m-ceia'), '22:00');
  // quem já tinha o plano sem horário recebe os horários ao recarregar
  const old = { ...st, core: { ...st.core, meals: st.core.meals.map((m) => ({ ...m, time: m.id === 'plan-m-almoco' ? '12:30' : null })) } };
  st = M.importPlan(old, PLAN).state;
  assert.equal(t('plan-m-cafe'), '07:00');
  assert.equal(t('plan-m-almoco'), '12:30');
  // ordem: refeições com horário primeiro, depois as demais na ordem do plano
  assert.deepEqual(M.mealsForWeekday(st.core, 0).map((m) => m.name).slice(0, 3), ['Café da manhã', 'Almoço', 'Lanche da tarde (pré-treino) – Sanduíche']);
});

test('horários informados: ordem do dia e atualização sem sobrescrever', () => {
  const st = M.importPlan(M.emptyState(), PLAN).state;
  const ms = M.mealsForWeekday(st.core, 0);
  assert.deepEqual(ms.slice(0, 5).map((m) => m.time), ['07:00', '12:00', '16:00', '19:30', '22:00']);
  // plano antigo sem horários + nova importação → recebe horários; horário já editado é mantido
  let old = M.emptyState();
  old = M.importPlan(old, { ...PLAN, meals: PLAN.meals.map((m) => ({ ...m, time: null })) }).state;
  old = { ...old, core: { ...old.core, meals: old.core.meals.map((m) => (m.id === 'plan-m-almoco' ? { ...m, time: '12:30' } : m)) } };
  const up = M.importPlan(old, PLAN).state;
  const t = (id) => up.core.meals.find((m) => m.id === id).time;
  assert.equal(t('plan-m-cafe'), '07:00');
  assert.equal(t('plan-m-almoco'), '12:30');
  assert.equal(t('plan-m-ceia'), '22:00');
  assert.equal(t('plan-m-iogurte'), null);
});

test('troca em registro já feito (swapEntryItem) e recálculo', () => {
  let st = M.importPlan(M.emptyState(), PLAN).state;
  const meal = st.core.meals.find((m) => m.id === 'plan-m-almoco');
  const date = '2026-11-13';
  st = M.registerAsPlanned(st, date, meal.id, '12:00').state;
  const e = st.days[date].entries[0];
  const frangoItem = e.items[2];
  assert.equal(frangoItem.planItemId, meal.items[2].id);
  st = M.swapEntryItem(st, date, e.id, frangoItem.id, 'plan-patinho', 100).state;
  const e2 = st.days[date].entries[0];
  assert.equal(e2.items[2].foodId, 'plan-patinho');
  assert.equal(e2.items[2].substitutedFor, 'Peito de frango sem pele grelhado');
  close(M.dayConsumed(st.days[date]).kcal, 320 + 115.5 + 219 + 44.2);
  // arroz e feijão iguais
  assert.equal(e2.items[0].amount, 250);
  assert.equal(e2.items[1].amount, 150);
});
