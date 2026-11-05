# Projeto Integrador - Parte 2: Pedidos e Catálogo

Integração síncrona via HTTP entre os microsserviços de **Catálogo** e **Pedidos**.

---

## 1. Portas e Variáveis de Ambiente

- **Catálogo (`catalogo-service`)**: Porta `3001`
  - `.env`: `PORT=3001`
- **Pedidos (`pedidos-service`)**: Porta `3000`
  - `.env`:
    ```env
    PORT=3000
    CATALOG_URL=http://localhost:3001
    ```

---

## 2. Como Rodar

Abra dois terminais na raiz do projeto:

### Terminal 1 (Catálogo)
```bash
cd catalogo-service
npm install
npm run dev
```

### Terminal 2 (Pedidos)
```bash
cd pedidos-service
npm install
npm run dev
```

---

## 3. Endpoints

### Catálogo (:3001)
- `GET /produtos`: Lista produtos
- `GET /produtos/:id`: Detalha produto
- `POST /produtos`: Cria produto
- `POST /produtos/:id/reservas`: Reserva estoque
  - **Body:** `{"quantidade": 2}`
  - **Retorno 200:** `{"produtoId": 1, "reservado": 2, "precoUnitario": 4500, "estoqueRestante": 8}`

### Pedidos (:3000)
- `GET /pedidos`: Lista pedidos
- `GET /pedidos/:id`: Detalha pedido por ID
- `POST /pedidos`: Cria pedido (valida body, reserva estoque no catálogo e calcula o total)
  - **Body:**
    ```json
    {
      "produtoId": 1,
      "quantidade": 2,
      "clienteEmail": "aluno@estudante.ifms.edu.br"
    }
    ```
  - **Retorno 201:** Pedido confirmado com total calculado a partir do catálogo.

---

## 4. Respostas e Tratamento de Erros

| Status | Situação |
|---|---|
| `201` | Pedido criado com sucesso após reserva aceita |
| `400` | Dados inválidos (campos ausentes ou quantidade <= 0) |
| `404` | Produto não encontrado |
| `409` | Estoque insuficiente |
| `502` | Catálogo indisponível / fora do ar |

---

## 5. Testes

Para rodar todos os testes automatizados da Parte 2:

```bash
node executar_testes_completos.mjs
```
