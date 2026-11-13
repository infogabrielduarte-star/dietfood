// Cadastro de alimentos e seletor de alimento.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp, errorText } from '../state/AppState.js';
import { Sheet, Field, Chips, Btn, P, Row, Tag, DemoTag, Notice, EmptyState } from '../ui/kit.js';
import { colors, space, font } from '../theme.js';
import {
  UNITS, PREPARATIONS, SOURCES, CATEGORIES, MACROS, MACRO_LABEL, MACRO_UNIT, fmtAmount, fmtKcal, fmtG, hasValues,
} from '../logic/nutrition.js';
import { saveFood, deleteFood, validateFood, foodById, foodUsage } from '../logic/model.js';

const numText = (n) => (n == null ? '' : String(n).replace('.', ','));

export function prepLabel(p) {
  return p === 'cru' ? 'cru' : p === 'cozido' ? 'cozido' : '';
}

export function FoodTitle({ food, style }) {
  const prep = prepLabel(food.preparation);
  return (
    <Text style={[{ color: colors.text, fontSize: font.body, fontWeight: '700' }, style]}>
      {food.name}
      {prep ? <Text style={{ color: colors.muted, fontWeight: '400' }}>{` (${prep})`}</Text> : null}
    </Text>
  );
}

export function foodRefLine(food) {
  if (!hasValues(food)) return `por ${fmtAmount(food.refAmount)} ${food.unit}: valores indisponíveis — preencha pelo rótulo`;
  return `por ${fmtAmount(food.refAmount)} ${food.unit}: ${fmtKcal(food.kcal)} kcal · P ${fmtG(food.protein)} · C ${fmtG(food.carbs)} · G ${fmtG(food.fat)}`;
}

export function FoodEditorSheet({ foodId, onClose, onSaved, initialName = '' }) {
  const { state, apply, showToast, confirm } = useApp();
  const existing = foodId ? foodById(state.core, foodId) : null;
  const [form, setForm] = useState(() => (existing ? {
    name: existing.name,
    preparation: existing.preparation || 'na',
    unit: existing.unit,
    refAmount: numText(existing.refAmount),
    kcal: numText(existing.kcal),
    protein: numText(existing.protein),
    carbs: numText(existing.carbs),
    fat: numText(existing.fat),
    source: hasValues(existing) ? existing.source || 'manual' : '',
    sourceNote: hasValues(existing) ? existing.sourceNote || '' : '',
    category: existing.category || 'outro',
  } : {
    name: initialName, preparation: 'na', unit: 'g', refAmount: '100', kcal: '', protein: '', carbs: '', fat: '', source: '', sourceNote: '', category: 'outro',
  }));
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [acceptedWarning, setAcceptedWarning] = useState(false);
  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setAcceptedWarning(false);
  };

  const save = () => {
    const check = validateFood(form, state.core, foodId);
    setErrors(check.errors);
    if (Object.keys(check.errors).length) return;
    if (check.warnings.length && !acceptedWarning) {
      setWarnings(check.warnings);
      setAcceptedWarning(true);
      return;
    }
    try {
      const food = apply((s) => saveFood(s, form, foodId));
      showToast(foodId ? 'Alimento atualizado' : 'Alimento cadastrado');
      onSaved ? onSaved(food) : onClose();
    } catch (e) {
      setErrors(e.errors || {});
    }
  };

  const remove = async () => {
    const used = foodUsage(state.core, foodId);
    if (used.length) {
      await confirm({
        title: 'Não é possível excluir',
        message: `Este alimento está em: ${used.map((m) => m.name).join(', ')}. Remova-o dessas refeições antes de excluir.`,
        confirmLabel: 'Entendi',
        hideCancel: true,
      });
      return;
    }
    const okDel = await confirm({
      title: 'Excluir alimento?',
      message: `"${existing.name}" sairá do seu cadastro. Registros já feitos com ele continuam no histórico.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!okDel) return;
    try {
      apply((s) => deleteFood(s, foodId));
      showToast('Alimento excluído');
      onClose();
    } catch (e) {
      showToast(errorText(e), null, 'alert');
    }
  };

  return (
    <Sheet
      visible
      title={foodId ? 'Editar alimento' : 'Novo alimento'}
      onClose={onClose}
      testID="food-editor"
      footer={(
        <>
          <Btn label="Cancelar" variant="secondary" onPress={onClose} flex />
          <Btn label={acceptedWarning && warnings.length ? 'Salvar assim' : 'Salvar'} onPress={save} flex testID="food-save" />
        </>
      )}
    >
      {existing?.demo ? <Notice text="Alimento de demonstração: valores de exemplo, não use como referência da sua dieta." /> : null}
      {existing && !hasValues(existing) ? <Notice tone="alert" text={`Valores indisponíveis. ${existing.dataNote || 'Preencha pelo rótulo.'} Informe a porção do rótulo (ex.: 30 g) e os valores dessa porção.`} /> : null}
      {existing?.estimated ? <Notice text={`Valor estimado: ${existing.dataNote} Fonte: ${existing.sourceNote}. Se você corrigir os números, deixam de ser estimados.`} /> : null}
      <Field label="Nome *" value={form.name} onChangeText={set('name')} error={errors.name} placeholder="Ex.: Arroz integral" testID="food-name" maxLength={60} />
      <Text style={lbl}>Preparo</Text>
      <Chips options={PREPARATIONS} value={form.preparation} onChange={set('preparation')} testIDPrefix="food-prep" />
      <Text style={[lbl, { marginTop: space.md }]}>Unidade *</Text>
      <Chips options={UNITS.map((u) => ({ value: u, label: u }))} value={form.unit} onChange={set('unit')} small testIDPrefix="food-unit" />
      {errors.unit ? <Text style={err}>⚠ {errors.unit}</Text> : null}
      <Field
        style={{ marginTop: space.md }}
        label="Porção de referência *"
        value={form.refAmount}
        onChangeText={set('refAmount')}
        keyboardType="decimal-pad"
        suffix={form.unit}
        error={errors.refAmount}
        hint="Os valores abaixo correspondem a esta quantidade (ex.: 100 g, 1 unid, 30 g)."
        testID="food-ref"
      />
      <Text style={[lbl, { marginTop: space.sm }]}>Valores nutricionais da porção *</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {MACROS.map((m) => (
          <Field
            key={m}
            style={{ width: '48%' }}
            label={MACRO_LABEL[m]}
            value={form[m]}
            onChangeText={set(m)}
            keyboardType="decimal-pad"
            suffix={MACRO_UNIT[m]}
            error={errors[m]}
            testID={`food-${m}`}
          />
        ))}
      </View>
      <Text style={lbl}>Categoria (usada nas sugestões de troca)</Text>
      <Chips options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} value={form.category} onChange={set('category')} small testIDPrefix="food-cat" />
      <View style={{ height: space.md }} />
      <Text style={lbl}>Fonte dos valores *</Text>
      <Chips options={SOURCES} value={form.source} onChange={set('source')} testIDPrefix="food-source" />
      {errors.source ? <Text style={err}>⚠ {errors.source}</Text> : null}
      <Field
        style={{ marginTop: space.md }}
        label="Detalhe da fonte (opcional)"
        value={form.sourceNote}
        onChangeText={set('sourceNote')}
        placeholder="Ex.: rótulo marca X, TACO"
        maxLength={80}
      />
      {acceptedWarning && warnings.length ? <Notice tone="alert" text={`${warnings.join(' ')} Toque em "Salvar assim" para manter.`} /> : null}
      {foodId ? (
        <>
          <P muted small style={{ marginBottom: space.md }}>
            Mudar este alimento atualiza os cálculos da dieta. Registros de consumo já feitos não mudam.
          </P>
          <Btn label="Excluir alimento" variant="danger" onPress={remove} testID="food-delete" />
        </>
      ) : null}
    </Sheet>
  );
}

const lbl = { color: colors.muted, fontSize: font.small, marginBottom: 6, fontWeight: '600' };
const err = { color: colors.alert, fontSize: font.small, marginTop: 4 };

/** Escolha de alimento com busca e atalho para cadastrar um novo. */
export function FoodPickerSheet({ title = 'Escolher alimento', onPick, onClose }) {
  const { state } = useApp();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const foods = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...state.core.foods]
      .filter((f) => !term || f.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.core.foods, q]);

  return (
    <Sheet visible title={title} onClose={onClose} testID="food-picker">
      <Field value={q} onChangeText={setQ} placeholder="Buscar alimento" testID="picker-search" />
      <Btn label="+ Cadastrar novo alimento" variant="outline" onPress={() => setCreating(true)} testID="picker-new" />
      <View style={{ height: space.md }} />
      {foods.length === 0 ? (
        <EmptyState
          title={state.core.foods.length ? 'Nenhum alimento encontrado' : 'Nenhum alimento cadastrado'}
          text="Cadastre o alimento com os valores do rótulo ou da tabela que você usa."
        />
      ) : foods.map((f) => (
        <Pressable
          key={f.id}
          onPress={() => onPick(f)}
          testID={`pick-${f.name}`}
          style={({ pressed }) => [{
            paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 56,
          }, pressed && { opacity: 0.7 }]}
        >
          <Row><FoodTitle food={f} style={{ flexShrink: 1 }} />{f.demo ? <DemoTag /> : null}{!hasValues(f) ? <Tag label="sem valores" tone="alert" /> : f.estimated ? <Tag label="estimado" /> : null}</Row>
          <Text style={{ color: colors.muted, fontSize: font.small, marginTop: 2 }}>{foodRefLine(f)}</Text>
        </Pressable>
      ))}
      {creating ? (
        <FoodEditorSheet
          initialName={q.trim()}
          onClose={() => setCreating(false)}
          onSaved={(food) => { setCreating(false); onPick(food); }}
        />
      ) : null}
    </Sheet>
  );
}

export function SourceTag({ food }) {
  const s = SOURCES.find((x) => x.value === food.source);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {!hasValues(food) ? <Tag label="sem valores — preencha pelo rótulo" tone="alert" /> : s ? <Tag label={food.sourceNote || s.label} /> : null}
      {food.estimated ? <Tag label="estimado" /> : null}
    </View>
  );
}
