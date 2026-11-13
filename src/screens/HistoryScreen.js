// Histórico: semana em barras, lista de dias registrados e abertura de qualquer data.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useApp } from '../state/AppState.js';
import { Card, Btn, Row, Field, EmptyState, MacroLine, P, styles } from '../ui/kit.js';
import { colors, space, font, tabular } from '../theme.js';
import {
  addDays, formatDateLong, parseBrDate, weekdayOf, WEEKDAYS,
} from '../logic/dates.js';
import { fmtKcal } from '../logic/nutrition.js';
import { dayConsumed, dayStatus, planForWeekday } from '../logic/model.js';
import { DayView } from './DayView.js';

const STATUS = {
  ok: { icon: '✓', label: 'Dentro da meta', color: colors.accent },
  over: { icon: '⚠', label: 'Meta ultrapassada', color: colors.alert },
  nogoal: { icon: '•', label: 'Sem meta definida', color: colors.muted },
  empty: { icon: '–', label: 'Sem registro', color: colors.muted },
};

export function HistoryScreen() {
  const { state, today, historyDate, setHistoryDate } = useApp();
  const [goTo, setGoTo] = useState('');
  const [goErr, setGoErr] = useState(null);
  const [limit, setLimit] = useState(30);

  const goalsFor = (d) => (d.date === today ? state.core.goals : d.goalsSnap || state.core.goals);

  const days = useMemo(
    () => Object.values(state.days).filter((d) => d.entries.length > 0).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [state.days],
  );

  if (historyDate) {
    return <DayView date={historyDate} onBack={() => setHistoryDate(null)} onNavigate={setHistoryDate} />;
  }

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  const open = () => {
    const key = parseBrDate(goTo);
    if (!key) { setGoErr('Use o formato DD/MM/AAAA.'); return; }
    if (key > today) { setGoErr('Escolha hoje ou uma data anterior.'); return; }
    setGoErr(null);
    setHistoryDate(key);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '800', marginBottom: space.md }} accessibilityRole="header">Histórico</Text>

      <Card testID="week">
        <Text style={{ color: colors.muted, fontSize: font.small, fontWeight: '700', marginBottom: space.md }}>Últimos 7 dias · calorias consumidas</Text>
        <Row style={{ alignItems: 'flex-end', justifyContent: 'space-between' }} gap={6}>
          {week.map((k) => {
            const d = state.days[k];
            const c = dayConsumed(d).kcal;
            const goals = d ? goalsFor(d) : state.core.goals;
            const ref = goals.kcal || (d?.planSnap?.kcal) || planForWeekday(state.core, weekdayOf(k)).kcal || 0;
            const st = STATUS[dayStatus(d, goals)];
            const h = ref > 0 ? Math.min(1, c / ref) : c > 0 ? 1 : 0;
            return (
              <Pressable key={k} onPress={() => setHistoryDate(k)} style={{ flex: 1, alignItems: 'center' }} accessibilityLabel={`${formatDateLong(k)}: ${fmtKcal(c)} kcal, ${st.label}`} testID={`week-${k}`}>
                <View style={{ height: 90, width: '70%', backgroundColor: colors.border, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden', borderWidth: k === today ? 1.5 : 0, borderColor: colors.accent }}>
                  <View style={{ height: `${h * 100}%`, backgroundColor: st === STATUS.over ? colors.alert : colors.primary }} />
                </View>
                <Text style={{ color: st.color, fontWeight: '800', marginTop: 4 }}>{st.icon}</Text>
                <Text style={{ color: k === today ? colors.text : colors.muted, fontSize: 12, fontWeight: '700' }}>{WEEKDAYS[weekdayOf(k)]}</Text>
              </Pressable>
            );
          })}
        </Row>
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: space.sm }}>✓ dentro da meta · ⚠ meta ultrapassada · – sem registro. Toque num dia para abrir.</Text>
      </Card>

      <Card>
        <Text style={{ color: colors.muted, fontSize: font.small, fontWeight: '700', marginBottom: space.sm }}>Abrir uma data</Text>
        <Row style={{ alignItems: 'flex-start' }}>
          <Field style={{ flex: 1, marginBottom: 0 }} value={goTo} onChangeText={(v) => { setGoTo(v); setGoErr(null); }} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" error={goErr} maxLength={10} testID="hist-date" />
          <Btn label="Abrir" onPress={open} testID="hist-open" />
        </Row>
        <Btn small variant="ghost" label="Ontem" onPress={() => setHistoryDate(addDays(today, -1))} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
      </Card>

      <Text style={styles.section}>Dias com registro</Text>
      {days.length === 0 ? (
        <Card><EmptyState title="Nenhum registro ainda" text="Registre refeições na aba Hoje. Elas aparecerão aqui, dia a dia." /></Card>
      ) : null}
      {days.slice(0, limit).map((d) => {
        const goals = goalsFor(d);
        const st = STATUS[dayStatus(d, goals)];
        const c = dayConsumed(d);
        return (
          <Card key={d.date} onPress={() => setHistoryDate(d.date)} testID={`hist-${d.date}`}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.body, flex: 1 }}>
                {d.date === today ? 'Hoje · ' : ''}{formatDateLong(d.date)}
              </Text>
              <Text style={{ color: st.color, fontWeight: '700', fontSize: font.small }}>{`${st.icon} ${st.label}`}</Text>
            </Row>
            <MacroLine n={c} style={{ marginTop: 6 }} />
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, ...tabular }}>
              {`${d.entries.length} ${d.entries.length === 1 ? 'registro' : 'registros'}${goals.kcal != null ? ` · meta ${fmtKcal(goals.kcal)} kcal` : ''}`}
            </Text>
          </Card>
        );
      })}
      {days.length > limit ? <Btn variant="outline" label="Mostrar mais" onPress={() => setLimit((l) => l + 30)} /> : null}
      <P muted small style={{ marginTop: space.md }}>
        Os registros guardam os alimentos e valores do momento em que foram feitos: editar a dieta não muda dias anteriores.
      </P>
    </ScrollView>
  );
}
