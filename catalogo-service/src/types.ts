export interface Produto {
  id: number;
  nome: string;
  preco: number;
  estoque: number;
}

export interface ReservaResponse {
  produtoId: number;
  reservado: number;
  precoUnitario: number;
  estoqueRestante: number;
}

export interface ApiError {
  mensagem: string;
  codigo?: string;
}

