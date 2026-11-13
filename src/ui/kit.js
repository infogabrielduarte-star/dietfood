// Componentes básicos de interface do Dietfood.
import React from 'react';
import {
  View, Text, Pressable, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space, radius, font, tabular } from '../theme.js';
import { MACROS, MACRO_LABEL, MACRO_UNIT, fmtMacro, isOver } from '../logic/nutrition.js';

export function Btn({ label, onPress, variant = 'primary', small, disabled, style, testID, flex }) {
  const v = btnVariants[variant] || btnVariants.primary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        flex && { flex: 1 },
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <Text style={[s.btnText, small && { fontSize: font.small }, { color: v.color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const btnVariants = {
  primary: { bg: colors.primary, border: colors.primary, color: colors.onPrimary },
  secondary: { bg: colors.field, border: colors.border, color: colors.text },
  ghost: { bg: 'transparent', border: 'transparent', color: colors.accent },
  outline: { bg: 'transparent', border: colors.border, color: colors.accent },
  danger: { bg: 'transparent', border: colors.alert, color: colors.alert },
};

export function Card({ children, style, highlight, onPress, testID }) {
  const content = [s.card, highlight && s.cardHighlight, style];
  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [...content, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View testID={testID} style={content}>{children}</View>;
}

export function Tag({ label, tone = 'muted', style }) {
  const t = {
    muted: { bg: colors.field, color: colors.muted, border: colors.border },
    accent: { bg: colors.accentBg, color: colors.accent, border: colors.accentBg },
    alert: { bg: colors.alertBg, color: colors.alert, border: colors.alertBg },
    demo: { bg: 'transparent', color: colors.accent, border: colors.accent },
  }[tone];
  return (
    <View style={[s.tag, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      <Text style={[s.tagText, { color: t.color }]}>{label}</Text>
    </View>
  );
}

export const DemoTag = () => <Tag label="DEMO" tone="demo" />;

export function H1({ children, style }) {
  return <Text style={[s.h1, style]} accessibilityRole="header">{children}</Text>;
}
export function H2({ children, style }) {
  return <Text style={[s.h2, style]} accessibilityRole="header">{children}</Text>;
}
export function P({ children, style, muted, small, numberOfLines }) {
  return (
    <Text numberOfLines={numberOfLines} style={[s.p, muted && { color: colors.muted }, small && { fontSize: font.small }, style]}>
      {children}
    </Text>
  );
}

export function Row({ children, style, gap = space.sm }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Field({
  label, value, onChangeText, error, hint, placeholder, keyboardType, suffix, multiline, testID,
  onBlur, maxLength, autoCapitalize, style, inputStyle,
}) {
  return (
    <View style={[{ marginBottom: space.md }, style]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={[s.inputWrap, error && { borderColor: colors.alert }]}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor="#8A9493"
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          accessibilityLabel={label || placeholder}
          style={[s.input, multiline && { minHeight: 88, textAlignVertical: 'top' }, inputStyle]}
        />
        {suffix ? <Text style={s.suffix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={s.error}>⚠ {error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Seleção por "pílulas" (única ou múltipla). */
export function Chips({ options, value, onChange, multi, testIDPrefix, small }) {
  const selected = (v) => (multi ? value.includes(v) : value === v);
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = selected(o.value);
        return (
          <Pressable
            key={String(o.value)}
            testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.a11y || o.label}
            onPress={() => {
              if (multi) onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value]);
              else onChange(o.value);
            }}
            style={[s.chip, small && s.chipSmall, on && s.chipOn]}
          >
            <Text style={[s.chipText, on && { color: colors.onPrimary }]}>{on && multi ? '✓ ' : ''}{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Segmented({ options, value, onChange, testIDPrefix }) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[s.segItem, on && s.segOn]}
          >
            <Text style={[s.segText, on && { color: colors.onPrimary }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({ value, max, marker, over }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const mk = marker != null && max > 0 ? Math.min(1, marker / max) : null;
  return (
    <View style={s.bar} accessibilityRole="progressbar">
      <View style={[s.barFill, { width: `${pct * 100}%`, backgroundColor: over ? colors.alert : colors.accent }]} />
      {mk != null ? <View style={[s.barMarker, { left: `${mk * 100}%` }]} /> : null}
    </View>
  );
}

/** Linha compacta de macros: "520 kcal · P 30 · C 60 · G 12". */
export function MacroLine({ n, style, strong }) {
  return (
    <Text style={[s.macroLine, strong && { color: colors.text }, style]}>
      <Text style={{ color: colors.accent, fontWeight: '700' }}>{fmtMacro('kcal', n.kcal)} kcal</Text>
      {`  ·  P ${fmtMacro('protein', n.protein)} g  ·  C ${fmtMacro('carbs', n.carbs)} g  ·  G ${fmtMacro('fat', n.fat)} g`}
    </Text>
  );
}

/** Tabela Meta × Planejado × Consumido × Saldo. */
export function MacroTable({ goals, planned, consumed }) {
  return (
    <View style={s.table}>
      <View style={s.tr}>
        <Text style={[s.th, { flex: 1.3, textAlign: 'left' }]}> </Text>
        <Text style={s.th}>Meta</Text>
        <Text style={s.th}>Planej.</Text>
        <Text style={s.th}>Consum.</Text>
        <Text style={s.th}>Saldo</Text>
      </View>
      {MACROS.map((m) => {
        const g = goals[m];
        const over = isOver(m, consumed[m], g);
        const bal = g == null ? null : g - consumed[m];
        return (
          <View key={m} style={s.tr}>
            <Text style={[s.td, { flex: 1.3, textAlign: 'left', color: colors.muted }]}>
              {MACRO_LABEL[m].slice(0, m === 'carbs' ? 5 : 8)}{m === 'carbs' ? '.' : ''} ({MACRO_UNIT[m]})
            </Text>
            <Text style={s.td}>{g == null ? '—' : fmtMacro(m, g)}</Text>
            <Text style={s.td}>{fmtMacro(m, planned[m])}</Text>
            <Text style={[s.td, { color: colors.text, fontWeight: '700' }]}>{fmtMacro(m, consumed[m])}</Text>
            <Text style={[s.td, over && { color: colors.alert, fontWeight: '700' }]}>
              {bal == null ? '—' : over ? `⚠ +${fmtMacro(m, -bal)}` : fmtMacro(m, bal)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Painel que sobe da parte de baixo (bottom sheet). Voltar do Android fecha. */
export function Sheet({ visible, title, onClose, children, footer, testID }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.sheetBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fechar" />
          <View testID={testID} style={[s.sheet, { paddingBottom: Math.max(insets.bottom, space.md), marginTop: insets.top + 24 }]}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle} numberOfLines={2}>{title}</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" style={s.closeBtn} testID="sheet-close">
                <Text style={{ color: colors.muted, fontSize: 22 }}>✕</Text>
              </Pressable>
            </View>
            <ScrollView
              style={{ flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ padding: space.lg, paddingTop: space.sm }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
            {footer ? <View style={s.sheetFooter}>{footer}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function EmptyState({ title, text, children, icon = '○' }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyIcon}>{icon}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      {text ? <Text style={s.emptyText}>{text}</Text> : null}
      {children ? <View style={{ marginTop: space.md, gap: space.sm, alignSelf: 'stretch' }}>{children}</View> : null}
    </View>
  );
}

export function Notice({ text, tone = 'accent', children }) {
  const alert = tone === 'alert';
  return (
    <View style={[s.notice, alert && { borderColor: colors.alert, backgroundColor: colors.alertBg }]}>
      <Text style={[s.noticeText, alert && { color: colors.alert }]}>{alert ? '⚠ ' : 'ℹ '}{text}</Text>
      {children}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  section: { color: colors.muted, fontSize: font.small, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: space.xl, marginBottom: space.sm },
  num: { ...tabular },
});

const s = StyleSheet.create({
  btn: {
    minHeight: 50, borderRadius: radius.md, paddingHorizontal: space.lg, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1,
  },
  btnSmall: { minHeight: 44, paddingHorizontal: space.md },
  btnText: { fontSize: font.body, fontWeight: '700' },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: space.lg, marginBottom: space.md,
  },
  cardHighlight: { borderColor: colors.accent, borderWidth: 1.5 },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, alignSelf: 'flex-start' },
  tagText: { fontSize: font.tiny, fontWeight: '700' },
  h1: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  h2: { color: colors.text, fontSize: font.h2, fontWeight: '700' },
  p: { color: colors.text, fontSize: font.body, lineHeight: 22 },
  label: { color: colors.muted, fontSize: font.small, marginBottom: 6, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.field, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, minHeight: 50,
  },
  input: { flex: 1, color: colors.text, fontSize: font.body, paddingHorizontal: space.md, paddingVertical: 12, ...tabular },
  suffix: { color: colors.muted, paddingRight: space.md, fontSize: font.body },
  error: { color: colors.alert, fontSize: font.small, marginTop: 4 },
  hint: { color: colors.muted, fontSize: font.tiny, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center',
  },
  chipSmall: { minHeight: 40, paddingHorizontal: 10, minWidth: 44 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: font.small, fontWeight: '700' },
  seg: { flexDirection: 'row', backgroundColor: colors.field, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  segItem: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segOn: { backgroundColor: colors.primary },
  segText: { color: colors.muted, fontWeight: '700', fontSize: font.small },
  bar: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden', marginVertical: 6 },
  barFill: { height: 10, borderRadius: 5 },
  barMarker: { position: 'absolute', top: 0, width: 2, height: 10, marginLeft: -1, backgroundColor: colors.text, opacity: 0.55 },
  macroLine: { color: colors.muted, fontSize: font.small, ...tabular },
  table: { marginTop: space.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  th: { flex: 1, color: colors.muted, fontSize: font.tiny, fontWeight: '700', textAlign: 'right' },
  td: { flex: 1, color: colors.muted, fontSize: 13, textAlign: 'right', ...tabular },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, maxHeight: '94%', flexShrink: 1,
  },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginTop: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.sm },
  sheetTitle: { flex: 1, color: colors.text, fontSize: font.h2, fontWeight: '800' },
  closeBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  sheetFooter: {
    flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  empty: { alignItems: 'center', paddingVertical: space.xl, paddingHorizontal: space.lg },
  emptyIcon: { fontSize: 34, color: colors.accent, marginBottom: space.sm },
  emptyTitle: { color: colors.text, fontSize: font.h2, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: font.body, textAlign: 'center', marginTop: 6, lineHeight: 22 },
  notice: {
    borderWidth: 1, borderColor: colors.accentBg, backgroundColor: colors.accentBg, borderRadius: radius.md,
    padding: space.md, marginBottom: space.md, gap: space.sm,
  },
  noticeText: { color: colors.accent, fontSize: font.small, lineHeight: 20 },
});
