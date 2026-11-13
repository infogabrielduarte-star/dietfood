import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { emptyState, emptyCore, refreshTodaySnapshot, ValidationError } from '../logic/model.js';
import { dateKey } from '../logic/dates.js';
import { loadAll, writeDocs, replaceAll } from '../storage/db.js';

const Ctx = createContext(null);

function docsFor(state, changed) {
  const docs = [];
  if (changed.core) docs.push({ id: 'core', body: state.core });
  for (const d of changed.days || []) {
    if (state.days[d]) docs.push({ id: `day:${d}`, body: state.days[d] });
  }
  return docs;
}

function allDocs(state) {
  return [
    { id: 'core', body: state.core },
    ...Object.values(state.days).map((d) => ({ id: `day:${d.date}`, body: d })),
  ];
}

export function AppProvider({ children }) {
  const [state, setState] = useState(emptyState);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [today, setToday] = useState(dateKey());
  const ref = useRef(state);

  const reportSave = useCallback((p) => {
    p.then(() => setSaveError(null)).catch((e) => setSaveError(String(e?.message || e)));
  }, []);

  const load = useCallback(() => {
    setStatus('loading');
    loadAll()
      .then(({ core, days }) => {
        const s = { core: core ? { ...emptyCore(), ...core } : emptyCore(), days };
        ref.current = s;
        setState(s);
        setStatus('ready');
      })
      .catch((e) => {
        setLoadError(String(e?.message || e));
        setStatus('error');
      });
  }, []);

  useEffect(load, [load]);

  // Atualiza "hoje" quando vira o dia com o app aberto.
  useEffect(() => {
    const t = setInterval(() => setToday((prev) => (prev === dateKey() ? prev : dateKey())), 30000);
    return () => clearInterval(t);
  }, []);

  /**
   * Aplica uma operação do modelo, salva no banco o que mudou e devolve o resultado.
   * Erros de validação são relançados para a tela mostrar.
   */
  const apply = useCallback((op) => {
    const res = op(ref.current);
    const changed = { core: !!res.changed.core, days: [...(res.changed.days || [])] };
    let next = res.state;
    const snap = refreshTodaySnapshot(next, dateKey());
    if (snap.changed) {
      next = snap.state;
      if (!changed.days.includes(dateKey())) changed.days.push(dateKey());
    }
    if (next === ref.current) return res.result;
    ref.current = next;
    setState(next);
    const docs = docsFor(next, changed);
    if (docs.length) reportSave(writeDocs(docs));
    return res.result;
  }, [reportSave]);

  /** Substitui todos os dados (importar backup / apagar tudo). */
  const replaceState = useCallback(async (next) => {
    await replaceAll(allDocs(next));
    ref.current = next;
    setState(next);
    setSaveError(null);
  }, []);

  // ---------- Avisos (toast) ----------
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((message, action = null, tone = 'info') => {
    clearTimeout(toastTimer.current);
    setToast({ message, action, tone, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 3000);
  }, []);
  const hideToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  // ---------- Confirmações ----------
  const [dialog, setDialog] = useState(null);
  const confirm = useCallback(
    (opts) => new Promise((resolve) => setDialog({ ...opts, resolve })),
    [],
  );
  const closeDialog = useCallback((value) => {
    setDialog((d) => {
      if (d) d.resolve(value);
      return null;
    });
  }, []);

  // ---------- Navegação entre abas ----------
  const [tab, setTab] = useState('today');
  const [historyDate, setHistoryDate] = useState(null);
  const [dietDay, setDietDay] = useState(null);

  const value = useMemo(() => ({
    state, status, loadError, saveError, today, apply, replaceState, reload: load,
    toast, showToast, hideToast, dialog, confirm, closeDialog,
    tab, setTab, historyDate, setHistoryDate, dietDay, setDietDay,
  }), [state, status, loadError, saveError, today, apply, replaceState, load, toast, showToast,
    hideToast, dialog, confirm, closeDialog, tab, historyDate, dietDay]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  return useContext(Ctx);
}

/** Executa uma operação e mostra o primeiro erro de validação como aviso. */
export function errorText(e) {
  if (e instanceof ValidationError || e?.name === 'ValidationError') {
    return e.errors.form || e.errors.duplicate || e.message;
  }
  return 'Algo deu errado. Tente novamente.';
}
