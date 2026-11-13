# Dietfood — app Android de dieta e macronutrientes

Aplicativo Android para armazenar e organizar um plano alimentar em um só lugar, substituindo planilhas, PDFs e mensagens soltas. O app mostra as refeições do dia, permite registrar o que foi consumido, trocar alimentos por equivalentes e acompanhar calorias, proteínas, carboidratos e gorduras.

Funciona **offline**: os dados ficam no próprio aparelho, em um banco **SQLite**.

> O plano alimentar incluído no código é um **plano de exemplo** (3500 kcal) usado como dados iniciais. Os horários são sugestões e podem ser editados no app.

## Funcionalidades

- **Hoje:** resumo do dia (meta, planejado, consumido e saldo) e as refeições em cartões, com alimentos, quantidades, calorias e macros. Um toque registra a refeição "conforme a dieta".
- **Troca de alimentos:** ao tocar em um alimento, o app mostra as substituições do plano e sugestões calculadas com valores equivalentes. Antes de confirmar, compara a refeição antes e depois. A troca pode valer só para hoje ou atualizar o plano.
- **Desfazer:** toda ação pode ser desfeita. Cada refeição é registrada uma única vez por dia.
- **Dieta:** plano por dia da semana, com edição de horários, observações e alimentos.
- **Histórico:** últimos 7 dias e lista completa. Dias anteriores podem ser abertos e corrigidos, e o histórico nunca é alterado por mudanças no plano.
- **Ajustes:** metas, atualização do plano, backup (exportar/importar) e opção de apagar tudo.

## Destaques técnicos

- **Regras de negócio isoladas da interface** (`src/logic/`): cálculos nutricionais, trocas, sugestões, registros e histórico em funções puras, cobertas por **32 testes automatizados** (`node:test`).
- **Persistência local com SQLite** (`expo-sqlite`), sem depender de internet ou servidor.
- **Valores nutricionais com fonte:** os alimentos usam a **TACO 4ª ed.** (NEPA/UNICAMP), a **POF 2008–2009 do IBGE** e rótulos. Valores estimados ficam marcados e explicados no app. Valores desconhecidos **não viram zero**: o total aparece com "+" e a pendência fica visível.
- **Histórico imutável:** alterar o plano não reescreve dias anteriores.
- **Instalação automatizada no Windows:** o script `Instalar-Dietfood-Android.bat` verifica o Node.js, instala dependências, localiza ou baixa o ADB, detecta o celular, gera o APK (localmente ou pelo EAS da Expo) e instala no aparelho.

## Tecnologias

React Native · Expo · JavaScript · SQLite (expo-sqlite) · node:test · EAS Build

## Como rodar

```bash
npm install
npm test          # testes de lógica: cálculos, trocas, registros, histórico, plano
npx expo start    # modo de desenvolvimento (abrir com o Expo Go)
```

Para gerar e instalar o APK em um celular Android conectado por USB (com a depuração USB ativada), rode `Instalar-Dietfood-Android.bat` no Windows.

## Estrutura

```
App.js                     abas (Hoje, Dieta, Histórico, Ajustes), botão voltar do Android, avisos
src/data/planoAlimentar.js plano de exemplo com fontes nutricionais
src/logic/                 cálculos, regras, trocas e sugestões (testados em tests/)
src/storage/db.js          SQLite no aparelho
src/state/AppState.js      estado global do app
src/ui/                    componentes visuais (kit, cartão de refeição)
src/sheets/                painéis de troca, edição de refeição e registro
src/screens/               telas Hoje, Dieta, Histórico e Ajustes
tests/logic.test.mjs       testes automatizados da lógica
```

## Autor

Gabriel Silva Duarte — [LinkedIn](https://www.linkedin.com/in/gabriel-silva-duarte-542567283)
