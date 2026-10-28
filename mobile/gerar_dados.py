"""Gera mobile/dados.js a partir do versao4.py e dos CSVs em "banco de dados/".

Assim a versão para celular usa exatamente os mesmos alimentos, regras e valores
nutricionais da versão Streamlit. O plano alimentar pessoal (meu_plano.json) NÃO entra
aqui, porque este arquivo é publicado; vai só o plano_exemplo.json. O pessoal é carregado
no celular pelo botão de backup e fica salvo só no aparelho.

Rode de novo sempre que mudar algum desses dados:

    python mobile/gerar_dados.py
"""
import ast
import csv
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = os.path.join(RAIZ, "banco de dados")

CONSTANTES = [
    "REFEICOES_COM_DETALHES", "REFEICOES_BASE", "REGRAS_SALADA",
    "REF_TACO", "REF_USDA", "REF_PLANO", "REF_WEBDIET_PRATO", "REF_WEBDIET_EPOCA",
    "PROPORCAO_PRATO", "GRUPOS_TACO_PRATO", "DA_EPOCA",
    "SHOPPING_LIST_EXCLUSIONS", "DIAS_SEMANA",
]


def ler_constantes():
    """Lê as constantes do versao4.py sem executar o app (só valores literais)."""
    with open(os.path.join(RAIZ, "versao4.py"), encoding="utf-8") as f:
        arvore = ast.parse(f.read())
    valores = {}
    for no in arvore.body:
        if isinstance(no, ast.Assign) and len(no.targets) == 1 and isinstance(no.targets[0], ast.Name):
            nome = no.targets[0].id
            if nome in CONSTANTES:
                valores[nome] = ast.literal_eval(no.value)
    faltando = set(CONSTANTES) - set(valores)
    assert not faltando, f"Constantes não encontradas: {faltando}"
    return valores


def ler_csv(nome):
    with open(os.path.join(DADOS, nome), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def numero(valor):
    return float(valor) if valor not in (None, "") else 0.0


def main():
    c = ler_constantes()

    alimentos = {}
    for prefixo, arquivo, fonte in (("", "taco.csv", "TACO"), ("U", "alimentos_usda.csv", "USDA")):
        for r in ler_csv(arquivo):
            alimentos[prefixo + r["id"]] = {
                "nome": r["Alimento"], "grupo": r["Grupo"], "fonte": fonte,
                "kcal": numero(r["Calorias (kcal)"]), "prot": numero(r["Proteína (g)"]),
                "carb": numero(r["Carbo (g)"]), "gord": numero(r["Gordura (g)"]),
            }

    with open(os.path.join(DADOS, "plano_exemplo.json"), encoding="utf-8") as f:
        plano_exemplo = json.load(f)

    salada = {}
    for r in ler_csv("ingredientes_salada.csv"):
        salada.setdefault(r["Categoria"], []).append({
            "nome": r["Ingrediente"], "porcao": r["Porção"], "fonte": r.get("Fonte", ""),
            "kcal": numero(r["Calorias (kcal)"]), "prot": numero(r["Proteína (g)"]),
            "carb": numero(r["Carbo (g)"]), "gord": numero(r["Gordura (g)"]),
        })

    dados = {
        "dias": c["DIAS_SEMANA"],
        "refeicoes": c["REFEICOES_BASE"],
        "detalhes": c["REFEICOES_COM_DETALHES"],
        "exclusoesCompras": c["SHOPPING_LIST_EXCLUSIONS"],
        "salada": {"ingredientes": salada, "regras": c["REGRAS_SALADA"]},
        "prato": {"proporcao": c["PROPORCAO_PRATO"], "gruposTaco": c["GRUPOS_TACO_PRATO"]},
        "planoExemplo": plano_exemplo,
        "alimentos": alimentos,
        "daEpoca": c["DA_EPOCA"],
        "referencias": {k: c[k] for k in ("REF_TACO", "REF_USDA", "REF_PLANO", "REF_WEBDIET_PRATO", "REF_WEBDIET_EPOCA")},
    }
    destino = os.path.join(RAIZ, "mobile", "dados.js")
    with open(destino, "w", encoding="utf-8") as f:
        f.write("// Gerado por mobile/gerar_dados.py — não edite à mão.\n")
        f.write("window.DADOS = ")
        json.dump(dados, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print(f"{destino}: {len(alimentos)} alimentos, {sum(len(v) for v in salada.values())} ingredientes de salada")


if __name__ == "__main__":
    main()
