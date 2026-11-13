// Minha dieta: plano por dia da semana (refeições) e cadastro de alimentos.
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useApp } from '../state/AppState.js';
import {
  Card, Btn, Row, Tag, DemoTag, Chips, Segmented, MacroLine, EmptyState, Field, P, styles,
} from '../ui/kit.js';
import { colors, space, font, tabular } from '../theme.js';
import { WEEKDAYS, WEEKDAYS_LONG, daysLabel, weekdayOf } from '../logic/dates.js';
import { fmtAmount, fmtMacro, isOver, MACROS, hasValues } from '../logic/nutrition.js';
import {
  mealsForWeekday, mealNutrients, planForWeekday, deleteMeal, foodById, hasGoals,
} from '../logic/model.js';
import { MealEditorSheet } from '../sheets/MealEditorSheet.js';
import { MealCard } from '../ui/MealCard.js';
import { CopyDaySheet } from '../sheets/EntrySheets.js';
import { FoodEditorSheet, FoodTitle, foodRefLine, SourceTag } from '../sheets/FoodSheets.js';

export function DietScreen() {
  const { state, today, dietDay, setDietDay } = useApp();
  const [section, setSection] = useState('meals');
  const wd = dietDay ?? weekdayOf(today);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '800', marginBottom: space.md }} accessibilityRole="header">
        Dieta
      </Text>
      <Segmented
        options={[
          { value: 'meals', label: 'Refeições' },
          { value: 'foods', label: `Alimentos (${state.core.foods.length})` },
        ]}
        value={section}
        onChange={setSection}
        testIDPrefix="diet-section"
      />
      <View style={{ height: space.lg }} />
      {section === 'meals' ? <MealsSection wd={wd} setWd={setDietDay} /> : <FoodsSection />}
    </ScrollView>
  );
}

function MealsSection({ wd, setWd }) {
  const { state, apply, showToast, confirm } = useApp();
  const { core } = state;
  const [editor, setEditor] = useState(null); // { mealId } | { copyFromId } | {}
  const [copying, setCopying] = useState(false);
  const meals = mealsForWeekday(core, wd);
  const plan = planForWeekday(core, wd);

  const remove = async (meal) => {
    if (meal.days.length > 1) {
      const choice = await confirm({
        title: `Excluir "${meal.name}"?`,
        message: `Esta refeição se repete em: ${daysLabel(meal.days)}.`,
        options: [
          { value: 'day', label: `Só de ${WEEKDAYS_LONG[wd].toLowerCase()}` },
          { value: 'all', label: 'De todos os dias', danger: true },
        ],
      });
      if (!choice) return;
      apply((s) => deleteMeal(s, meal.id, choice === 'day' ? wd : null));
    } else {
      const okDel = await confirm({
        title: `Excluir "${meal.name}"?`,
        message: 'A refeição sai da dieta. Registros de consumo já feitos continuam no histórico.',
        confirmLabel: 'Excluir',
        danger: true,
      });
      if (!okDel) return;
      apply((s) => deleteMeal(s, meal.id));
    }
    showToast('Refeição excluída');
  };

  return (
    <>
      <Chips
        small
        options={WEEKDAYS.map((w, i) => ({ value: i, label: w, a11y: WEEKDAYS_LONG[i] }))}
        value={wd}
        onChange={setWd}
        testIDPrefix="diet-day"
      />
      <Card style={{ marginTop: space.md }}>
        <Text style={{ color: colors.muted, fontSize: font.small, fontWeight: '700' }}>{`Planejado para ${WEEKDAYS_LONG[wd].toLowerCase()}`}</Text>
        <MacroLine n={plan} strong style={{ marginTop: 4 }} />
        {hasGoals(core.goals) ? (
          <Text style={{ color: colors.muted, fontSize: font.small, marginTop: 6, ...tabular }}>
            {'Meta: '}
            {MACROS.map((m, i) => {
              const g = core.goals[m];
              const over = isOver(m, plan[m], g);
              return (
                <Text key={m} style={over ? { color: colors.alert, fontWeight: '700' } : null}>
                  {`${i ? ' · ' : ''}${g == null ? '—' : fmtMacro(m, g)}${m === 'kcal' ? ' kcal' : ' g'}${over ? ' ⚠' : ''}`}
                </Text>
              );
            })}
          </Text>
        ) : <Text style={{ color: colors.muted, fontSize: font.small, marginTop: 6 }}>Sem metas definidas.</Text>}
      </Card>
      <Row>
        <Btn label="+ Nova refeição" onPress={() => setEditor({})} flex testID="meal-new" />
        <Btn label="Copiar dia" variant="secondary" onPress={() => setCopying(true)} disabled={meals.length === 0} testID="copy-day-open" />
      </Row>

      {meals.length === 0 ? (
        <Card style={{ marginTop: space.md }}>
          <EmptyState
            title={`Nenhuma refeição na ${WEEKDAYS_LONG[wd].toLowerCase()}`}
            text={'Crie uma refeição ou copie outro dia. Uma refeição pode valer para vários dias.'}
          />
        </Card>
      ) : <View style={{ height: space.md }} />}

      {meals.map((m) => (
        <MealCard
          key={m.id}
          meal={m}
          mode="plan"
          onEdit={() => setEditor({ mealId: m.id })}
          extraActions={(
            <>
              <Btn small variant="outline" label="Duplicar" onPress={() => setEditor({ copyFromId: m.id })} testID={`dup-${m.name}`} />
              <Btn small variant="danger" label="Excluir" onPress={() => remove(m)} testID={`del-${m.name}`} />
            </>
          )}
        />
      ))}

      {editor ? <MealEditorSheet {...editor} defaultDay={wd} onClose={() => setEditor(null)} /> : null}
      {copying ? <CopyDaySheet fromDay={wd} onClose={() => setCopying(false)} /> : null}
    </>
  );
}

function FoodsSection() {
  const { state } = useApp();
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState(null);
  const foods = useMemo(() => {
    const t = q.trim().toLowerCase();
    return [...state.core.foods].filter((f) => !t || f.name.toLowerCase().includes(t)).sort((a, b) => a.name.localeCompare(b.name));
  }, [state.core.foods, q]);

  return (
    <>
      <Btn label="+ Novo alimento" onPress={() => setEditor({})} testID="food-new" />
      <P muted small style={{ marginVertical: space.sm }}>
        Informe os valores de uma porção de referência (ex.: 100 g do rótulo). O app calcula qualquer quantidade proporcionalmente.
      </P>
      {state.core.foods.length > 0 ? <Field value={q} onChangeText={setQ} placeholder="Buscar alimento" testID="food-search" /> : null}
      {state.core.foods.length === 0 ? (
        <Card><EmptyState title="Nenhum alimento cadastrado" text="Comece pelos alimentos da sua dieta, com os valores do rótulo ou da tabela que você usa." /></Card>
      ) : foods.length === 0 ? <P muted>Nenhum alimento encontrado.</P> : null}
      {foods.map((f) => (
        <Card key={f.id} onPress={() => setEditor({ foodId: f.id })} testID={`food-card-${f.name}`}>
          <Row style={{ justifyContent: 'space-between' }}>
            <FoodTitle food={f} style={{ flex: 1 }} />
            {f.demo ? <DemoTag /> : null}
          </Row>
          <Text style={{ color: colors.muted, fontSize: font.small, marginTop: 4, ...tabular }}>{foodRefLine(f)}</Text>
          <View style={{ marginTop: 6 }}><SourceTag food={f} /></View>
        </Card>
      ))}
      {editor ? <FoodEditorSheet foodId={editor.foodId} onClose={() => setEditor(null)} /> : null}
    </>
  );
}
