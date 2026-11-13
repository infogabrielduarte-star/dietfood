// Cartão de refeição minimalista: horário e nome, alimentos e quantidades,
// resumo de calorias e macros e a ação de registrar. Detalhes ficam em "Ver detalhes".
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp } from '../state/AppState.js';
import { Btn, Row } from './kit.js';
import { colors, space, font, radius, tabular } from '../theme.js';
import { fmtMacro, fmtAmount, hasValues, fmtKcal } from '../logic/nutrition.js';
import { entryForMeal, foodById } from '../logic/model.js';
import { daysLabel } from '../logic/dates.js';
import { SwapSheet, mealRows, rowsTotal } from '../sheets/SwapSheet.js';
import { EntryEditorSheet, useQuickRegister, useUndoableDelete } from '../sheets/EntrySheets.js';
import { prepLabel } from '../sheets/FoodSheets.js';

export function MacroSummary({ n, partial, testID }) {
  const cells = [
    { v: `${fmtMacro('kcal', n.kcal)}${partial ? '+' : ''}`, u: 'kcal', big: true },
    { v: `${fmtMacro('protein', n.protein)} g`, u: 'proteína' },
    { v: `${fmtMacro('carbs', n.carbs)} g`, u: 'carboidratos' },
    { v: `${fmtMacro('fat', n.fat)} g`, u: 'gorduras' },
  ];
  return (
    <View style={st.summary} testID={testID}>
      {cells.map((c, i) => (
        <View key={c.u} style={[st.sumCell, i > 0 && st.sumDivider]}>
          <Text style={[st.sumValue, c.big && { fontSize: 17 }]} numberOfLines={1}>
            {c.v}{c.big ? <Text style={st.sumUnitInline}> kcal</Text> : null}
          </Text>
          {!c.big ? <Text style={st.sumUnit} numberOfLines={1}>{c.u}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * mode 'day': mostra o registrado (se houver) ou o planejado, com "Comi conforme a dieta".
 * mode 'plan': mostra a dieta (aba Dieta); tocar num alimento troca no plano.
 */
export function MealCard({ meal, date, mode = 'day', badge, onEdit, extraActions }) {
  const { state } = useApp();
  const { core } = state;
  const day = date ? state.days[date] : null;
  const entry = mode === 'day' ? entryForMeal(day, meal.id) : null;
  const rows = mealRows(core, meal, entry);
  const total = rowsTotal(rows);
  const partial = rows.some((r) => !hasValues(r.ref));
  const quick = useQuickRegister();
  const undo = useUndoableDelete();
  const [swapKey, setSwapKey] = useState(null);
  const [open, setOpen] = useState(false);
  const [editor, setEditor] = useState(null);

  const status = entry
    ? { text: `✓ ${entry.time}`, color: colors.accent }
    : badge ? { text: badge, color: badge === 'Próxima' ? colors.accent : colors.muted } : null;

  return (
    <View style={[st.card, badge === 'Próxima' && !entry && st.cardNext]} testID={`meal-${meal.name}`}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space.md }}>
        <View style={{ flex: 1 }}>
          <Text style={st.title} accessibilityRole="header">{meal.name}</Text>
          <Text style={st.time}>{meal.time || 'Sem horário'}</Text>
        </View>
        {status ? <Text style={[st.status, { color: status.color, borderColor: status.color }]}>{status.text}</Text> : null}
      </Row>

      {rows.length === 0 ? <Text style={st.muted}>Nenhum alimento.</Text> : null}
      {rows.map((r) => (
        <Pressable
          key={r.key}
          onPress={() => setSwapKey(r.key)}
          accessibilityRole="button"
          accessibilityLabel={`${r.name}, ${fmtAmount(r.amount)} ${r.unit}. Trocar ou ajustar`}
          testID={`row-${meal.name}-${r.name}`}
          style={({ pressed }) => [st.row, swapKey === r.key && st.rowActive, pressed && { opacity: 0.8 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={st.rowName} numberOfLines={2}>
              {r.name}
              {prepLabel(r.prep) ? <Text style={st.rowPrep}>{` ${prepLabel(r.prep)}`}</Text> : null}
            </Text>
            <Text style={st.rowQty} numberOfLines={1}>
              {`${fmtAmount(r.amount)} ${r.unit}${r.note ? ` · ${r.note}` : ''}`}
            </Text>
          </View>
          {r.subsCount ? <Text style={st.alt}>{`⇄ ${r.subsCount}`}</Text> : null}
          <Text style={st.chev}>›</Text>
        </Pressable>
      ))}

      <MacroSummary n={total} partial={partial} testID={`sum-${meal.name}`} />

      {mode === 'day' ? (
        entry ? (
          <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
            <Text style={st.muted}>{`Registrado às ${entry.time}`}</Text>
            <Btn small variant="ghost" label="Desfazer" onPress={() => undo(date, entry)} testID={`undo-${meal.name}`} />
          </Row>
        ) : (
          <Btn label="Comi conforme a dieta" onPress={() => quick(date, meal)} style={{ marginTop: space.md }} testID={`quick-${meal.name}`} />
        )
      ) : null}

      <Pressable onPress={() => setOpen((v) => !v)} style={st.more} accessibilityRole="button" accessibilityState={{ expanded: open }} testID={`more-${meal.name}`}>
        <Text style={st.moreTxt}>{open ? 'Ocultar detalhes ⌃' : 'Ver detalhes ⌄'}</Text>
      </Pressable>

      {open ? (
        <View style={st.details}>
          {meal.notes ? <Text style={st.detailText}>{meal.notes}</Text> : null}
          {mode === 'plan' ? <Text style={st.detailMuted}>{`Dias: ${daysLabel(meal.days)}`}</Text> : null}
          {rows.map((r) => {
            const f = foodById(core, r.foodId);
            const src = f?.sourceNote;
            return src || f?.estimated ? (
              <Text key={`src-${r.key}`} style={st.detailMuted}>
                {`${r.name}: ${src || 'fonte não informada'}${f?.estimated ? ` · estimado (${f.dataNote})` : ''}`}
              </Text>
            ) : null;
          })}
          {partial ? <Text style={st.detailMuted}>+ Total parcial: há alimento sem valores nutricionais (preencha em Dieta › Alimentos).</Text> : null}
          {meal.reference ? (
            <Text style={st.detailMuted}>
              {`Referência do plano: ${fmtKcal(meal.reference.kcal)} kcal · P ${fmtMacro('protein', meal.reference.protein)} · C ${fmtMacro('carbs', meal.reference.carbs)} · G ${fmtMacro('fat', meal.reference.fat)}`}
            </Text>
          ) : null}
          <Row style={{ flexWrap: 'wrap', marginTop: space.sm }} gap={space.sm}>
            {mode === 'day' ? (
              <Btn
                small
                variant="outline"
                label={entry ? 'Adicionar ou remover alimentos' : 'Registrar com ajustes'}
                onPress={() => setEditor(entry ? { entryId: entry.id } : { mealId: meal.id })}
                testID={`adjust-${meal.name}`}
              />
            ) : null}
            {onEdit ? <Btn small variant="outline" label="Editar refeição" onPress={onEdit} testID={`edit-${meal.name}`} /> : null}
            {extraActions}
          </Row>
        </View>
      ) : null}

      {swapKey ? (
        <SwapSheet meal={meal} date={date} rowKey={swapKey} planOnly={mode === 'plan'} onClose={() => setSwapKey(null)} />
      ) : null}
      {editor ? <EntryEditorSheet date={date} {...editor} onClose={() => setEditor(null)} /> : null}
    </View>
  );
}

const st = {
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: space.lg, marginBottom: space.md,
  },
  cardNext: { borderColor: colors.accent },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  time: { color: colors.muted, fontSize: font.body, marginTop: 2, ...tabular },
  status: { fontSize: 12, fontWeight: '800', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.field, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, paddingVertical: 12, paddingHorizontal: space.md, marginBottom: space.sm, minHeight: 60,
  },
  rowActive: { borderColor: colors.accent },
  rowName: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  rowPrep: { color: colors.muted, fontWeight: '400', fontSize: font.small },
  rowQty: { color: colors.muted, fontSize: font.small, marginTop: 2, ...tabular },
  alt: { color: colors.muted, fontSize: 12, marginRight: space.sm },
  chev: { color: colors.muted, fontSize: 24, marginLeft: 4 },
  summary: { flexDirection: 'row', marginTop: space.sm, paddingVertical: space.sm },
  sumCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  sumDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  sumValue: { color: colors.text, fontSize: 15, fontWeight: '800', ...tabular },
  sumUnitInline: { color: colors.text, fontSize: 13, fontWeight: '700' },
  sumUnit: { color: colors.muted, fontSize: 11, marginTop: 1 },
  muted: { color: colors.muted, fontSize: font.small },
  more: { alignItems: 'center', paddingTop: space.md, minHeight: 40, justifyContent: 'center' },
  moreTxt: { color: colors.muted, fontSize: font.small, fontWeight: '600' },
  details: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: space.sm, paddingTop: space.md, gap: 6 },
  detailText: { color: colors.text, fontSize: font.small, lineHeight: 20 },
  detailMuted: { color: colors.muted, fontSize: 12, lineHeight: 17 },
};
