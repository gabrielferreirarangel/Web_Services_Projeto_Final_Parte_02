import { ReservaEstoque } from "../types";
import { AppError } from "../errors/app.error";

const CATALOG_URL = process.env.CATALOG_URL || "http://localhost:3001";

export async function reservarEstoque(
  produtoId: number,
  quantidade: number
): Promise<ReservaEstoque> {
  const url = `${CATALOG_URL}/produtos/${produtoId}/reservas`;
  const opcoes: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ quantidade })
  };

  try {
    const resposta = await fetch(url, opcoes);
    const dados = await resposta.json().catch(() => null);

    if (!resposta.ok) {
      const mensagem = dados?.mensagem ?? "Falha ao reservar estoque";
      const codigo = dados?.codigo;
      throw new AppError(mensagem, resposta.status, codigo);
    }

    return dados as ReservaEstoque;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    // Falha de conexão ou Catálogo desligado gera 502
    throw new AppError("Catálogo indisponível", 502, "CATALOGO_INDISPONIVEL");
  }
}
