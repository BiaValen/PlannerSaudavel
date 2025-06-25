import streamlit as st
import datetime

st.set_page_config(page_title="Planner Alimentar - Bia", layout="wide")
st.title("🥗 Planner Alimentar Semanal - Bia")

st.markdown("""
<style>
    .meal-box {
        border: 1px solid #cce;
        border-radius: 10px;
        padding: 10px;
        margin-bottom: 10px;
        background-color: #f9fcff;
    }
    .meal-title {
        font-weight: bold;
        color: #004488;
        margin-bottom: 5px;
    }
</style>
""", unsafe_allow_html=True)

# Dias da semana e refeições
week_days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
meal_times = ["Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Doce ou extra"]

# Planner
for day in week_days:
    st.subheader(f"📅 {day}")
    cols = st.columns(3)
    for i, meal in enumerate(meal_times):
        with cols[i % 3]:
            st.markdown(f"<div class='meal-box'><div class='meal-title'>{meal}</div>", unsafe_allow_html=True)
            st.text_area(f"{day} - {meal}", key=f"{day}_{meal}", height=80)
            st.markdown("</div>", unsafe_allow_html=True)

# Observações finais
st.markdown("---")
st.markdown("### 📝 Observações Gerais")
st.text_area("Anote aqui suas metas, ajustes ou como você se sentiu durante a semana:", height=150)

# Footer
st.markdown("""
<center><sub>Desenvolvido para Bia ❤️ | ChatGPT x Saúde e Bem-estar</sub></center>
""", unsafe_allow_html=True)
