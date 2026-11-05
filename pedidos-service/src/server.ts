import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import pedidosRoutes from "./routes/pedidos.routes";
import { AppError } from "./errors/app.error";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SERVICE_NAME = "PEDIDOS";

// Rotas do serviço
app.use(pedidosRoutes);

// Rota não encontrada
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    mensagem: "Rota não encontrada",
    codigo: "ROTA_NAO_ENCONTRADA"
  });
});

// Middleware de tratamento de erros global
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      mensagem: err.message,
      codigo: err.codigo
    });
    return;
  }

  // Falha de parse de JSON ou erro inesperado (sem stack trace)
  const status = typeof err.status === "number" ? err.status : 500;
  const mensagem = status === 400 ? "Dados do pedido são inválidos" : "Erro interno no servidor";
  const codigo = status === 400 ? "DADOS_INVALIDOS" : "ERRO_INTERNO";

  res.status(status).json({
    mensagem,
    codigo
  });
});

app.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] Rodando na porta ${PORT}`);
});
