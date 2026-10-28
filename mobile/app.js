/* Planner Saudável — versão para celular.
   Tudo roda no navegador; os dados ficam salvos só neste aparelho (localStorage).
   Os alimentos, regras e valores nutricionais vêm de dados.js (gerado por gerar_dados.py). */
"use strict";

const D = window.DADOS;
const CHAVE = "plannerSaudavel.v1";
const PREFIXO_SALADA = "🥗 ";
const PREFIXO_PRATO = "🍽️ ";
const PREFIXO_PLANO = "📋 ";
const REFEICOES = Object.keys(D.refeicoes);
const ESPACOS = Object.keys(D.prato.gruposTaco);
const CATEGORIAS_SALADA = Object.keys(D.salada.ingredientes);
const CAMPOS_MEDIDAS = [
  ["peso", "Peso", "kg"], ["braco", "Braço direito", "cm"], ["costas", "Costas", "cm"],
  ["cintura", "Cintura", "cm"], ["quadril", "Quadril", "cm"], ["coxa", "Coxa", "cm"],
];
const CAMPOS_BIO = [
  ["peso", "Peso", "kg"], ["imc", "IMC", ""], ["gordura", "Gordura corporal", "%"],
  ["taxaMuscular", "Taxa muscular", "%"], ["massaMagra", "Massa corporal magra", "kg"],
  ["gorduraSub", "Gordura subcutânea", "%"], ["gorduraVisceral", "Gordura visceral", ""],
  ["agua", "Água corporal", "%"], ["musculoEsq", "Músculo esquelético", "%"],
  ["massaMuscular", "Massa muscular", "kg"], ["massaOssea", "Massa óssea", "kg"],
  ["proteina", "Proteína", "%"], ["tmb", "Taxa metabólica basal", "kcal"],
  ["idadeCorpo", "Idade do corpo", "anos"], ["massaGorda", "Massa gorda", "kg"],
  ["pesoAgua", "Peso da água", "kg"], ["massaProteina", "Massa de proteína", "kg"],
  ["pesoIdeal", "Peso corporal ideal", "kg"],
];

/* ---------- Estado e armazenamento ---------- */
function estadoInicial() {
  return {
    planner: {},            // {dia: {refeicao: {meal, people}}}
    agua: {},               // {dia: copos}
    comprasMarcadas: {},    // {item: true}
    saladas: {},            // {nome: {itens: {categoria: [nomes]}, refeicoes: []}}
    pratos: {},             // {nome: {itens: [{espaco, id, gramas}], refeicoes: []}}
    personalizados: {},     // {Pn: {nome, grupo(espaço), kcal, prot, carb, gord, gramas, medida}}
    medidas: [],            // [{data, peso, braco, ...}]
    bio: [],                // [{data, peso, imc, ..., tipo}]
    rascunho: { salada: {}, prato: {}, extras: {} },
    plano: null,            // plano alimentar carregado de meu_plano.json (fica só no aparelho)
    perfil: {},             // {nome, nascimento, altura (cm), pesoMeta (kg)}
    tema: "claro",          // "claro" | "escuro"
  };
}
let armazenamentoOk = true;
function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return Object.assign(estadoInicial(), JSON.parse(bruto));
  } catch (e) { armazenamentoOk = false; }
  return estadoInicial();
}
let S = carregar();
// Pede ao navegador para não apagar os dados sozinho quando faltar espaço no aparelho
try { navigator.storage?.persist?.(); } catch (e) {}
function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(S)); armazenamentoOk = true; }
  catch (e) { armazenamentoOk = false; }
}

// Plano alimentar em uso: o que você carregou no aparelho (Perfil → Backup) ou o de exemplo, genérico
const plano = () => S.plano || D.planoExemplo;
function planoValido(p) {
  return p && typeof p === "object" && p.regras && p.opcoes && p.descricao
    && ESPACOS.every((e) => Array.isArray(p.regras[e]) && Array.isArray(p.opcoes[e]));
}

// Estado só da tela (não é salvo)
const hoje = new Date();
const UI = {
  aba: "semana",
  dia: D.dias[(hoje.getDay() + 6) % 7],
  abaPeso: "medidas",
  modal: null,
  busca: {},
};

/* ---------- Utilidades ---------- */
function h(tag, attrs, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k in el && k !== "list") el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const f of filhos.flat(Infinity)) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}
const fmt = (n, casas = 0) => Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const hojeISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const dataBR = (iso) => iso ? iso.split("-").reverse().join("/") : "";
let timerToast;
function toast(msg) {
  document.querySelector(".toast")?.remove();
  const t = h("div", { class: "toast" }, msg);
  document.body.append(t);
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.remove(), 3000);
}
function atualizar() { salvar(); render(); }

/* ---------- Ícones (SVG de traço, 24×24) ---------- */
const ICONES = {
  semana: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  salada: '<path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M12 11c0-4 2.5-6.5 6-7-.3 3.6-2.6 6.2-6 7Z"/><path d="M8.5 11c0-2.5-1.5-4-4-4.5"/>',
  prato: '<circle cx="14" cy="12" r="7.5"/><circle cx="14" cy="12" r="3.8"/><path d="M3 3v5.5a1.5 1.5 0 0 0 3 0V3M4.5 10v11"/>',
  peso: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 10a4 4 0 0 1 8 0"/><path d="M12 10l1.8-2.4"/>',
  ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.9-.9 1.6v.4"/><path d="M12 17h.01"/>',
  baixar: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  enviar: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  carrinho: '<path d="M2.5 4H5l2.2 10.4a1.5 1.5 0 0 0 1.5 1.1h8.4a1.5 1.5 0 0 0 1.4-1.1L20.5 8H6"/><circle cx="10" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
  gota: '<path d="M12 3c3.5 4.2 6 7.6 6 10.8a6 6 0 0 1-12 0C6 10.6 8.5 7.2 12 3Z"/>',
  fogo: '<path d="M12 21a7 7 0 0 0 7-7c0-4-3-6.5-4-10-2 1.5-3 3.5-3 5.5-1-.8-1.7-2-2-3.2C7.5 8.5 5 11 5 14a7 7 0 0 0 7 7Z"/>',
  lista: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V2.5h6V4M9 12.5l2 2 4-4"/>',
  cafe: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c-.6 1 .6 2 0 3M12 3c-.6 1 .6 2 0 3"/>',
  maca: '<path d="M12 8c-2-1.5-7-1.5-7 4 0 4 2.5 8 5 8 .8 0 1.2-.5 2-.5s1.2.5 2 .5c2.5 0 5-4 5-8 0-5.5-5-5.5-7-4Z"/><path d="M12 8c0-2 .8-3.5 2.5-4.5"/>',
  talheres: '<path d="M6 3v5.5a1.5 1.5 0 0 0 3 0V3M7.5 10v11"/><path d="M17 21V3c-2.2 1.2-3.5 3.6-3.5 7v3H17"/>',
  biscoito: '<circle cx="12" cy="12" r="9"/><path d="M9 9h.01M14.5 8h.01M15 13.5h.01M9.5 15h.01M12 11.5h.01"/>',
  lua: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  coracao: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  lixeira: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  lapis: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z"/>',
  grafico: '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
  regua: '<rect x="2.5" y="8" width="19" height="8" rx="2"/><path d="M6.5 8v3M10.5 8v4M14.5 8v3M18 8v4"/>',
  alvo: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
  pino: '<path d="M12 21s7-6 7-11.5A7 7 0 0 0 5 9.5C5 15 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  salvar: '<path d="M6 3h12v18l-6-4-6 4Z"/>',
  livro: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2.5 2 2 0 0 0 2 2h14"/>',
  documento: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  recibo: '<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
};
function ic(nome, classe = "ic") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", classe);
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = ICONES[nome];
  return svg;
}
// Título com o ícone num quadradinho colorido (lilas, azul, rosa, amarelo, verde)
function titulo(icone, texto, cor = "lilas", tag = "h3") {
  return h(tag, { class: "titulo" }, h("span", { class: "tile " + cor }, ic(icone)), h("span", {}, texto));
}
// "Café da manhã 🍳" → "Café da manhã" (o emoji faz parte da chave salva, só some na tela)
const semEmoji = (t) => t.replace(/\s*\p{Extended_Pictographic}.*$/u, "");
const ICONE_REFEICAO = [["cafe", "amarelo"], ["maca", "verde"], ["talheres", "rosa"], ["biscoito", "azul"], ["lua", "lilas"], ["coracao", "rosa"]];

/* ---------- Alimentos e cálculos ---------- */
function alimento(id) { return D.alimentos[id] || S.personalizados[id]; }
function nutr(a, gramas) {
  const f = gramas / 100;
  return { kcal: a.kcal * f, prot: a.prot * f, carb: a.carb * f, gord: a.gord * f };
}
function somar(lista) {
  return lista.reduce((t, n) => ({ kcal: t.kcal + n.kcal, prot: t.prot + n.prot, carb: t.carb + n.carb, gord: t.gord + n.gord }),
    { kcal: 0, prot: 0, carb: 0, gord: 0 });
}
function daEpoca(nome) {
  const mes = new Date().getMonth() + 1;
  const simples = nome.toLowerCase().replaceAll(",", "");
  const primeiro = nome.split(",")[0].trim().toLowerCase();
  return (D.daEpoca[mes] || []).some((i) => primeiro === i.toLowerCase() || simples.startsWith(i.toLowerCase()));
}

// Salada: {categoria: [nomes]} -> [{categoria, item, fator}]
function itensSalada(comb) {
  const itens = [];
  for (const cat of CATEGORIAS_SALADA) {
    const disponiveis = D.salada.ingredientes[cat];
    const nomes = (comb[cat] || []).filter((n) => disponiveis.some((i) => i.nome === n));
    const divide = D.salada.regras[cat]?.[2];
    const fator = divide && nomes.length ? 1 / nomes.length : 1;
    for (const n of nomes) itens.push({ categoria: cat, item: disponiveis.find((i) => i.nome === n), fator });
  }
  return itens;
}
const totaisSalada = (itens) => somar(itens.map(({ item, fator }) => ({
  kcal: item.kcal * fator, prot: item.prot * fator, carb: item.carb * fator, gord: item.gord * fator })));
const qtdSalada = (item, fator) => fator === 1 ? item.porcao : `½ × ${item.porcao}`;

// Prato: [{espaco, id, gramas}]
const totaisPrato = (itens) => somar(itens.filter((i) => alimento(i.id)).map((i) => nutr(alimento(i.id), i.gramas)));

// Detalhes de qualquer refeição do planner (base, salada salva ou prato salvo)
// Refeição do cardápio do plano: itens sem dado em tabela (id null) aparecem, mas não entram nas calorias
function refeicaoDoPlano(nome) {
  return (plano().cardapio || []).find((r) => PREFIXO_PLANO + r.nome === nome);
}
function detalhes(nome) {
  if (D.detalhes[nome]) return D.detalhes[nome];
  const doPlano = nome.startsWith(PREFIXO_PLANO) ? refeicaoDoPlano(nome) : null;
  if (doPlano) {
    const comDado = doPlano.itens.filter((i) => i.id && alimento(i.id));
    return {
      calories: Math.round(totaisPrato(comDado).kcal),
      ingredients: doPlano.itens.map((i) => i.gramas ? { name: i.nome, quantity: i.gramas, unit: "g" }
        : { name: i.nome, quantity: 1, unit: i.medida || "porção" }),
      plano: doPlano,
      semDados: doPlano.itens.filter((i) => !(i.id && alimento(i.id))).map((i) => i.nome),
    };
  }
  if (nome.startsWith(PREFIXO_SALADA) && S.saladas[nome.slice(PREFIXO_SALADA.length)]) {
    const itens = itensSalada(S.saladas[nome.slice(PREFIXO_SALADA.length)].itens);
    return {
      calories: Math.round(totaisSalada(itens).kcal),
      ingredients: itens.map(({ item, fator }) => {
        const g = /^(\d+)g\b/.exec(item.porcao);
        return g ? { name: item.nome, quantity: +g[1] * fator, unit: "g" }
          : { name: item.nome, quantity: fator, unit: `porção de ${item.porcao}` };
      }),
    };
  }
  if (nome.startsWith(PREFIXO_PRATO) && S.pratos[nome.slice(PREFIXO_PRATO.length)]) {
    const itens = S.pratos[nome.slice(PREFIXO_PRATO.length)].itens.filter((i) => alimento(i.id));
    return {
      calories: Math.round(totaisPrato(itens).kcal),
      ingredients: itens.map((i) => ({ name: alimento(i.id).nome, quantity: i.gramas, unit: "g" })),
    };
  }
  return null;
}
function opcoesRefeicao(refeicao) {
  return [
    ...D.refeicoes[refeicao].slice().sort((a, b) => a.localeCompare(b)),
    ...Object.entries(S.saladas).filter(([, d]) => d.refeicoes.includes(refeicao)).map(([n]) => PREFIXO_SALADA + n).sort(),
    ...Object.entries(S.pratos).filter(([, d]) => d.refeicoes.includes(refeicao)).map(([n]) => PREFIXO_PRATO + n).sort(),
    ...(plano().cardapio || []).filter((r) => r.em.includes(refeicao)).map((r) => PREFIXO_PLANO + r.nome),
  ];
}
function selecao(dia, refeicao) {
  S.planner[dia] ??= {};
  S.planner[dia][refeicao] ??= { meal: "Nenhuma", people: 1 };
  return S.planner[dia][refeicao];
}
function kcalDia(dia) {
  return REFEICOES.reduce((t, r) => t + (detalhes(S.planner[dia]?.[r]?.meal || "")?.calories || 0), 0);
}
function porNoPlanner(prefixo, nome, dia, refeicao) {
  const sel = selecao(dia, refeicao);
  const anterior = sel.meal;
  sel.meal = prefixo + nome;
  atualizar();
  toast(anterior && anterior !== "Nenhuma" && anterior !== prefixo + nome
    ? `Colocado em ${dia} – ${refeicao}, no lugar de “${anterior}”.`
    : `Colocado em ${dia} – ${refeicao}.`);
}
function tirarDoPlanner(prefixo, nome, manterEm = []) {
  for (const dia of Object.keys(S.planner)) {
    for (const [ref, sel] of Object.entries(S.planner[dia])) {
      if (sel.meal === prefixo + nome && !manterEm.includes(ref)) sel.meal = "Nenhuma";
    }
  }
}
function listaCompras() {
  const total = {}, unidades = {};
  for (const dia of D.dias) {
    for (const ref of REFEICOES) {
      const sel = S.planner[dia]?.[ref];
      const det = sel && sel.meal !== "Nenhuma" ? detalhes(sel.meal) : null;
      if (!det) continue;
      for (const ing of det.ingredients) {
        const n = ing.name.toLowerCase(), u = ing.unit.toLowerCase();
        if (D.exclusoesCompras.some((ex) => n.includes(ex) || u.includes(ex))) continue;
        total[ing.name] = (total[ing.name] || 0) + ing.quantity * (sel.people || 1);
        unidades[ing.name] = ing.unit;
      }
    }
  }
  return Object.keys(total).sort((a, b) => a.localeCompare(b))
    .map((nome) => ({ nome, qtd: total[nome], unidade: unidades[nome] }));
}

/* ---------- Componentes ---------- */
function barra(valor, meta) {
  const pct = meta ? Math.min(valor / meta, 1) : 0;
  return h("div", { class: "barra" + (valor > meta ? " acima" : "") }, h("div", { style: `width:${pct * 100}%` }));
}
function metricas(t) {
  return h("div", { class: "metricas" },
    [["Proteína", t.prot], ["Carbo", t.carb], ["Gordura", t.gord]].map(([r, v]) =>
      h("div", { class: "metrica" }, h("div", { class: "rotulo" }, r), h("div", { class: "valor" }, `${fmt(v)} g`))));
}
function selectSimples(valor, opcoes, onchange, attrs = {}) {
  return h("select", { class: "entrada", onchange: (e) => onchange(e.target.value), ...attrs },
    opcoes.map((o) => h("option", { value: o, selected: o === valor }, o)));
}
function campoNumero(rotulo, valor, onchange, attrs = {}) {
  return h("label", { class: "campo" }, h("span", {}, rotulo),
    h("input", { type: "number", inputMode: "decimal", step: "0.1", min: "0", value: valor ?? "", placeholder: "—",
      onchange: (e) => onchange(e.target.value === "" ? null : Number(e.target.value)), ...attrs }));
}
function abrirModal(conteudo) { UI.modal = conteudo; render(); }
function fecharModal() { UI.modal = null; render(); }

// Cartão de salada/prato salvo: aparece em, pôr na semana, carregar, excluir
function cartaoSalvo({ prefixo, nome, dados, resumo, descricao, carregarFn, excluirFn, mudarRefeicoes }) {
  const chave = prefixo + nome;
  UI.busca[chave] ??= { dia: UI.dia, refeicao: dados.refeicoes[0] };
  const alvo = UI.busca[chave];
  if (!dados.refeicoes.includes(alvo.refeicao)) alvo.refeicao = dados.refeicoes[0];
  return h("div", { class: "cartao" },
    h("h3", {}, prefixo + nome),
    h("div", { class: "suave" }, resumo),
    h("p", { class: "suave" }, descricao),
    h("details", {},
      h("summary", { class: "suave" }, `Aparece em: ${dados.refeicoes.join(", ")}`),
      REFEICOES.map((r) => h("label", { class: "opcao" },
        h("input", { type: "checkbox", checked: dados.refeicoes.includes(r), onchange: (e) => {
          const novas = e.target.checked ? [...dados.refeicoes, r] : dados.refeicoes.filter((x) => x !== r);
          if (!novas.length) { toast("Precisa aparecer em pelo menos uma refeição."); return render(); }
          mudarRefeicoes(REFEICOES.filter((x) => novas.includes(x)));
        } }), h("span", {}, r)))),
    h("div", { class: "grade2" },
      h("label", { class: "campo" }, h("span", {}, "Dia"), selectSimples(alvo.dia, D.dias, (v) => { alvo.dia = v; })),
      h("label", { class: "campo" }, h("span", {}, "Refeição"), selectSimples(alvo.refeicao, dados.refeicoes, (v) => { alvo.refeicao = v; }))),
    h("button", { class: "btn primario bloco", onclick: () => porNoPlanner(prefixo, nome, alvo.dia, alvo.refeicao) }, ic("semana"), "Pôr na semana"),
    h("div", { class: "grade2", style: "margin-top:8px" },
      h("button", { class: "btn", onclick: carregarFn }, ic("lapis"), "Editar"),
      h("button", { class: "btn perigo", onclick: () => { if (confirm(`Excluir “${nome}”?`)) excluirFn(); } }, ic("lixeira"), "Excluir")));
}

// Cartão "salvar" compartilhado por salada e prato
function cartaoSalvar(rascunho, onSalvar, onLimpar, tipo) {
  rascunho.nome ??= "";
  rascunho.refeicoes ??= REFEICOES.filter((r) => r.startsWith("Almoço") || r.startsWith("Jantar"));
  return h("div", { class: "cartao" },
    titulo("salvar", `Salvar ${tipo}`),
    h("label", { class: "campo" }, h("span", {}, "Nome"),
      h("input", { value: rascunho.nome, placeholder: tipo === "salada" ? "Ex.: Frango com milho" : "Ex.: Frango com arroz",
        onchange: (e) => { rascunho.nome = e.target.value; salvar(); } })),
    h("details", {},
      h("summary", { class: "suave" }, `Aparece no planner em: ${rascunho.refeicoes.join(", ") || "—"}`),
      REFEICOES.map((r) => h("label", { class: "opcao" },
        h("input", { type: "checkbox", checked: rascunho.refeicoes.includes(r), onchange: (e) => {
          rascunho.refeicoes = REFEICOES.filter((x) => x === r ? e.target.checked : rascunho.refeicoes.includes(x));
          atualizar();
        } }), h("span", {}, r)))),
    h("div", { class: "grade2", style: "margin-top:8px" },
      h("button", { class: "btn primario", onclick: onSalvar }, "Salvar"),
      h("button", { class: "btn", onclick: onLimpar }, "Limpar")),
    h("p", { class: "suave" }, "Salvar com um nome que já existe substitui."));
}

/* ---------- Gráfico (SVG) com linha de tendência ---------- */
function regressao(pontos) {
  const n = pontos.length;
  const mx = pontos.reduce((s, p) => s + p.x, 0) / n, my = pontos.reduce((s, p) => s + p.y, 0) / n;
  const sxx = pontos.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const sxy = pontos.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const a = sxx ? sxy / sxx : 0;
  return { a, b: my - a * mx };
}
function grafico(registros, chave, unidade, meta = null) {
  const dados = registros.filter((r) => r[chave] != null && r.data)
    .map((r) => ({ data: r.data, x: Date.parse(r.data) / 864e5, y: r[chave] })).sort((p, q) => p.x - q.x);
  if (!dados.length) return h("p", { class: "vazio" }, "Sem registros ainda.");
  const L = 340, A = 180, me = 38, md = 10, mt = 10, mb = 24;
  const xs = dados.map((p) => p.x), ys = dados.map((p) => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 1; x1 += 1; }
  if (meta != null) ys.push(meta);
  let y0 = Math.min(...ys), y1 = Math.max(...ys); const folga = (y1 - y0) * 0.15 || 1; y0 -= folga; y1 += folga;
  const px = (x) => me + (x - x0) / (x1 - x0) * (L - me - md);
  const py = (y) => mt + (1 - (y - y0) / (y1 - y0)) * (A - mt - mb);
  const NS = "http://www.w3.org/2000/svg";
  const s = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  const svg = s("svg", { viewBox: `0 0 ${L} ${A}`, role: "img", "aria-label": `Gráfico de ${chave}` });
  for (let i = 0; i <= 3; i++) {
    const y = y0 + (y1 - y0) * i / 3;
    svg.append(s("line", { x1: me, x2: L - md, y1: py(y), y2: py(y), class: "grade" }));
    const t = s("text", { x: me - 6, y: py(y) + 4, "text-anchor": "end", class: "eixo" }); t.textContent = fmt(y, 1); svg.append(t);
  }
  for (const [p, ancora] of [[dados[0], "start"], [dados[dados.length - 1], "end"]]) {
    const t = s("text", { x: px(p.x), y: A - 6, "text-anchor": dados.length === 1 ? "middle" : ancora, class: "eixo" });
    t.textContent = dataBR(p.data).slice(0, 5); svg.append(t);
  }
  if (meta != null) {
    svg.append(s("line", { x1: me, x2: L - md, y1: py(meta), y2: py(meta), class: "linha-alvo" }));
    const t = s("text", { x: L - md, y: py(meta) - 5, "text-anchor": "end", class: "eixo alvo" }); t.textContent = `meta ${fmt(meta, 1)}`; svg.append(t);
  }
  let rodape = null;
  if (dados.length >= 2) {
    const { a, b } = regressao(dados);
    svg.append(s("line", { x1: px(x0), y1: py(a * x0 + b), x2: px(x1), y2: py(a * x1 + b),
      stroke: "var(--laranja)", "stroke-width": 2, "stroke-dasharray": "6 4" }));
    rodape = h("p", { class: "suave" }, "Tendência (tracejado laranja): ", h("b", {}, `${a * 7 >= 0 ? "+" : ""}${fmt(a * 7, 2)} ${unidade} por semana`));
  }
  svg.append(s("polyline", { points: dados.map((p) => `${px(p.x)},${py(p.y)}`).join(" "), fill: "none", stroke: "var(--acento)", "stroke-width": 2.5 }));
  for (const p of dados) {
    const c = s("circle", { cx: px(p.x), cy: py(p.y), r: 4, fill: "var(--acento)" });
    const t = s("title", {}); t.textContent = `${dataBR(p.data)}: ${fmt(p.y, 1)} ${unidade}`; c.append(t); svg.append(c);
  }
  return h("div", { class: "grafico" }, svg, rodape);
}

/* ---------- Tela: Semana ---------- */
function telaSemana() {
  const dia = UI.dia;
  const kcal = kcalDia(dia);
  const copos = S.agua[dia] || 0;
  const litros = plano().aguaLitros || 2;
  const totalCopos = Math.round(litros / 0.25);
  const metaKcal = plano().metaDiaKcal;
  const escolhidas = REFEICOES.filter((r) => (S.planner[dia]?.[r]?.meal || "Nenhuma") !== "Nenhuma").length;
  const nCompras = listaCompras().length;
  return [
    h("section", { class: "destaque" },
      h("div", { class: "destaque-texto" },
        h("h2", {}, "Sua semana, prato a prato"),
        h("p", {}, "Escolha as refeições de cada dia. A lista de compras sai pronta."),
        h("button", { class: "btn pilula", onclick: () => abrirModal(modalCompras) }, ic("carrinho"), "Lista de compras")),
      h("div", { class: "ilustracao", html: ILUSTRACAO })),
    h("div", { class: "chips" }, D.dias.map((d) => h("button", {
      class: "chip" + (d === dia ? " ativo" : ""), onclick: () => { UI.dia = d; render(); },
    }, d.slice(0, 3), d === D.dias[(hoje.getDay() + 6) % 7] ? h("span", { class: "ponto", "aria-label": "hoje" }) : null))),
    h("div", { class: "stats" },
      stat("fogo", "amarelo", "Calorias", fmt(kcal), metaKcal ? `de ~${fmt(metaKcal)} kcal` : "kcal no dia"),
      stat("gota", "azul", "Água", `${fmt(copos * 0.25, 2)} L`, `de ${fmt(litros, 2)} L`),
      stat("talheres", "rosa", "Refeições", `${escolhidas}/${REFEICOES.length}`, "escolhidas no dia"),
      stat("carrinho", "verde", "Compras", fmt(nCompras), nCompras === 1 ? "item na semana" : "itens na semana")),
    h("div", { class: "cartao" },
      h("div", { class: "linha entre" }, titulo("semana", dia, "lilas", "h2"),
        h("span", { class: "selo" }, metaKcal ? `${fmt(kcal)} de ~${fmt(metaKcal)} kcal` : `${fmt(kcal)} kcal`)),
      REFEICOES.map((ref, i) => {
        const sel = selecao(dia, ref);
        const opcoes = opcoesRefeicao(ref);
        if (sel.meal !== "Nenhuma" && !opcoes.includes(sel.meal)) opcoes.unshift(sel.meal);
        const det = detalhes(sel.meal);
        const [icone, cor] = ICONE_REFEICAO[i] || ["talheres", "lilas"];
        return h("div", { class: "refeicao" },
          h("span", { class: "tile " + cor }, ic(icone)),
          h("div", { class: "cresce" },
            h("div", { class: "linha entre" }, h("b", {}, semEmoji(ref)), det ? h("span", { class: "kcal-tag" }, `~${det.calories} kcal`) : null),
            h("div", { class: "linha", style: "margin-top:6px" },
              h("select", { class: "entrada cresce", "aria-label": semEmoji(ref), onchange: (e) => { sel.meal = e.target.value; atualizar(); } },
                ["Nenhuma", ...opcoes].map((o) => h("option", { value: o, selected: o === sel.meal }, o))),
              h("select", { class: "entrada pessoas", "aria-label": "Pessoas",
                onchange: (e) => { sel.people = Number(e.target.value); atualizar(); } },
                [1, 2, 3, 4, 5, 6].map((n) => h("option", { value: n, selected: n === (sel.people || 1) }, `${n} pess.`)))),
            det?.plano ? h("details", { class: "suave detalhe-plano" },
              h("summary", {}, ic("lista"), "Ver refeição do plano"),
              h("ul", {}, det.plano.itens.map((it) => h("li", {},
                it.nome, it.gramas ? ` · ${fmt(it.gramas, it.gramas % 1 ? 1 : 0)} g` : "", it.medida ? ` (${it.medida})` : ""))),
              det.semDados.length ? h("p", {}, `Sem dado em tabela (fora das calorias — veja o rótulo): ${det.semDados.join(", ")}.`) : null,
              det.plano.substituicoes?.length ? [h("b", {}, "Pode trocar:"), h("ul", {}, det.plano.substituicoes.map((t) => h("li", {}, t)))] : null) : null));
      })),
    h("div", { class: "cartao" },
      h("div", { class: "linha entre" }, titulo("gota", "Hidratação", "azul"), h("span", { class: "suave" }, `${fmt(copos * 0.25, 2)} de ${fmt(litros, 2)} L`)),
      h("div", { class: "copos", style: `grid-template-columns:repeat(${totalCopos <= 8 ? totalCopos : 7},1fr)` }, Array.from({ length: totalCopos }, (_, i) => h("button", {
        class: "copo" + (i < copos ? " cheio" : ""), "aria-label": `Copo ${i + 1}`,
        onclick: () => { S.agua[dia] = i < copos && i === copos - 1 ? i : i + 1; atualizar(); },
      }, ic("gota")))),
      barra(copos, totalCopos)),
    h("div", { class: "cartao" },
      h("div", { class: "linha entre" }, titulo("grafico", "Calorias da semana", "rosa"), h("span", { class: "suave" }, "toque num dia")),
      graficoSemana(metaKcal)),
    plano().orientacoes?.length ? h("details", { class: "cartao" }, h("summary", {}, titulo("pino", "Orientações do plano", "verde", "span")),
      h("ul", {}, plano().orientacoes.map((t) => h("li", {}, t)))) : null,
  ];
}
function stat(icone, cor, rotulo, valor, detalhe) {
  return h("div", { class: "stat " + cor },
    h("span", { class: "tile " + cor }, ic(icone)),
    h("div", { class: "stat-rotulo" }, rotulo),
    h("div", { class: "stat-valor" }, valor),
    h("div", { class: "stat-detalhe" }, detalhe));
}
// Barras com as calorias de cada dia; a linha tracejada é a meta do plano (se houver)
function graficoSemana(meta) {
  const vals = D.dias.map(kcalDia);
  const maior = Math.max(meta || 0, ...vals, 500);
  const passo = maior <= 1000 ? 250 : maior <= 2000 ? 500 : 1000;
  const topo = Math.ceil(maior / passo) * passo;
  const L = 340, A = 190, me = 40, md = 6, mt = 12, mb = 26;
  const py = (v) => mt + (1 - v / topo) * (A - mt - mb);
  const col = (L - me - md) / 7, larg = Math.min(26, col * 0.6);
  const NS = "http://www.w3.org/2000/svg";
  const s = (tag, attrs, texto) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (texto != null) e.textContent = texto; return e; };
  const svg = s("svg", { viewBox: `0 0 ${L} ${A}`, role: "img", "aria-label": "Calorias por dia da semana" });
  for (let v = 0; v <= topo; v += passo) {
    svg.append(s("line", { x1: me, x2: L - md, y1: py(v), y2: py(v), class: "grade" }));
    svg.append(s("text", { x: me - 6, y: py(v) + 4, "text-anchor": "end", class: "eixo" }, fmt(v)));
  }
  D.dias.forEach((d, i) => {
    const cx = me + col * i + col / 2;
    const g = s("g", { class: "dia-barra" + (d === UI.dia ? " atual" : ""), tabindex: 0, role: "button", "aria-label": `${d}: ${fmt(vals[i])} kcal` });
    g.append(s("rect", { x: me + col * i, y: mt, width: col, height: A - mt, fill: "transparent" }));
    if (vals[i] > 0) {
      const y = py(vals[i]);
      g.append(s("rect", { x: cx - larg / 2, y, width: larg, height: py(0) - y, rx: Math.min(8, (py(0) - y) / 2), class: "barra-" + (i % 5) }));
    }
    g.append(s("text", { x: cx, y: A - 8, "text-anchor": "middle", class: "eixo dia" }, d.slice(0, 3)));
    const escolher = () => { UI.dia = d; render(); };
    g.addEventListener("click", escolher);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolher(); } });
    svg.append(g);
  });
  if (meta) {
    svg.append(s("line", { x1: me, x2: L - md, y1: py(meta), y2: py(meta), class: "linha-meta" }));
    svg.append(s("text", { x: L - md, y: py(meta) - 5, "text-anchor": "end", class: "eixo meta" }, "meta"));
  }
  return h("div", { class: "grafico" }, svg);
}
const ILUSTRACAO = `<svg viewBox="0 0 160 130" aria-hidden="true">
  <defs><linearGradient id="tigela" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B9A4FF"/><stop offset="1" stop-color="#7C5CF5"/></linearGradient></defs>
  <ellipse cx="80" cy="118" rx="58" ry="7" fill="#2A1F55" opacity=".12"/>
  <path d="M118 14c11 1 18 9 18 20-11-1-18-8-18-20Z" fill="#5DB075"/>
  <path d="M124 22c3 4 6 8 8 12" stroke="#3E8C57" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="50" cy="58" r="18" fill="#7CC37F"/>
  <circle cx="74" cy="46" r="17" fill="#9BD46A"/>
  <circle cx="102" cy="52" r="18" fill="#5DB075"/>
  <circle cx="64" cy="64" r="10" fill="#FFD166"/>
  <circle cx="90" cy="61" r="12" fill="#F25C6A"/>
  <circle cx="86" cy="57" r="3" fill="#fff" opacity=".5"/>
  <circle cx="114" cy="64" r="8" fill="#F25C6A"/>
  <path d="M18 66h124a62 46 0 0 1-124 0Z" fill="url(#tigela)"/>
  <path d="M40 84c9 10 22 15 34 15" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".35"/>
  <path d="M28 14l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#FFC94D"/>
  <path d="M146 64l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2Z" fill="#FFC94D"/>
</svg>`;
function modalCompras() {
  const itens = listaCompras();
  const texto = itens.map((i) => `☐ ${fmt(i.qtd, i.qtd % 1 ? 1 : 0)} ${i.unidade} de ${i.nome}`).join("\n");
  return [
    titulo("carrinho", "Lista de compras", "verde", "h2"),
    itens.length ? h("ul", { class: "lista" }, itens.map((i) => h("li", {},
      h("input", { type: "checkbox", checked: !!S.comprasMarcadas[i.nome], style: "width:22px;height:22px;accent-color:var(--acento)",
        onchange: (e) => { S.comprasMarcadas[i.nome] = e.target.checked; atualizar(); } }),
      h("span", { class: S.comprasMarcadas[i.nome] ? "riscado" : "" }, h("b", {}, `${fmt(i.qtd, i.qtd % 1 ? 1 : 0)} ${i.unidade}`), ` de ${i.nome}`))))
      : h("p", { class: "vazio" }, "Escolha refeições na semana para gerar a lista (itens do RU, arroz e feijão ficam de fora)."),
    itens.length ? h("div", { class: "grade2", style: "margin-top:12px" },
      h("button", { class: "btn", onclick: async () => {
        if (navigator.share) { try { await navigator.share({ title: "Lista de compras", text: texto }); } catch (e) {} }
        else { try { await navigator.clipboard.writeText(texto); toast("Lista copiada!"); } catch (e) { toast("Não foi possível copiar."); } }
      } }, ic("enviar"), "Compartilhar"),
      h("button", { class: "btn", onclick: () => { S.comprasMarcadas = {}; atualizar(); } }, "Desmarcar tudo")) : null,
  ];
}

/* ---------- Tela: Salada ---------- */
function telaSalada() {
  const R = S.rascunho.salada;
  R.itens ??= {};
  const itens = itensSalada(R.itens);
  const t = totaisSalada(itens);
  const pendencias = [];
  const passos = CATEGORIAS_SALADA.map((cat, i) => {
    const [minimo, maximo, divide] = D.salada.regras[cat];
    const marcados = R.itens[cat] || [];
    if (marcados.length < minimo) pendencias.push(cat);
    const cheio = marcados.length >= maximo;
    return h("div", { class: "cartao" },
      h("div", { class: "linha entre" }, h("h3", {}, `${i + 1}. ${cat}`),
        h("span", { class: "selo" + (marcados.length >= minimo ? "" : " pendente") }, `${marcados.length}/${maximo}`)),
      h("div", { class: "suave" }, (minimo === maximo ? `Escolha ${minimo}` : `Escolha ${minimo} ou ${maximo}`) + (divide ? " — com 2, meia porção de cada" : "")),
      D.salada.ingredientes[cat].map((item) => {
        const marcado = marcados.includes(item.nome);
        const bloqueado = cheio && !marcado;
        return h("label", { class: "opcao" + (bloqueado ? " desabilitada" : "") },
          h("input", { type: "checkbox", checked: marcado, disabled: bloqueado, onchange: (e) => {
            R.itens[cat] = e.target.checked ? [...marcados, item.nome] : marcados.filter((n) => n !== item.nome);
            atualizar();
          } }),
          h("span", { class: "cresce" }, item.nome, h("div", { class: "suave" }, item.porcao)),
          h("span", { class: "kcal" }, `${fmt(item.kcal)} kcal`));
      }));
  });
  return [
    h("p", { class: "suave" }, "Regra do pote: 1–2 bases + 1 proteína + 1 carbo (ou 2 com meia porção) + 2 vegetais + 1 molho."),
    passos,
    h("div", { class: "resumo-fixo" },
      h("div", {}, h("div", { class: "grande" }, `${fmt(t.kcal)} kcal`),
        h("div", { class: "macros" }, `P ${fmt(t.prot)} g · C ${fmt(t.carb)} g · G ${fmt(t.gord)} g`)),
      h("div", { class: "cresce", style: "text-align:right;font-size:.85rem" },
        pendencias.length ? `Falta: ${pendencias.join(", ")}` : itens.length ? "Salada completa! 🎉" : "Marque os ingredientes")),
    itens.length ? h("div", { class: "cartao" }, titulo("recibo", "Ingredientes", "amarelo"),
      h("ul", { class: "lista" }, itens.map(({ item, fator }) => h("li", {},
        h("span", { class: "cresce" }, item.nome, h("div", { class: "suave" }, qtdSalada(item, fator))),
        h("b", {}, `${fmt(item.kcal * fator)} kcal`))))) : null,
    cartaoSalvar(R, () => {
      const nome = (R.nome || "").trim();
      if (!nome) return toast("Dê um nome para a salada.");
      if (!itens.length) return toast("Escolha pelo menos um ingrediente.");
      if (!R.refeicoes.length) return toast("Escolha em quais refeições ela aparece.");
      S.saladas[nome] = { itens: JSON.parse(JSON.stringify(R.itens)), refeicoes: [...R.refeicoes] };
      tirarDoPlanner(PREFIXO_SALADA, nome, R.refeicoes);
      atualizar(); toast(`Salada “${nome}” salva!`);
    }, () => { S.rascunho.salada = {}; atualizar(); }, "salada"),
    titulo("livro", "Minhas saladas", "verde", "h2"),
    Object.keys(S.saladas).length ? Object.entries(S.saladas).sort(([a], [b]) => a.localeCompare(b)).map(([nome, dados]) => {
      const its = itensSalada(dados.itens), ts = totaisSalada(its);
      return cartaoSalvo({
        prefixo: PREFIXO_SALADA, nome, dados,
        resumo: `${fmt(ts.kcal)} kcal · P ${fmt(ts.prot)} g · C ${fmt(ts.carb)} g · G ${fmt(ts.gord)} g`,
        descricao: its.map(({ item }) => item.nome).join(" · "),
        carregarFn: () => { S.rascunho.salada = { itens: JSON.parse(JSON.stringify(dados.itens)), nome, refeicoes: [...dados.refeicoes] }; atualizar(); window.scrollTo(0, 0); },
        excluirFn: () => { delete S.saladas[nome]; tirarDoPlanner(PREFIXO_SALADA, nome); atualizar(); toast("Salada excluída."); },
        mudarRefeicoes: (refs) => { dados.refeicoes = refs; tirarDoPlanner(PREFIXO_SALADA, nome, refs); atualizar(); },
      });
    }) : h("p", { class: "vazio" }, "Nenhuma salada salva ainda."),
  ];
}

/* ---------- Tela: Prato ---------- */
function opcoesEspaco(espaco) {
  const opcoes = [...(plano().opcoes[espaco] || [])].filter((o) => alimento(o.id));
  for (const [id, a] of Object.entries(S.personalizados)) if (a.grupo === espaco) opcoes.push({ id, gramas: a.gramas, medida: a.medida || "" });
  for (const id of S.rascunho.extras[espaco] || []) {
    if (alimento(id) && !opcoes.some((o) => o.id === id)) opcoes.push({ id, gramas: 100, medida: "" });
  }
  return opcoes;
}
function itensPrato() {
  return ESPACOS.flatMap((e) => Object.entries(S.rascunho.prato[e] || {}).map(([id, gramas]) => ({ espaco: e, id, gramas })));
}
function telaPrato() {
  const P = S.rascunho.prato;
  const itens = itensPrato();
  const t = totaisPrato(itens);
  const P0 = plano();
  const meta = P0.metaRefeicao;
  const metaVeg = P0.metaVegetais;
  const pendencias = [];
  const passos = ESPACOS.map((espaco, i) => {
    const [minimo, maximo] = P0.regras[espaco];
    P[espaco] ??= {};
    const marcados = P[espaco];
    const qtd = Object.keys(marcados).length;
    const ehVeg = espaco === "Vegetais";
    const gVeg = ehVeg ? Object.values(marcados).reduce((s, g) => s + g, 0) : 0;
    if (qtd < minimo) pendencias.push(espaco.toLowerCase());
    const cheio = maximo != null && qtd >= maximo;
    const termo = (UI.busca["prato_" + espaco] || "").trim().toLowerCase();
    const naLista = new Set(opcoesEspaco(espaco).map((o) => o.id));
    const resultados = termo.length >= 2 ? Object.entries(D.alimentos)
      .filter(([id, a]) => D.prato.gruposTaco[espaco].includes(a.grupo) && !naLista.has(id) && a.nome.toLowerCase().includes(termo))
      .slice(0, 8) : [];
    return h("div", { class: "cartao" },
      h("div", { class: "linha entre" }, h("h3", {}, `${i + 1}. ${espaco}`),
        h("span", { class: "selo" + ((ehVeg && metaVeg ? gVeg >= metaVeg : qtd >= minimo) ? "" : " pendente") },
          ehVeg ? (metaVeg ? `${fmt(gVeg)}/${metaVeg} g` : `${fmt(gVeg)} g`) : `${qtd}/${maximo}`)),
      h("div", { class: "suave" }, P0.descricao[espaco]),
      opcoesEspaco(espaco).map((o) => {
        const a = alimento(o.id);
        const marcado = o.id in marcados;
        const bloqueado = cheio && !marcado;
        return h("div", { class: "opcao" + (bloqueado ? " desabilitada" : "") },
          h("input", { type: "checkbox", checked: marcado, disabled: bloqueado, onchange: (e) => {
            if (e.target.checked) marcados[o.id] = o.gramas; else delete marcados[o.id];
            atualizar();
          } }),
          h("span", { class: "cresce", onclick: () => { if (bloqueado) return; if (marcado) delete marcados[o.id]; else marcados[o.id] = o.gramas; atualizar(); } },
            a.nome, daEpoca(a.nome) ? " 🌱" : "",
            h("div", { class: "suave" }, [`${fmt(o.gramas)} g`, o.medida, a.fonte === "USDA" ? "fonte: USDA" : a.fonte ? null : "seu cadastro"].filter(Boolean).join(" · "))),
          marcado ? h("input", { type: "number", class: "entrada gramas", inputMode: "decimal", min: "0", step: "5", value: marcados[o.id],
            "aria-label": "Gramas", onchange: (e) => { marcados[o.id] = Number(e.target.value) || 0; atualizar(); } })
            : h("span", { class: "kcal" }, `${fmt(nutr(a, o.gramas).kcal)} kcal`));
      }),
      ehVeg && qtd && metaVeg ? [barra(gVeg, metaVeg),
        h("button", { class: "btn bloco", onclick: () => {
          for (const id of Object.keys(marcados)) marcados[id] = Math.round(metaVeg / qtd);
          atualizar();
        } }, `Dividir ${metaVeg} g igualmente`)] : null,
      h("label", { class: "busca" }, ic("busca"),
        h("input", { class: "entrada", type: "search", placeholder: `Buscar outro alimento na TACO (${espaco.toLowerCase()})…`,
          value: UI.busca["prato_" + espaco] || "",
          oninput: (e) => { UI.busca["prato_" + espaco] = e.target.value; renderMantendoFoco(e.target); } })),
      resultados.length ? h("ul", { class: "lista" }, resultados.map(([id, a]) => h("li", {},
        h("span", { class: "cresce" }, a.nome, h("div", { class: "suave" }, `${fmt(a.kcal)} kcal / 100 g`)),
        h("button", { class: "btn", onclick: () => {
          (S.rascunho.extras[espaco] ??= []).push(id);
          if (!cheio) marcados[id] = 100;
          UI.busca["prato_" + espaco] = "";
          atualizar();
        } }, "Adicionar")))) : null);
  });
  const peso = Object.fromEntries(Object.keys(D.prato.proporcao).map((e) => [e, itens.filter((i) => i.espaco === e).reduce((s, i) => s + i.gramas, 0)]));
  const pesoTotal = Object.values(peso).reduce((s, g) => s + g, 0);
  return [
    !S.plano ? h("div", { class: "aviso" }, "Você está usando o ", h("b", {}, "plano de exemplo"),
      " (genérico, 100 g de cada). Toque no seu perfil (círculo no topo) → Backup e plano alimentar, e carregue o seu ", h("b", {}, "meu_plano.json"),
      " para usar as regras e quantidades da sua nutri.") : null,
    h("p", { class: "suave" }, `Plano: ${plano().nome}. Ajuste os gramas se quiser. 🌱 = da época.`),
    passos,
    h("div", { class: "resumo-fixo" },
      h("div", {}, h("div", { class: "grande" }, `${fmt(t.kcal)} kcal`),
        h("div", { class: "macros" }, `P ${fmt(t.prot)} g · C ${fmt(t.carb)} g · G ${fmt(t.gord)} g`)),
      h("div", { class: "cresce", style: "text-align:right;font-size:.85rem" },
        pendencias.length ? `Falta: ${pendencias.join(", ")}` : itens.length ? "Prato completo! 🎉" : "Marque os alimentos")),
    itens.length ? h("div", { class: "cartao" },
      meta ? [titulo("alvo", "Referência do plano por refeição", "azul"),
        [["carb", "Carbo"], ["prot", "Proteína"], ["gord", "Gordura"]].map(([k, r]) => [
          h("div", { class: "linha entre suave" }, h("span", {}, r), h("span", {}, `${fmt(t[k])} g de ~${meta[k]} g`)), barra(t[k], meta[k])]),
        h("p", { class: "suave" }, "É só referência: algumas refeições ficam acima, outras abaixo.")] : null,
      pesoTotal ? [titulo("prato", "Proporção do prato (pelo peso)", "rosa"),
        Object.entries(D.prato.proporcao).map(([e, ideal]) => h("div", { class: "linha entre" },
          h("span", {}, e), h("span", {}, h("b", {}, `${fmt(peso[e] / pesoTotal * 100)}%`), h("span", { class: "suave" }, ` (ideal ~${ideal}%)`))))] : null) : null,
    cartaoSalvar(P, () => {
      const nome = (P.nome || "").trim();
      if (!nome) return toast("Dê um nome para o prato.");
      if (!itens.length) return toast("Escolha pelo menos um alimento.");
      if (!P.refeicoes.length) return toast("Escolha em quais refeições ele aparece.");
      S.pratos[nome] = { itens: itens.map((i) => ({ ...i })), refeicoes: [...P.refeicoes] };
      tirarDoPlanner(PREFIXO_PRATO, nome, P.refeicoes);
      atualizar(); toast(`Prato “${nome}” salvo!`);
    }, () => { S.rascunho.prato = {}; S.rascunho.extras = {}; atualizar(); }, "prato"),
    h("details", { class: "cartao" },
      h("summary", {}, titulo("mais", "Cadastrar alimento que não está na TACO", "amarelo", "span")),
      formularioAlimento()),
    titulo("livro", "Meus pratos", "verde", "h2"),
    Object.keys(S.pratos).length ? Object.entries(S.pratos).sort(([a], [b]) => a.localeCompare(b)).map(([nome, dados]) => {
      const tp = totaisPrato(dados.itens);
      return cartaoSalvo({
        prefixo: PREFIXO_PRATO, nome, dados,
        resumo: `${fmt(tp.kcal)} kcal · P ${fmt(tp.prot)} g · C ${fmt(tp.carb)} g · G ${fmt(tp.gord)} g`,
        descricao: dados.itens.map((i) => `${alimento(i.id)?.nome || "(excluído)"} (${fmt(i.gramas)} g)`).join(" · "),
        carregarFn: () => {
          const rasc = { nome, refeicoes: [...dados.refeicoes] }, extras = {};
          for (const i of dados.itens) {
            (rasc[i.espaco] ??= {})[i.id] = i.gramas;
            if (!(plano().opcoes[i.espaco] || []).some((o) => o.id === i.id)) (extras[i.espaco] ??= []).push(i.id);
          }
          S.rascunho.prato = rasc; S.rascunho.extras = extras; atualizar(); window.scrollTo(0, 0);
        },
        excluirFn: () => { delete S.pratos[nome]; tirarDoPlanner(PREFIXO_PRATO, nome); atualizar(); toast("Prato excluído."); },
        mudarRefeicoes: (refs) => { dados.refeicoes = refs; tirarDoPlanner(PREFIXO_PRATO, nome, refs); atualizar(); },
      });
    }) : h("p", { class: "vazio" }, "Nenhum prato salvo ainda."),
  ];
}
const novoAlimento = { nome: "", grupo: "Proteína", kcal: null, prot: null, carb: null, gord: null, gramas: 100, medida: "" };
function formularioAlimento() {
  const N = novoAlimento;
  const meus = Object.entries(S.personalizados);
  return [
    h("p", { class: "suave" }, "Informe os valores por 100 g (do rótulo ou de outra tabela)."),
    h("label", { class: "campo" }, h("span", {}, "Nome"), h("input", { value: N.nome, placeholder: "Ex.: Hambúrguer de lentilha", onchange: (e) => { N.nome = e.target.value; } })),
    h("label", { class: "campo" }, h("span", {}, "Espaço do prato"), selectSimples(N.grupo, ESPACOS, (v) => { N.grupo = v; })),
    h("div", { class: "grade2" },
      campoNumero("Calorias (kcal/100 g)", N.kcal, (v) => { N.kcal = v; }),
      campoNumero("Proteína (g/100 g)", N.prot, (v) => { N.prot = v; }),
      campoNumero("Carbo (g/100 g)", N.carb, (v) => { N.carb = v; }),
      campoNumero("Gordura (g/100 g)", N.gord, (v) => { N.gord = v; }),
      campoNumero("Porção padrão (g)", N.gramas, (v) => { N.gramas = v || 100; }),
      h("label", { class: "campo" }, h("span", {}, "Medida caseira"), h("input", { value: N.medida, placeholder: "Ex.: 1 unidade", onchange: (e) => { N.medida = e.target.value; } }))),
    h("button", { class: "btn primario bloco", onclick: () => {
      if (!N.nome.trim()) return toast("Dê um nome para o alimento.");
      const id = "P" + (Math.max(0, ...Object.keys(S.personalizados).map((k) => Number(k.slice(1)) || 0)) + 1);
      S.personalizados[id] = { nome: N.nome.trim(), grupo: N.grupo, fonte: "", kcal: N.kcal || 0, prot: N.prot || 0, carb: N.carb || 0, gord: N.gord || 0, gramas: N.gramas || 100, medida: N.medida };
      Object.assign(N, { nome: "", kcal: null, prot: null, carb: null, gord: null, gramas: 100, medida: "" });
      atualizar(); toast("Alimento cadastrado!");
    } }, "Cadastrar"),
    meus.length ? h("ul", { class: "lista", style: "margin-top:8px" }, meus.map(([id, a]) => h("li", {},
      h("span", { class: "cresce" }, a.nome, h("div", { class: "suave" }, `${a.grupo} · ${fmt(a.kcal)} kcal/100 g`)),
      h("button", { class: "btn perigo icone", "aria-label": `Excluir ${a.nome}`, onclick: () => {
        if (!confirm(`Excluir “${a.nome}”?`)) return;
        delete S.personalizados[id];
        for (const e of ESPACOS) delete S.rascunho.prato[e]?.[id];
        atualizar();
      } }, ic("lixeira"))))) : null,
  ];
}

/* ---------- Tela: Peso e medidas ---------- */
const formMedidas = { data: hojeISO() }, formBio = { data: hojeISO() };
const escolhaGrafico = { medida: "cintura", bio: "gordura" };
function salvarRegistro(lista, form, campos, extra = []) {
  const reg = { data: form.data };
  for (const [k] of campos) reg[k] = form[k] ?? null;
  for (const k of extra) reg[k] = (form[k] || "").trim() || null;
  if ([...campos.map(([k]) => k), ...extra].every((k) => reg[k] == null)) { toast("Preencha pelo menos um valor."); return false; }
  const i = lista.findIndex((r) => r.data === reg.data);
  if (i >= 0) lista.splice(i, 1, reg); else lista.push(reg);
  lista.sort((a, b) => a.data.localeCompare(b.data));
  return true;
}
function historico(lista, campos, extra = []) {
  if (!lista.length) return h("p", { class: "vazio" }, "Nenhum registro ainda.");
  return h("ul", { class: "lista" }, lista.slice().reverse().map((r) => h("li", {},
    h("span", { class: "cresce" }, h("b", {}, dataBR(r.data)), h("div", { class: "suave" },
      [...campos.filter(([k]) => r[k] != null).map(([k, rot, u]) => `${rot}: ${fmt(r[k], 1)}${u ? " " + u : ""}`),
        ...extra.filter((k) => r[k]).map((k) => r[k])].join(" · "))),
    h("button", { class: "btn perigo icone", "aria-label": "Excluir registro", onclick: () => {
      if (confirm(`Excluir o registro de ${dataBR(r.data)}?`)) { lista.splice(lista.indexOf(r), 1); atualizar(); }
    } }, ic("lixeira")))));
}
// Peso: junta medidas e bioimpedância (no mesmo dia, vale o das medidas)
function seriePeso() {
  const pesos = {};
  for (const r of S.bio) if (r.peso != null) pesos[r.data] = r.peso;
  for (const r of S.medidas) if (r.peso != null) pesos[r.data] = r.peso;
  return Object.entries(pesos).map(([data, peso]) => ({ data, peso })).sort((a, b) => a.data.localeCompare(b.data));
}
function faltaMeta(atual, meta) {
  const d = atual - meta;
  return Math.abs(d) < 0.05 ? "na meta!" : `${d > 0 ? "−" : "+"}${fmt(Math.abs(d), 1)} kg`;
}
function idade(iso) {
  if (!iso) return null;
  const n = new Date(iso + "T12:00"), h0 = new Date();
  let a = h0.getFullYear() - n.getFullYear();
  if (h0.getMonth() < n.getMonth() || (h0.getMonth() === n.getMonth() && h0.getDate() < n.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}
function telaPeso() {
  const abas = h("div", { class: "chips" },
    [["medidas", "regua", "Medidas e peso"], ["bio", "alvo", "Bioimpedância"]].map(([k, icone, r]) =>
      h("button", { class: "chip" + (UI.abaPeso === k ? " ativo" : ""), onclick: () => { UI.abaPeso = k; render(); } }, ic(icone), r)));
  if (UI.abaPeso === "medidas") {
    const serie = seriePeso();
    const meta = S.perfil.pesoMeta;
    const comMedida = CAMPOS_MEDIDAS.filter(([k, , u]) => u === "cm" && S.medidas.some((r) => r[k] != null));
    if (comMedida.length && !comMedida.some(([k]) => k === escolhaGrafico.medida)) escolhaGrafico.medida = comMedida[0][0];
    return [abas,
      h("div", { class: "cartao" },
        titulo("grafico", "Tendência do peso", "rosa"),
        serie.length ? h("div", { class: "metricas" },
          [["Atual", `${fmt(serie.at(-1).peso, 1)} kg`], ["Desde o início", `${serie.at(-1).peso - serie[0].peso >= 0 ? "+" : ""}${fmt(serie.at(-1).peso - serie[0].peso, 1)} kg`],
            meta ? ["Para a meta", faltaMeta(serie.at(-1).peso, meta)] : ["Registros", serie.length]]
            .map(([r, v]) => h("div", { class: "metrica" }, h("div", { class: "rotulo" }, r), h("div", { class: "valor" }, v)))) : null,
        grafico(serie, "peso", "kg", meta || null)),
      h("div", { class: "cartao" },
        titulo("mais", "Novo registro", "lilas"),
        h("label", { class: "campo" }, h("span", {}, "Data"), h("input", { type: "date", value: formMedidas.data, onchange: (e) => { formMedidas.data = e.target.value; } })),
        h("div", { class: "grade2" }, CAMPOS_MEDIDAS.map(([k, r, u]) => campoNumero(`${r} (${u})`, formMedidas[k], (v) => { formMedidas[k] = v; }))),
        h("button", { class: "btn primario bloco", onclick: () => {
          if (!salvarRegistro(S.medidas, formMedidas, CAMPOS_MEDIDAS)) return;
          for (const [k] of CAMPOS_MEDIDAS) formMedidas[k] = null;
          atualizar(); toast("Medidas salvas!");
        } }, "Salvar medidas"),
        h("p", { class: "suave" }, "Deixe em branco o que não mediu. Salvar de novo na mesma data substitui.")),
      comMedida.length ? h("div", { class: "cartao" },
        titulo("regua", "Evolução das medidas", "azul"),
        h("select", { class: "entrada", onchange: (e) => { escolhaGrafico.medida = e.target.value; render(); } },
          comMedida.map(([k, r]) => h("option", { value: k, selected: k === escolhaGrafico.medida }, r))),
        grafico(S.medidas, escolhaGrafico.medida, "cm")) : null,
      h("div", { class: "cartao" }, titulo("lista", "Histórico", "amarelo"), historico(S.medidas, CAMPOS_MEDIDAS)),
    ];
  }
  const comDados = CAMPOS_BIO.filter(([k]) => S.bio.some((r) => r[k] != null));
  if (comDados.length && !comDados.some(([k]) => k === escolhaGrafico.bio)) escolhaGrafico.bio = comDados[0][0];
  const campoGraf = CAMPOS_BIO.find(([k]) => k === escolhaGrafico.bio);
  return [abas,
    h("div", { class: "cartao" },
      titulo("mais", "Nova bioimpedância", "lilas"),
      h("label", { class: "campo" }, h("span", {}, "Print da balança (só para consulta, não é salvo)"),
        h("input", { type: "file", accept: "image/*", onchange: (e) => {
          const f = e.target.files[0];
          if (f) { formBio.imagem && URL.revokeObjectURL(formBio.imagem); formBio.imagem = URL.createObjectURL(f); render(); }
        } })),
      formBio.imagem ? h("img", { src: formBio.imagem, alt: "Print da balança", style: "width:100%;border-radius:12px;margin:4px 0 8px" }) : null,
      h("label", { class: "campo" }, h("span", {}, "Data"), h("input", { type: "date", value: formBio.data, onchange: (e) => { formBio.data = e.target.value; } })),
      h("div", { class: "grade2" }, CAMPOS_BIO.map(([k, r, u]) => campoNumero(u ? `${r} (${u})` : r, formBio[k], (v) => { formBio[k] = v; }))),
      h("label", { class: "campo" }, h("span", {}, "Tipo de corpo"), h("input", { value: formBio.tipo || "", placeholder: "Ex.: Padrão", onchange: (e) => { formBio.tipo = e.target.value; } })),
      h("button", { class: "btn primario bloco", onclick: () => {
        if (!salvarRegistro(S.bio, formBio, CAMPOS_BIO, ["tipo"])) return;
        for (const [k] of CAMPOS_BIO) formBio[k] = null;
        formBio.tipo = "";
        atualizar(); toast("Bioimpedância salva!");
      } }, "Salvar bioimpedância")),
    comDados.length ? h("div", { class: "cartao" },
      titulo("grafico", "Evolução", "azul"),
      h("select", { class: "entrada", onchange: (e) => { escolhaGrafico.bio = e.target.value; render(); } },
        comDados.map(([k, r]) => h("option", { value: k, selected: k === escolhaGrafico.bio }, r))),
      grafico(S.bio, campoGraf[0], campoGraf[2])) : null,
    h("div", { class: "cartao" }, titulo("lista", "Histórico", "amarelo"), historico(S.bio, CAMPOS_BIO, ["tipo"])),
  ];
}

/* ---------- Modais: referências e backup ---------- */
function modalReferencias() {
  const R = D.referencias;
  const usda = Object.values(D.alimentos).filter((a) => a.fonte === "USDA").map((a) => a.nome).sort();
  const planilha = Object.values(D.salada.ingredientes).flat().filter((i) => i.fonte === "Planilha original").map((i) => i.nome);
  return [
    h("h2", {}, "Referências"),
    h("ul", {},
      h("li", {}, h("b", {}, "Valores nutricionais: "), R.REF_TACO, "."),
      h("li", {}, h("b", {}, "Alimentos que não existem na TACO: "), R.REF_USDA, " — ", usda.join("; "), "."),
      h("li", {}, h("b", {}, "Salada, itens sem equivalente na TACO "), "(valores da sua planilha original): ", planilha.join("; "), "."),
      h("li", {}, h("b", {}, "Regras do prato e metas: "), S.plano ? `${R.REF_PLANO} (${plano().nome})` : "plano de exemplo, genérico", "."),
      h("li", {}, h("b", {}, "Proporção do prato: "), R.REF_WEBDIET_PRATO, " (50% folhas e vegetais + 15% legumes, 25% proteína, 10% carboidrato)."),
      h("li", {}, h("b", {}, "Selo 🌱: "), R.REF_WEBDIET_EPOCA, ".")),
    h("button", { class: "btn bloco", onclick: fecharModal }, "Fechar"),
  ];
}
function modalBackup() {
  return [
    titulo("baixar", "Backup dos seus dados", "lilas", "h2"),
    h("p", { class: "suave" }, "Seus dados ficam salvos só neste aparelho, neste navegador. Se limpar os dados do navegador, eles somem — faça backup de vez em quando."),
    !armazenamentoOk ? h("p", { class: "aviso" }, "⚠️ Este navegador não está deixando salvar (modo anônimo?). Exporte um backup antes de fechar.") : null,
    h("button", { class: "btn primario bloco", onclick: () => {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
      const a = h("a", { href: URL.createObjectURL(blob), download: `planner-saudavel-${hojeISO()}.json` });
      document.body.append(a); a.click(); a.remove();
    } }, ic("baixar"), "Exportar backup"),
    h("label", { class: "btn bloco", style: "margin-top:8px" }, ic("enviar"), "Importar backup",
      h("input", { type: "file", accept: "application/json,.json", style: "display:none", onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const dados = JSON.parse(await f.text());
          if (typeof dados !== "object" || !dados) throw new Error();
          if (!confirm("Importar substitui todos os dados atuais deste aparelho. Continuar?")) return;
          S = Object.assign(estadoInicial(), dados); UI.modal = null; aplicarTema(); atualizar(); toast("Backup importado!");
        } catch (err) { toast("Arquivo de backup inválido."); }
      } })),
    h("div", { style: "margin-top:20px" }, titulo("documento", "Meu plano alimentar", "verde", "h2")),
    h("p", { class: "suave" }, `Em uso: ${plano().nome}. O seu plano fica só neste aparelho — ele não está no site.`),
    h("label", { class: "btn primario bloco" }, ic("documento"), "Carregar meu_plano.json",
      h("input", { type: "file", accept: "application/json,.json", style: "display:none", onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const novo = JSON.parse(await f.text());
          if (!planoValido(novo)) throw new Error();
          S.plano = novo; S.rascunho.prato = {}; S.rascunho.extras = {}; UI.modal = null; atualizar();
          toast(`Plano carregado: ${novo.nome || "meu plano"}`);
        } catch (err) { toast("Arquivo de plano inválido."); }
      } })),
    S.plano ? h("button", { class: "btn perigo bloco", style: "margin-top:8px", onclick: () => {
      if (confirm("Voltar para o plano de exemplo?")) { S.plano = null; S.rascunho.prato = {}; S.rascunho.extras = {}; atualizar(); }
    } }, "Voltar ao plano de exemplo") : null,
    h("button", { class: "btn bloco", style: "margin-top:8px", onclick: fecharModal }, "Fechar"),
  ];
}

/* ---------- Perfil e configurações ---------- */
function aplicarTema() {
  const escuro = S.tema === "escuro";
  if (escuro) document.documentElement.dataset.theme = "dark";
  else document.documentElement.dataset.theme = "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", escuro ? "#14122A" : "#EEEBFB");
}
function inicial() { return (S.perfil.nome || "").trim().charAt(0).toUpperCase(); }
function modalPerfil() {
  const P = S.perfil;
  const serie = seriePeso();
  const atual = serie.at(-1)?.peso;
  const imc = atual && P.altura ? atual / (P.altura / 100) ** 2 : null;
  const anos = idade(P.nascimento);
  const mudar = (k, v) => { if (v == null || v === "") delete P[k]; else P[k] = v; atualizar(); };
  const numero = (e) => { const v = parseFloat(String(e.target.value).replace(",", ".")); return Number.isFinite(v) && v > 0 ? v : null; };
  return [
    h("div", { class: "perfil-topo" },
      h("span", { class: "avatar", "aria-hidden": "true" }, inicial() || ic("pessoa")),
      h("div", { class: "cresce" }, h("h2", {}, P.nome ? `Olá, ${P.nome}!` : "Seu perfil"),
        h("div", { class: "suave" }, anos != null ? `${anos} anos` : "Fica salvo só neste aparelho."))),
    h("div", { class: "metricas" },
      [["Peso atual", atual ? `${fmt(atual, 1)} kg` : "—"],
       ["Meta", P.pesoMeta ? `${fmt(P.pesoMeta, 1)} kg` : "—"],
       atual && P.pesoMeta ? ["Para a meta", faltaMeta(atual, P.pesoMeta)] : ["IMC", imc ? fmt(imc, 1) : "—"]]
        .map(([r, v]) => h("div", { class: "metrica" }, h("div", { class: "rotulo" }, r), h("div", { class: "valor" }, v)))),
    atual && P.pesoMeta && imc ? h("p", { class: "suave" }, `IMC calculado: ${fmt(imc, 1)} (peso do último registro e sua altura).`) : null,
    !atual ? h("p", { class: "suave" }, "O peso atual vem do último registro da aba Peso.") : null,
    h("div", { class: "secao" }, titulo("pessoa", "Seus dados", "rosa")),
    h("label", { class: "campo" }, h("span", {}, "Nome"),
      h("input", { id: "perfil-nome", value: P.nome || "", placeholder: "Como quer ser chamada?", autocomplete: "given-name",
        onchange: (e) => mudar("nome", e.target.value.trim()) })),
    h("label", { class: "campo" }, h("span", {}, "Data de nascimento"),
      h("input", { id: "perfil-nascimento", type: "date", value: P.nascimento || "", max: hojeISO(),
        onchange: (e) => mudar("nascimento", e.target.value) })),
    h("div", { class: "grade2" },
      h("label", { class: "campo" }, h("span", {}, "Altura (cm)"),
        h("input", { id: "perfil-altura", type: "number", inputMode: "decimal", min: "50", max: "250", step: "0.5", value: P.altura ?? "", placeholder: "Ex.: 165",
          onchange: (e) => mudar("altura", numero(e)) })),
      h("label", { class: "campo" }, h("span", {}, "Peso meta (kg)"),
        h("input", { id: "perfil-meta", type: "number", inputMode: "decimal", min: "20", max: "300", step: "0.1", value: P.pesoMeta ?? "", placeholder: "Ex.: 62",
          onchange: (e) => mudar("pesoMeta", numero(e)) }))),
    h("div", { class: "secao" }, titulo("sol", "Aparência", "amarelo")),
    h("div", { class: "alternador", role: "radiogroup", "aria-label": "Tema" },
      [["claro", "sol", "Claro"], ["escuro", "lua", "Escuro"]].map(([k, icone, r]) =>
        h("button", { class: S.tema === k ? "ativo" : "", role: "radio", "aria-checked": String(S.tema === k),
          onclick: () => { S.tema = k; aplicarTema(); atualizar(); } }, ic(icone), r))),
    h("div", { class: "secao" }, titulo("baixar", "Dados e plano", "lilas")),
    h("button", { class: "btn bloco", onclick: () => abrirModal(modalBackup) }, ic("baixar"), "Backup e plano alimentar"),
    h("button", { class: "btn primario bloco", style: "margin-top:12px", onclick: fecharModal }, "Pronto"),
  ];
}

/* ---------- Render ---------- */
const ABAS = [["semana", "semana", "Semana"], ["salada", "salada", "Salada"], ["prato", "prato", "Prato"], ["peso", "peso", "Peso"]];
const TITULOS = { semana: "Plano da semana", salada: "Monte sua salada", prato: "Monte seu prato", peso: "Peso e medidas" };
function render() {
  const rolagem = window.scrollY;
  const telas = { semana: telaSemana, salada: telaSalada, prato: telaPrato, peso: telaPeso };
  const app = document.getElementById("app");
  const partes = [
    h("header", { class: "topo" },
      h("span", { class: "logo" }, ic("salada")),
      h("div", { class: "cresce" }, h("div", { class: "marca" }, S.perfil.nome ? `Olá, ${S.perfil.nome}!` : "Planner Saudável"), h("h1", {}, TITULOS[UI.aba])),
      h("button", { class: "icone-btn", "aria-label": "Referências", title: "Referências", onclick: () => abrirModal(modalReferencias) }, ic("ajuda")),
      h("button", { class: "avatar", "aria-label": "Perfil e configurações", title: "Perfil e configurações", onclick: () => abrirModal(modalPerfil) }, inicial() || ic("pessoa"))),
    !armazenamentoOk ? h("p", { class: "aviso" }, "⚠️ Não foi possível salvar neste navegador. Abra o perfil (círculo no topo) → Backup e plano alimentar para exportar seus dados.") : null,
    telas[UI.aba](),
    h("nav", { class: "nav" }, h("div", { class: "nav-interno" }, ABAS.map(([k, e, r]) =>
      h("button", { class: UI.aba === k ? "ativo" : "", "aria-current": UI.aba === k ? "page" : null,
        onclick: () => { if (UI.aba !== k) { UI.aba = k; render(); window.scrollTo(0, 0); } } },
        ic(e), h("span", {}, r))))),
    UI.modal ? h("div", { class: "fundo-modal", onclick: (e) => { if (e.target === e.currentTarget) fecharModal(); } },
      h("div", { class: "folha", role: "dialog" }, UI.modal())) : null,
  ];
  app.replaceChildren(...partes.flat(Infinity).filter((p) => p instanceof Node));
  window.scrollTo(0, rolagem);
}
// Busca: re-renderiza sem perder o foco/cursor do campo
function renderMantendoFoco(campo) {
  const ph = campo.placeholder, pos = campo.selectionStart;
  render();
  const novo = [...document.querySelectorAll("input[type=search]")].find((i) => i.placeholder === ph && i.value === campo.value);
  if (novo) { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch (e) {} }
}
aplicarTema();
render();
