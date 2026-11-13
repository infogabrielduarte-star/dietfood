// Plano alimentar de exemplo (3500 kcal) carregado como dados iniciais do app.
// Refeições, quantidades, medidas caseiras, substituições e observações
// seguem um plano de referência. Os horários são apenas sugestões e podem ser
// editados no app.
//
// Valores nutricionais (por porção de referência):
//  - "TACO 4ª ed.": Tabela Brasileira de Composição de Alimentos, NEPA/UNICAMP, 2011.
//  - "IBGE POF 2008–2009": Tabela de Composição Nutricional dos Alimentos Consumidos no Brasil.
//  - estimated: true → valor representativo (variedade ou preparo não especificado no plano,
//    ou produto de marca representado por item genérico). dataNote explica.
//  - kcal/protein/carbs/fat = null → indisponível: produto industrializado sem item
//    equivalente nas tabelas. Preencha pelo rótulo da sua marca.
//
// Totais por refeição do relatório de nutrientes do plano de referência ficam em `reference`
// para comparação com o cálculo do app.

const T = 'TACO 4ª ed.';
const SRC = { source: 'tabela' };

const food = (id, name, preparation, category, unit, refAmount, kcal, protein, carbs, fat, sourceNote, extra = {}) => ({
  id: `plan-${id}`,
  name,
  preparation,
  category,
  unit,
  refAmount,
  kcal,
  protein,
  carbs,
  fat,
  ...SRC,
  sourceNote,
  estimated: false,
  dataNote: '',
  ...extra,
});

const est = (dataNote) => ({ estimated: true, dataNote });
const missing = (name) => ({
  source: 'rotulo',
  sourceNote: 'Indisponível — preencha pelo rótulo',
  estimated: false,
  dataNote: `${name} não consta na TACO. Copie os valores do rótulo da sua marca.`,
});

export const PLAN_FOODS = [
  // Café da manhã
  food('ovo', 'Ovo de galinha inteiro', 'cozido', 'proteina', 'g', 100, 146, 13.3, 0.6, 9.5, `${T}: Ovo, de galinha, inteiro, cozido/10 min`,
    est('O plano não informa o preparo; considerado cozido.')),
  food('pao-forma-integral', 'Pão de forma integral', 'na', 'carboidrato', 'g', 100, 253, 9.4, 49.9, 3.7, `${T}: Pão, trigo, forma, integral`),
  food('doce-leite', 'Doce de leite cremoso', 'na', 'doce', 'g', 100, 306, 5.5, 59.5, 6.0, `${T}: Doce, de leite, cremoso`),
  food('mamao', 'Mamão', 'cru', 'fruta', 'g', 100, 45, 0.8, 11.6, 0.1, `${T}: Mamão, Formosa, cru`,
    est('O plano não informa a variedade; considerado mamão formosa.')),
  food('mussarela', 'Queijo muçarela', 'na', 'laticinio', 'g', 100, 330, 22.6, 3.0, 25.2, `${T}: Queijo, mozarela`),
  food('aveia', 'Aveia em flocos', 'cru', 'carboidrato', 'g', 100, 394, 13.9, 66.6, 8.5, `${T}: Aveia, flocos, crua`),
  // Almoço / jantar
  food('arroz', 'Arroz branco', 'cozido', 'carboidrato', 'g', 100, 128, 2.5, 28.1, 0.2, `${T}: Arroz, tipo 1, cozido`),
  food('feijao-preto', 'Feijão preto', 'cozido', 'leguminosa', 'g', 100, 77, 4.5, 14.0, 0.5, `${T}: Feijão, preto, cozido`),
  food('frango', 'Peito de frango sem pele grelhado', 'cozido', 'proteina', 'g', 100, 159, 32.0, 0, 2.5, `${T}: Frango, peito, sem pele, grelhado`),
  food('azeite', 'Azeite de oliva', 'na', 'gordura', 'g', 100, 884, 0, 0, 100, `${T}: Azeite, de oliva, extra virgem`),
  // Lanche – sanduíche
  food('pao-frances', 'Pão francês', 'na', 'carboidrato', 'g', 100, 300, 8.0, 58.6, 3.1, `${T}: Pão, trigo, francês`),
  food('carne', 'Carne bovina magra (alcatra, contrafilé, coxão mole, filé mignon, lagarto, patinho)', 'cozido', 'proteina', 'g', 100, 219, 35.9, 0, 7.3,
    `${T}: Carne, bovina, patinho, sem gordura, grelhado`, est('O plano agrupa vários cortes; representado por patinho grelhado.')),
  food('maionese', 'Maionese tradicional', 'na', 'gordura', 'g', 100, 302, 0.6, 7.9, 30.5, `${T}: Maionese, tradicional com ovos`),
  food('tomate', 'Tomate', 'cru', 'vegetal', 'g', 100, 15, 1.1, 3.1, 0.2, `${T}: Tomate, com semente, cru`),
  food('alface', 'Alface', 'cru', 'vegetal', 'g', 100, 11, 1.3, 1.7, 0.2, `${T}: Alface, crespa, crua`,
    est('O plano não informa o tipo; considerada alface crespa.')),
  food('banana', 'Banana nanica', 'cru', 'fruta', 'g', 100, 92, 1.4, 23.8, 0.1, `${T}: Banana, nanica, crua`),
  // Lanche – iogurte/mingau
  food('iogurte', 'Iogurte natural', 'na', 'laticinio', 'g', 100, 51, 4.1, 1.9, 3.0, `${T}: Iogurte, natural`),
  food('maca', 'Maçã', 'cru', 'fruta', 'g', 100, 56, 0.3, 15.2, 0.0, `${T}: Maçã, Fuji, com casca, crua`,
    est('O plano não informa a variedade; considerada maçã fuji com casca.')),
  food('leite-po', 'Leite de vaca integral em pó', 'na', 'laticinio', 'g', 100, 497, 25.4, 39.2, 26.9, `${T}: Leite, de vaca, integral, pó`),
  // Ceia
  food('tapioca-massa', 'Tapioca (massa pronta)', 'na', 'carboidrato', 'g', 100, 228, 0, 57, 0,
    'Rótulo de goma de tapioca hidratada (228 kcal/100 g)', est('Marca não informada no plano; valores típicos de rótulo. Confira o rótulo da sua marca.')),
  // Substituições
  food('requeijao', 'Requeijão cremoso', 'na', 'laticinio', 'g', 100, 257, 9.6, 2.4, 23.4, `${T}: Queijo, requeijão, cremoso`),
  food('sucrilhos', 'Sucrilhos (cereal de milho com açúcar)', 'na', 'carboidrato', 'g', 100, 377, 4.7, 88.8, 0.7,
    `${T}: Cereal matinal, milho, açúcar`, est('Produto de marca representado pelo cereal genérico da TACO.')),
  food('goma-tapioca', 'Goma de tapioca', 'na', 'carboidrato', 'g', 100, 228, 0, 57, 0,
    'Rótulo de goma de tapioca hidratada (228 kcal/100 g)', est('Marca não informada no plano; valores típicos de rótulo. Confira o rótulo da sua marca.')),
  food('granola', 'Granola', 'na', 'carboidrato', 'g', 100, 388, 9.5, 73.8, 6.3, 'IBGE POF 2008–2009: Granola',
    est('Tipo/marca não informados no plano; valor médio do IBGE.')),
  food('cuscuz', 'Cuscuz de milho com sal', 'cozido', 'carboidrato', 'g', 100, 113, 2.2, 25.3, 0.7, `${T}: Cuscuz, de milho, cozido com sal`),
  food('melao', 'Melão', 'cru', 'fruta', 'g', 100, 29, 0.7, 7.5, 0.0, `${T}: Melão, cru`),
  food('abacate', 'Abacate', 'cru', 'fruta', 'g', 100, 96, 1.2, 6.0, 8.4, `${T}: Abacate, cru`),
  food('macarrao', 'Macarrão', 'cozido', 'carboidrato', 'g', 100, 148, 4.0, 31.2, 0.5, `${T}: Macarrão, trigo, cru (÷ 2,5)`,
    est('A TACO só traz o macarrão cru; valores divididos por 2,5 (rendimento típico do cozimento).')),
  food('mandioca', 'Mandioca (aipim, macaxeira)', 'cozido', 'carboidrato', 'g', 100, 125, 0.6, 30.1, 0.3, `${T}: Mandioca, cozida`),
  food('batata-baroa', 'Batata baroa (mandioquinha)', 'cozido', 'carboidrato', 'g', 100, 80, 0.9, 18.9, 0.2, `${T}: Mandioquinha, cozida`),
  food('batata-cozida', 'Batata inglesa', 'cozido', 'carboidrato', 'g', 100, 52, 1.2, 11.9, 0.0, `${T}: Batata, inglesa, cozida`),
  food('batata-crua', 'Batata inglesa (pesada crua)', 'cru', 'carboidrato', 'g', 100, 64, 1.8, 14.7, 0.0, `${T}: Batata, inglesa, crua`),
  food('patinho', 'Patinho grelhado', 'cozido', 'proteina', 'g', 100, 219, 35.9, 0, 7.3, `${T}: Carne, bovina, patinho, sem gordura, grelhado`),
  food('peixe', 'Filé de peixe grelhado/assado', 'cozido', 'proteina', 'g', 100, 122, 26.6, 0, 0.9, `${T}: Merluza, filé, assado`,
    est('O plano não informa o peixe; representado por merluza assada.')),
  food('musculo', 'Músculo bovino', 'cozido', 'proteina', 'g', 100, 194, 31.2, 0, 6.7, `${T}: Carne, bovina, músculo, sem gordura, cozido`),
  food('rap10', 'Pão tipo tortilha (Rap10)', 'na', 'carboidrato', 'g', 40, 110, 3.3, 18, 2.8, 'Rótulo Pullman Rap10 tradicional (1 unidade, 40 g)', { source: 'rotulo' }),
  food('atum', 'Atum ralado em óleo', 'na', 'proteina', 'g', 100, 166, 26.2, 0, 6.0, `${T}: Atum, conserva em óleo`),
  food('frango-desfiado', 'Frango desfiado', 'cozido', 'proteina', 'g', 100, 163, 31.5, 0, 3.2, `${T}: Frango, peito, sem pele, cozido`,
    est('Considerado peito de frango cozido.')),
  food('manga', 'Manga', 'cru', 'fruta', 'g', 100, 72, 0.4, 19.4, 0.3, `${T}: Manga, Palmer, crua`, est('Variedade não informada; considerada Palmer.')),
  food('abacaxi', 'Abacaxi', 'cru', 'fruta', 'g', 100, 48, 0.9, 12.3, 0.1, `${T}: Abacaxi, cru`),
  food('laranja', 'Laranja', 'cru', 'fruta', 'g', 100, 37, 1.0, 8.9, 0.1, `${T}: Laranja, pêra, crua`, est('Variedade não informada; considerada laranja-pera.')),
  food('pera', 'Pera', 'cru', 'fruta', 'g', 100, 53, 0.6, 14.0, 0.1, `${T}: Pêra, Williams, crua`, est('Variedade não informada; considerada Williams.')),
  food('kiwi', 'Kiwi', 'cru', 'fruta', 'g', 100, 51, 1.3, 11.5, 0.6, `${T}: Kiwi, cru`),
  food('leite-desnatado', 'Leite desnatado UHT', 'na', 'laticinio', 'ml', 100, 34.15, 3.38, 4.98, 0.08,
    'IBGE POF 2008–2009: Leite de vaca desnatado', est('Valores por 100 g usados para 100 ml.')),
];

const ALL = [0, 1, 2, 3, 4, 5, 6];
let n = 0;
const it = (foodId, amount, note = '', subs = []) => {
  n += 1;
  return {
    id: `plan-i${n}`,
    foodId: `plan-${foodId}`,
    amount,
    note,
    subs: subs.map(([sf, sa, sn], i) => ({ id: `plan-s${n}-${i}`, foodId: `plan-${sf}`, amount: sa, note: sn || '' })),
  };
};

const ALMOCO_NOTES = [
  'Ingerir 150–200 g de vegetais variados (saladas de folhas, legumes, verduras), com pelo menos 3 tipos diferentes.',
  'Caso não consuma o feijão, aumentar 50 g do carboidrato principal.',
  'A batata inglesa em menor quantidade é pesada crua, para preparos como air fryer.',
].join('\n');

const arrozSubs = [['macarrao', 250], ['mandioca', 250], ['batata-baroa', 500], ['batata-cozida', 500], ['batata-crua', 375]];
const frangoSubs = [['patinho', 100], ['peixe', 100], ['carne', 92.3], ['musculo', 100]];

export const PLAN_MEALS = [
  {
    id: 'plan-m-cafe',
    name: 'Café da manhã',
    time: '07:00',
    days: ALL,
    notes: 'Consumir café conforme o habitual. Caso tome café adoçado com açúcar, tentar reduzir quantidades ou utilizar adoçantes zero calorias.',
    reference: { kcal: 672, protein: 36.0, carbs: 77.0, fat: 25.8 },
    items: [
      it('ovo', 150, '3 unidades', [['leite-po', 30]]),
      it('pao-forma-integral', 50, '2 fatias', [['aveia', 30], ['sucrilhos', 30], ['goma-tapioca', 30], ['granola', 30], ['pao-frances', 50, '1 unidade'], ['cuscuz', 100]]),
      it('doce-leite', 20, '', [['requeijao', 20]]),
      it('mamao', 170, '1 fatia média', [['banana', 65, '1 unidade média'], ['maca', 130, '1 unidade média'], ['melao', 115, '1 fatia grande'], ['abacate', 100]]),
      it('mussarela', 20, '1 fatia média'),
      it('aveia', 30),
    ],
  },
  {
    id: 'plan-m-almoco',
    name: 'Almoço',
    time: '12:00',
    days: ALL,
    notes: ALMOCO_NOTES,
    reference: { kcal: 607, protein: 45.0, carbs: 91.3, fat: 8.8 },
    items: [
      it('arroz', 250, '', arrozSubs),
      it('feijao-preto', 150),
      it('frango', 100, '', frangoSubs),
      it('azeite', 5),
    ],
  },
  {
    id: 'plan-m-sanduiche',
    name: 'Lanche da tarde (pré-treino) – Sanduíche',
    time: '16:00',
    days: ALL,
    notes: 'O lanche com hambúrguer também pode ser colocado no lugar do jantar.',
    reference: { kcal: 528, protein: 37.8, carbs: 48.8, fat: 21.0 },
    items: [
      it('pao-frances', 50, '1 unidade', [['rap10', 40, '1 unidade'], ['goma-tapioca', 50]]),
      it('carne', 80, '', [['atum', 80], ['frango-desfiado', 80], ['ovo', 100, '2 unidades']]),
      it('maionese', 27, '1 colher de sopa cheia', [['requeijao', 30, '1 colher de sopa cheia']]),
      it('mussarela', 20, '1 fatia média'),
      it('tomate', 30, '2 fatias médias'),
      it('alface', 10, '1 folha média'),
      it('banana', 65, '1 unidade média', [['manga', 150], ['abacaxi', 150], ['laranja', 180, '1 unidade média'], ['pera', 110, '1 unidade'], ['kiwi', 152, '2 unidades médias']]),
    ],
  },
  {
    id: 'plan-m-iogurte',
    name: 'Lanche – Iogurte com frutas/mingau',
    time: null,
    days: ALL,
    notes: [
      'Mingau: misture a aveia com o leite, leve ao micro-ondas e mexa de 45 em 45 segundos até dar a consistência de mingau. Banana e morangos com o leite em pó como cobertura.',
    ].join('\n'),
    reference: null,
    items: [
      it('iogurte', 165, '1 copo pequeno', [['leite-desnatado', 240, '1 copo americano duplo']]),
      it('maca', 130, '1 unidade média'),
      it('banana', 65, '1 unidade média'),
      it('leite-po', 30),
      it('frango-desfiado', 75),
      it('aveia', 30),
    ],
  },
  {
    id: 'plan-m-jantar',
    name: 'Jantar',
    time: '19:30',
    days: ALL,
    notes: ALMOCO_NOTES,
    reference: { kcal: 607, protein: 45.0, carbs: 91.3, fat: 8.8 },
    items: [
      it('arroz', 250, '', arrozSubs),
      it('feijao-preto', 150),
      it('frango', 100, '', frangoSubs),
      it('azeite', 5),
    ],
  },
  {
    id: 'plan-m-ceia',
    name: 'Ceia',
    time: '22:00',
    days: ALL,
    notes: 'Fazer panqueca com a massa de tapioca e o ovo. Cobertura: requeijão e banana (ou 1 fatia de queijo no lugar da banana).',
    reference: null,
    items: [
      it('ovo', 100, '2 unidades'),
      it('tapioca-massa', 60),
      it('requeijao', 30, '1 colher de sopa cheia'),
      it('banana', 75, '1 unidade pequena', [['mussarela', 20, '1 fatia']]),
    ],
  },
];

export const PLAN = {
  id: 'plano-3500-2026-11-v2',
  // Alimentos retirados do plano; somem do plano e das substituições.
  removedFoodIds: ['plan-whey', 'plan-pasta-amendoim', 'plan-geleia'],
  title: 'Plano alimentar 3500 kcal',
  foods: PLAN_FOODS,
  meals: PLAN_MEALS,
  // Meta: 3500 kcal (plano de referência); macros do "Total das refeições" do relatório.
  goals: { kcal: 3500, protein: 224.0, carbs: 441.9, fat: 102.3 },
  goalsSource: 'Plano alimentar de exemplo: 3500 kcal; macros do relatório de nutrientes',
  reportTotal: { kcal: 3503, protein: 224.0, carbs: 441.9, fat: 102.3 },
};
