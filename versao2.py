import streamlit as st
import json
import os
from datetime import datetime

# --- CONFIGURAÇÃO DA PÁGINA ---
st.set_page_config(
    page_title="Planner Alimentar - Bia",
    page_icon="🥗",
    layout="wide"
)

# --- ESTILOS CSS ---
st.markdown("""
<style>
    /* Melhora a aparência dos expanders */
    .st-emotion-cache-1hboz31 {
        border: 1px solid #e6e6e6;
        border-radius: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .st-emotion-cache-1hboz31 p {
        font-weight: bold;
        color: #004488;
    }
    /* Estilo da caixa de cada refeição */
    .meal-box {
        border: 1px solid #d0d0d0;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
        background-color: #f9f9f9;
        transition: box-shadow 0.3s ease-in-out;
    }
    .meal-box:hover {
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .meal-title {
        font-weight: bold;
        color: #004488;
        margin-bottom: 8px;
        font-size: 1.05em;
    }
</style>
""", unsafe_allow_html=True)


# --- CONSTANTES E CONFIGURAÇÕES ---
FILE_PATH = "planner_data.json"
DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
REFEICOES = ["Café da manhã 🍳", "Lanche da manhã 🍎", "Almoço 🍲", "Lanche da tarde 🥪", "Jantar 🥗", "Ceia/Extra 🌙"]

# --- FUNÇÕES DE DADOS (CARREGAR E SALVAR) ---

def carregar_dados():
    """Carrega os dados do planner a partir de um arquivo JSON."""
    if os.path.exists(FILE_PATH):
        try:
            with open(FILE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {} # Retorna dict vazio se o arquivo estiver corrompido
    return {}

def salvar_dados(dados):
    """Salva os dados do planner em um arquivo JSON."""
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=4)

def gerar_relatorio_txt(dados):
    """Gera uma string formatada do plano para exportação."""
    report = f"Plano Alimentar Semanal - Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n"
    report += "="*50 + "\n\n"
    for dia in DIAS_SEMANA:
        report += f"📅 {dia.upper()}\n"
        report += "-"*20 + "\n"
        for refeicao in REFEICOES:
            refeicao_limpa = refeicao.split(' ')[0] # Remove emoji para chave
            texto = dados.get(dia, {}).get(refeicao, "")
            report += f"  - {refeicao}: {texto or 'Não preenchido'}\n"
        report += "\n"
    
    observacoes = dados.get("observacoes", "")
    report += f"📝 Observações Gerais:\n{observacoes or 'Nenhuma'}\n"
    return report

# --- INICIALIZAÇÃO DO ESTADO DA SESSÃO ---
if "planner_data" not in st.session_state:
    st.session_state.planner_data = carregar_dados()

# --- INTERFACE DO USUÁRIO ---

st.title("🥗 Planner Alimentar Semanal")
st.markdown("Organize suas refeições, salve seu progresso e exporte seu plano a qualquer momento.")
st.markdown("---")

# --- BARRA LATERAL (SIDEBAR) ---
with st.sidebar:
    st.image("https://images.emojiterra.com/google/noto-emoji/v2.034/512px/1f966.png", width=100)
    st.header("Ações")

    if st.button("Salvar Alterações", use_container_width=True, type="primary"):
        salvar_dados(st.session_state.planner_data)
        st.toast('Plano salvo com sucesso!', icon='✅')

    # Preparar dados para download
    relatorio_txt = gerar_relatorio_txt(st.session_state.planner_data)
    st.download_button(
        label="Exportar para .txt",
        data=relatorio_txt,
        file_name=f"plano_alimentar_{datetime.now().strftime('%Y-%m-%d')}.txt",
        mime="text/plain",
        use_container_width=True
    )
    
    st.markdown("---")
    st.header("📝 Observações Gerais")
    st.session_state.planner_data["observacoes"] = st.text_area(
        "Anote suas metas, como se sentiu, ou o que precisar:",
        value=st.session_state.planner_data.get("observacoes", ""),
        height=200,
        key="obs_gerais"
    )

# --- LAYOUT PRINCIPAL (PLANNER) ---
# Define qual dia estará expandido por padrão (hoje ou segunda-feira)
dia_hoje_index = datetime.now().weekday() # Segunda=0, Domingo=6

for i, dia in enumerate(DIAS_SEMANA):
    # O expander do dia atual abre por padrão
    with st.expander(f"### 📅 {dia}", expanded=(i == dia_hoje_index)):
        cols = st.columns(3) # Cria 3 colunas para as refeições
        
        # Inicializa o dicionário do dia se não existir
        if dia not in st.session_state.planner_data:
            st.session_state.planner_data[dia] = {}

        for i, refeicao in enumerate(REFEICOES):
            col = cols[i % 3]
            with col:
                st.markdown(f"<div class='meal-box'><div class='meal-title'>{refeicao}</div>", unsafe_allow_html=True)
                
                # O valor do text_area é vinculado ao session_state
                st.session_state.planner_data[dia][refeicao] = st.text_area(
                    label=f"Input para {dia} - {refeicao}",
                    value=st.session_state.planner_data[dia].get(refeicao, ""),
                    key=f"{dia}_{refeicao}",
                    height=100,
                    label_visibility="collapsed" # Esconde o label, já temos um título
                )
                st.markdown("</div>", unsafe_allow_html=True)

# --- RODAPÉ ---
st.markdown("""
<hr>
<center><sub>Desenvolvido com carinho para Bia ❤️ | v2.0 com Python e Streamlit</sub></center>
""", unsafe_allow_html=True)