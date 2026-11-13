// Trocar alimento → Confirmar alteração.
// Só o item escolhido muda; os demais alimentos da refeição permanecem iguais.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useApp, errorText } from '../state/AppState.js';
import { Sheet, Btn, Row } from '../ui/kit.js';
import { colors, space, font, radius, tabular } from '../theme.js';
import {
  MACROS, MACRO_LABEL, MACRO_UNIT, nutrientsFor, refOf, sumN, fmtMacro, fmtAmount, parseNumber, hasValues,
} from '../logic/nutrition.js';
import {
  foodById, entryForMeal, registerWithSwap, swapInPlan, swapEntryItem, emptyDay,
} from '../logic/model.js';
import { optionsFor, equivalentPortion, roundPortion } from '../logic/suggest.js';
import { weekdayOf, nowTime } from '../logic/dates.js';
import { prepLabel } from './FoodSheets.js';

const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const fullName = (name, prep) => (prepLabel(prep) ? `${name} (${prepLabel(prep)})` : name);

/** Linhas atuais da refeição: do registro (se já registrada) ou do plano. */
export function mealRows(core, meal, entry) {
  if (entry) {
    return entry.items.map((it) => ({
      key: it.id,
      foodId: it.foodId,
      name: it.name,
      prep: it.preparation,
      amount: it.amount,
      unit: it.unit,
      ref: it.ref,
      note: it.substitutedFor ? `no lugar de ${lower(it.substitutedFor)}` : '',
      target: { kind: 'entry', entryId: entry.id, entryItemId: it.id, planItemId: it.planItemId || null },
    }));
  }
  return meal.items
    .map((it) => ({ it, f: foodById(core, it.foodId) }))
    .filter((x) => x.f)
    .map(({ it, f }) => ({
      key: it.id,
      foodId: f.id,
      name: f.name,
      prep: f.preparation,
      amount: it.amount,
      unit: f.unit,
      ref: refOf(f),
      note: it.note || '',
      subsCount: (it.subs || []).length,
      target: { kind: 'plan', planItemId: it.id },
    }));
}

export function rowsTotal(rows) {
  return sumN(rows.map((r) => nutrientsFor(r.ref, r.amount)));
}

export function SwapSheet({ meal, date: dateProp, rowKey, planOnly = false, onClose }) {
  const { state, apply, showToast, today } = useApp();
  const date = dateProp || today;
  const { core } = state;
  const day = state.days[date];
  const entry = planOnly ? null : entryForMeal(day, meal.id);
  const rows = mealRows(core, meal, entry);
  const row = rows.find((r) => r.key === rowKey);
  const planItem = row?.target.planItemId ? meal.items.find((i) => i.id === row.target.planItemId) : null;
  const currentFood = row ? foodById(core, row.foodId) : null;

  const [stage, setStage] = useState('choose');
  const [query, setQuery] = useState('');
  const [selId, setSelId] = useState(row?.foodId);
  const [qtyText, setQtyText] = useState(row ? fmtAmount(row.amount) : '');
  const [applyTo, setApplyTo] = useState(planOnly ? 'plan' : 'today');

  // Opções: atual, as do plano (prioridade) e sugestões calculadas; busca abre o cadastro inteiro.
  const options = useMemo(() => {
    if (!row) return [];
    const list = [];
    const seen = new Set();
    const push = (food, amount, tag) => {
      if (!food || seen.has(food.id) || !hasValues(food)) return;
      seen.add(food.id);
      list.push({ food, amount, tag });
    };
    push(currentFood || { id: row.foodId, name: row.name, preparation: row.prep, unit: row.unit, ...row.ref }, row.amount, 'atual');
    if (planItem) {
      if (planItem.foodId !== row.foodId) push(foodById(core, planItem.foodId), planItem.amount, 'do plano');
      for (const s of planItem.subs || []) push(foodById(core, s.foodId), s.amount, 'do plano');
      if (currentFood && hasValues(currentFood)) {
        const o = optionsFor(core, meal, { ...planItem, foodId: currentFood.id, amount: row.amount }, { weekday: weekdayOf(date), limit: 5 });
        for (const c of o.suggestions) push(c.food, c.amount, 'sugestão');
      }
    }
    return list;
  }, [core, meal, row?.key, row?.foodId, row?.amount, planItem]);

  const searchResults = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t || !row) return null;
    return core.foods
      .filter((f) => hasValues(f) && f.name.toLowerCase().includes(t))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 12)
      .map((f) => {
        const known = options.find((o) => o.food.id === f.id);
        if (known) return known;
        const eq = currentFood && hasValues(currentFood) ? equivalentPortion(currentFood, row.amount, f).amount : null;
        return { food: f, amount: eq || f.refAmount, tag: eq ? 'porção equivalente' : 'porção de referência' };
      });
  }, [query, core.foods, options, currentFood, row]);

  if (!row) return null;

  const shown = searchResults || options;
  const selected = shown.find((o) => o.food.id === selId) || options.find((o) => o.food.id === selId);
  const selFood = selected?.food;
  const qty = parseNumber(qtyText);
  const validQty = qty > 0;

  const pick = (o) => {
    setSelId(o.food.id);
    setQtyText(fmtAmount(o.amount));
  };
  const step = (dir) => {
    const unit = selFood?.unit || row.unit;
    const base = validQty ? qty : 0;
    const inc = unit === 'g' || unit === 'ml' ? (base < 20 ? 1 : 5) : 0.5;
    const next = Math.max(inc, roundPortion(base + dir * inc, unit) || base + dir * inc);
    setQtyText(fmtAmount(next));
  };

  const unchanged = selFood && selFood.id === row.foodId && validQty && Math.abs(qty - row.amount) < 1e-9;
  const others = rows.filter((r) => r.key !== row.key).map((r) => lower(r.name.split(' (')[0]));
  const othersText = others.length === 0 ? '' : others.length === 1
    ? `${others[0].charAt(0).toUpperCase()}${others[0].slice(1)} permanece igual.`
    : `${others.slice(0, -1).join(', ').replace(/^./, (c) => c.toUpperCase())} e ${others[others.length - 1]} permanecem iguais.`;

  // Antes × depois da refeição
  const afterRows = rows.map((r) => (r.key === row.key && selFood
    ? { ...r, name: selFood.name, prep: selFood.preparation, unit: selFood.unit, amount: qty, ref: refOf(selFood), changed: true }
    : r));
  const before = rowsTotal(rows);
  const after = validQty ? rowsTotal(afterRows) : before;

  const confirm = () => {
    const prevMeals = state.core.meals;
    const prevDay = state.days[date];
    try {
      if (applyTo === 'plan') {
        apply((s) => swapInPlan(s, meal.id, row.target.planItemId, selFood.id, qty));
        showToast('Plano atualizado', {
          label: 'Desfazer',
          onPress: () => apply((s) => ({ state: { ...s, core: { ...s.core, meals: prevMeals } }, changed: { core: true } })),
        });
      } else {
        if (row.target.kind === 'entry') {
          apply((s) => swapEntryItem(s, date, row.target.entryId, row.target.entryItemId, selFood.id, qty));
        } else {
          apply((s) => registerWithSwap(s, date, meal.id, row.target.planItemId, selFood.id, qty, date === today ? nowTime() : meal.time));
        }
        showToast(entry ? 'Registro atualizado' : `Registrado: ${meal.name}`, {
          label: 'Desfazer',
          onPress: () => apply((s) => ({ state: { ...s, days: { ...s.days, [date]: prevDay || emptyDay(date) } }, changed: { days: [date] } })),
        });
      }
      onClose();
    } catch (e) {
      showToast(errorText(e), null, 'alert');
    }
  };

  const canPlan = !!row.target.planItemId;
  const confirmLabel = applyTo === 'plan' ? 'Confirmar e atualizar plano' : entry ? 'Confirmar alteração' : 'Confirmar e registrar';

  if (stage === 'confirm') {
    return (
      <Sheet
        visible
        title="Confirmar alteração"
        onClose={onClose}
        testID="confirm-sheet"
        footer={(
          <View style={{ flex: 1, gap: space.sm }}>
            <Btn label={confirmLabel} onPress={confirm} testID="confirm-apply" />
            <Btn label="‹ Voltar" variant="ghost" onPress={() => setStage('choose')} small />
          </View>
        )}
      >
        <View style={s.list}>
          {afterRows.map((r, i) => (
            <View key={r.key} style={[s.listRow, i > 0 && s.listDivider, r.changed && s.listChanged]}>
              <Text style={[s.listName, r.changed && { color: colors.accent }]} numberOfLines={1}>
                {fullName(r.name, r.prep)}
                <Text style={{ color: r.changed ? colors.accent : colors.muted, fontWeight: '400' }}>{`  ·  ${fmtAmount(r.amount)} ${r.unit}`}</Text>
              </Text>
            </View>
          ))}
        </View>

        <Text style={s.h3}>Resumo da refeição</Text>
        <View style={s.table} testID="confirm-table">
          <View style={s.tr}>
            <Text style={[s.th, { flex: 1.4, textAlign: 'left' }]}> </Text>
            <Text style={s.th}>Antes</Text>
            <Text style={s.th}>Depois</Text>
          </View>
          {MACROS.map((m) => (
            <View key={m} style={s.tr} testID={`confirm-${m}`}>
              <Text style={[s.td, { flex: 1.4, textAlign: 'left', color: colors.text }]}>{MACRO_LABEL[m]}</Text>
              <Text style={s.td}>{`${fmtMacro(m, before[m])} ${MACRO_UNIT[m]}`}</Text>
              <Text style={[s.td, { color: colors.text, fontWeight: '700' }]}>{`${fmtMacro(m, after[m])} ${MACRO_UNIT[m]}`}</Text>
            </View>
          ))}
        </View>

        {!planOnly ? (
          <>
            <Text style={s.h3}>Aplicar alteração</Text>
            <Radio
              label={date === today ? 'Somente hoje' : 'Somente neste dia'}
              hint={entry ? 'Atualiza o registro desta refeição' : 'Registra a refeição com a troca'}
              on={applyTo === 'today'}
              onPress={() => setApplyTo('today')}
              testID="apply-today"
            />
            <Radio
              label="Atualizar plano"
              hint={canPlan ? 'Muda a dieta; dias anteriores não mudam' : 'Este item não faz parte do plano'}
              on={applyTo === 'plan'}
              disabled={!canPlan}
              onPress={() => canPlan && setApplyTo('plan')}
              testID="apply-plan"
            />
          </>
        ) : (
          <Text style={s.hint}>A troca muda a dieta planejada. Registros já feitos não mudam.</Text>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet
      visible
      title="Trocar alimento"
      onClose={onClose}
      testID="swap-sheet"
      footer={(
        <Btn
          label={selFood ? `Usar ${lower(selFood.name.split(' (')[0])}` : 'Escolha um alimento'}
          onPress={() => setStage('confirm')}
          disabled={!selFood || !validQty || unchanged}
          flex
          testID="swap-use"
        />
      )}
    >
      <Text style={s.sub}>{`Substituindo: ${lower(fullName(row.name, row.prep))}`}</Text>

      <View style={s.search}>
        <Text style={{ color: colors.muted, fontSize: 18, marginRight: 8 }}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar alternativa"
          placeholderTextColor="#8A9493"
          style={s.searchInput}
          testID="swap-search"
          accessibilityLabel="Buscar alternativa"
        />
      </View>

      {shown.length === 0 ? <Text style={s.hint}>Nenhum alimento encontrado.</Text> : null}
      {shown.map((o) => {
        const on = o.food.id === selId;
        const n = nutrientsFor(refOf(o.food), on && validQty ? qty : o.amount);
        return (
          <Pressable
            key={o.food.id}
            onPress={() => pick(o)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            testID={`swap-opt-${o.food.name}`}
            style={[s.opt, on && s.optOn]}
          >
            <View style={[s.radio, on && s.radioOn]}>{on ? <View style={s.radioDot} /> : null}</View>
            <View style={{ flex: 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={s.optName} numberOfLines={2}>{fullName(o.food.name, o.food.preparation)}</Text>
                <Text style={s.optQty} numberOfLines={1}>{`${fmtAmount(on && validQty ? qty : o.amount)} ${o.food.unit}`}</Text>
              </Row>
              <Text style={s.optMacros}>
                {`${fmtMacro('kcal', n.kcal)} kcal · P ${fmtMacro('protein', n.protein)} · C ${fmtMacro('carbs', n.carbs)} · G ${fmtMacro('fat', n.fat)}`}
                {o.tag !== 'atual' ? <Text style={{ color: o.tag === 'do plano' ? colors.accent : colors.muted }}>{`  ·  ${o.tag}`}</Text> : <Text>{'  ·  atual'}</Text>}
              </Text>
            </View>
          </Pressable>
        );
      })}

      <Text style={[s.h3, { marginTop: space.lg }]}>Quantidade</Text>
      <View style={s.stepper}>
        <Pressable onPress={() => step(-1)} style={s.stepBtn} accessibilityRole="button" accessibilityLabel="Diminuir" testID="qty-minus">
          <Text style={s.stepTxt}>−</Text>
        </Pressable>
        <View style={s.stepValue}>
          <TextInput
            value={qtyText}
            onChangeText={setQtyText}
            keyboardType="decimal-pad"
            style={s.stepInput}
            testID="qty-input"
            accessibilityLabel="Quantidade"
          />
          <Text style={s.stepUnit}>{selFood?.unit || row.unit}</Text>
        </View>
        <Pressable onPress={() => step(1)} style={s.stepBtn} accessibilityRole="button" accessibilityLabel="Aumentar" testID="qty-plus">
          <Text style={s.stepTxt}>+</Text>
        </Pressable>
      </View>
      {!validQty ? <Text style={{ color: colors.alert, marginTop: 6 }}>⚠ Informe uma quantidade maior que zero.</Text> : null}
      {selected && selected.tag !== 'atual' && selected.tag !== 'do plano' ? (
        <Text style={s.hint}>Porção calculada pelo app para equivaler ao alimento atual. Confira e ajuste se quiser.</Text>
      ) : null}
      {othersText ? <Text style={s.hint}>{othersText}</Text> : null}
    </Sheet>
  );
}

function Radio({ label, hint, on, onPress, disabled, testID }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled }}
      testID={testID}
      style={[s.opt, on && s.optOn, disabled && { opacity: 0.45 }]}
    >
      <View style={[s.radio, on && s.radioOn]}>{on ? <View style={s.radioDot} /> : null}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.optName}>{label}</Text>
        {hint ? <Text style={s.optMacros}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = {
  sub: { color: colors.muted, fontSize: font.small, marginBottom: space.md, marginTop: -4 },
  h3: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: space.lg, marginBottom: space.sm },
  hint: { color: colors.muted, fontSize: font.small, marginTop: space.sm, lineHeight: 20 },
  search: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48, marginBottom: space.md,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: font.body, paddingVertical: 10 },
  opt: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.card, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, minHeight: 56,
  },
  optOn: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  optName: { color: colors.text, fontSize: font.body, fontWeight: '600', flexShrink: 1 },
  optQty: { color: colors.text, fontSize: font.body, fontWeight: '700', marginLeft: space.sm, flexShrink: 0, ...tabular },
  optMacros: { color: colors.muted, fontSize: 12, marginTop: 3, ...tabular },
  stepper: {
    flexDirection: 'row', alignItems: 'stretch', backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, overflow: 'hidden', minHeight: 52,
  },
  stepBtn: { width: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  stepTxt: { color: colors.text, fontSize: 24, fontWeight: '600' },
  stepValue: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepInput: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'right', minWidth: 60, paddingVertical: 8, ...tabular },
  stepUnit: { color: colors.text, fontSize: 18, fontWeight: '700', marginLeft: 6 },
  list: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  listRow: { paddingVertical: 12, paddingHorizontal: space.md },
  listDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  listChanged: { backgroundColor: colors.accentBg, borderLeftWidth: 3, borderLeftColor: colors.accent },
  listName: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  table: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  th: { flex: 1, color: colors.muted, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  td: { flex: 1, color: colors.muted, fontSize: font.small, textAlign: 'right', ...tabular },
};

