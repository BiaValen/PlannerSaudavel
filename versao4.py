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
# --- PRATO ---
# TACO 4ª ed. (NEPA/Unicamp), valores por 100 g — extraída de github.com/raulfdm/taco-api (licença MIT)
TACO_FILE = os.path.join(BASE_DIR, "banco de dados", "taco.csv")
# Alimentos que não existem na TACO: USDA National Nutrient Database for Standard Reference, Release 28 (SR28)
USDA_FILE = os.path.join(BASE_DIR, "banco de dados", "alimentos_usda.csv")
PRATO_OPCOES_FILE = os.path.join(BASE_DIR, "banco de dados", "prato_opcoes.csv")
ALIMENTOS_PERSONALIZADOS_FILE = os.path.join(BASE_DIR, "banco de dados", "alimentos_personalizados.csv")
PRATOS_SALVOS_FILE = os.path.join(BASE_DIR, "banco de dados", "pratos_salvos.json")
PREFIXO_PRATO = "🍽️ "  # identifica os pratos salvos nas opções do planner
# Regra do almoço/jantar do plano alimentar: (mín. de opções, máx. de opções)
REGRAS_PRATO = {
    "Vegetais": (1, None),
    "Proteína": (1, 1),
    "Carboidrato": (1, 1),
    "Gordura": (0, 1),
    "Sobremesa": (0, 1),
}
DESCRICAO_PRATO = {
    "Vegetais": "Crus e/ou refogados, à vontade — o plano pede 1 prato de refeição (300 g) no total. "
                "Milho, batata, grão-de-bico, ervilha e abóbora contam como carboidrato.",
    "Proteína": "Escolha 1 — no plano, 1 filé médio (120 g) ou 2 ovos.",
    "Carboidrato": "Escolha 1 — as quantidades são as do plano.",
    "Gordura": "Opcional — 1 colher de sopa (7,5 ml) de azeite extravirgem.",
    "Sobremesa": "Opcional — 1 fruta pequena (80 g).",
}
REF_TACO = "TACO – Tabela Brasileira de Composição de Alimentos, 4ª ed. (NEPA/Unicamp, 2011)"
REF_USDA = ("USDA National Nutrient Database for Standard Reference, Release 28 (SR28) – "
            "U.S. Department of Agriculture, Agricultural Research Service")
REF_PLANO = "Seu plano alimentar (almoço/jantar) e a prescrição da avaliação nutricional"
REF_WEBDIET_PRATO = "WebDiet – “Como montar um prato saudável”"
REF_WEBDIET_EPOCA = "WebDiet – “Frutas e legumes da época”"
META_VEGETAIS_G = 300
# Referência da prescrição por refeição (g): carboidrato, proteína, gordura
META_REFEICAO = {"carb": 30, "prot": 24, "gord": 6}
# Proporção do prato (WebDiet): 50% folhas/vegetais + 15% legumes, 25% proteína, 10% carboidrato
PROPORCAO_PRATO = {"Vegetais": 65, "Proteína": 25, "Carboidrato": 10}
# Grupos da TACO que aparecem na busca de cada espaço do prato
GRUPOS_TACO_PRATO = {
    "Vegetais": ["Verduras, hortaliças e derivados"],
    "Proteína": ["Carnes e derivados", "Pescados e frutos do mar", "Ovos e derivados", "Leite e derivados"],
    "Carboidrato": ["Cereais e derivados", "Verduras, hortaliças e derivados", "Leguminosas e derivados"],
    "Gordura": ["Gorduras e óleos", "Nozes e sementes"],
    "Sobremesa": ["Frutas e derivados"],
}
# Frutas e legumes da época (WebDiet)
DA_EPOCA = {
    1: ["Pimentão verde", "Maracujá", "Pêssego", "Jiló", "Tomate"],
    2: ["Melancia", "Ameixa", "Laranja", "Quiabo", "Abóbora seca"],
    3: ["Pêra", "Tangerina", "Kiwi", "Pepino", "Batata doce amarela"],
    4: ["Banana", "Abacate", "Tomate", "Salsa", "Chuchu"],
    5: ["Mandioca", "Agrião", "Mamão", "Uva", "Maçã"],
    6: ["Milho verde", "Rabanete", "Gengibre", "Kiwi", "Abacate"],
    7: ["Morango", "Carambola", "Ervilha comum", "Brócolis", "Hortelã"],
    8: ["Cenoura", "Mandioquinha", "Erva-doce", "Tangerina", "Maracujá"],
    9: ["Maçã", "Acerola", "Jabuticaba", "Aspargos", "Palmito"],
    10: ["Uva", "Lima da Pérsia", "Manjericão", "Nabo", "Rúcula"],
    11: ["Abacaxi", "Amora", "Melão", "Pepino caipira", "Berinjela"],
    12: ["Pêssego", "Lichia", "Cereja", "Cebolinha", "Vagem"],
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
                "fonte": row.get("Fonte", ""),
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

COLUNAS_PERSONALIZADOS = ["id", "Alimento", "Grupo", "Calorias (kcal)", "Proteína (g)", "Carbo (g)", "Gordura (g)", "Gramas", "Medida caseira"]

def carregar_linhas_csv(filepath):
    if not os.path.exists(filepath):
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))

def salvar_linhas_csv(linhas, filepath, colunas):
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=colunas, lineterminator="\n")
        writer.writeheader()
        writer.writerows(linhas)

def carregar_alimentos():
    """TACO + USDA + alimentos cadastrados pela usuária. Valores por 100 g. Chave: id (texto)."""
    alimentos = {}
    for arquivo, prefixo in ((TACO_FILE, ""), (USDA_FILE, "U"), (ALIMENTOS_PERSONALIZADOS_FILE, "P")):
        if not os.path.exists(arquivo):
            continue
        with open(arquivo, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                alimentos[prefixo + row["id"]] = {
                    "nome": row["Alimento"],
                    "grupo": row["Grupo"],
                    "kcal": float(row["Calorias (kcal)"]),
                    "prot": float(row["Proteína (g)"]),
                    "carb": float(row["Carbo (g)"]),
                    "gord": float(row["Gordura (g)"]),
                    "personalizado": prefixo == "P",
                    "fonte": {"": "TACO", "U": "USDA", "P": "Cadastro"}[prefixo],
                    "gramas": float(row.get("Gramas") or 100),
                    "medida": row.get("Medida caseira", ""),
                    "descricao_usda": row.get("Descrição USDA", ""),
                }
    return alimentos

def carregar_opcoes_prato(alimentos):
    """{espaço: [{"id", "gramas", "medida"}]} com as opções do plano + alimentos cadastrados."""
    opcoes = {e: [] for e in REGRAS_PRATO}
    if os.path.exists(PRATO_OPCOES_FILE):
        with open(PRATO_OPCOES_FILE, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row["id"] in alimentos and row["Espaço"] in opcoes:
                    opcoes[row["Espaço"]].append(
                        {"id": row["id"], "gramas": float(row["Gramas"]), "medida": row["Medida caseira"]}
                    )
    for id_, a in alimentos.items():
        if a["personalizado"] and a["grupo"] in opcoes:
            opcoes[a["grupo"]].append({"id": id_, "gramas": a["gramas"], "medida": a["medida"]})
    return opcoes

def nutrientes(alimento, gramas):
    return {k: alimento[k] * gramas / 100 for k in ("kcal", "prot", "carb", "gord")}

def eh_da_epoca(nome, mes):
    """Compara o nome da TACO (ex.: 'Maçã, Fuji, com casca, crua') com a lista do mês."""
    nome_simples = nome.lower().replace(",", "")
    primeiro = nome.split(",")[0].strip().lower()
    return any(primeiro == item.lower() or nome_simples.startswith(item.lower()) for item in DA_EPOCA.get(mes, []))

def prato_para_refeicao(itens, alimentos):
    """Converte o prato salvo no formato de REFEICOES_COM_DETALHES."""
    ingredientes, kcal = [], 0
    for item in itens:
        alimento = alimentos.get(item["id"])
        if alimento:
            kcal += nutrientes(alimento, item["gramas"])["kcal"]
            ingredientes.append({"name": alimento["nome"], "quantity": item["gramas"], "unit": "g"})
    return {"calories": round(kcal), "ingredients": ingredientes}

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

# Formato: {nome: {"itens": {categoria: [ingredientes]}, "refeicoes": [refeições do planner onde a salada aparece]}}
# (arquivos do formato antigo guardavam só os itens; nesse caso a salada aparece em todas as refeições)
if 'saladas_salvas' not in st.session_state:
    st.session_state.saladas_salvas = {
        nome: dados if "itens" in dados else {"itens": dados, "refeicoes": list(st.session_state.refeicoes_disponiveis)}
        for nome, dados in carregar_dados(SALADAS_SALVAS_FILE).items()
    }

if 'salada_refeicoes' not in st.session_state:
    st.session_state.salada_refeicoes = [
        r for r in st.session_state.refeicoes_disponiveis if r.startswith(("Almoço", "Jantar"))
    ]

INGREDIENTES_SALADA = carregar_ingredientes_salada(SALADA_FILE)
ALIMENTOS = carregar_alimentos()
OPCOES_PRATO = carregar_opcoes_prato(ALIMENTOS)

if 'pratos_salvos' not in st.session_state:
    st.session_state.pratos_salvos = carregar_dados(PRATOS_SALVOS_FILE)
if 'prato_refeicoes' not in st.session_state:
    st.session_state.prato_refeicoes = [
        r for r in st.session_state.refeicoes_disponiveis if r.startswith(("Almoço", "Jantar"))
    ]

# Widgets de uma página que não está aberta perdem o valor; regravar mantém as escolhas ao trocar de página
for _chave in list(st.session_state.keys()):
    if (_chave.startswith(("salada_", "prato_chk__", "prato_g__", "agua_", "check_")) and "__" in _chave) \
            or _chave.startswith(("agua_", "check_")) \
            or _chave in ("salada_nome", "salada_refeicoes", "prato_nome", "prato_refeicoes"):
        st.session_state[_chave] = st.session_state[_chave]

def _sincronizar_planner():
    """Faz os selectbox do planner mostrarem o que está em selecoes (usado quando a seleção muda fora do planner
    ou quando as calorias de uma salada mudam). Precisa rodar antes de os selectbox serem criados."""
    for dia, categorias in st.session_state.selecoes.items():
        if not isinstance(categorias, dict):
            continue
        for categoria, selecao in categorias.items():
            chave = f"{dia}_{categoria}_meal"
            if not isinstance(selecao, dict) or chave not in st.session_state:
                continue
            refeicao = selecao.get('meal', "Nenhuma")
            if refeicao == "Nenhuma" or refeicao in REFEICOES_COM_DETALHES:
                st.session_state[chave] = format_label(refeicao)

# Depois de editar a lista de ingredientes: tira das seleções o que não existe mais
# e atualiza as saladas no planner (as calorias podem ter mudado)
if st.session_state.pop("ingredientes_alterados", False):
    st.session_state.sincronizar_planner = True

# As saladas salvas viram refeições: aparecem no planner e entram na lista de compras
for _nome, _dados in st.session_state.saladas_salvas.items():
    REFEICOES_COM_DETALHES[PREFIXO_SALADA + _nome] = salada_para_refeicao(
        itens_da_combinacao(_dados["itens"], INGREDIENTES_SALADA)
    )

# Os pratos salvos também viram refeições
for _nome, _dados in st.session_state.pratos_salvos.items():
    REFEICOES_COM_DETALHES[PREFIXO_PRATO + _nome] = prato_para_refeicao(_dados["itens"], ALIMENTOS)

if st.session_state.pop("sincronizar_planner", False):
    _sincronizar_planner()

# --- INTERFACE ---
st.markdown("""
<style>
    /* Cartões (containers com borda) mais suaves */
    [data-testid="stVerticalBlockBorderWrapper"] { border-radius: 14px; }
    /* Números dos totais */
    [data-testid="stMetricValue"] { font-size: 1.6rem; color: #2F8F5B; }
    [data-testid="stMetricLabel"] p { font-size: 0.85rem; opacity: 0.75; }
    /* Abas maiores */
    button[data-baseweb="tab"] p { font-size: 1.05rem; font-weight: 600; }
    /* Opções desabilitadas bem apagadas */
    [data-testid="stCheckbox"] label:has(input:disabled) { opacity: 0.45; }
</style>
""", unsafe_allow_html=True)

st.title("🥑 Planner Saudável")
st.caption("Monte suas saladas, planeje a semana e gere a lista de compras.")

def _refeicao_atual(dia, categoria):
    """Refeição escolhida (considera o valor do selectbox, que já vem atualizado no início da execução)."""
    chave = f"{dia}_{categoria}_meal"
    if chave in st.session_state:
        return parse_label(st.session_state[chave])
    return st.session_state.selecoes.get(dia, {}).get(categoria, {}).get('meal', "Nenhuma")

def _kcal_do_dia(dia):
    total = 0
    for categoria in st.session_state.refeicoes_disponiveis:
        detalhes = REFEICOES_COM_DETALHES.get(_refeicao_atual(dia, categoria))
        if detalhes:
            total += detalhes['calories']
    return total

# --- BARRA LATERAL ---
PAGINA_PLANNER, PAGINA_SALADA, PAGINA_PRATO = "🗓️ Planner Semanal", "🥗 Monte sua Salada", "🍽️ Monte seu Prato"

with st.sidebar:
    pagina = st.radio("Páginas", [PAGINA_PLANNER, PAGINA_SALADA, PAGINA_PRATO], key="pagina")
    st.divider()
    st.markdown("## 🥑 Ações")

    if st.button("💾 Salvar plano semanal", use_container_width=True, type="primary"):
        salvar_dados(st.session_state.selecoes, PLANNER_FILE)
        st.toast('Plano salvo com sucesso!', icon='✅')

    if st.button("🛒 Gerar lista de compras", use_container_width=True):
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

    st.caption("Lembre de salvar o plano depois de mudar as refeições.")



# --- LAYOUT PRINCIPAL (PLANNER E LISTA) ---
if pagina == PAGINA_PLANNER:
    main_cols = st.columns([2, 1.3], gap="large")

    with main_cols[0]:
        st.subheader("Seu plano da semana")
        st.caption("Abra um dia para escolher as refeições. Suas saladas salvas aparecem com 🥗.")
        dia_hoje_index = datetime.now().weekday() 

        for i, dia in enumerate(DIAS_SEMANA):
            hoje = i == dia_hoje_index
            kcal_dia = _kcal_do_dia(dia)
            titulo = f"{'📍 ' if hoje else ''}**{dia}**{' · hoje' if hoje else ''}  —  {kcal_dia} kcal"
            with st.expander(titulo, expanded=hoje):
                # Lógica de seleção de refeições mantida da versão anterior
                if dia not in st.session_state.selecoes:
                    st.session_state.selecoes[dia] = {}
            
                for categoria, opcoes in st.session_state.refeicoes_disponiveis.items():
                    if categoria not in st.session_state.selecoes[dia]:
                         st.session_state.selecoes[dia][categoria] = {}

                    meal_cols = st.columns([4, 1]) 

                    with meal_cols[0]:
                        opcoes_formatadas = ["Nenhuma"] + [format_label(o) for o in sorted(opcoes)] + [format_label(PREFIXO_SALADA + n) for n, d in sorted(st.session_state.saladas_salvas.items()) if categoria in d["refeicoes"]] + [format_label(PREFIXO_PRATO + n) for n, d in sorted(st.session_state.pratos_salvos.items()) if categoria in d["refeicoes"]]
                    
                        selecao_atual_formatada = format_label(st.session_state.selecoes[dia][categoria].get('meal', "Nenhuma"))
                        index_selecao = opcoes_formatadas.index(selecao_atual_formatada) if selecao_atual_formatada in opcoes_formatadas else 0
                    
                        escolha_formatada = st.selectbox(
                            categoria,
                            options=opcoes_formatadas,
                            index=index_selecao if f"{dia}_{categoria}_meal" not in st.session_state else 0,
                            key=f"{dia}_{categoria}_meal",
                        )
                        st.session_state.selecoes[dia][categoria]['meal'] = parse_label(escolha_formatada)

                    with meal_cols[1]:
                        st.session_state.selecoes[dia][categoria]['people'] = st.number_input(
                            "👤 Pessoas",
                            min_value=1,
                            value=st.session_state.selecoes[dia][categoria].get('people', 1),
                            step=1,
                            key=f"{dia}_{categoria}_people",
                        )

                # --- RASTREADOR DE HIDRATAÇÃO VISUAL ---
                st.divider()
                st.markdown("💧 **Hidratação** · meta de 2 litros (cada copo = 250 ml)")
            
                # Inicializa o estado do contador de água para o dia
                if f"agua_checked_{dia}" not in st.session_state:
                    st.session_state[f"agua_checked_{dia}"] = 0
            
                water_cols = st.columns(8)
                num_checked = 0
                for j in range(8):
                    if water_cols[j].checkbox("🥛", key=f"agua_{dia}_{j}"):
                        num_checked += 1
            
                litros_consumidos = num_checked * 0.250
                st.progress(litros_consumidos / 2.0, text=f"{litros_consumidos:.2f} de 2,00 litros")

    with main_cols[1]:
        with st.container(border=True):
            st.subheader("🛒 Lista de compras")
            if st.session_state.get('lista_compras'):
                ingredientes, unidades = st.session_state.lista_compras
                if not ingredientes:
                    st.info("A lista de compras está vazia. Os itens selecionados já foram filtrados ou não precisam de compra (ex: itens do RU, arroz, feijão).")
                else:
                    st.caption("Marque o que já está no carrinho.")
                    # Exibe a lista
                    for item, quantidade in sorted(ingredientes.items()):
                        unidade = unidades.get(item, "unidade(s)")
                        quantidade_str = f"{int(quantidade)}" if quantidade == int(quantidade) else f"{quantidade:.2f}".replace('.00', '')
                        label = f"**{quantidade_str} {unidade}** de {item}"
                        st.checkbox(label, key=f"check_{item}")

                    # Botão de Exportar para PDF
                    pdf_data = generate_pdf_list(st.session_state.lista_compras)
                    st.download_button(
                        label="📥 Baixar lista em PDF",
                        data=pdf_data,
                        file_name=f"lista_compras_{datetime.now().strftime('%Y-%m-%d')}.pdf",
                        mime="application/pdf",
                        use_container_width=True,
                        type="secondary"
                    )

            else:
                st.info("Escolha as refeições da semana e clique em **🛒 Gerar lista de compras** na barra lateral.")


# --- ABA: MONTE SUA SALADA ---
def _chave_check(categoria, nome):
    return f"salada_{categoria}__{nome}"

def _marcados(categoria):
    """Ingredientes marcados na categoria, na ordem da lista."""
    return [i["nome"] for i in INGREDIENTES_SALADA.get(categoria, [])
            if st.session_state.get(_chave_check(categoria, i["nome"]), False)]

def _tirar_do_planner(nome, manter_em=(), prefixo=PREFIXO_SALADA):
    """Tira a salada/prato das refeições do planner que não estão em `manter_em`."""
    refeicao = prefixo + nome
    for categorias in st.session_state.selecoes.values():
        if isinstance(categorias, dict):
            for categoria, selecao in categorias.items():
                if isinstance(selecao, dict) and selecao.get('meal') == refeicao and categoria not in manter_em:
                    selecao['meal'] = "Nenhuma"
    st.session_state.sincronizar_planner = True

def _salvar_salada():
    nome = st.session_state.get("salada_nome", "").strip()
    combinacao = {c: _marcados(c) for c in INGREDIENTES_SALADA}
    refeicoes = list(st.session_state.get("salada_refeicoes", []))
    if not nome:
        st.toast("Dê um nome para a salada.", icon="⚠️")
        return
    if not any(combinacao.values()):
        st.toast("Escolha pelo menos um ingrediente.", icon="⚠️")
        return
    if not refeicoes:
        st.toast("Escolha em quais refeições a salada aparece.", icon="⚠️")
        return
    st.session_state.saladas_salvas[nome] = {"itens": combinacao, "refeicoes": refeicoes}
    salvar_dados(st.session_state.saladas_salvas, SALADAS_SALVAS_FILE)
    st.session_state[f"aparece_{nome}"] = refeicoes
    _tirar_do_planner(nome, manter_em=refeicoes)
    st.toast(f"Salada '{nome}' salva!", icon="✅")

def _carregar_salada(nome):
    dados = st.session_state.saladas_salvas.get(nome, {"itens": {}, "refeicoes": []})
    for categoria, itens in INGREDIENTES_SALADA.items():
        for item in itens:
            st.session_state[_chave_check(categoria, item["nome"])] = item["nome"] in dados["itens"].get(categoria, [])
    st.session_state.salada_nome = nome
    st.session_state.salada_refeicoes = list(dados["refeicoes"])

def _mudar_refeicoes(nome):
    refeicoes = list(st.session_state.get(f"aparece_{nome}", []))
    if not refeicoes:
        st.session_state[f"aparece_{nome}"] = st.session_state.saladas_salvas[nome]["refeicoes"]
        st.toast("A salada precisa aparecer em pelo menos uma refeição.", icon="⚠️")
        return
    st.session_state.saladas_salvas[nome]["refeicoes"] = refeicoes
    salvar_dados(st.session_state.saladas_salvas, SALADAS_SALVAS_FILE)
    _tirar_do_planner(nome, manter_em=refeicoes)

def _excluir_salada(nome):
    st.session_state.saladas_salvas.pop(nome, None)
    salvar_dados(st.session_state.saladas_salvas, SALADAS_SALVAS_FILE)
    _tirar_do_planner(nome)
    st.toast(f"Salada '{nome}' excluída.", icon="🗑️")

def _adicionar_ao_planner(nome, chave, prefixo=PREFIXO_SALADA):
    dia = st.session_state[f"{chave}_dia"]
    categoria = st.session_state[f"{chave}_refeicao"]
    st.session_state.selecoes.setdefault(dia, {}).setdefault(categoria, {})['meal'] = prefixo + nome
    st.session_state.sincronizar_planner = True
    st.toast(f"'{nome}' colocado em {dia} – {categoria}. Lembre de salvar o plano.", icon="🗓️")

def _ajuda_fonte_salada(fonte):
    """Texto do ⓘ de cada ingrediente da salada."""
    if fonte.startswith("TACO"):
        return f"Fonte: {REF_TACO}. Alimento usado: {fonte.removeprefix('TACO 4ª ed. ').strip('()')}."
    if fonte == "Planilha original":
        return "Fonte: valores da sua planilha original (sem equivalente na TACO)."
    return f"Fonte: {fonte}." if fonte else None

def _totais(itens):
    return {k: sum(i[k] * q for _, i, q in itens) for k in ("kcal", "prot", "carb", "gord")}

def _limpar_salada():
    for categoria, itens in INGREDIENTES_SALADA.items():
        for item in itens:
            st.session_state[_chave_check(categoria, item["nome"])] = False
    st.session_state.salada_nome = ""

def _qtd_txt(item, fator):
    return item["porcao"] if fator == 1 else f"½ × {item['porcao']}"

def _barra_macros(t):
    """Distribuição das calorias entre proteína, carbo e gordura."""
    kcal_macros = {"Proteína": t["prot"] * 4, "Carbo": t["carb"] * 4, "Gordura": t["gord"] * 9}
    soma = sum(kcal_macros.values())
    for nome, kcal in kcal_macros.items():
        pct = kcal / soma if soma else 0
        st.progress(pct, text=f"{nome}: {pct:.0%} das calorias")

if pagina == PAGINA_SALADA:
    if not INGREDIENTES_SALADA:
        st.error("Arquivo de ingredientes da salada não encontrado.")
    else:
        combinacao_atual = {}
        pendencias = []
        salada_cols = st.columns([1.6, 1], gap="large")

        with salada_cols[0]:
            st.subheader(
                "Monte sua salada em 5 passos",
                help=f"Referências: {REF_TACO}; para os itens sem equivalente na TACO, sua planilha original. "
                     "Passe o mouse no ⓘ de cada ingrediente para ver a fonte dele.",
            )
            st.caption("Marque os ingredientes de cada passo. Quando o limite é atingido, as outras opções ficam cinza.")
            for passo, (categoria, itens) in enumerate(INGREDIENTES_SALADA.items(), start=1):
                minimo, maximo, divide = REGRAS_SALADA.get(categoria, (0, len(itens), False))
                marcados = _marcados(categoria)
                with st.container(border=True):
                    cab = st.columns([3, 1])
                    cab[0].markdown(f"#### {passo}. {categoria}")
                    completo = minimo <= len(marcados) <= maximo
                    cab[1].markdown(
                        f"<div style='text-align:right; padding-top:0.6rem'>{'✅' if completo else '⏳'} "
                        f"<b>{len(marcados)}/{maximo}</b></div>",
                        unsafe_allow_html=True,
                    )
                    regra_txt = f"Escolha {minimo}" if minimo == maximo else f"Escolha {minimo} ou {maximo}"
                    if divide:
                        regra_txt += " — com 2, vai meia porção de cada"
                    st.caption(regra_txt)

                    # Com o limite atingido, as opções não marcadas ficam desabilitadas (cinza)
                    limite_atingido = len(marcados) >= maximo
                    for item in itens:
                        chave = _chave_check(categoria, item["nome"])
                        st.checkbox(
                            f"{item['nome']}  ·  {item['porcao']}  ·  **{item['kcal']:g} kcal**",
                            key=chave,
                            disabled=limite_atingido and not st.session_state.get(chave, False),
                            help=_ajuda_fonte_salada(item["fonte"]),
                        )
                escolhidos = _marcados(categoria)
                if len(escolhidos) < minimo:
                    pendencias.append(f"{categoria} ({minimo - len(escolhidos)})")
                combinacao_atual[categoria] = escolhidos

        itens_escolhidos = itens_da_combinacao(combinacao_atual, INGREDIENTES_SALADA)

        with salada_cols[1]:
            with st.container(border=True):
                st.subheader("📊 Sua salada")
                t = _totais(itens_escolhidos)
                st.metric("Calorias", f"{t['kcal']:.0f} kcal")
                m1, m2, m3 = st.columns(3)
                m1.metric("Proteína", f"{t['prot']:.0f} g")
                m2.metric("Carbo", f"{t['carb']:.0f} g")
                m3.metric("Gordura", f"{t['gord']:.0f} g")

                if itens_escolhidos:
                    _barra_macros(t)
                    st.markdown("\n".join(
                        f"- {i['nome']} · {_qtd_txt(i, q)} · {i['kcal'] * q:.0f} kcal"
                        for _, i, q in itens_escolhidos
                    ))
                else:
                    st.caption("Marque os ingredientes ao lado para ver os totais aqui.")

                if pendencias:
                    st.info("Falta escolher: " + ", ".join(pendencias))
                elif itens_escolhidos:
                    st.success("Salada completa! 🎉")

            with st.container(border=True):
                st.markdown("#### 💾 Salvar esta salada")
                st.text_input("Nome", key="salada_nome", placeholder="Ex.: Frango com milho")
                st.multiselect(
                    "Aparece no planner em",
                    list(st.session_state.refeicoes_disponiveis),
                    key="salada_refeicoes",
                    help="A salada só aparece como opção nessas refeições.",
                )
                b1, b2 = st.columns(2)
                b1.button("Salvar", on_click=_salvar_salada, type="primary", use_container_width=True)
                b2.button("Limpar escolhas", on_click=_limpar_salada, use_container_width=True)
                st.caption("Salvar com um nome que já existe substitui a salada.")

        st.divider()
        st.subheader("📚 Minhas saladas")
        if not st.session_state.saladas_salvas:
            st.info("Você ainda não salvou nenhuma salada. Monte uma acima e clique em **Salvar**.")
        grade = st.columns(2, gap="medium")
        for idx, (nome, dados) in enumerate(sorted(st.session_state.saladas_salvas.items())):
            combinacao = dados["itens"]
            itens_salvos = itens_da_combinacao(combinacao, INGREDIENTES_SALADA)
            ts = _totais(itens_salvos)
            with grade[idx % 2], st.container(border=True):
                st.markdown(f"#### {PREFIXO_SALADA}{nome}")
                st.markdown(
                    f"**{ts['kcal']:.0f} kcal** · Proteína {ts['prot']:.0f} g · Carbo {ts['carb']:.0f} g · Gordura {ts['gord']:.0f} g"
                )
                faltando = [
                    n for c, nomes in combinacao.items() for n in nomes
                    if n not in {i["nome"] for i in INGREDIENTES_SALADA.get(c, [])}
                ]
                if faltando:
                    st.warning("Ingredientes que não existem mais na lista (ignorados no cálculo): " + ", ".join(faltando))
                st.caption(" · ".join(i["nome"] for _, i, _ in itens_salvos))

                if f"aparece_{nome}" not in st.session_state:
                    st.session_state[f"aparece_{nome}"] = list(dados["refeicoes"])
                st.multiselect(
                    "Aparece no planner em",
                    list(st.session_state.refeicoes_disponiveis),
                    key=f"aparece_{nome}",
                    on_change=_mudar_refeicoes,
                    args=(nome,),
                )

                chave = f"salada_salva_{nome}"
                sel = st.columns(2)
                sel[0].selectbox("Dia", DIAS_SEMANA, key=f"{chave}_dia")
                sel[1].selectbox("Refeição", dados["refeicoes"], key=f"{chave}_refeicao")
                st.button("🗓️ Pôr na semana", key=f"{chave}_add", on_click=_adicionar_ao_planner, args=(nome, chave), type="primary", use_container_width=True)
                acoes = st.columns(2)
                acoes[0].button("✏️ Carregar para editar", key=f"{chave}_load", on_click=_carregar_salada, args=(nome,), use_container_width=True)
                acoes[1].button("🗑️ Excluir", key=f"{chave}_del", on_click=_excluir_salada, args=(nome,), use_container_width=True)

    # --- GERENCIAR INGREDIENTES ---
    st.divider()
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


# --- PÁGINA: MONTE SEU PRATO ---
def _chk_prato(espaco, id_):
    return f"prato_chk__{espaco}__{id_}"

def _g_prato(espaco, id_):
    return f"prato_g__{espaco}__{id_}"

def _opcoes_do_espaco(espaco):
    """Opções do plano + alimentos que a usuária buscou na TACO nesta sessão."""
    opcoes = list(OPCOES_PRATO.get(espaco, []))
    ids = {o["id"] for o in opcoes}
    for id_ in st.session_state.get(f"prato_extras_{espaco}", []):
        if id_ not in ids and id_ in ALIMENTOS:
            opcoes.append({"id": id_, "gramas": 100.0, "medida": ""})
            ids.add(id_)
    return opcoes

def _marcados_prato(espaco):
    return [o for o in _opcoes_do_espaco(espaco) if st.session_state.get(_chk_prato(espaco, o["id"]), False)]

def _itens_prato_atual():
    itens = []
    for espaco in REGRAS_PRATO:
        for o in _marcados_prato(espaco):
            gramas = st.session_state.get(_g_prato(espaco, o["id"]), o["gramas"])
            itens.append({"espaco": espaco, "id": o["id"], "gramas": float(gramas)})
    return itens

def _totais_prato(itens):
    t = {"kcal": 0.0, "prot": 0.0, "carb": 0.0, "gord": 0.0}
    for item in itens:
        alimento = ALIMENTOS.get(item["id"])
        if alimento:
            for k, v in nutrientes(alimento, item["gramas"]).items():
                t[k] += v
    return t

def _adicionar_extra(espaco):
    """Busca na TACO: coloca o alimento escolhido na lista do espaço (e marca, se couber)."""
    id_ = st.session_state.get(f"prato_busca_{espaco}")
    if not id_:
        return
    extras = st.session_state.setdefault(f"prato_extras_{espaco}", [])
    if id_ not in extras:
        extras.append(id_)
    maximo = REGRAS_PRATO[espaco][1]
    if maximo is None or len(_marcados_prato(espaco)) < maximo:
        st.session_state[_chk_prato(espaco, id_)] = True
    st.session_state[f"prato_busca_{espaco}"] = None

def _dividir_vegetais():
    marcados = _marcados_prato("Vegetais")
    for o in marcados:
        st.session_state[_g_prato("Vegetais", o["id"])] = float(round(META_VEGETAIS_G / len(marcados)))

def _limpar_prato():
    for espaco in REGRAS_PRATO:
        for o in _opcoes_do_espaco(espaco):
            st.session_state[_chk_prato(espaco, o["id"])] = False
            st.session_state.pop(_g_prato(espaco, o["id"]), None)
    st.session_state.prato_nome = ""

def _salvar_prato():
    nome = st.session_state.get("prato_nome", "").strip()
    itens = _itens_prato_atual()
    refeicoes = list(st.session_state.get("prato_refeicoes", []))
    if not nome:
        st.toast("Dê um nome para o prato.", icon="⚠️")
        return
    if not itens:
        st.toast("Escolha pelo menos um alimento.", icon="⚠️")
        return
    if not refeicoes:
        st.toast("Escolha em quais refeições o prato aparece.", icon="⚠️")
        return
    st.session_state.pratos_salvos[nome] = {"itens": itens, "refeicoes": refeicoes}
    salvar_dados(st.session_state.pratos_salvos, PRATOS_SALVOS_FILE)
    st.session_state[f"prato_aparece_{nome}"] = refeicoes
    _tirar_do_planner(nome, manter_em=refeicoes, prefixo=PREFIXO_PRATO)
    st.toast(f"Prato '{nome}' salvo!", icon="✅")

def _carregar_prato(nome):
    dados = st.session_state.pratos_salvos.get(nome, {"itens": [], "refeicoes": []})
    _limpar_prato()
    for item in dados["itens"]:
        espaco, id_ = item["espaco"], item["id"]
        if id_ not in {o["id"] for o in OPCOES_PRATO.get(espaco, [])}:
            extras = st.session_state.setdefault(f"prato_extras_{espaco}", [])
            if id_ not in extras:
                extras.append(id_)
        st.session_state[_chk_prato(espaco, id_)] = True
        st.session_state[_g_prato(espaco, id_)] = float(item["gramas"])
    st.session_state.prato_nome = nome
    st.session_state.prato_refeicoes = list(dados["refeicoes"])

def _mudar_refeicoes_prato(nome):
    refeicoes = list(st.session_state.get(f"prato_aparece_{nome}", []))
    if not refeicoes:
        st.session_state[f"prato_aparece_{nome}"] = st.session_state.pratos_salvos[nome]["refeicoes"]
        st.toast("O prato precisa aparecer em pelo menos uma refeição.", icon="⚠️")
        return
    st.session_state.pratos_salvos[nome]["refeicoes"] = refeicoes
    salvar_dados(st.session_state.pratos_salvos, PRATOS_SALVOS_FILE)
    _tirar_do_planner(nome, manter_em=refeicoes, prefixo=PREFIXO_PRATO)

def _excluir_prato(nome):
    st.session_state.pratos_salvos.pop(nome, None)
    salvar_dados(st.session_state.pratos_salvos, PRATOS_SALVOS_FILE)
    _tirar_do_planner(nome, prefixo=PREFIXO_PRATO)
    st.toast(f"Prato '{nome}' excluído.", icon="🗑️")

def _cadastrar_alimento():
    nome = st.session_state.get("novo_alimento_nome", "").strip()
    if not nome:
        st.toast("Dê um nome para o alimento.", icon="⚠️")
        return
    existentes = carregar_linhas_csv(ALIMENTOS_PERSONALIZADOS_FILE)
    novo_id = str(max([int(r["id"]) for r in existentes] + [0]) + 1)
    existentes.append({
        "id": novo_id,
        "Alimento": nome,
        "Grupo": st.session_state.novo_alimento_espaco,
        "Calorias (kcal)": f"{st.session_state.novo_alimento_kcal:g}",
        "Proteína (g)": f"{st.session_state.novo_alimento_prot:g}",
        "Carbo (g)": f"{st.session_state.novo_alimento_carb:g}",
        "Gordura (g)": f"{st.session_state.novo_alimento_gord:g}",
        "Gramas": f"{st.session_state.novo_alimento_gramas:g}",
        "Medida caseira": st.session_state.get("novo_alimento_medida", "").strip(),
    })
    salvar_linhas_csv(existentes, ALIMENTOS_PERSONALIZADOS_FILE, COLUNAS_PERSONALIZADOS)
    st.session_state.novo_alimento_nome = ""
    st.session_state.novo_alimento_medida = ""
    st.toast(f"'{nome}' cadastrado!", icon="✅")

def _excluir_alimento(id_):
    linhas = [r for r in carregar_linhas_csv(ALIMENTOS_PERSONALIZADOS_FILE) if "P" + r["id"] != id_]
    salvar_linhas_csv(linhas, ALIMENTOS_PERSONALIZADOS_FILE, COLUNAS_PERSONALIZADOS)
    for espaco in REGRAS_PRATO:
        st.session_state.pop(_chk_prato(espaco, id_), None)
    st.session_state.sincronizar_planner = True
    st.toast("Alimento excluído.", icon="🗑️")

def _ajuda_fonte_alimento(id_):
    """Texto do ⓘ de cada alimento do prato."""
    a = ALIMENTOS[id_]
    if a["fonte"] == "TACO":
        return f"Fonte: {REF_TACO}. Alimento: “{a['nome']}” (nº {id_})."
    if a["fonte"] == "USDA":
        return f"Fonte: {REF_USDA}. Alimento nº {id_[1:]}: {a['descricao_usda']}."
    return "Fonte: alimento cadastrado por você."

def _nome_item(id_):
    alimento = ALIMENTOS.get(id_)
    return alimento["nome"] if alimento else "(alimento excluído)"

if pagina == PAGINA_PRATO:
    mes_atual = datetime.now().month
    prato_cols = st.columns([1.6, 1], gap="large")

    with prato_cols[0]:
        st.subheader(
            "Monte seu prato",
            help=f"Referências: {REF_PLANO}; valores nutricionais: {REF_TACO} e, para o que não existe nela, "
                 f"{REF_USDA}; selo 🌱: {REF_WEBDIET_EPOCA}. Passe o mouse no ⓘ de cada alimento para ver a fonte dele.",
        )
        st.caption(
            "Baseado no almoço/jantar do seu plano alimentar. As quantidades já vêm do plano — ajuste os gramas "
            "se quiser. Valores nutricionais da TACO (os que não existem nela vêm da USDA). 🌱 = da época neste mês."
        )
        pendencias_prato = []
        for passo, espaco in enumerate(REGRAS_PRATO, start=1):
            minimo, maximo = REGRAS_PRATO[espaco]
            opcoes = _opcoes_do_espaco(espaco)
            marcados = _marcados_prato(espaco)
            with st.container(border=True):
                cab = st.columns([3, 1])
                cab[0].markdown(f"#### {passo}. {espaco}")
                if espaco == "Vegetais":
                    gramas_veg = sum(st.session_state.get(_g_prato(espaco, o["id"]), o["gramas"]) for o in marcados)
                    contador = f"{gramas_veg:.0f}/{META_VEGETAIS_G} g"
                    completo = gramas_veg >= META_VEGETAIS_G
                else:
                    contador = f"{len(marcados)}/{maximo}"
                    completo = minimo <= len(marcados)
                cab[1].markdown(
                    f"<div style='text-align:right; padding-top:0.6rem'>{'✅' if completo else '⏳'} <b>{contador}</b></div>",
                    unsafe_allow_html=True,
                )
                st.caption(DESCRICAO_PRATO[espaco])

                limite_atingido = maximo is not None and len(marcados) >= maximo
                for o in opcoes:
                    alimento = ALIMENTOS[o["id"]]
                    chk = _chk_prato(espaco, o["id"])
                    marcado = st.session_state.get(chk, False)
                    linha = st.columns([3, 1.2]) if marcado else [st.container()]
                    kcal_padrao = nutrientes(alimento, o["gramas"])["kcal"]
                    selo = " 🌱" if eh_da_epoca(alimento["nome"], mes_atual) else ""
                    extra = f" · {o['medida']}" if o["medida"] else ""
                    if alimento["fonte"] == "USDA":
                        extra += " · *fonte: USDA*"
                    linha[0].checkbox(
                        f"{alimento['nome']}{selo}  ·  {o['gramas']:g} g{extra}  ·  **{kcal_padrao:.0f} kcal**",
                        key=chk,
                        disabled=limite_atingido and not marcado,
                        help=_ajuda_fonte_alimento(o["id"]),
                    )
                    if marcado:
                        chave_g = _g_prato(espaco, o["id"])
                        if chave_g not in st.session_state:
                            st.session_state[chave_g] = float(o["gramas"])
                        linha[1].number_input(
                            "Gramas", min_value=0.0, max_value=2000.0, step=5.0, format="%.0f",
                            key=chave_g, label_visibility="collapsed",
                        )

                if espaco == "Vegetais" and marcados:
                    st.progress(min(gramas_veg / META_VEGETAIS_G, 1.0), text=f"{gramas_veg:.0f} de {META_VEGETAIS_G} g de vegetais")
                    st.button(f"Dividir {META_VEGETAIS_G} g igualmente entre os vegetais", on_click=_dividir_vegetais)

                ids_na_lista = {o["id"] for o in opcoes}
                busca = [
                    id_ for id_, a in ALIMENTOS.items()
                    if not a["personalizado"] and a["grupo"] in GRUPOS_TACO_PRATO[espaco] and id_ not in ids_na_lista
                ]
                st.selectbox(
                    "Buscar outro alimento na TACO",
                    busca,
                    index=None,
                    format_func=lambda i: ALIMENTOS[i]["nome"],
                    placeholder="🔎 Buscar outro alimento na TACO…",
                    key=f"prato_busca_{espaco}",
                    on_change=_adicionar_extra,
                    args=(espaco,),
                    label_visibility="collapsed",
                )

            if espaco == "Vegetais":
                if not marcados:
                    pendencias_prato.append("vegetais")
            elif len(marcados) < minimo:
                pendencias_prato.append(espaco.lower())

    itens_prato = _itens_prato_atual()
    with prato_cols[1]:
        with st.container(border=True):
            st.subheader("📊 Seu prato")
            t = _totais_prato(itens_prato)
            st.metric("Calorias", f"{t['kcal']:.0f} kcal")
            m1, m2, m3 = st.columns(3)
            m1.metric("Proteína", f"{t['prot']:.0f} g")
            m2.metric("Carbo", f"{t['carb']:.0f} g")
            m3.metric("Gordura", f"{t['gord']:.0f} g")

            if itens_prato:
                st.markdown(
                    "**Referência do seu plano por refeição**",
                    help=f"{REF_PLANO}: ~30 g de carboidratos, ~24 g de proteínas e ~6 g de gorduras por refeição (5 refeições por dia).",
                )
                for chave, rotulo in (("carb", "Carbo"), ("prot", "Proteína"), ("gord", "Gordura")):
                    meta = META_REFEICAO[chave]
                    st.progress(min(t[chave] / meta, 1.0), text=f"{rotulo}: {t[chave]:.0f} g de ~{meta} g")
                st.caption("É só uma referência: algumas refeições ficam acima e outras abaixo, e tudo bem.")

                peso = {e: sum(i["gramas"] for i in itens_prato if i["espaco"] == e) for e in PROPORCAO_PRATO}
                peso_total = sum(peso.values())
                if peso_total:
                    st.markdown(
                        "**Proporção do prato** (pelo peso)",
                        help=f"{REF_WEBDIET_PRATO}: 50% folhas e vegetais + 15% legumes (aqui somados em Vegetais), "
                             "25% proteína e 10% grãos ou fonte de carboidrato.",
                    )
                    st.markdown("\n".join(
                        f"- {e}: **{peso[e] / peso_total:.0%}** (ideal ~{ideal}%)"
                        for e, ideal in PROPORCAO_PRATO.items()
                    ))

                st.markdown("**Ingredientes**")
                st.markdown("\n".join(
                    f"- {_nome_item(i['id'])} · {i['gramas']:g} g · {_totais_prato([i])['kcal']:.0f} kcal"
                    for i in itens_prato
                ))
            else:
                st.caption("Marque os alimentos ao lado para ver os totais aqui.")

            if pendencias_prato:
                st.info("Falta escolher: " + ", ".join(pendencias_prato))
            elif itens_prato:
                st.success("Prato completo! 🎉")

        with st.container(border=True):
            st.markdown("#### 💾 Salvar este prato")
            st.text_input("Nome", key="prato_nome", placeholder="Ex.: Frango com arroz e legumes")
            st.multiselect(
                "Aparece no planner em",
                list(st.session_state.refeicoes_disponiveis),
                key="prato_refeicoes",
                help="O prato só aparece como opção nessas refeições.",
            )
            b1, b2 = st.columns(2)
            b1.button("Salvar", key="prato_salvar", on_click=_salvar_prato, type="primary", use_container_width=True)
            b2.button("Limpar escolhas", key="prato_limpar", on_click=_limpar_prato, use_container_width=True)
            st.caption("Salvar com um nome que já existe substitui o prato.")

        with st.expander("➕ Cadastrar alimento que não está na TACO"):
            st.caption("Informe os valores por 100 g (do rótulo ou de outra tabela).")
            st.text_input("Nome do alimento", key="novo_alimento_nome", placeholder="Ex.: Hambúrguer de lentilha")
            st.selectbox("Espaço do prato", list(REGRAS_PRATO), key="novo_alimento_espaco")
            n1, n2 = st.columns(2)
            n1.number_input("Calorias (kcal/100 g)", min_value=0.0, step=1.0, key="novo_alimento_kcal")
            n2.number_input("Proteína (g/100 g)", min_value=0.0, step=0.1, key="novo_alimento_prot")
            n3, n4 = st.columns(2)
            n3.number_input("Carbo (g/100 g)", min_value=0.0, step=0.1, key="novo_alimento_carb")
            n4.number_input("Gordura (g/100 g)", min_value=0.0, step=0.1, key="novo_alimento_gord")
            n5, n6 = st.columns(2)
            n5.number_input("Porção padrão (g)", min_value=1.0, value=100.0, step=5.0, key="novo_alimento_gramas")
            n6.text_input("Medida caseira", key="novo_alimento_medida", placeholder="Ex.: 1 unidade")
            st.button("Cadastrar", key="novo_alimento_btn", on_click=_cadastrar_alimento, use_container_width=True)

            personalizados = [(i, a) for i, a in ALIMENTOS.items() if a["personalizado"]]
            if personalizados:
                st.markdown("**Seus alimentos**")
                for id_, a in personalizados:
                    c1, c2 = st.columns([4, 1])
                    c1.caption(f"{a['nome']} ({a['grupo']}) · {a['kcal']:g} kcal/100 g")
                    c2.button("🗑️", key=f"excluir_alimento_{id_}", on_click=_excluir_alimento, args=(id_,))

    st.divider()
    st.subheader("📚 Meus pratos")
    if not st.session_state.pratos_salvos:
        st.info("Você ainda não salvou nenhum prato. Monte um acima e clique em **Salvar**.")
    grade = st.columns(2, gap="medium")
    for idx, (nome, dados) in enumerate(sorted(st.session_state.pratos_salvos.items())):
        tp = _totais_prato(dados["itens"])
        with grade[idx % 2], st.container(border=True):
            st.markdown(f"#### {PREFIXO_PRATO}{nome}")
            st.markdown(
                f"**{tp['kcal']:.0f} kcal** · Proteína {tp['prot']:.0f} g · Carbo {tp['carb']:.0f} g · Gordura {tp['gord']:.0f} g"
            )
            if any(i["id"] not in ALIMENTOS for i in dados["itens"]):
                st.warning("Algum alimento deste prato foi excluído e não entra no cálculo.")
            st.caption(" · ".join(f"{_nome_item(i['id'])} ({i['gramas']:g} g)" for i in dados["itens"]))

            if f"prato_aparece_{nome}" not in st.session_state:
                st.session_state[f"prato_aparece_{nome}"] = list(dados["refeicoes"])
            st.multiselect(
                "Aparece no planner em",
                list(st.session_state.refeicoes_disponiveis),
                key=f"prato_aparece_{nome}",
                on_change=_mudar_refeicoes_prato,
                args=(nome,),
            )
            chave = f"prato_salvo_{nome}"
            sel = st.columns(2)
            sel[0].selectbox("Dia", DIAS_SEMANA, key=f"{chave}_dia")
            sel[1].selectbox("Refeição", dados["refeicoes"], key=f"{chave}_refeicao")
            st.button("🗓️ Pôr na semana", key=f"{chave}_add", on_click=_adicionar_ao_planner,
                      args=(nome, chave, PREFIXO_PRATO), type="primary", use_container_width=True)
            acoes = st.columns(2)
            acoes[0].button("✏️ Carregar para editar", key=f"{chave}_load", on_click=_carregar_prato, args=(nome,), use_container_width=True)
            acoes[1].button("🗑️ Excluir", key=f"{chave}_del", on_click=_excluir_prato, args=(nome,), use_container_width=True)
