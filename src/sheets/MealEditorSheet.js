// Cadastro/edição de refeição: nome, horário, dias, alimentos, quantidades,
// substituições e observações, com totais calculados ao vivo.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp } from '../state/AppState.js';
import { Sheet, Field, Chips, Btn, Row, MacroLine, Notice, P, H2 } from '../ui/kit.js';
import { colors, space, font, radius } from '../theme.js';
import { WEEKDAYS, normalizeTime } from '../logic/dates.js';
import { nutrientsFor, refOf, sumN, parseNumber } from '../logic/nutrition.js';
import { saveMeal, foodById, newId, mealDraftFrom } from '../logic/model.js';
import { FoodPickerSheet, FoodTitle } from './FoodSheets.js';

export function MealEditorSheet({ mealId, copyFromId, defaultDay = 0, onClose }) {
  const { state, apply, showToast } = useApp();
  const { core } = state;
  const source = core.meals.find((m) => m.id === (mealId || copyFromId));
  const [draft, setDraft] = useState(() => {
    if (source && mealId) return mealDraftFrom(source);
    if (source) return mealDraftFrom(source, { name: `${source.name} (cópia)`, days: [defaultDay] });
    return { name: '', time: '', days: [defaultDay], notes: '', items: [] };
  });
  const [errors, setErrors] = useState({});
  const [picker, setPicker] = useState(null); // { kind: 'new' | 'item' | 'sub' | 'newSub', itemId, subId }

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const updateItem = (id, patch) => setDraft((d) => ({
    ...d, items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
  }));
  const updateSub = (itemId, subId, patch) => setDraft((d) => ({
    ...d,
    items: d.items.map((it) => (it.id !== itemId ? it : {
      ...it, subs: it.subs.map((s) => (s.id === subId ? { ...s, ...patch } : s)),
    })),
  }));
  const clearErr = (...keys) => setErrors((e) => {
    const n = { ...e };
    keys.forEach((k) => delete n[k]);
    return n;
  });

  const lineFor = (foodId, amountText) => {
    const food = foodById(core, foodId);
    const a = parseNumber(amountText);
    if (!food || !(a > 0)) return null;
    return nutrientsFor(refOf(food), a);
  };

  const total = useMemo(
    () => sumN(draft.items.map((it) => lineFor(it.foodId, it.amount)).filter(Boolean)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.items, core.foods],
  );

  const onPick = (food) => {
    const p = picker;
    setPicker(null);
    if (p.kind === 'new') {
      setDraft((d) => ({
        ...d,
        items: [...d.items, { id: newId('item'), foodId: food.id, amount: String(food.refAmount).replace('.', ','), note: '', subs: [] }],
      }));
      clearErr('items');
    } else if (p.kind === 'item') {
      updateItem(p.itemId, { foodId: food.id });
      clearErr(`item:${p.itemId}:food`);
    } else if (p.kind === 'newSub') {
      setDraft((d) => ({
        ...d,
        items: d.items.map((it) => (it.id !== p.itemId ? it : {
          ...it, subs: [...it.subs, { id: newId('sub'), foodId: food.id, amount: String(food.refAmount).replace('.', ',') }],
        })),
      }));
    } else if (p.kind === 'sub') {
      updateSub(p.itemId, p.subId, { foodId: food.id });
      clearErr(`sub:${p.subId}:food`);
    }
  };

  const save = () => {
    try {
      const d = { ...draft, time: normalizeTime(draft.time) };
      apply((s) => saveMeal(s, d, mealId || null));
      showToast(mealId ? 'Refeição atualizada' : 'Refeição criada');
      onClose();
    } catch (e) {
      setErrors(e.errors || { form: 'Não foi possível salvar.' });
    }
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Sheet
      visible
      title={mealId ? 'Editar refeição' : copyFromId ? 'Nova refeição (cópia)' : 'Nova refeição'}
      onClose={onClose}
      testID="meal-editor"
      footer={(
        <>
          <Btn label="Cancelar" variant="secondary" onPress={onClose} flex />
          <Btn label="Salvar refeição" onPress={save} flex testID="meal-save" />
        </>
      )}
    >
      {hasErrors ? <Notice tone="alert" text={errors.form || 'Revise os campos destacados.'} /> : null}
      <Field label="Nome *" value={draft.name} onChangeText={(v) => { update({ name: v }); clearErr('name'); }} error={errors.name} placeholder="Ex.: Café da manhã" testID="meal-name" maxLength={50} />
      <Field
        label="Horário (opcional)"
        value={draft.time}
        onChangeText={(v) => { update({ time: v }); clearErr('time'); }}
        onBlur={() => update({ time: normalizeTime(draft.time) })}
        error={errors.time}
        placeholder="07:30"
        hint="Com horário, o app ordena as refeições e indica a próxima e as atrasadas."
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        testID="meal-time"
      />
      <Text style={lbl}>Dias da semana *</Text>
      <Chips
        multi
        small
        options={WEEKDAYS.map((w, i) => ({ value: i, label: w }))}
        value={draft.days}
        onChange={(v) => { update({ days: v }); clearErr('days'); }}
        testIDPrefix="meal-day"
      />
      <Row style={{ marginTop: space.sm }}>
        <Btn small variant="ghost" label="Todos os dias" onPress={() => { update({ days: [0, 1, 2, 3, 4, 5, 6] }); clearErr('days'); }} />
        <Btn small variant="ghost" label="Seg a Sex" onPress={() => { update({ days: [0, 1, 2, 3, 4] }); clearErr('days'); }} />
      </Row>
      {errors.days ? <Text style={errStyle}>⚠ {errors.days}</Text> : null}
      <P muted small style={{ marginTop: 4 }}>
        A mesma refeição vale para todos os dias marcados: editar aqui muda todos eles.
      </P>

      <H2 style={{ marginTop: space.xl, marginBottom: space.sm }}>Alimentos</H2>
      {draft.items.length === 0 ? (
        <P muted style={{ marginBottom: space.md }}>Nenhum alimento ainda.</P>
      ) : null}
      {draft.items.map((it, idx) => {
        const food = foodById(core, it.foodId);
        const n = lineFor(it.foodId, it.amount);
        return (
          <View key={it.id} style={box} testID={`meal-item-${idx}`}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Pressable
                style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
                onPress={() => setPicker({ kind: 'item', itemId: it.id })}
                accessibilityLabel="Trocar alimento"
              >
                {food ? <FoodTitle food={food} /> : <Text style={{ color: colors.alert }}>Escolher alimento</Text>}
                {errors[`item:${it.id}:food`] ? <Text style={errStyle}>⚠ {errors[`item:${it.id}:food`]}</Text> : null}
              </Pressable>
              <Btn small variant="ghost" label="Remover" onPress={() => setDraft((d) => ({ ...d, items: d.items.filter((x) => x.id !== it.id) }))} />
            </Row>
            <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
              <Field
                style={{ flex: 1, marginBottom: 0 }}
                label="Quantidade *"
                value={it.amount}
                onChangeText={(v) => { updateItem(it.id, { amount: v }); clearErr(`item:${it.id}:amount`); }}
                keyboardType="decimal-pad"
                suffix={food?.unit}
                error={errors[`item:${it.id}:amount`]}
                testID={`meal-item-${idx}-amount`}
              />
              <Field
                style={{ flex: 1.3, marginBottom: 0 }}
                label="Medida caseira"
                value={it.note}
                onChangeText={(v) => updateItem(it.id, { note: v })}
                placeholder="Ex.: 2 colheres"
                maxLength={60}
              />
            </Row>
            {n ? <MacroLine n={n} style={{ marginTop: space.sm }} /> : null}

            {it.subs.length ? <Text style={[lbl, { marginTop: space.md }]}>Substituições</Text> : null}
            {it.subs.map((sub) => {
              const sf = foodById(core, sub.foodId);
              const sn = lineFor(sub.foodId, sub.amount);
              return (
                <View key={sub.id} style={subBox}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Pressable style={{ flex: 1, minHeight: 40, justifyContent: 'center' }} onPress={() => setPicker({ kind: 'sub', itemId: it.id, subId: sub.id })}>
                      <Text style={{ color: colors.muted, fontSize: font.small }}>ou</Text>
                      {sf ? <FoodTitle food={sf} /> : <Text style={{ color: colors.alert }}>Escolher alimento</Text>}
                    </Pressable>
                    <Btn small variant="ghost" label="Remover" onPress={() => updateItem(it.id, { subs: it.subs.filter((x) => x.id !== sub.id) })} />
                  </Row>
                  <Field
                    style={{ marginBottom: 0 }}
                    value={sub.amount}
                    onChangeText={(v) => { updateSub(it.id, sub.id, { amount: v }); clearErr(`sub:${sub.id}:amount`); }}
                    keyboardType="decimal-pad"
                    suffix={sf?.unit}
                    error={errors[`sub:${sub.id}:amount`] || errors[`sub:${sub.id}:food`]}
                    placeholder="Quantidade"
                  />
                  {sn ? <MacroLine n={sn} style={{ marginTop: 6 }} /> : null}
                </View>
              );
            })}
            <Btn small variant="ghost" label="+ Substituição" onPress={() => setPicker({ kind: 'newSub', itemId: it.id })} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
          </View>
        );
      })}
      {errors.items ? <Text style={[errStyle, { marginBottom: space.sm }]}>⚠ {errors.items}</Text> : null}
      <Btn label="+ Adicionar alimento" variant="outline" onPress={() => setPicker({ kind: 'new' })} testID="meal-add-food" />

      <Field
        style={{ marginTop: space.xl }}
        label="Observações"
        value={draft.notes}
        onChangeText={(v) => update({ notes: v })}
        multiline
        placeholder="Ex.: preferir pão integral; tomar com água"
        maxLength={500}
      />

      <View style={[box, { borderColor: colors.accent }]}>
        <Text style={lbl}>Total da refeição</Text>
        <MacroLine n={total} strong />
        {draft.items.some((it) => !(parseNumber(it.amount) > 0) || !foodById(core, it.foodId)) ? (
          <P muted small style={{ marginTop: 4 }}>Itens sem alimento ou quantidade não entram no total.</P>
        ) : null}
      </View>

      {picker ? (
        <FoodPickerSheet
          title={picker.kind === 'newSub' || picker.kind === 'sub' ? 'Alimento substituto' : 'Escolher alimento'}
          onPick={onPick}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </Sheet>
  );
}

const lbl = { color: colors.muted, fontSize: font.small, marginBottom: 6, fontWeight: '600' };
const errStyle = { color: colors.alert, fontSize: font.small, marginTop: 4 };
const box = {
  backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  padding: space.md, marginBottom: space.md,
};
const subBox = {
  borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: space.md, marginTop: space.sm,
};

