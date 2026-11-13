// Registro de consumo: detalhe da refeição, registro com ajustes, extras e correções.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp, errorText } from '../state/AppState.js';
import { Sheet, Field, Btn, Row, MacroLine, Notice, P, Tag, DemoTag, Chips, Segmented } from '../ui/kit.js';
import { colors, space, font, radius } from '../theme.js';
import { nutrientsFor, refOf, sumN, parseNumber, fmtAmount, fmtKcal, fmtMacro, hasValues } from '../logic/nutrition.js';
import {
  foodById, mealNutrients, entryForMeal, entryNutrients, registerAsPlanned, saveEntry, deleteEntry,
  snapshotItem, newId, copyDay, mealsForWeekday,
} from '../logic/model.js';
import {
  nowTime, normalizeTime, daysLabel, WEEKDAYS, WEEKDAYS_LONG,
} from '../logic/dates.js';
import { FoodPickerSheet, FoodTitle, prepLabel } from './FoodSheets.js';

/** Registro rápido compartilhado pela tela Hoje e pelo detalhe da refeição. */
export function useQuickRegister() {
  const { apply, showToast, today } = useApp();
  return (date, meal) => {
    try {
      const entry = apply((s) => registerAsPlanned(s, date, meal.id, date === today ? nowTime() : meal.time));
      showToast(`Registrado: ${meal.name} · ${fmtKcal(entryNutrients(entry).kcal)} kcal`, {
        label: 'Desfazer',
        onPress: () => apply((s) => deleteEntry(s, date, entry.id)),
      });
      return true;
    } catch (e) {
      showToast(errorText(e), null, 'alert');
      return false;
    }
  };
}

export function useUndoableDelete() {
  const { apply, showToast, confirm } = useApp();
  return async (date, entry, onDone) => {
    const okDel = await confirm({
      title: 'Desfazer registro?',
      message: `"${entry.name}" deixará de contar no consumido deste dia.`,
      confirmLabel: 'Desfazer registro',
      danger: true,
    });
    if (!okDel) return;
    apply((s) => deleteEntry(s, date, entry.id));
    onDone?.();
    showToast('Registro removido', {
      label: 'Desfazer',
      onPress: () => {
        try { apply((s) => saveEntry(s, date, entry)); } catch (e) { showToast(errorText(e), null, 'alert'); }
      },
    });
  };
}

function rowsFromMeal(core, meal) {
  return meal.items
    .map((it) => {
      const options = [it, ...(it.subs || [])]
        .map((o) => ({ foodId: o.foodId, amount: o.amount }))
        .filter((o) => foodById(core, o.foodId));
      if (!options.length || !foodById(core, it.foodId)) return null;
      return {
        key: newId('row'), include: true, options, choice: 0, amountText: fmtAmount(it.amount), isExtra: false, note: it.note,
      };
    })
    .filter(Boolean);
}

function rowsFromEntry(entry) {
  return entry.items.map((it) => ({
    key: it.id, include: true, options: [{ snap: it, amount: it.amount }], choice: 0,
    amountText: fmtAmount(it.amount), isExtra: false, substitutedFor: it.substitutedFor,
  }));
}

/**
 * Registro com ajustes (mealId), correção (entryId) ou extra (nenhum dos dois).
 * onClose(saved:boolean)
 */
export function EntryEditorSheet({ date, mealId, entryId, onClose }) {
  const { state, apply, showToast, today } = useApp();
  const { core } = state;
  const day = state.days[date];
  const entry = entryId ? day?.entries.find((e) => e.id === entryId) : null;
  const meal = mealId ? core.meals.find((m) => m.id === mealId) : null;
  const mode = entry ? 'edit' : meal ? 'plan' : 'extra';

  const [rows, setRows] = useState(() => (entry ? rowsFromEntry(entry) : meal ? rowsFromMeal(core, meal) : []));
  const [name, setName] = useState(entry?.name || meal?.name || 'Extra');
  const [time, setTime] = useState(entry?.time || (date === today ? nowTime() : meal?.time || '12:00'));
  const [errors, setErrors] = useState({});
  const [picker, setPicker] = useState(null); // { kind: 'extra' } | { kind: 'swap', key }
  const undo = useUndoableDelete();

  const optionInfo = (opt) => {
    if (opt.snap) return { name: opt.snap.name, prep: opt.snap.preparation, unit: opt.snap.unit, ref: opt.snap.ref, demo: opt.snap.demo };
    const f = foodById(core, opt.foodId);
    return f ? { name: f.name, prep: f.preparation, unit: f.unit, ref: refOf(f), demo: f.demo, food: f } : null;
  };

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const total = useMemo(() => sumN(rows.filter((r) => r.include).map((r) => {
    const info = optionInfo(r.options[r.choice]);
    const a = parseNumber(r.amountText);
    return info && a > 0 ? nutrientsFor(info.ref, a) : nutrientsFor(null, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [rows, core.foods]);

  const onPick = (food) => {
    const p = picker;
    setPicker(null);
    if (p.kind === 'extra') {
      setRows((rs) => [...rs, {
        key: newId('row'), include: true, options: [{ foodId: food.id, amount: food.refAmount }], choice: 0,
        amountText: fmtAmount(food.refAmount), isExtra: true,
      }]);
    } else {
      setRows((rs) => rs.map((r) => {
        if (r.key !== p.key) return r;
        const orig = optionInfo(r.options[0]);
        return {
          ...r, options: [{ foodId: food.id, amount: food.refAmount }], choice: 0, amountText: fmtAmount(food.refAmount),
          substitutedFor: r.isExtra ? undefined : r.substitutedFor || orig?.name,
        };
      }));
    }
    setErrors({});
  };

  const save = () => {
    const errs = {};
    const items = [];
    for (const r of rows.filter((x) => x.include)) {
      const opt = r.options[r.choice];
      const info = optionInfo(opt);
      const a = parseNumber(r.amountText);
      if (!(a > 0)) { errs[r.key] = 'Quantidade maior que zero.'; continue; }
      if (!info) { errs[r.key] = 'Alimento não encontrado.'; continue; }
      if (opt.snap) {
        items.push({ ...opt.snap, amount: a });
      } else {
        const subFor = r.choice > 0 ? optionInfo(r.options[0])?.name : r.substitutedFor;
        items.push(snapshotItem(info.food, a, subFor ? { substitutedFor: subFor } : {}));
      }
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (items.length === 0) {
      setErrors({ form: mode === 'edit' ? 'Nenhum alimento marcado. Para remover o registro, use "Desfazer registro".' : 'Marque ou adicione pelo menos um alimento.' });
      return;
    }
    const t = normalizeTime(time);
    try {
      apply((s) => saveEntry(s, date, {
        ...(entry || {}),
        id: entry?.id,
        mealId: entry ? entry.mealId : mealId || null,
        name,
        time: t,
        items,
      }));
      showToast(mode === 'edit' ? 'Registro corrigido' : 'Consumo registrado');
      onClose(true);
    } catch (e) {
      setErrors({ form: errorText(e), ...(e.errors || {}) });
    }
  };

  const title = mode === 'edit' ? 'Corrigir registro' : mode === 'plan' ? `Registrar: ${meal.name}` : 'Registrar alimento extra';

  return (
    <Sheet
      visible
      title={title}
      onClose={() => onClose(false)}
      testID="entry-editor"
      footer={(
        <>
          <Btn label="Cancelar" variant="secondary" onPress={() => onClose(false)} flex />
          <Btn label="Salvar registro" onPress={save} flex testID="entry-save" />
        </>
      )}
    >
      {errors.form ? <Notice tone="alert" text={errors.form} /> : null}
      {errors.duplicate ? <Notice tone="alert" text={errors.duplicate} /> : null}
      <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
        {mode !== 'plan' ? (
          <Field style={{ flex: 2 }} label="Nome" value={name} onChangeText={setName} error={errors.name} testID="entry-name" maxLength={50} />
        ) : null}
        <Field
          style={{ flex: 1 }}
          label="Horário"
          value={time}
          onChangeText={setTime}
          onBlur={() => setTime(normalizeTime(time))}
          error={errors.time}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          testID="entry-time"
        />
      </Row>
      {mode === 'plan' ? <P muted small style={{ marginBottom: space.md }}>Desmarque o que não comeu, ajuste as quantidades ou escolha uma substituição.</P> : null}
      {mode === 'edit' ? <P muted small style={{ marginBottom: space.md }}>Os valores usados são os do momento do registro. Alterações na dieta não mudam este registro.</P> : null}
      {rows.length === 0 ? <P muted style={{ marginBottom: space.md }}>Nenhum alimento. Adicione abaixo.</P> : null}

      {rows.map((r, idx) => {
        const info = optionInfo(r.options[r.choice]);
        const a = parseNumber(r.amountText);
        const n = info && a > 0 ? nutrientsFor(info.ref, a) : null;
        return (
          <View key={r.key} style={[itemBox, !r.include && { opacity: 0.5 }]} testID={`entry-row-${idx}`}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Pressable
                onPress={() => setRow(r.key, { include: !r.include })}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: r.include }}
                accessibilityLabel={`Comi ${info?.name || ''}`}
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minHeight: 44, gap: space.sm }}
                testID={`entry-row-${idx}-toggle`}
              >
                <View style={[check, r.include && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  {r.include ? <Text style={{ color: colors.onPrimary, fontWeight: '800' }}>✓</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>
                    {info?.name || 'Alimento removido'}
                    {info && prepLabel(info.prep) ? <Text style={{ color: colors.muted, fontWeight: '400' }}>{` (${prepLabel(info.prep)})`}</Text> : null}
                  </Text>
                  {r.isExtra ? <Text style={noteText}>extra</Text> : null}
                  {!r.isExtra && (r.choice > 0 || r.substitutedFor) ? (
                    <Text style={noteText}>{`substitui ${r.choice > 0 ? optionInfo(r.options[0])?.name : r.substitutedFor}`}</Text>
                  ) : null}
                  {r.note ? <Text style={noteText}>{r.note}</Text> : null}
                </View>
              </Pressable>
              {info?.demo ? <DemoTag /> : null}
            </Row>
            {r.include ? (
              <>
                {r.options.length > 1 ? (
                  <View style={{ marginBottom: space.sm }}>
                    <Text style={lbl}>Substituir por</Text>
                    <Chips
                      small
                      options={r.options.map((o, i) => ({ value: i, label: i === 0 ? `${optionInfo(o).name} (previsto)` : optionInfo(o).name }))}
                      value={r.choice}
                      onChange={(i) => setRow(r.key, { choice: i, amountText: fmtAmount(r.options[i].amount) })}
                      testIDPrefix={`entry-row-${idx}-opt`}
                    />
                  </View>
                ) : null}
                <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
                  <Field
                    style={{ flex: 1, marginBottom: 0 }}
                    value={r.amountText}
                    onChangeText={(v) => { setRow(r.key, { amountText: v }); setErrors((e) => ({ ...e, [r.key]: undefined })); }}
                    keyboardType="decimal-pad"
                    suffix={info?.unit}
                    error={errors[r.key]}
                    testID={`entry-row-${idx}-amount`}
                    accessibilityLabel="Quantidade"
                  />
                  <Btn small variant="outline" label="Trocar" onPress={() => setPicker({ kind: 'swap', key: r.key })} />
                  {r.isExtra || mode !== 'plan' ? (
                    <Btn small variant="ghost" label="Remover" onPress={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
                  ) : null}
                </Row>
                {n && info && hasValues(info.ref) ? <MacroLine n={n} style={{ marginTop: 6 }} /> : null}
                {info && !hasValues(info.ref) ? <Text style={{ color: colors.alert, fontSize: font.small, marginTop: 6 }}>⚠ Sem valores nutricionais: não entra no total</Text> : null}
              </>
            ) : <Text style={noteText}>Não comi — não entra no total</Text>}
          </View>
        );
      })}

      <Btn label="+ Adicionar alimento extra" variant="outline" onPress={() => setPicker({ kind: 'extra' })} testID="entry-add-extra" />

      <View style={[itemBox, { borderColor: colors.accent, marginTop: space.md }]}>
        <Text style={lbl}>Total deste registro</Text>
        <MacroLine n={total} strong />
      </View>

      {mode === 'edit' ? (
        <Btn label="Desfazer registro" variant="danger" onPress={() => undo(date, entry, () => onClose(true))} testID="entry-delete" />
      ) : null}

      {picker ? (
        <FoodPickerSheet
          title={picker.kind === 'extra' ? 'Alimento extra' : 'Trocar por'}
          onPick={onPick}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </Sheet>
  );
}

/** Copiar as refeições de um dia da semana para outros. */
export function CopyDaySheet({ fromDay, onClose }) {
  const { state, apply, showToast } = useApp();
  const [targets, setTargets] = useState([]);
  const [mode, setMode] = useState('add');
  const [error, setError] = useState(null);
  const count = mealsForWeekday(state.core, fromDay).length;

  const run = () => {
    try {
      const n = apply((s) => copyDay(s, fromDay, targets, mode));
      showToast(`${n} refeição(ões) copiada(s)`);
      onClose();
    } catch (e) {
      setError(e.errors?.days || errorText(e));
    }
  };

  return (
    <Sheet
      visible
      title={`Copiar ${WEEKDAYS_LONG[fromDay]}`}
      onClose={onClose}
      testID="copy-day"
      footer={(
        <>
          <Btn label="Cancelar" variant="secondary" onPress={onClose} flex />
          <Btn label="Copiar" onPress={run} flex testID="copy-run" />
        </>
      )}
    >
      <P muted style={{ marginBottom: space.md }}>{`${count} refeição(ões) serão copiadas. As cópias são independentes: editar uma não muda as outras.`}</P>
      <Text style={lbl}>Para quais dias?</Text>
      <Chips
        multi
        small
        options={WEEKDAYS.map((w, i) => ({ value: i, label: w })).filter((o) => o.value !== fromDay)}
        value={targets}
        onChange={(v) => { setTargets(v); setError(null); }}
        testIDPrefix="copy-day"
      />
      {error ? <Text style={{ color: colors.alert, marginTop: 6 }}>⚠ {error}</Text> : null}
      <Text style={[lbl, { marginTop: space.lg }]}>Nos dias escolhidos</Text>
      <Segmented
        options={[{ value: 'add', label: 'Adicionar' }, { value: 'replace', label: 'Substituir' }]}
        value={mode}
        onChange={setMode}
        testIDPrefix="copy-mode"
      />
      <P muted small style={{ marginTop: space.sm }}>
        {mode === 'add'
          ? 'As refeições serão somadas às que já existem nesses dias.'
          : 'As refeições existentes nesses dias serão retiradas deles antes da cópia.'}
      </P>
    </Sheet>
  );
}

const lbl = { color: colors.muted, fontSize: font.small, marginBottom: 6, fontWeight: '600' };
const itemBox = {
  backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  padding: space.md, marginBottom: space.sm,
};
const amountText = { color: colors.accent, fontWeight: '700', fontSize: font.body, marginLeft: space.sm };
const noteText = { color: colors.muted, fontSize: font.small };
const check = {
  width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: colors.border,
  alignItems: 'center', justifyContent: 'center',
};
