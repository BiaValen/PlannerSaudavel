/* Planner Saudável — versão para celular.
   Tudo roda no navegador; os dados ficam salvos só neste aparelho (localStorage).
   Os alimentos, regras e valores nutricionais vêm de dados.js (gerado por gerar_dados.py). */
"use strict";

const D = window.DADOS;
const CHAVE = "plannerSaudavel.v1";
const PREFIXO_SALADA = "🥗 ";
const PREFIXO_PRATO = "🍽️ ";
const REFEICOES = Object.keys(D.refeicoes);
const ESPACOS = Object.keys(D.prato.regras);
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
function detalhes(nome) {
  if (D.detalhes[nome]) return D.detalhes[nome];
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
    h("button", { class: "btn primario bloco", onclick: () => porNoPlanner(prefixo, nome, alvo.dia, alvo.refeicao) }, "🗓️ Pôr na semana"),
    h("div", { class: "grade2", style: "margin-top:8px" },
      h("button", { class: "btn", onclick: carregarFn }, "✏️ Editar"),
      h("button", { class: "btn perigo", onclick: () => { if (confirm(`Excluir “${nome}”?`)) excluirFn(); } }, "🗑️ Excluir")));
}

// Cartão "salvar" compartilhado por salada e prato
function cartaoSalvar(rascunho, onSalvar, onLimpar, tipo) {
  rascunho.nome ??= "";
  rascunho.refeicoes ??= REFEICOES.filter((r) => r.startsWith("Almoço") || r.startsWith("Jantar"));
  return h("div", { class: "cartao" },
    h("h3", {}, `💾 Salvar ${tipo}`),
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
function grafico(registros, chave, unidade) {
  const dados = registros.filter((r) => r[chave] != null && r.data)
    .map((r) => ({ data: r.data, x: Date.parse(r.data) / 864e5, y: r[chave] })).sort((p, q) => p.x - q.x);
  if (!dados.length) return h("p", { class: "vazio" }, "Sem registros ainda.");
  const L = 340, A = 180, me = 38, md = 10, mt = 10, mb = 24;
  const xs = dados.map((p) => p.x), ys = dados.map((p) => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 1; x1 += 1; }
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
  let rodape = null;
  if (dados.length >= 2) {
    const { a, b } = regressao(dados);
    svg.append(s("line", { x1: px(x0), y1: py(a * x0 + b), x2: px(x1), y2: py(a * x1 + b),
      stroke: "var(--laranja)", "stroke-width": 2, "stroke-dasharray": "6 4" }));
    rodape = h("p", { class: "suave" }, "Tendência (tracejado laranja): ", h("b", {}, `${a * 7 >= 0 ? "+" : ""}${fmt(a * 7, 2)} ${unidade} por semana`));
  }
  svg.append(s("polyline", { points: dados.map((p) => `${px(p.x)},${py(p.y)}`).join(" "), fill: "none", stroke: "var(--verde)", "stroke-width": 2.5 }));
  for (const p of dados) {
    const c = s("circle", { cx: px(p.x), cy: py(p.y), r: 4, fill: "var(--verde)" });
    const t = s("title", {}); t.textContent = `${dataBR(p.data)}: ${fmt(p.y, 1)} ${unidade}`; c.append(t); svg.append(c);
  }
  return h("div", { class: "grafico" }, svg, rodape);
}

/* ---------- Tela: Semana ---------- */
function telaSemana() {
  const dia = UI.dia;
  const kcal = kcalDia(dia);
  const copos = S.agua[dia] || 0;
  return [
    h("div", { class: "chips" }, D.dias.map((d) => h("button", {
      class: "chip" + (d === dia ? " ativo" : ""), onclick: () => { UI.dia = d; render(); },
    }, d.slice(0, 3), d === D.dias[(hoje.getDay() + 6) % 7] ? h("span", { class: "ponto" }, " •") : null))),
    h("div", { class: "cartao" },
      h("div", { class: "linha entre" }, h("h2", {}, dia), h("span", { class: "selo" }, `${fmt(kcal)} kcal`)),
      REFEICOES.map((ref) => {
        const sel = selecao(dia, ref);
        const opcoes = opcoesRefeicao(ref);
        if (sel.meal !== "Nenhuma" && !opcoes.includes(sel.meal)) opcoes.unshift(sel.meal);
        const det = detalhes(sel.meal);
        return h("div", { style: "margin:12px 0" },
          h("div", { class: "linha entre" }, h("b", {}, ref), det ? h("span", { class: "suave" }, `~${det.calories} kcal`) : null),
          h("div", { class: "linha", style: "margin-top:4px" },
            h("select", { class: "entrada cresce", onchange: (e) => { sel.meal = e.target.value; atualizar(); } },
              ["Nenhuma", ...opcoes].map((o) => h("option", { value: o, selected: o === sel.meal }, o))),
            h("select", { class: "entrada", style: "width:76px", title: "Pessoas",
              onchange: (e) => { sel.people = Number(e.target.value); atualizar(); } },
              [1, 2, 3, 4, 5, 6].map((n) => h("option", { value: n, selected: n === (sel.people || 1) }, `👤${n}`)))));
      })),
    h("div", { class: "cartao" },
      h("div", { class: "linha entre" }, h("h3", {}, "💧 Hidratação"), h("span", { class: "suave" }, `${fmt(copos * 0.25, 2)} de 2,00 L`)),
      h("div", { class: "copos" }, Array.from({ length: 8 }, (_, i) => h("button", {
        class: "copo" + (i < copos ? " cheio" : ""), "aria-label": `Copo ${i + 1}`,
        onclick: () => { S.agua[dia] = i < copos && i === copos - 1 ? i : i + 1; atualizar(); },
      }, "🥛"))),
      barra(copos, 8)),
    h("button", { class: "btn primario bloco", onclick: () => abrirModal(modalCompras) }, "🛒 Lista de compras da semana"),
  ];
}
function modalCompras() {
  const itens = listaCompras();
  const texto = itens.map((i) => `☐ ${fmt(i.qtd, i.qtd % 1 ? 1 : 0)} ${i.unidade} de ${i.nome}`).join("\n");
  return [
    h("h2", {}, "🛒 Lista de compras"),
    itens.length ? h("ul", { class: "lista" }, itens.map((i) => h("li", {},
      h("input", { type: "checkbox", checked: !!S.comprasMarcadas[i.nome], style: "width:22px;height:22px;accent-color:var(--verde)",
        onchange: (e) => { S.comprasMarcadas[i.nome] = e.target.checked; atualizar(); } }),
      h("span", { class: S.comprasMarcadas[i.nome] ? "riscado" : "" }, h("b", {}, `${fmt(i.qtd, i.qtd % 1 ? 1 : 0)} ${i.unidade}`), ` de ${i.nome}`))))
      : h("p", { class: "vazio" }, "Escolha refeições na semana para gerar a lista (itens do RU, arroz e feijão ficam de fora)."),
    itens.length ? h("div", { class: "grade2", style: "margin-top:12px" },
      h("button", { class: "btn", onclick: async () => {
        if (navigator.share) { try { await navigator.share({ title: "Lista de compras", text: texto }); } catch (e) {} }
        else { try { await navigator.clipboard.writeText(texto); toast("Lista copiada!"); } catch (e) { toast("Não foi possível copiar."); } }
      } }, "📤 Compartilhar"),
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
    itens.length ? h("div", { class: "cartao" }, h("h3", {}, "🧾 Ingredientes"),
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
    h("h2", {}, "📚 Minhas saladas"),
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
  const opcoes = [...D.prato.opcoes[espaco]];
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
  const meta = D.prato.metaRefeicao;
  const pendencias = [];
  const passos = ESPACOS.map((espaco, i) => {
    const [minimo, maximo] = D.prato.regras[espaco];
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
        h("span", { class: "selo" + ((ehVeg ? gVeg >= D.prato.metaVegetais : qtd >= minimo) ? "" : " pendente") },
          ehVeg ? `${fmt(gVeg)}/${D.prato.metaVegetais} g` : `${qtd}/${maximo}`)),
      h("div", { class: "suave" }, D.prato.descricao[espaco]),
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
      ehVeg && qtd ? [barra(gVeg, D.prato.metaVegetais),
        h("button", { class: "btn bloco", onclick: () => {
          for (const id of Object.keys(marcados)) marcados[id] = Math.round(D.prato.metaVegetais / qtd);
          atualizar();
        } }, `Dividir ${D.prato.metaVegetais} g igualmente`)] : null,
      h("input", { class: "entrada", style: "margin-top:10px", type: "search", placeholder: "🔎 Buscar outro alimento na TACO…",
        value: UI.busca["prato_" + espaco] || "",
        oninput: (e) => { UI.busca["prato_" + espaco] = e.target.value; renderMantendoFoco(e.target); } }),
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
    h("p", { class: "suave" }, "Baseado no almoço/jantar do seu plano. As quantidades vêm do plano — ajuste os gramas se quiser. 🌱 = da época."),
    passos,
    h("div", { class: "resumo-fixo" },
      h("div", {}, h("div", { class: "grande" }, `${fmt(t.kcal)} kcal`),
        h("div", { class: "macros" }, `P ${fmt(t.prot)} g · C ${fmt(t.carb)} g · G ${fmt(t.gord)} g`)),
      h("div", { class: "cresce", style: "text-align:right;font-size:.85rem" },
        pendencias.length ? `Falta: ${pendencias.join(", ")}` : itens.length ? "Prato completo! 🎉" : "Marque os alimentos")),
    itens.length ? h("div", { class: "cartao" },
      h("h3", {}, "📊 Referência do plano por refeição"),
      [["carb", "Carbo"], ["prot", "Proteína"], ["gord", "Gordura"]].map(([k, r]) => [
        h("div", { class: "linha entre suave" }, h("span", {}, r), h("span", {}, `${fmt(t[k])} g de ~${meta[k]} g`)), barra(t[k], meta[k])]),
      h("p", { class: "suave" }, "É só referência: algumas refeições ficam acima, outras abaixo."),
      pesoTotal ? [h("h3", {}, "🍽️ Proporção do prato (pelo peso)"),
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
      h("summary", {}, "➕ Cadastrar alimento que não está na TACO"),
      formularioAlimento()),
    h("h2", {}, "📚 Meus pratos"),
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
            if (!D.prato.opcoes[i.espaco].some((o) => o.id === i.id)) (extras[i.espaco] ??= []).push(i.id);
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
      h("button", { class: "btn perigo", onclick: () => {
        if (!confirm(`Excluir “${a.nome}”?`)) return;
        delete S.personalizados[id];
        for (const e of ESPACOS) delete S.rascunho.prato[e]?.[id];
        atualizar();
      } }, "🗑️")))) : null,
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
    h("button", { class: "btn perigo", "aria-label": "Excluir registro", onclick: () => {
      if (confirm(`Excluir o registro de ${dataBR(r.data)}?`)) { lista.splice(lista.indexOf(r), 1); atualizar(); }
    } }, "🗑️"))));
}
function telaPeso() {
  const abas = h("div", { class: "chips" },
    [["medidas", "📏 Medidas e peso"], ["bio", "🔬 Bioimpedância"]].map(([k, r]) =>
      h("button", { class: "chip" + (UI.abaPeso === k ? " ativo" : ""), onclick: () => { UI.abaPeso = k; render(); } }, r)));
  if (UI.abaPeso === "medidas") {
    // Peso: junta medidas e bioimpedância (no mesmo dia, vale o das medidas)
    const pesos = {};
    for (const r of S.bio) if (r.peso != null) pesos[r.data] = r.peso;
    for (const r of S.medidas) if (r.peso != null) pesos[r.data] = r.peso;
    const serie = Object.entries(pesos).map(([data, peso]) => ({ data, peso })).sort((a, b) => a.data.localeCompare(b.data));
    const comMedida = CAMPOS_MEDIDAS.filter(([k, , u]) => u === "cm" && S.medidas.some((r) => r[k] != null));
    if (comMedida.length && !comMedida.some(([k]) => k === escolhaGrafico.medida)) escolhaGrafico.medida = comMedida[0][0];
    return [abas,
      h("div", { class: "cartao" },
        h("h3", {}, "📉 Tendência do peso"),
        serie.length ? h("div", { class: "metricas" },
          [["Atual", `${fmt(serie.at(-1).peso, 1)} kg`], ["Desde o início", `${serie.at(-1).peso - serie[0].peso >= 0 ? "+" : ""}${fmt(serie.at(-1).peso - serie[0].peso, 1)} kg`], ["Registros", serie.length]]
            .map(([r, v]) => h("div", { class: "metrica" }, h("div", { class: "rotulo" }, r), h("div", { class: "valor" }, v)))) : null,
        grafico(serie, "peso", "kg")),
      h("div", { class: "cartao" },
        h("h3", {}, "➕ Novo registro"),
        h("label", { class: "campo" }, h("span", {}, "Data"), h("input", { type: "date", value: formMedidas.data, onchange: (e) => { formMedidas.data = e.target.value; } })),
        h("div", { class: "grade2" }, CAMPOS_MEDIDAS.map(([k, r, u]) => campoNumero(`${r} (${u})`, formMedidas[k], (v) => { formMedidas[k] = v; }))),
        h("button", { class: "btn primario bloco", onclick: () => {
          if (!salvarRegistro(S.medidas, formMedidas, CAMPOS_MEDIDAS)) return;
          for (const [k] of CAMPOS_MEDIDAS) formMedidas[k] = null;
          atualizar(); toast("Medidas salvas!");
        } }, "Salvar medidas"),
        h("p", { class: "suave" }, "Deixe em branco o que não mediu. Salvar de novo na mesma data substitui.")),
      comMedida.length ? h("div", { class: "cartao" },
        h("h3", {}, "📏 Evolução das medidas"),
        h("select", { class: "entrada", onchange: (e) => { escolhaGrafico.medida = e.target.value; render(); } },
          comMedida.map(([k, r]) => h("option", { value: k, selected: k === escolhaGrafico.medida }, r))),
        grafico(S.medidas, escolhaGrafico.medida, "cm")) : null,
      h("div", { class: "cartao" }, h("h3", {}, "📋 Histórico"), historico(S.medidas, CAMPOS_MEDIDAS)),
    ];
  }
  const comDados = CAMPOS_BIO.filter(([k]) => S.bio.some((r) => r[k] != null));
  if (comDados.length && !comDados.some(([k]) => k === escolhaGrafico.bio)) escolhaGrafico.bio = comDados[0][0];
  const campoGraf = CAMPOS_BIO.find(([k]) => k === escolhaGrafico.bio);
  return [abas,
    h("div", { class: "cartao" },
      h("h3", {}, "➕ Nova bioimpedância"),
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
      h("h3", {}, "📈 Evolução"),
      h("select", { class: "entrada", onchange: (e) => { escolhaGrafico.bio = e.target.value; render(); } },
        comDados.map(([k, r]) => h("option", { value: k, selected: k === escolhaGrafico.bio }, r))),
      grafico(S.bio, campoGraf[0], campoGraf[2])) : null,
    h("div", { class: "cartao" }, h("h3", {}, "📋 Histórico"), historico(S.bio, CAMPOS_BIO, ["tipo"])),
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
      h("li", {}, h("b", {}, "Regras do prato e metas por refeição: "), R.REF_PLANO, " (~30 g de carboidratos, ~24 g de proteínas e ~6 g de gorduras por refeição)."),
      h("li", {}, h("b", {}, "Proporção do prato: "), R.REF_WEBDIET_PRATO, " (50% folhas e vegetais + 15% legumes, 25% proteína, 10% carboidrato)."),
      h("li", {}, h("b", {}, "Selo 🌱: "), R.REF_WEBDIET_EPOCA, ".")),
    h("button", { class: "btn bloco", onclick: fecharModal }, "Fechar"),
  ];
}
function modalBackup() {
  return [
    h("h2", {}, "💾 Backup dos seus dados"),
    h("p", { class: "suave" }, "Seus dados ficam salvos só neste aparelho, neste navegador. Se limpar os dados do navegador, eles somem — faça backup de vez em quando."),
    !armazenamentoOk ? h("p", { class: "aviso" }, "⚠️ Este navegador não está deixando salvar (modo anônimo?). Exporte um backup antes de fechar.") : null,
    h("button", { class: "btn primario bloco", onclick: () => {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
      const a = h("a", { href: URL.createObjectURL(blob), download: `planner-saudavel-${hojeISO()}.json` });
      document.body.append(a); a.click(); a.remove();
    } }, "⬇️ Exportar backup"),
    h("label", { class: "btn bloco", style: "display:grid;place-items:center;margin-top:8px" }, "⬆️ Importar backup",
      h("input", { type: "file", accept: "application/json,.json", style: "display:none", onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const dados = JSON.parse(await f.text());
          if (typeof dados !== "object" || !dados) throw new Error();
          if (!confirm("Importar substitui todos os dados atuais deste aparelho. Continuar?")) return;
          S = Object.assign(estadoInicial(), dados); UI.modal = null; atualizar(); toast("Backup importado!");
        } catch (err) { toast("Arquivo de backup inválido."); }
      } })),
    h("button", { class: "btn bloco", style: "margin-top:8px", onclick: fecharModal }, "Fechar"),
  ];
}

/* ---------- Render ---------- */
const ABAS = [["semana", "🗓️", "Semana"], ["salada", "🥗", "Salada"], ["prato", "🍽️", "Prato"], ["peso", "⚖️", "Peso"]];
const TITULOS = { semana: "Plano da semana", salada: "Monte sua salada", prato: "Monte seu prato", peso: "Peso e medidas" };
function render() {
  const rolagem = window.scrollY;
  const telas = { semana: telaSemana, salada: telaSalada, prato: telaPrato, peso: telaPeso };
  const app = document.getElementById("app");
  const partes = [
    h("header", { class: "topo" },
      h("h1", {}, "🥑 ", TITULOS[UI.aba]),
      h("button", { class: "icone-btn", "aria-label": "Referências", onclick: () => abrirModal(modalReferencias) }, "?"),
      h("button", { class: "icone-btn", "aria-label": "Backup", onclick: () => abrirModal(modalBackup) }, "💾")),
    !armazenamentoOk ? h("p", { class: "aviso" }, "⚠️ Não foi possível salvar neste navegador. Use 💾 para exportar um backup.") : null,
    telas[UI.aba](),
    h("nav", { class: "nav" }, h("div", { class: "nav-interno" }, ABAS.map(([k, e, r]) =>
      h("button", { class: UI.aba === k ? "ativo" : "", "aria-current": UI.aba === k ? "page" : null,
        onclick: () => { if (UI.aba !== k) { UI.aba = k; render(); window.scrollTo(0, 0); } } },
        h("span", { class: "emoji" }, e), r)))),
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
render();
