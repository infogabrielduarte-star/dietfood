// Esquema de cores do Dietfood — tema claro.
export const colors = {
  bg: '#F6F7F7', // fundo da tela (branco gelo)
  card: '#FFFFFF', // cartões
  field: '#F6F7F7', // campos, linhas de alimento e menus
  primary: '#446462', // ações e botões (verde acinzentado)
  accent: '#446462', // destaques e links
  onPrimary: '#FFFFFF', // texto sobre botões
  text: '#000000', // títulos e textos
  muted: '#5B6766', // texto secundário (complementar, contraste ≥ 4,5:1)
  border: '#E6E9EC', // bordas dos cartões
  // Estados (complementares): sempre acompanhados de ícone e texto.
  alert: '#B42318', // meta ultrapassada, excluir
  alertBg: '#FDECEA',
  accentBg: '#E4ECEB', // seleção / item ativo
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22 };

export const font = {
  title: 22,
  h2: 18,
  body: 16,
  small: 14,
  tiny: 12,
  big: 34,
};

// Números alinhados (largura fixa dos dígitos).
export const tabular = { fontVariant: ['tabular-nums'] };
