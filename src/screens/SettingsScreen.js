// Configurações: metas diárias, dados de demonstração, cópia de segurança e limpeza.
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Share } from 'react-native';
import { useApp, errorText } from '../state/AppState.js';
import { Card, Btn, Row, Field, Sheet, Notice, P, DemoTag, styles } from '../ui/kit.js';
import { colors, space, font } from '../theme.js';
import { MACROS, MACRO_LABEL, MACRO_UNIT, parseNumber, kcalFromMacros } from '../logic/nutrition.js';
import {
  setGoals, validateGoals, hasDemo, loadDemo, removeDemo, exportData, parseImport, emptyState, importPlan,
} from '../logic/model.js';
import { PLAN } from '../data/planoAlimentar.js';

const toText = (v) => (v == null ? '' : String(v).replace('.', ','));
export const APP_VERSION = '1.2.0';

export function SettingsScreen() {
  const { state, apply, showToast, confirm, replaceState } = useApp();
  const { core } = state;
  const [goals, setGoalsForm] = useState(() => Object.fromEntries(MACROS.map((m) => [m, toText(core.goals[m])])));
  const [errors, setErrors] = useState({});
  const [importing, setImporting] = useState(false);
  const [wiping, setWiping] = useState(false);
  const demo = hasDemo(state);

  // Mantém o formulário em sincronia quando as metas mudam por fora (demo, importação).
  useEffect(() => {
    setGoalsForm(Object.fromEntries(MACROS.map((m) => [m, toText(core.goals[m])])));
  }, [core.goals]);

  const saveGoals = () => {
    const v = validateGoals(goals);
    setErrors(v.errors);
    if (Object.keys(v.errors).length) return;
    apply((s) => setGoals(s, goals));
    showToast('Metas salvas');
  };

  const calcKcal = () => {
    const [p, c, f] = ['protein', 'carbs', 'fat'].map((m) => parseNumber(goals[m]));
    if ([p, c, f].some((x) => Number.isNaN(x))) {
      setErrors({ kcal: 'Preencha proteínas, carboidratos e gorduras para calcular.' });
      return;
    }
    setGoalsForm((g) => ({ ...g, kcal: String(Math.round(kcalFromMacros(p, c, f))) }));
    setErrors({});
  };

  const doExport = async () => {
    try {
      const json = exportData(state);
      await Share.share({ title: 'Backup Dietfood', message: json });
    } catch (e) {
      showToast('Não foi possível compartilhar o backup.', null, 'alert');
    }
  };

  const doRemoveDemo = async () => {
    const okDel = await confirm({
      title: 'Remover dados de demonstração?',
      message: 'Saem os alimentos, refeições e metas marcados como DEMO, e os itens de demonstração dos registros. Seus dados reais ficam.',
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!okDel) return;
    apply((s) => removeDemo(s));
    showToast('Dados de demonstração removidos');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '800', marginBottom: space.md }} accessibilityRole="header">Ajustes</Text>

      <Card testID="goals-card">
        <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
          <Text style={{ color: colors.text, fontSize: font.h2, fontWeight: '700' }}>Metas diárias</Text>
          {core.goalsDemo ? <DemoTag /> : null}
        </Row>
        {core.goalsDemo ? <Notice text="Estas metas são de demonstração. Substitua pelos seus valores." /> : null}
        {core.goalsSource ? <P small style={{ marginBottom: 6, color: colors.accent }}>{`Origem: ${core.goalsSource}`}</P> : null}
        <P muted small style={{ marginBottom: space.md }}>Deixe em branco o que não quiser acompanhar. Mudar as metas não altera dias anteriores já registrados.</P>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {MACROS.map((m) => (
            <Field
              key={m}
              style={{ width: '48%' }}
              label={MACRO_LABEL[m]}
              value={goals[m]}
              onChangeText={(v) => { setGoalsForm((g) => ({ ...g, [m]: v })); setErrors((e) => ({ ...e, [m]: undefined })); }}
              keyboardType="decimal-pad"
              suffix={MACRO_UNIT[m]}
              error={errors[m]}
              placeholder="—"
              testID={`goal-${m}`}
            />
          ))}
        </View>
        <Btn small variant="ghost" label="Calcular calorias pelos macros (4/4/9)" onPress={calcKcal} style={{ alignSelf: 'flex-start' }} />
        <Btn label="Salvar metas" onPress={saveGoals} testID="goals-save" style={{ marginTop: space.sm }} />
      </Card>

      <Text style={styles.section}>Plano alimentar</Text>
      <Card>
        <P small style={{ marginBottom: space.sm }}>{`${PLAN.title} · 6 refeições · valores TACO/IBGE/rótulos com fonte.`}</P>
        {core.planImported === PLAN.id ? <P muted small>✓ Versão atual carregada.</P> : null}
        {core.planImported && core.planImported !== PLAN.id ? (
          <P small style={{ color: colors.accent }}>Há uma versão nova do plano: sem whey, pasta de amendoim e geleia, e com os valores pendentes preenchidos. Seus horários e o histórico são mantidos.</P>
        ) : null}
        <Btn
          label={core.planImported === PLAN.id ? 'Recarregar itens que faltam' : core.planImported ? 'Atualizar para a versão nova' : 'Carregar meu plano alimentar'}
          variant={core.planImported === PLAN.id ? 'secondary' : 'primary'}
          style={{ marginTop: space.sm }}
          onPress={() => { apply((s) => importPlan(s, PLAN)); showToast('Plano alimentar cadastrado'); }}
          testID="plan-import"
        />
      </Card>

      <Text style={styles.section}>Dados de demonstração</Text>
      <Card>
        {demo ? (
          <>
            <P style={{ marginBottom: space.md }}>Há dados de demonstração no app (marcados com DEMO). Eles servem só para explorar e não são sua dieta.</P>
            <Btn label="Remover dados de demonstração" variant="danger" onPress={doRemoveDemo} testID="demo-remove" />
          </>
        ) : (
          <>
            <P muted style={{ marginBottom: space.md }}>Carrega um exemplo de dieta, identificado como DEMO, para conhecer o app. Pode ser removido com um toque.</P>
            <Btn label="Carregar exemplo" variant="secondary" onPress={() => { apply((s) => loadDemo(s)); showToast('Dados de demonstração carregados'); }} testID="demo-load" />
          </>
        )}
      </Card>

      <Text style={styles.section}>Cópia de segurança</Text>
      <Card>
        <P muted small style={{ marginBottom: space.md }}>
          Exporta tudo (dieta, alimentos, metas e histórico) como texto. Salve no Google Drive, e-mail ou em uma nota. Para recuperar, cole o texto em "Importar".
        </P>
        <Row>
          <Btn label="Exportar" onPress={doExport} flex testID="backup-export" />
          <Btn label="Importar" variant="secondary" onPress={() => setImporting(true)} flex testID="backup-import" />
        </Row>
      </Card>

      <Text style={styles.section}>Armazenamento</Text>
      <Card>
        <P small>Os dados ficam salvos neste celular (banco SQLite do app) e continuam disponíveis ao fechar e reabrir. Desinstalar o app apaga os dados: faça uma cópia de segurança antes.</P>
        <P muted small style={{ marginTop: space.sm }}>
          {`${core.foods.length} alimentos · ${core.meals.length} refeições · ${Object.values(state.days).filter((d) => d.entries.length).length} dias com registro`}
        </P>
        <Btn label="Apagar todos os dados" variant="danger" onPress={() => setWiping(true)} style={{ marginTop: space.md }} testID="wipe-open" />
      </Card>

      <P muted small style={{ textAlign: 'center', marginTop: space.lg }}>{`Dietfood ${APP_VERSION} · uso pessoal`}</P>

      {importing ? (
        <ImportSheet
          onClose={() => setImporting(false)}
          onImport={async (data) => {
            const okImp = await confirm({
              title: 'Substituir todos os dados?',
              message: `O backup tem ${data.core.foods.length} alimentos, ${data.core.meals.length} refeições e ${Object.keys(data.days).length} dias. Os dados atuais deste celular serão substituídos.`,
              confirmLabel: 'Substituir',
              danger: true,
            });
            if (!okImp) return;
            try {
              await replaceState(data);
              setImporting(false);
              showToast('Backup importado');
            } catch (e) {
              showToast('Falha ao gravar o backup.', null, 'alert');
            }
          }}
        />
      ) : null}
      {wiping ? (
        <WipeSheet
          onClose={() => setWiping(false)}
          onWipe={async () => {
            await replaceState(emptyState());
            setWiping(false);
            showToast('Todos os dados foram apagados');
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function ImportSheet({ onClose, onImport }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const run = () => {
    try {
      onImport(parseImport(text));
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <Sheet
      visible
      title="Importar backup"
      onClose={onClose}
      testID="import-sheet"
      footer={(
        <>
          <Btn label="Cancelar" variant="secondary" onPress={onClose} flex />
          <Btn label="Importar" onPress={run} flex disabled={!text.trim()} testID="import-run" />
        </>
      )}
    >
      <P muted small style={{ marginBottom: space.md }}>Cole aqui o texto exportado pelo Dietfood.</P>
      <Field value={text} onChangeText={(v) => { setText(v); setError(null); }} multiline placeholder='{"app":"dietfood", ...}' error={error} testID="import-text" />
    </Sheet>
  );
}

function WipeSheet({ onClose, onWipe }) {
  const [text, setText] = useState('');
  return (
    <Sheet
      visible
      title="Apagar todos os dados"
      onClose={onClose}
      footer={(
        <>
          <Btn label="Cancelar" variant="secondary" onPress={onClose} flex />
          <Btn label="Apagar tudo" variant="danger" onPress={onWipe} flex disabled={text.trim().toUpperCase() !== 'APAGAR'} testID="wipe-run" />
        </>
      )}
    >
      <Notice tone="alert" text="Isto apaga dieta, alimentos, metas e todo o histórico deste celular. Não dá para desfazer." />
      <Field label='Digite APAGAR para confirmar' value={text} onChangeText={setText} autoCapitalize="characters" testID="wipe-text" />
    </Sheet>
  );
}

