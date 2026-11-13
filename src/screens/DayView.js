// Hoje (ou um dia do histórico): resumo do dia e as refeições em cartões simples.
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useApp } from '../state/AppState.js';
import { Btn, Row, ProgressBar, MacroTable, MacroLine, EmptyState, styles } from '../ui/kit.js';
import { MealCard } from '../ui/MealCard.js';
import { colors, space, font, radius, tabular } from '../theme.js';
import { MACRO_UNIT, fmtMacro, isOver } from '../logic/nutrition.js';
import { weekdayOf, formatDateLong, timeToMinutes, nowTime, addDays } from '../logic/dates.js';
import {
  mealsForWeekday, entryForMeal, entryNutrients, dayConsumed, planForWeekday, hasDemo, sortEntries, importPlan, hasGoals,
} from '../logic/model.js';
import { PLAN } from '../data/planoAlimentar.js';
import { EntryEditorSheet } from '../sheets/EntrySheets.js';

export function DayView({ date, onBack, onNavigate }) {
  const { state, today, setTab, apply, showToast } = useApp();
  const { core } = state;
  const isToday = date === today;
  const wd = weekdayOf(date);
  const day = state.days[date];
  const [editor, setEditor] = useState(null);

  const meals = mealsForWeekday(core, wd);
  const consumed = dayConsumed(day);
  const planned = !isToday && day?.planSnap ? day.planSnap : planForWeekday(core, wd);
  const goals = !isToday && day?.goalsSnap ? day.goalsSnap : core.goals;
  const empty = core.foods.length === 0 && core.meals.length === 0;

  const nowMin = timeToMinutes(nowTime());
  const tOf = (m) => timeToMinutes(m.time);
  const pending = meals.filter((m) => !entryForMeal(day, m.id));
  const next = isToday ? pending.find((m) => tOf(m) != null && tOf(m) >= nowMin - 60) || pending[0] : null;
  const planIds = new Set(meals.map((m) => m.id));
  const extras = sortEntries((day?.entries || []).filter((e) => !e.mealId || !planIds.has(e.mealId)));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      {onBack ? (
        <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
          <Btn small variant="ghost" label="‹ Histórico" onPress={onBack} testID="day-back" style={{ marginLeft: -12 }} />
          <Row gap={0}>
            <Btn small variant="ghost" label="‹" onPress={() => onNavigate(addDays(date, -1))} testID="day-prev" />
            <Btn small variant="ghost" label="›" disabled={date >= today} onPress={() => onNavigate(addDays(date, 1))} testID="day-next" />
          </Row>
        </Row>
      ) : null}
      <Text style={st.kicker}>{isToday ? 'Hoje' : 'Histórico'}</Text>
      <Text style={st.date} accessibilityRole="header">{formatDateLong(date)}</Text>

      {hasDemo(state) ? (
        <Pressable onPress={() => setTab('settings')} style={st.demo}>
          <Text style={{ color: colors.accent, fontSize: font.small }}>Dados de demonstração ativos · remover em Ajustes ›</Text>
        </Pressable>
      ) : null}

      {empty && isToday ? (
        <View style={st.card}>
          <EmptyState icon="◎" title="Bem-vindo ao Dietfood" text="Carregue seu plano alimentar para começar.">
            <Btn label="Carregar meu plano (3500 kcal)" testID="onb-plan" onPress={() => { apply((s) => importPlan(s, PLAN)); showToast('Plano carregado'); }} />
            <Btn label="Montar outra dieta" variant="secondary" onPress={() => setTab('diet')} testID="onb-diet" />
          </EmptyState>
        </View>
      ) : null}

      {!empty ? <DaySummary goals={goals} planned={planned} consumed={consumed} /> : null}

      {meals.length === 0 && !empty ? (
        <View style={st.card}><EmptyState title="Nenhuma refeição neste dia" text="Cadastre em Dieta." /></View>
      ) : null}

      {meals.map((m) => {
        const late = isToday && !entryForMeal(day, m.id) && tOf(m) != null && tOf(m) < nowMin && m !== next;
        return <MealCard key={m.id} meal={m} date={date} badge={m === next ? 'Próxima' : late ? 'Atrasada' : null} />;
      })}

      {extras.length ? <Text style={styles.section}>Extras</Text> : null}
      {extras.map((e) => (
        <Pressable key={e.id} onPress={() => setEditor({ entryId: e.id })} style={st.extra} testID={`extra-${e.name}`}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.body }}>{e.name}</Text>
            <Text style={{ color: colors.muted, ...tabular }}>{e.time}</Text>
          </Row>
          <Text style={{ color: colors.muted, fontSize: font.small, marginTop: 2 }} numberOfLines={1}>{e.items.map((i) => i.name).join(' · ')}</Text>
          <MacroLine n={entryNutrients(e)} style={{ marginTop: 4 }} />
        </Pressable>
      ))}
      {!empty ? <Btn label="+ Alimento fora do plano" variant="ghost" onPress={() => setEditor({})} testID="add-extra" /> : null}

      {editor ? <EntryEditorSheet date={date} {...editor} onClose={() => setEditor(null)} /> : null}
    </ScrollView>
  );
}

/** Meta, planejado e consumido — compacto, com a tabela completa sob demanda. */
export function DaySummary({ goals, planned, consumed }) {
  const [table, setTable] = useState(false);
  const g = goals.kcal;
  const over = isOver('kcal', consumed.kcal, g);
  return (
    <View style={st.card} testID="summary">
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Text style={st.big} testID="sum-kcal">
          <Text style={over ? { color: colors.alert } : null}>{fmtMacro('kcal', consumed.kcal)}</Text>
          <Text style={st.bigUnit}>{g != null ? ` / ${fmtMacro('kcal', g)} kcal` : ' kcal'}</Text>
        </Text>
        <Text style={[st.balance, over && { color: colors.alert }]}>
          {g == null ? 'sem meta' : over ? `⚠ +${fmtMacro('kcal', consumed.kcal - g)}` : `faltam ${fmtMacro('kcal', g - consumed.kcal)}`}
        </Text>
      </Row>
      {g != null ? <ProgressBar value={consumed.kcal} max={Math.max(g, consumed.kcal)} marker={planned.kcal} over={over} /> : null}
      <Row style={{ marginTop: space.sm }} gap={space.sm}>
        {['protein', 'carbs', 'fat'].map((m) => {
          const gm = goals[m];
          const o = isOver(m, consumed[m], gm);
          return (
            <View key={m} style={{ flex: 1 }} testID={`sum-${m}`}>
              <Text style={[st.macroVal, o && { color: colors.alert }]}>
                {`${fmtMacro(m, consumed[m])}${gm != null ? `/${fmtMacro(m, gm)}` : ''} g`}
              </Text>
              <Text style={st.macroLbl}>{`${{ protein: 'proteína', carbs: 'carboidratos', fat: 'gorduras' }[m]}${o ? ' ⚠' : ''}`}</Text>
              {gm != null ? <ProgressBar value={consumed[m]} max={Math.max(gm, consumed[m])} over={o} /> : null}
            </View>
          );
        })}
      </Row>
      <Pressable onPress={() => setTable((v) => !v)} style={{ paddingTop: space.sm }} testID="toggle-table">
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {`Planejado ${fmtMacro('kcal', planned.kcal)} ${MACRO_UNIT.kcal}  ·  ${table ? 'ocultar ⌃' : 'meta × planejado × consumido ⌄'}`}
        </Text>
      </Pressable>
      {table ? <MacroTable goals={goals} planned={planned} consumed={consumed} /> : null}
      {!hasGoals(goals) ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Defina metas em Ajustes.</Text> : null}
    </View>
  );
}

const st = {
  kicker: { color: colors.accent, fontWeight: '800', fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  date: { color: colors.text, fontSize: font.title, fontWeight: '800', marginBottom: space.md },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, marginBottom: space.md },
  demo: { backgroundColor: colors.accentBg, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  big: { color: colors.text, fontSize: 30, fontWeight: '800', ...tabular },
  bigUnit: { color: colors.muted, fontSize: font.body, fontWeight: '600' },
  balance: { color: colors.accent, fontSize: font.small, fontWeight: '700', marginBottom: 6, ...tabular },
  macroVal: { color: colors.text, fontSize: font.small, fontWeight: '800', ...tabular },
  macroLbl: { color: colors.muted, fontSize: 11 },
  extra: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, marginBottom: space.sm },
};
