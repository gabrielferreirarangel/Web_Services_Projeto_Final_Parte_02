import { Pedido, CriarPedidoInput } from "../types";
import { pedidos } from "../data/pedidos";
import { reservarEstoque } from "../clients/catalogo.client";
import { AppError } from "../errors/app.error";

let proximoId = 1;

// Validação simples de formato de e-mail
function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function criarPedido(input: CriarPedidoInput): Promise<Pedido> {
  const { produtoId, quantidade, clienteEmail } = input || {};

  // 1. Validar produtoId, quantidade e clienteEmail
  if (
    typeof produtoId !== "number" ||
    !Number.isInteger(produtoId) ||
    produtoId <= 0 ||
    typeof quantidade !== "number" ||
    !Number.isInteger(quantidade) ||
    quantidade <= 0 ||
    typeof clienteEmail !== "string" ||
    !clienteEmail.trim() ||
    !emailValido(clienteEmail.trim())
  ) {
    throw new AppError("Dados do pedido são inválidos", 400, "DADOS_INVALIDOS");
  }

  // 2. Chamar reservarEstoque(produtoId, quantidade)
  // 3. Se a reserva falhar (erro 400/404/409/502), o fluxo encerra aqui e o pedido NÃO é criado
  const reserva = await reservarEstoque(produtoId, quantidade);

  // 4. Calcular total usando reserva.precoUnitario
  const total = Number((reserva.precoUnitario * quantidade).toFixed(2));

  // 5. Montar o objeto Pedido
  const novoPedido: Pedido = {
    id: proximoId++,
    produtoId,
    quantidade,
    precoUnitario: reserva.precoUnitario,
    total,
    clienteEmail: clienteEmail.trim(),
    status: "confirmado",
    notificacaoStatus: "nao_enviada",
    criadoEm: new Date().toISOString()
  };

  // 6. Adicionar ao array de Pedidos (REGRA: somente após a reserva confirmada)
  pedidos.push(novoPedido);

  // 7. Retornar o pedido para o controller
  return novoPedido;
}

export function listarPedidos(): Pedido[] {
  return pedidos;
}

export function buscarPedidoPorId(id: number): Pedido {
  if (typeof id !== "number" || isNaN(id)) {
    throw new AppError("ID do pedido é inválido", 400, "DADOS_INVALIDOS");
  }

  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido) {
    throw new AppError("Pedido não encontrado", 404, "PEDIDO_NAO_ENCONTRADO");
  }

  return pedido;
}

