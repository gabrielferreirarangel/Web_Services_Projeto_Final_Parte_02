import { Request, Response, NextFunction } from "express";
import * as pedidoService from "../services/pedidos.service";

export async function criar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pedido = await pedidoService.criarPedido(req.body);
    res.status(201).json(pedido);
  } catch (error) {
    next(error);
  }
}

export function listar(_req: Request, res: Response, next: NextFunction): void {
  try {
    const lista = pedidoService.listarPedidos();
    res.status(200).json(lista);
  } catch (error) {
    next(error);
  }
}

export function buscarPorId(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = Number(req.params.id);
    const pedido = pedidoService.buscarPedidoPorId(id);
    res.status(200).json(pedido);
  } catch (error) {
    next(error);
  }
}
