// Dietfood — app Android (React Native + Expo).
import React, { useEffect } from 'react';
import { View, Text, Pressable, Modal, BackHandler, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/state/AppState.js';
import { colors, space, font, radius } from './src/theme.js';
import { Btn, Notice } from './src/ui/kit.js';
import { DayView } from './src/screens/DayView.js';
import { DietScreen } from './src/screens/DietScreen.js';
import { HistoryScreen } from './src/screens/HistoryScreen.js';
import { SettingsScreen } from './src/screens/SettingsScreen.js';

const TABS = [
  { key: 'today', label: 'Hoje', icon: '⌂' },
  { key: 'diet', label: 'Dieta', icon: '☰' },
  { key: 'history', label: 'Histórico', icon: '▦' },
  { key: 'settings', label: 'Ajustes', icon: '⚙' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const insets = useSafeAreaInsets();
  const { status, loadError, reload, saveError, tab, setTab, today, historyDate, setHistoryDate } = useApp();

  // Botão/gesto "voltar" do Android: fecha o dia aberto no histórico, depois volta para Hoje, depois sai.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab === 'history' && historyDate) { setHistoryDate(null); return true; }
      if (tab !== 'today') { setTab('today'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [tab, historyDate, setTab, setHistoryDate]);

  if (status === 'loading') {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <Text style={s.brand}>Dietfood</Text>
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} />
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={[s.center, { padding: space.xl }]}>
        <Text style={s.brand}>Dietfood</Text>
        <Notice tone="alert" text={`Não foi possível abrir os dados salvos. ${loadError || ''}`} />
        <Btn label="Tentar de novo" onPress={reload} />
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {saveError ? (
        <View style={s.saveError}><Text style={{ color: colors.alert, fontSize: font.small }}>⚠ Falha ao salvar no celular: {saveError}</Text></View>
      ) : null}
      <View style={{ flex: 1 }}>
        {tab === 'today' ? <DayView date={today} /> : null}
        {tab === 'diet' ? <DietScreen /> : null}
        {tab === 'history' ? <HistoryScreen /> : null}
        {tab === 'settings' ? <SettingsScreen /> : null}
      </View>
      <Toast bottom={64 + insets.bottom + space.sm} />
      <View style={[s.tabbar, { paddingBottom: Math.max(insets.bottom, 6) }]} accessibilityRole="tablist">
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable
              key={t.key}
              testID={`tab-${t.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.label}
              onPress={() => { if (t.key === 'history' && tab === 'history') setHistoryDate(null); setTab(t.key); }}
              style={s.tabItem}
            >
              <View style={[s.tabPill, on && { backgroundColor: colors.accentBg }]}>
                <Text style={[s.tabIcon, on && { color: colors.accent }]}>{t.icon}</Text>
              </View>
              <Text style={[s.tabLabel, on && { color: colors.text }]} numberOfLines={1}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Dialog />
    </View>
  );
}

function Toast({ bottom }) {
  const { toast, hideToast } = useApp();
  if (!toast) return null;
  const alert = toast.tone === 'alert';
  return (
    <View style={[s.toast, { bottom }, alert && { borderColor: colors.alert }]} testID="toast">
      <Text style={[s.toastText, alert && { color: '#FFB4AB' }]}>{alert ? '⚠ ' : ''}{toast.message}</Text>
      {toast.action ? (
        <Pressable
          onPress={() => { toast.action.onPress(); hideToast(); }}
          style={s.toastBtn}
          accessibilityRole="button"
          testID="toast-action"
        >
          <Text style={{ color: '#A9D3CE', fontWeight: '800' }}>{toast.action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Dialog() {
  const { dialog, closeDialog } = useApp();
  if (!dialog) return null;
  const cancelValue = dialog.options ? null : false;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => closeDialog(cancelValue)} statusBarTranslucent>
      <View style={s.dialogBackdrop}>
        <View style={s.dialog} testID="dialog">
          <Text style={s.dialogTitle}>{dialog.title}</Text>
          {dialog.message ? <Text style={s.dialogMsg}>{dialog.message}</Text> : null}
          <View style={{ gap: space.sm, marginTop: space.lg }}>
            {dialog.options ? dialog.options.map((o) => (
              <Btn key={o.value} label={o.label} variant={o.danger ? 'danger' : 'secondary'} onPress={() => closeDialog(o.value)} testID={`dialog-opt-${o.value}`} />
            )) : (
              <Btn label={dialog.confirmLabel || 'Confirmar'} variant={dialog.danger ? 'danger' : 'primary'} onPress={() => closeDialog(true)} testID="dialog-ok" />
            )}
            {!dialog.hideCancel ? <Btn label="Cancelar" variant="ghost" onPress={() => closeDialog(cancelValue)} testID="dialog-cancel" /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: space.md },
  brand: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: 0.5 },
  saveError: { backgroundColor: colors.alertBg, padding: space.sm, paddingHorizontal: space.lg },
  tabbar: {
    flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  tabPill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { color: colors.muted, fontSize: 18 },
  tabLabel: { color: colors.muted, fontSize: 10.5, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  toast: {
    position: 'absolute', left: space.lg, right: space.lg, backgroundColor: '#1F2A29', borderRadius: radius.md,
    borderWidth: 1, borderColor: '#1F2A29', paddingLeft: space.lg, flexDirection: 'row', alignItems: 'center',
    minHeight: 52, zIndex: 10, elevation: 8,
  },
  toastText: { color: colors.onPrimary, flex: 1, fontSize: font.small, paddingVertical: space.sm },
  toastBtn: { paddingHorizontal: space.lg, minHeight: 52, justifyContent: 'center' },
  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: space.xl },
  dialog: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: space.xl },
  dialogTitle: { color: colors.text, fontSize: font.h2, fontWeight: '800' },
  dialogMsg: { color: colors.muted, fontSize: font.body, marginTop: space.sm, lineHeight: 22 },
});
