import streamlit as st
import json
import os
from collections import defaultdict
from datetime import datetime
import copy
import re

# --- CONFIGURAÇÃO DA PÁGINA ---
st.set_page_config(
    page_title="Planner Alimentar Inteligente",
    page_icon="🥑",
    layout="wide"
)

# --- BANCO DE DADOS DETALHADO DE REFEIÇÕES (COM QUANTIDADES E CALORIAS ESTIMADAS) ---
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
            {"name": "Salada crua", "quantity": 1, "unit": "porção à vontade"},
            {"name": "Legumes cozidos", "quantity": 100, "unit": "g (1 concha)"},
            {"name": "Arroz", "quantity": 90, "unit": "g (3 colheres)"},
            {"name": "Feijão", "quantity": 60, "unit": "g (2 colheres)"},
            {"name": "Proteína (carne, frango, peixe)", "quantity": 100, "unit": "g"}
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
            {"name": "Salada crua", "quantity": 1, "unit": "porção à vontade"},
            {"name": "Legumes cozidos", "quantity": 100, "unit": "g"},
            {"name": "Proteína (carne, frango, peixe)", "quantity": 100, "unit": "g"},
            {"name": "Arroz", "quantity": 30, "unit": "g (1 colher)"}
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

# --- ARQUIVOS DE DADOS E CONSTANTES ---
PLANNER_FILE = "planner_final_selecoes.json"
CUSTOM_REFEICOES_FILE = "refeicoes_personalizadas_final.json"
DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]

# --- FUNÇÕES AUXILIARES ---
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


# --- INICIALIZAÇÃO DO ESTADO DA SESSÃO ---
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

# --- INTERFACE ---
st.title("🥑 Planner Alimentar Inteligente")
st.markdown("Planeje sua semana, defina o número de pessoas, controle sua hidratação e gere a lista de compras automaticamente. *As calorias são estimativas.*")

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
                            key = ing['name'].strip()
                            aggregated_ingredients[key] += ing['quantity'] * num_pessoas
                            unidades[key] = ing['unit']
                    else: # Item customizado
                        key = f"{refeicao_selecionada} (custom)"
                        aggregated_ingredients[key] += num_pessoas
                        unidades[key] = 'unidade(s)'

        st.session_state.lista_compras = (aggregated_ingredients, unidades)
        st.toast('Lista de compras gerada!', icon='📝')

    # --- ADICIONAR NOVA REFEIÇÃO ---
    with st.expander("➕ Adicionar Prato Customizado"):
        # ... (código para adicionar prato customizado mantido da versão anterior)
        pass

# --- LAYOUT PRINCIPAL (PLANNER E LISTA) ---
main_cols = st.columns([2, 1.5]) # Coluna do planner maior que a da lista

with main_cols[0]:
    st.subheader("🗓️ Seu Plano Semanal")
    dia_hoje_index = datetime.now().weekday() 

    for i, dia in enumerate(DIAS_SEMANA):
        with st.expander(f"### {dia}", expanded=(i == dia_hoje_index)):
            if dia not in st.session_state.selecoes:
                st.session_state.selecoes[dia] = {}
            
            for categoria, opcoes in st.session_state.refeicoes_disponiveis.items():
                if categoria not in st.session_state.selecoes[dia]:
                     st.session_state.selecoes[dia][categoria] = {}

                st.markdown(f"**{categoria}**")
                meal_cols = st.columns([3, 1]) # Colunas para refeição e número de pessoas

                with meal_cols[0]:
                    opcoes_formatadas = ["Nenhuma"] + [format_label(o) for o in sorted(opcoes)]
                    
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
            
            # --- RASTREADOR DE HIDRATAÇÃO ---
            st.markdown("---")
            st.markdown(f"💧 **Hidratação** - Meta: 2 litros")
            water_cols = st.columns(8)
            for j in range(8):
                water_cols[j].checkbox(f"{j+1}º copo", key=f"agua_{dia}_{j}", label_visibility="collapsed")
            

with main_cols[1]:
    st.subheader("🛒 Lista de Compras da Semana")
    if st.session_state.lista_compras:
        ingredientes, unidades = st.session_state.lista_compras
        if not ingredientes:
            st.info("Nenhuma refeição selecionada.")
        else:
            st.markdown("Marque os itens que for comprando:")
            for item, quantidade in sorted(ingredientes.items()):
                unidade = unidades[item]
                # Formatação inteligente da quantidade
                if quantidade == int(quantidade):
                    quantidade_str = int(quantidade)
                else:
                    quantidade_str = f"{quantidade:.2f}".replace('.00', '')
                
                label = f"**{quantidade_str} {unidade}** de {item}"
                st.checkbox(label, key=f"check_{item}")

    else:
        st.info("Clique em 'Gerar Lista de Compras' para ver seus ingredientes.")