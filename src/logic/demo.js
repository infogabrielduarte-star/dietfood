// DADOS DE DEMONSTRAÇÃO — apenas para explorar o app.
// Não são a dieta nem as metas do usuário. Valores aproximados de tabela de
// composição (referência TACO), marcados como exemplo e removíveis em
// Configurações > Dados de demonstração.

export const DEMO_GOALS = { kcal: 2000, protein: 140, carbs: 220, fat: 60 };

const f = (id, name, preparation, unit, refAmount, kcal, protein, carbs, fat) => ({
  id: `demo-${id}`,
  name,
  preparation,
  unit,
  refAmount,
  kcal,
  protein,
  carbs,
  fat,
  source: 'tabela',
  sourceNote: 'Exemplo (aprox. TACO)',
});

export const DEMO_FOODS = [
  f('pao', 'Pão francês', 'na', 'g', 50, 150, 4.0, 29.3, 1.6),
  f('ovo', 'Ovo de galinha', 'cozido', 'unid', 1, 73, 6.7, 0.3, 4.8),
  f('aveia', 'Aveia em flocos', 'cru', 'g', 30, 118, 4.2, 20.0, 2.6),
  f('banana', 'Banana prata', 'cru', 'g', 100, 98, 1.3, 26.0, 0.1),
  f('arroz', 'Arroz branco', 'cozido', 'g', 100, 128, 2.5, 28.1, 0.2),
  f('feijao', 'Feijão carioca', 'cozido', 'g', 100, 76, 4.8, 13.6, 0.5),
  f('frango', 'Peito de frango grelhado', 'cozido', 'g', 100, 159, 32.0, 0, 2.5),
];

const ALL = [0, 1, 2, 3, 4, 5, 6];
const it = (id, foodId, amount, note = '', subs = []) => ({
  id: `demo-i-${id}`,
  foodId: `demo-${foodId}`,
  amount,
  note,
  subs: subs.map(([sid, sf, sa]) => ({ id: `demo-s-${sid}`, foodId: `demo-${sf}`, amount: sa })),
});

export const DEMO_MEALS = [
  {
    id: 'demo-m-cafe',
    name: 'Café da manhã',
    time: '07:30',
    days: ALL,
    notes: 'Exemplo de refeição com substituição.',
    items: [it('cafe1', 'pao', 50, '1 unidade', [['cafe1a', 'aveia', 40]]), it('cafe2', 'ovo', 2, '2 unidades')],
  },
  {
    id: 'demo-m-almoco',
    name: 'Almoço',
    time: '12:30',
    days: ALL,
    notes: '',
    items: [
      it('alm1', 'arroz', 150, '≈ 4 colheres de sopa'),
      it('alm2', 'feijao', 100, '1 concha'),
      it('alm3', 'frango', 120),
    ],
  },
  {
    id: 'demo-m-lanche',
    name: 'Lanche da tarde',
    time: '16:00',
    days: ALL,
    notes: '',
    items: [it('lan1', 'banana', 100, '1 unidade média'), it('lan2', 'aveia', 30, '2 colheres de sopa')],
  },
  {
    id: 'demo-m-jantar',
    name: 'Jantar',
    time: '20:00',
    days: ALL,
    notes: '',
    items: [it('jan1', 'arroz', 100), it('jan2', 'frango', 120)],
  },
];
