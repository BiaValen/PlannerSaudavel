import streamlit as st
import json
import csv
import os
from collections import defaultdict
from datetime import datetime
import copy
import re
import pandas as pd
from fpdf import FPDF

BASE_DIR = os.path.dirname(os.path.abspath(__file__)) 

# --- CONFIGURAÇÃO DA PÁGINA ---
st.set_page_config(
    page_title="Planner Alimentar Inteligente",
    page_icon="🥑",
    layout="wide"
)

# --- BANCO DE DADOS DE REFEIÇÕES (MESMA ESTRUTURA DA VERSÃO ANTERIOR) ---
# Fonte das quantidades: Documento fornecido pelo usuário.
# Fonte das calorias: Pesquisa e estimativa com base nas quantidades.
REFEICOES_COM_DETALHES = {
    # Café da Manhã
    "Banana com cacau, aveia e whey": {
        "calories": 385,
        "ingredients": [
            {"name": "Banana", "quantity": 1, "unit": "unidade média"},
            {"name": "Cacau 100% em pó", "quantity": 5, "unit": "g"},
            {"name": "Leite em pó desnatado", "quantity": 20, "unit": "g"},
            {"name": "Farelo de aveia", "quantity": 10, "unit": "g"},
            {"name": "Whey Protein", "quantity": 30, "unit": "g"}
        ]
    },
    "Pão integral com queijo e fruta": {
        "calories": 350,
        "ingredients": [
            {"name": "Pão integral", "quantity": 2, "unit": "fatias (50g)"},
            {"name": "Queijo branco ou muçarela light", "quantity": 2, "unit": "fatias (30g)"},
            {"name": "Banana ou Maçã", "quantity": 1, "unit": "unidade pequena"}
        ]
    },
    "Wrap com ovo ou frango": {
        "calories": 320,
        "ingredients": [
            {"name": "Pão folha integral (wrap)", "quantity": 1, "unit": "unidade (60g)"},
            {"name": "Ovo", "quantity": 1, "unit": "unidade"},
            {"name": "Frango desfiado", "quantity": 60, "unit": "g (opcional)"},
            {"name": "Queijo", "quantity": 1, "unit": "fatia (15g)"}
        ]
    },
    # Lanches
    "Fruta com chocolate 70%": {
        "calories": 160,
        "ingredients": [
            {"name": "Fruta (banana, maçã ou mexerica)", "quantity": 1, "unit": "unidade pequena"},
            {"name": "Chocolate 70%", "quantity": 10, "unit": "g"}
        ]
    },
    "Torradas integrais com requeijão": {
        "calories": 110,
        "ingredients": [
            {"name": "Requeijão light", "quantity": 15, "unit": "g (1 colher)"},
            {"name": "Torrada integral", "quantity": 2, "unit": "unidades"}
        ]
    },
    "Queijo com fruta": {
        "calories": 130,
        "ingredients": [
            {"name": "Queijo", "quantity": 15, "unit": "g (1 fatia)"},
            {"name": "Fruta", "quantity": 1, "unit": "unidade"}
        ]
    },
    "Snack de grão-de-bico ou milho": {
        "calories": 120,
        "ingredients": [
            {"name": "Grão-de-bico ou milho torrado", "quantity": 30, "unit": "g"}
        ]
    },
    # Almoço
    "Almoço no RU": {
        "calories": 550,
        "ingredients": [
            {"name": "Salada crua (RU)", "quantity": 1, "unit": "porção à vontade"},
            {"name": "Legumes cozidos (RU)", "quantity": 100, "unit": "g (1 concha)"},
            {"name": "Arroz (RU)", "quantity": 90, "unit": "g (3 colheres)"},
            {"name": "Feijão (RU)", "quantity": 60, "unit": "g (2 colheres)"},
            {"name": "Proteína (RU)", "quantity": 100, "unit": "g"}
        ]
    },
    "Strogonoff leve com arroz e legumes": {
        "calories": 480,
        "ingredients": [
            {"name": "Frango (para strogonoff)", "quantity": 100, "unit": "g"},
            {"name": "Iogurte/Creme de leite leve", "quantity": 30, "unit": "g"},
            {"name": "Arroz integral", "quantity": 120, "unit": "g cozido (4 colheres)"},
            {"name": "Legumes refogados", "quantity": 1, "unit": "porção (1/2 prato)"}
        ]
    },
    "Omelete (2 ovos) com legumes": {
        "calories": 300,
        "ingredients": [
            {"name": "Ovo", "quantity": 2, "unit": "unidades"},
            {"name": "Legumes refogados", "quantity": 1, "unit": "porção (1/2 prato)"}
        ]
    },
    # Jantar
    "Jantar no RU (versão leve)": {
        "calories": 400,
        "ingredients": [
            {"name": "Salada crua (RU)", "quantity": 1, "unit": "porção à vontade"},
            {"name": "Legumes cozidos (RU)", "quantity": 100, "unit": "g"},
            {"name": "Proteína (RU)", "quantity": 100, "unit": "g"},
            {"name": "Arroz (RU)", "quantity": 30, "unit": "g (1 colher)"}
        ]
    },
    "Marmita (proteína, legumes, carboidrato)": {
        "calories": 350,
        "ingredients": [
            {"name": "Proteína leve (frango, carne magra, ovo)", "quantity": 100, "unit": "g"},
            {"name": "Legumes", "quantity": 1, "unit": "porção (1/2 prato)"},
            {"name": "Arroz integral ou Purê de batata doce", "quantity": 60, "unit": "g (2 colheres)"}
        ]
    },
    "Sanduíche integral com ovo": {
        "calories": 310,
        "ingredients": [
            {"name": "Pão integral", "quantity": 2, "unit": "fatias"},
            {"name": "Queijo", "quantity": 1, "unit": "fatia (15g)"},
            {"name": "Ovo", "quantity": 1, "unit": "unidade"}
        ]
    },
    "Sopa de legumes com frango": {
        "calories": 280,
        "ingredients": [
            {"name": "Legumes para sopa", "quantity": 1, "unit": "porção"},
            {"name": "Frango desfiado", "quantity": 80, "unit": "g"},
            {"name": "Arroz", "quantity": 30, "unit": "g (1 colher, opcional)"}
        ]
    },
    # Doce
    "Chocolate 70%": {
        "calories": 55,
        "ingredients": [{"name": "Chocolate 70%", "quantity": 10, "unit": "g (1 quadrado)"}]
    },
    "Brigadeiro fake": {
        "calories": 230,
        "ingredients": [
            {"name": "Banana", "quantity": 1, "unit": "unidade"},
            {"name": "Cacau 100% em pó", "quantity": 5, "unit": "g"},
            {"name": "Adoçante", "quantity": 1, "unit": "pitada"},
            {"name": "Whey Protein", "quantity": 15, "unit": "g (1/2 scoop)"}
        ]
    },
    "Geleia sem açúcar com torrada":{
        "calories": 90,
        "ingredients": [
            {"name": "Geleia sem açúcar", "quantity": 1, "unit": "colher"},
            {"name": "Torrada integral", "quantity": 1, "unit": "unidade"}
        ]
    },
    "Café com gotas de chocolate":{
        "calories": 40,
        "ingredients": [
            {"name": "Café", "quantity": 1, "unit": "xícara"},
            {"name": "Gotas de chocolate", "quantity": 3, "unit": "unidades"}
        ]
    }
}


REFEICOES_BASE = {
    "Café da manhã 🍳": ["Banana com cacau, aveia e whey", "Pão integral com queijo e fruta", "Wrap com ovo ou frango"],
    "Lanche da manhã 🍎": ["Fruta com chocolate 70%", "Torradas integrais com requeijão", "Queijo com fruta", "Snack de grão-de-bico ou milho"],
    "Almoço 🍲": ["Almoço no RU", "Strogonoff leve com arroz e legumes", "Omelete (2 ovos) com legumes"],
    "Lanche da tarde 🥪": ["Fruta com chocolate 70%", "Torradas integrais com requeijão", "Queijo com fruta", "Snack de grão-de-bico ou milho"],
    "Jantar 🥗": ["Jantar no RU (versão leve)", "Marmita (proteína, legumes, carboidrato)", "Sanduíche integral com ovo", "Sopa de legumes com frango"],
    "Doce ou extra 🍬": ["Chocolate 70%", "Brigadeiro fake", "Geleia sem açúcar com torrada", "Café com gotas de chocolate"]
}

# --- ARQUIVOS, CONSTANTES E FILTROS ---
# Usa o BASE_DIR para montar o caminho completo para os arquivos na pasta "banco de dados"
PLANNER_FILE = os.path.join(BASE_DIR, "banco de dados", "planner_final_selecoes.json")
CUSTOM_REFEICOES_FILE = os.path.join(BASE_DIR, "banco de dados", "refeicoes_personalizadas_final.json")
SALADA_FILE = os.path.join(BASE_DIR, "banco de dados", "ingredientes_salada.csv")
SALADAS_SALVAS_FILE = os.path.join(BASE_DIR, "banco de dados", "saladas_salvas.json")
PREFIXO_SALADA = "🥗 "  # identifica as saladas salvas nas opções do planner
# Regra de montagem da salada: (mín. de opções, máx. de opções, divide a porção quando escolher mais de uma)
REGRAS_SALADA = {
    "Base": (1, 2, True),
    "Proteína": (1, 1, False),
    "Carbo Complexo": (1, 2, True),
    "Vegetal Extra": (2, 2, False),
    "Molho / Gordura": (1, 1, False),
}
DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
SHOPPING_LIST_EXCLUSIONS = ['arroz', 'feijão', '(ru)', 'pitada']

# --- FUNÇÕES AUXILIARES ---
# (As funções carregar_dados, salvar_dados, format_label, parse_label são mantidas da versão anterior)
def carregar_dados(filepath):
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}
    return {}

def salvar_dados(data, filepath):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def format_label(meal_name):
    """Formata o nome da refeição para incluir calorias no selectbox."""
    details = REFEICOES_COM_DETALHES.get(meal_name)
    if details:
        return f"{meal_name} (~{details['calories']} kcal)"
    return meal_name

def parse_label(formatted_label):
    """Extrai o nome original da refeição do label formatado."""
    return re.sub(r'\s\(~\d+\s+kcal\)$', '', formatted_label)
COLUNAS_SALADA = ["Categoria", "Ingrediente", "Porção", "Calorias (kcal)", "Proteína (g)", "Carbo (g)", "Gordura (g)", "Fonte"]

def carregar_linhas_salada(filepath):
    """Lê o CSV de ingredientes da salada como lista de linhas (para o editor)."""
    if not os.path.exists(filepath):
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))

def salvar_linhas_salada(linhas, filepath):
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COLUNAS_SALADA, lineterminator="\n")
        writer.writeheader()
        writer.writerows(linhas)

def _texto(valor):
    """Converte célula do editor em texto (vazio para None/NaN)."""
    return "" if valor is None or pd.isna(valor) else str(valor).strip()

def carregar_ingredientes_salada(filepath):
    """Lê o CSV de ingredientes da salada e agrupa por categoria (mantendo a ordem do arquivo)."""
    categorias = {}
    if not os.path.exists(filepath):
        return categorias
    with open(filepath, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            categorias.setdefault(row["Categoria"], []).append({
                "nome": row["Ingrediente"],
                "porcao": row["Porção"],
                "kcal": float(row["Calorias (kcal)"]),
                "prot": float(row["Proteína (g)"]),
                "carb": float(row["Carbo (g)"]),
                "gord": float(row["Gordura (g)"]),
            })
    return categorias

def itens_da_combinacao(combinacao, ingredientes_salada):
    """Transforma {categoria: [nomes]} em [(categoria, item, fator)], aplicando a divisão de porção da regra."""
    itens = []
    for categoria, nomes in combinacao.items():
        por_nome = {i["nome"]: i for i in ingredientes_salada.get(categoria, [])}
        nomes = [n for n in nomes if n in por_nome]
        divide = REGRAS_SALADA.get(categoria, (0, 0, False))[2]
        fator = 1 / len(nomes) if (divide and nomes) else 1
        itens += [(categoria, por_nome[n], fator) for n in nomes]
    return itens

def salada_para_refeicao(itens):
    """Converte a salada no formato de REFEICOES_COM_DETALHES (calorias + ingredientes da lista de compras)."""
    ingredientes = []
    for _, item, fator in itens:
        gramas = re.match(r"(\d+)g\b", item["porcao"])
        if gramas:
            ingredientes.append({"name": item["nome"], "quantity": int(gramas.group(1)) * fator, "unit": "g"})
        else:
            ingredientes.append({"name": item["nome"], "quantity": fator, "unit": f"porção de {item['porcao']}"})
    return {"calories": round(sum(i["kcal"] * f for _, i, f in itens)), "ingredients": ingredientes}

def generate_pdf_list(shopping_list_data):
    """Gera um PDF da lista de compras usando uma fonte Unicode empacotada."""
    ingredientes, unidades = shopping_list_data
    
    pdf = FPDF()
    pdf.add_page()
    
    # CORREÇÃO: Define o caminho para a fonte usando o BASE_DIR e a pasta "fonte"
    font_path = os.path.join(BASE_DIR, "fonte", "DejaVuSans.ttf")
    
    # Adiciona a fonte Unicode ao PDF usando o caminho completo.
    pdf.add_font("DejaVu", "", font_path)

    # Usa a nova fonte "DejaVu"
    pdf.set_font("DejaVu", "", 16)
    pdf.cell(0, 10, "Lista de Compras Semanal", 0, 1, "C")
    
    pdf.set_font("DejaVu", "", 10)
    pdf.cell(0, 8, f"Gerada em: {datetime.now().strftime('%d/%m/%Y')}", 0, 1, "C")
    pdf.ln(10)

    pdf.set_font("DejaVu", "", 12)
    for item, quantidade in sorted(ingredientes.items()):
        unidade = unidades.get(item, "unidade(s)")
        quantidade_str = f"{int(quantidade)}" if quantidade == int(quantidade) else f"{quantidade:.2f}".replace('.00', '')
        
        item_line = f"□  {quantidade_str} {unidade} de {item}"
        pdf.cell(0, 10, item_line, 0, 1)

    return bytes(pdf.output(dest='S'))


# --- INICIALIZAÇÃO DO ESTADO DA SESSÃO ---
# (Mantida da versão anterior)
if 'selecoes' not in st.session_state:
    st.session_state.selecoes = carregar_dados(PLANNER_FILE)

if 'refeicoes_disponiveis' not in st.session_state:
    refeicoes_customizadas = carregar_dados(CUSTOM_REFEICOES_FILE)
    refeicoes_merged = copy.deepcopy(REFEICOES_BASE)
    for categoria, pratos in refeicoes_customizadas.items():
        if categoria in refeicoes_merged:
            for prato in pratos:
                if prato not in refeicoes_merged[categoria]:
                    refeicoes_merged[categoria].append(prato)
    st.session_state.refeicoes_disponiveis = refeicoes_merged
    
if 'lista_compras' not in st.session_state:
    st.session_state.lista_compras = None

if 'saladas_salvas' not in st.session_state:
    st.session_state.saladas_salvas = carregar_dados(SALADAS_SALVAS_FILE)

INGREDIENTES_SALADA = carregar_ingredientes_salada(SALADA_FILE)

def _limpar_widgets_planner(refeicao):
    """Força os selectbox do planner que usam essa refeição a serem recriados (o rótulo de kcal pode ter mudado)."""
    for dia, categorias in st.session_state.selecoes.items():
        if isinstance(categorias, dict):
            for categoria, selecao in categorias.items():
                if isinstance(selecao, dict) and selecao.get('meal') == refeicao:
                    st.session_state.pop(f"{dia}_{categoria}_meal", None)

# Depois de editar a lista de ingredientes: tira das seleções o que não existe mais
# e atualiza as saladas no planner (as calorias podem ter mudado)
if st.session_state.pop("ingredientes_alterados", False):
    for _categoria in REGRAS_SALADA:
        _chave = f"salada_{_categoria}"
        if _chave in st.session_state:
            _validos = {i["nome"] for i in INGREDIENTES_SALADA.get(_categoria, [])}
            st.session_state[_chave] = [n for n in st.session_state[_chave] if n in _validos]
    for _nome in st.session_state.saladas_salvas:
        _limpar_widgets_planner(PREFIXO_SALADA + _nome)
# As saladas salvas viram refeições: aparecem no planner e entram na lista de compras
for _nome, _combinacao in st.session_state.saladas_salvas.items():
    REFEICOES_COM_DETALHES[PREFIXO_SALADA + _nome] = salada_para_refeicao(
        itens_da_combinacao(_combinacao, INGREDIENTES_SALADA)
    )

# --- INTERFACE ---
st.title("🥑 Planner Alimentar Inteligente")
st.markdown("Planeje sua semana, defina o número de pessoas, controle sua hidratação e gere a lista de compras para levar ao mercado.")

# --- BARRA LATERAL ---
with st.sidebar:
    st.image("https://static.vecteezy.com/system/resources/previews/010/897/232/original/avatar-icon-of-girl-in-a-baseball-cap-and-with-headphones-in-a-flat-style-vector.jpg", width=120)
    st.header("Ações")

    if st.button("Salvar Plano Semanal", use_container_width=True, type="primary"):
        salvar_dados(st.session_state.selecoes, PLANNER_FILE)
        st.toast('Plano salvo com sucesso!', icon='✅')

    if st.button("Gerar Lista de Compras", use_container_width=True):
        aggregated_ingredients = defaultdict(float)
        unidades = {}
        
        for dia in DIAS_SEMANA:
            for categoria in st.session_state.refeicoes_disponiveis.keys():
                selecao = st.session_state.selecoes.get(dia, {}).get(categoria, {})
                refeicao_selecionada = selecao.get('meal')
                num_pessoas = selecao.get('people', 1)

                if refeicao_selecionada and refeicao_selecionada != "Nenhuma":
                    detalhes = REFEICOES_COM_DETALHES.get(refeicao_selecionada)
                    if detalhes:
                        for ing in detalhes['ingredients']:
                            # Lógica de exclusão da lista de compras
                            ing_name_lower = ing['name'].lower()
                            ing_unit_lower = ing['unit'].lower()
                            if not any(ex in ing_name_lower or ex in ing_unit_lower for ex in SHOPPING_LIST_EXCLUSIONS):
                                key = ing['name'].strip()
                                aggregated_ingredients[key] += ing['quantity'] * num_pessoas
                                unidades[key] = ing['unit']

        st.session_state.lista_compras = (aggregated_ingredients, unidades)
        st.toast('Lista de compras gerada!', icon='📝')
    
    # Adicionar prato customizado (opcional)
    with st.expander("➕ Adicionar Prato Customizado"):
        st.info("Funcionalidade em desenvolvimento.")


# --- ABAS ---
tab_planner, tab_salada = st.tabs(["🗓️ Planner Semanal", "🥗 Monte sua Salada"])

# --- LAYOUT PRINCIPAL (PLANNER E LISTA) ---
with tab_planner:
    main_cols = st.columns([2, 1.5]) 

    with main_cols[0]:
        st.subheader("🗓️ Seu Plano Semanal")
        dia_hoje_index = datetime.now().weekday() 

        for i, dia in enumerate(DIAS_SEMANA):
            with st.expander(f"### {dia}", expanded=(i == dia_hoje_index)):
                # Lógica de seleção de refeições mantida da versão anterior
                if dia not in st.session_state.selecoes:
                    st.session_state.selecoes[dia] = {}
            
                for categoria, opcoes in st.session_state.refeicoes_disponiveis.items():
                    if categoria not in st.session_state.selecoes[dia]:
                         st.session_state.selecoes[dia][categoria] = {}

                    st.markdown(f"**{categoria}**")
                    meal_cols = st.columns([3, 1]) 

                    with meal_cols[0]:
                        opcoes_formatadas = ["Nenhuma"] + [format_label(o) for o in sorted(opcoes)] + [format_label(PREFIXO_SALADA + n) for n in sorted(st.session_state.saladas_salvas)]
                    
                        selecao_atual_formatada = format_label(st.session_state.selecoes[dia][categoria].get('meal', "Nenhuma"))
                        index_selecao = opcoes_formatadas.index(selecao_atual_formatada) if selecao_atual_formatada in opcoes_formatadas else 0
                    
                        escolha_formatada = st.selectbox(
                            f"sel_{dia}_{categoria}",
                            options=opcoes_formatadas,
                            index=index_selecao,
                            key=f"{dia}_{categoria}_meal",
                            label_visibility="collapsed"
                        )
                        st.session_state.selecoes[dia][categoria]['meal'] = parse_label(escolha_formatada)

                    with meal_cols[1]:
                        st.session_state.selecoes[dia][categoria]['people'] = st.number_input(
                            f"num_{dia}_{categoria}",
                            min_value=1,
                            value=st.session_state.selecoes[dia][categoria].get('people', 1),
                            step=1,
                            key=f"{dia}_{categoria}_people",
                            label_visibility="collapsed"
                        )

                # --- RASTREADOR DE HIDRATAÇÃO VISUAL ---
                st.markdown("---")
                st.markdown(f"💧 **Hidratação** - Meta: 2 litros (250ml por check)")
            
                # Inicializa o estado do contador de água para o dia
                if f"agua_checked_{dia}" not in st.session_state:
                    st.session_state[f"agua_checked_{dia}"] = 0
            
                water_cols = st.columns(8)
                num_checked = 0
                for j in range(8):
                    if water_cols[j].checkbox(f" ", key=f"agua_{dia}_{j}"):
                        num_checked += 1
            
                litros_consumidos = num_checked * 0.250
                st.progress(litros_consumidos / 2.0)
                st.caption(f"**Total: {litros_consumidos:.2f} / 2.00 Litros**")

    with main_cols[1]:
        st.subheader("🛒 Lista de Compras da Semana")
        if st.session_state.get('lista_compras'):
            ingredientes, unidades = st.session_state.lista_compras
            if not ingredientes:
                st.info("A lista de compras está vazia. Os itens selecionados já foram filtrados ou não precisam de compra (ex: itens do RU, arroz, feijão).")
            else:
                # Exibe a lista
                for item, quantidade in sorted(ingredientes.items()):
                    unidade = unidades.get(item, "unidade(s)")
                    quantidade_str = f"{int(quantidade)}" if quantidade == int(quantidade) else f"{quantidade:.2f}".replace('.00', '')
                    label = f"**{quantidade_str} {unidade}** de {item}"
                    st.checkbox(label, key=f"check_{item}")

                # Botão de Exportar para PDF
                pdf_data = generate_pdf_list(st.session_state.lista_compras)
                st.download_button(
                    label="📥 Exportar Lista para PDF",
                    data=pdf_data,
                    file_name=f"lista_compras_{datetime.now().strftime('%Y-%m-%d')}.pdf",
                    mime="application/pdf",
                    use_container_width=True,
                    type="secondary"
                )

        else:
            st.info("Clique em 'Gerar Lista de Compras' na barra lateral para ver seus ingredientes.")


# --- ABA: MONTE SUA SALADA ---
def _salvar_salada():
    nome = st.session_state.get("salada_nome", "").strip()
    combinacao = {c: list(st.session_state.get(f"salada_{c}", [])) for c in INGREDIENTES_SALADA}
    if not nome:
        st.toast("Dê um nome para a combinação.", icon="⚠️")
        return
    if not any(combinacao.values()):
        st.toast("Escolha pelo menos um ingrediente.", icon="⚠️")
        return
    st.session_state.saladas_salvas[nome] = combinacao
    salvar_dados(st.session_state.saladas_salvas, SALADAS_SALVAS_FILE)
    _limpar_widgets_planner(PREFIXO_SALADA + nome)
    st.toast(f"Salada '{nome}' salva!", icon="✅")

def _carregar_salada(nome):
    combinacao = st.session_state.saladas_salvas.get(nome, {})
    for categoria in INGREDIENTES_SALADA:
        st.session_state[f"salada_{categoria}"] = list(combinacao.get(categoria, []))
    st.session_state.salada_nome = nome

def _excluir_salada(nome):
    st.session_state.saladas_salvas.pop(nome, None)
    salvar_dados(st.session_state.saladas_salvas, SALADAS_SALVAS_FILE)
    refeicao = PREFIXO_SALADA + nome
    _limpar_widgets_planner(refeicao)
    for categorias in st.session_state.selecoes.values():
        if isinstance(categorias, dict):
            for selecao in categorias.values():
                if isinstance(selecao, dict) and selecao.get('meal') == refeicao:
                    selecao['meal'] = "Nenhuma"
    st.toast(f"Salada '{nome}' excluída.", icon="🗑️")

def _adicionar_ao_planner(nome, chave):
    dia = st.session_state[f"{chave}_dia"]
    categoria = st.session_state[f"{chave}_refeicao"]
    st.session_state.selecoes.setdefault(dia, {}).setdefault(categoria, {})['meal'] = PREFIXO_SALADA + nome
    st.session_state.pop(f"{dia}_{categoria}_meal", None)
    st.toast(f"'{nome}' colocada em {dia} – {categoria}. Lembre de salvar o plano.", icon="🗓️")

def _totais(itens):
    return {k: sum(i[k] * q for _, i, q in itens) for k in ("kcal", "prot", "carb", "gord")}

with tab_salada:
    st.subheader("🥗 Monte sua Salada")
    st.caption(
        "Regra do pote: 1–2 Bases (dividem os 100g) + 1 Proteína + 1 Carbo (ou 2 com meia porção cada) "
        "+ 2 Vegetais + 1 Molho/Gordura."
    )

    if not INGREDIENTES_SALADA:
        st.error("Arquivo de ingredientes da salada não encontrado.")
    else:
        combinacao_atual = {}
        pendencias = []
        salada_cols = st.columns([2, 1.5])

        with salada_cols[0]:
            for categoria, itens in INGREDIENTES_SALADA.items():
                minimo, maximo, divide = REGRAS_SALADA.get(categoria, (0, len(itens), False))
                por_nome = {i["nome"]: i for i in itens}
                regra_txt = f"escolha {minimo}" if minimo == maximo else f"escolha {minimo} a {maximo}"
                if divide:
                    regra_txt += "; com 2, meia porção de cada"

                escolhidos = st.multiselect(
                    f"**{categoria}** ({regra_txt})",
                    options=list(por_nome.keys()),
                    format_func=lambda n, d=por_nome: f"{n} — {d[n]['porcao']} (~{d[n]['kcal']:g} kcal)",
                    max_selections=maximo,
                    key=f"salada_{categoria}",
                )
                if len(escolhidos) < minimo:
                    pendencias.append(f"{categoria}: faltam {minimo - len(escolhidos)}")
                combinacao_atual[categoria] = escolhidos

        itens_escolhidos = itens_da_combinacao(combinacao_atual, INGREDIENTES_SALADA)

        with salada_cols[1]:
            st.markdown("#### 📊 Total da sua escolha")
            t = _totais(itens_escolhidos)
            m1, m2 = st.columns(2)
            m1.metric("Calorias", f"{t['kcal']:.0f} kcal")
            m2.metric("Proteína", f"{t['prot']:.0f} g")
            m3, m4 = st.columns(2)
            m3.metric("Carbo", f"{t['carb']:.0f} g")
            m4.metric("Gordura", f"{t['gord']:.0f} g")

            if pendencias:
                st.info("Para seguir a regra do pote: " + " · ".join(pendencias))

            if itens_escolhidos:
                st.markdown("#### 🧾 Ingredientes")
                st.table([
                    {
                        "Categoria": cat,
                        "Ingrediente": i["nome"],
                        "Qtd": i["porcao"] if q == 1 else f"½ × {i['porcao']}",
                        "kcal": f"{i['kcal'] * q:.0f}",
                        "P (g)": f"{i['prot'] * q:.0f}",
                        "C (g)": f"{i['carb'] * q:.0f}",
                        "G (g)": f"{i['gord'] * q:.0f}",
                    }
                    for cat, i, q in itens_escolhidos
                ])

            st.markdown("#### 💾 Salvar combinação")
            st.text_input("Nome da combinação", key="salada_nome", placeholder="Ex.: Salada de frango com milho")
            st.button("Salvar salada", on_click=_salvar_salada, type="primary", use_container_width=True)
            st.caption("Salvar com um nome que já existe substitui a combinação.")

        st.markdown("---")
        st.subheader("📚 Minhas saladas")
        if not st.session_state.saladas_salvas:
            st.info("Nenhuma salada salva ainda.")
        for idx, (nome, combinacao) in enumerate(sorted(st.session_state.saladas_salvas.items())):
            itens_salvos = itens_da_combinacao(combinacao, INGREDIENTES_SALADA)
            ts = _totais(itens_salvos)
            with st.expander(f"{PREFIXO_SALADA}{nome} — {ts['kcal']:.0f} kcal · P {ts['prot']:.0f}g · C {ts['carb']:.0f}g · G {ts['gord']:.0f}g"):
                faltando = [
                    n for c, nomes in combinacao.items() for n in nomes
                    if n not in {i["nome"] for i in INGREDIENTES_SALADA.get(c, [])}
                ]
                if faltando:
                    st.warning("Ingredientes que não existem mais na lista (ignorados no cálculo): " + ", ".join(faltando))
                st.markdown("\n".join(
                    f"- **{cat}:** {i['nome']} ({i['porcao'] if q == 1 else '½ × ' + i['porcao']})"
                    for cat, i, q in itens_salvos
                ))
                chave = f"salada_salva_{idx}"
                acoes = st.columns([1.2, 1.5, 1, 1, 1])
                acoes[0].selectbox("Dia", DIAS_SEMANA, key=f"{chave}_dia")
                acoes[1].selectbox("Refeição", list(st.session_state.refeicoes_disponiveis.keys()), key=f"{chave}_refeicao")
                acoes[2].button("🗓️ Pôr na semana", key=f"{chave}_add", on_click=_adicionar_ao_planner, args=(nome, chave))
                acoes[3].button("✏️ Carregar", key=f"{chave}_load", on_click=_carregar_salada, args=(nome,))
                acoes[4].button("🗑️ Excluir", key=f"{chave}_del", on_click=_excluir_salada, args=(nome,))

    # --- GERENCIAR INGREDIENTES ---
    st.markdown("---")
    with st.expander("⚙️ Gerenciar ingredientes (adicionar, editar ou excluir)"):
        st.caption(
            "Edite direto na tabela. Para adicionar, use a última linha vazia; para excluir, "
            "marque a linha à esquerda e aperte a lixeira. Depois clique em **Salvar ingredientes**."
        )
        linhas_originais = carregar_linhas_salada(SALADA_FILE)
        df_original = pd.DataFrame(linhas_originais, columns=COLUNAS_SALADA)
        campos_num = ["Calorias (kcal)", "Proteína (g)", "Carbo (g)", "Gordura (g)"]
        for col in campos_num:
            df_original[col] = pd.to_numeric(df_original[col], errors="coerce")

        if "ingredientes_versao" not in st.session_state:
            st.session_state.ingredientes_versao = 0
        df_editado = st.data_editor(
            df_original,
            num_rows="dynamic",
            use_container_width=True,
            hide_index=True,
            key=f"editor_ingredientes_{st.session_state.ingredientes_versao}",
            column_config={
                "Categoria": st.column_config.SelectboxColumn(options=list(REGRAS_SALADA.keys()), required=True),
                "Ingrediente": st.column_config.TextColumn(required=True),
                "Porção": st.column_config.TextColumn(required=True, help="Ex.: 100g, 2 unidades, 1 col. sopa"),
                **{c: st.column_config.NumberColumn(min_value=0.0, step=0.1, required=True) for c in campos_num},
                "Fonte": st.column_config.TextColumn(disabled=True, help="Preenchida automaticamente"),
            },
        )

        if st.button("💾 Salvar ingredientes", type="primary"):
            erros = []
            novas_linhas = []
            vistos = set()
            ordem = {c: n for n, c in enumerate(REGRAS_SALADA)}
            for idx, row in df_editado.iterrows():
                categoria = _texto(row["Categoria"])
                nome = _texto(row["Ingrediente"])
                porcao = _texto(row["Porção"])
                if not categoria and not nome:
                    continue  # linha vazia
                if categoria not in REGRAS_SALADA or not nome or not porcao or any(pd.isna(row[c]) for c in campos_num):
                    erros.append(f"Linha '{nome or '(sem nome)'}': preencha categoria, ingrediente, porção e os 4 valores.")
                    continue
                if (categoria, nome.lower()) in vistos:
                    erros.append(f"'{nome}' aparece duas vezes em {categoria}.")
                    continue
                vistos.add((categoria, nome.lower()))

                linha = {
                    "Categoria": categoria,
                    "Ingrediente": nome,
                    "Porção": porcao,
                    **{c: f"{float(row[c]):g}" for c in campos_num},
                }
                original = df_original.loc[idx] if idx in df_original.index else None
                if original is None:
                    linha["Fonte"] = "Adicionado pelo usuário"
                else:
                    mudou = (
                        original["Categoria"] != categoria or original["Ingrediente"] != nome
                        or original["Porção"] != porcao
                        or any(float(original[c]) != float(row[c]) for c in campos_num)
                    )
                    linha["Fonte"] = "Editado pelo usuário" if mudou else _texto(original["Fonte"])
                novas_linhas.append(linha)

            if erros:
                for e in erros:
                    st.error(e)
            else:
                novas_linhas.sort(key=lambda l: ordem[l["Categoria"]])
                salvar_linhas_salada(novas_linhas, SALADA_FILE)
                st.session_state.ingredientes_versao += 1
                st.session_state.ingredientes_alterados = True
                st.toast("Ingredientes salvos!", icon="✅")
                st.rerun()
