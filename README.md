# Web Services — Projeto Integrador (Parte 2)
**Instituto Federal de Mato Grosso do Sul (IFMS)**  
**Curso:** Tecnologia em Sistemas para Internet (TSI)  
**Disciplina:** Web Services  
**Etapa:** Parte 2 — Pedidos e comunicação síncrona com Catálogo/Estoque  

---

## 1. Visão Geral da Etapa

Nesta segunda parte do projeto, o sistema passa a ter uma integração síncrona real entre dois microsserviços independentes rodando em processos e portas distintas:

1. **`catalogo-service` (Porta 3001)**:
   - Dono das informações de produtos, preços e quantidade de estoque.
   - Fornece operações de consulta e reserva de produtos.
   - Atualizado para retornar `precoUnitario` na reserva, garantindo dados confiáveis para o cálculo do pedido.

2. **`pedidos-service` (Porta 3000)**:
   - Orquestra a criação de pedidos.
   - Valida os dados enviados pelo cliente.
   - Solicita reserva ao `catalogo-service` via HTTP (`fetch`).
   - Calcula o total com base no preço fornecido pelo catálogo.
   - Persiste o pedido **apenas após** a reserva ser aceita com sucesso.
   - Traduz respostas de erro do catálogo (`400`, `404`, `409`, `502`) de forma padronizada para o cliente.

```
                      +-------------------+
                      |   Cliente HTTP    |
                      |  (Thunder Client) |
                      +---------+---------+
                                |
                   POST /pedidos | (produtoId, quantidade, clienteEmail)
                                v
                      +---------+---------+
                      |  pedidos-service  | (Porta 3000)
                      +---------+---------+
                                |
         POST /produtos/:id/reservas | (quantidade)
                                v
                      +---------+---------+
                      | catalogo-service  | (Porta 3001)
                      +-------------------+
```

---

## 2. Configurações e Variáveis de Ambiente

### `catalogo-service`
- Arquivo `.env`:
  ```env
  PORT=3001
  ```
- Arquivo versionado de exemplo: `.env.example`

### `pedidos-service`
- Arquivo `.env`:
  ```env
  PORT=3000
  CATALOG_URL=http://localhost:3001
  ```
- Arquivo versionado de exemplo: `.env.example`

> **Nota de Segurança e Boas Práticas:** Os arquivos `.env` contêm configurações locais de ambiente e estão listados no `.gitignore`. Apenas `.env.example` é versionado no Git.

---

## 3. Como Instalar e Executar

### Pré-requisitos
- Node.js (v18 ou superior)
- npm

### Passo 1: Instalar dependências

Abra o terminal na raiz do projeto e instale as dependências de cada serviço:

```bash
# Instalar catalogo-service
cd catalogo-service
npm install

# Instalar pedidos-service
cd ../pedidos-service
npm install
```

### Passo 2: Executar os serviços em dois terminais

#### Terminal 1 — Iniciar Catálogo
```bash
cd catalogo-service
npm run dev
```
*Saída esperada:* `[CATALOGO] Rodando na porta 3001`

#### Terminal 2 — Iniciar Pedidos
```bash
cd pedidos-service
npm run dev
```
*Saída esperada:* `[PEDIDOS] Rodando na porta 3000`

---

## 4. Documentação dos Endpoints

### 4.1. Catálogo (`http://localhost:3001`)

| Método | Rota | Descrição | Status de Sucesso |
|---|---|---|---|
| `GET` | `/produtos` | Lista todos os produtos cadastrados | `200 OK` |
| `GET` | `/produtos/:id` | Retorna os detalhes de um produto | `200 OK` (ou `404 Not Found`) |
| `POST` | `/produtos` | Cadastra um novo produto | `201 Created` (ou `400 Bad Request`) |
| `POST` | `/produtos/:id/reservas` | Reserva unidades de estoque do produto | `200 OK` (ou `400`, `404`, `409`) |

#### Exemplo de Reserva de Estoque (`POST /produtos/1/reservas`)
- **Body enviado:**
  ```json
  {
    "quantidade": 2
  }
  ```
- **Resposta `200 OK` (Contrato atualizado da Parte 2):**
  ```json
  {
    "produtoId": 1,
    "reservado": 2,
    "precoUnitario": 4500,
    "estoqueRestante": 8
  }
  ```

---

### 4.2. Pedidos (`http://localhost:3000`)

| Método | Rota | Descrição | Status de Sucesso |
|---|---|---|---|
| `POST` | `/pedidos` | Cria um pedido após reserva no catálogo | `201 Created` |
| `GET` | `/pedidos` | Lista os pedidos locais cadastrados | `200 OK` |
| `GET` | `/pedidos/:id` | Retorna um pedido específico por ID | `200 OK` (ou `404 Not Found`) |

#### Contrato de Criação de Pedido (`POST /pedidos`)
- **Body enviado pelo cliente:**
  ```json
  {
    "produtoId": 1,
    "quantidade": 2,
    "clienteEmail": "aluno@estudante.ifms.edu.br"
  }
  ```
  *(O cliente não envia preço nem total: o preço vem do Catálogo e o total é calculado no Pedidos)*

- **Resposta `201 Created`:**
  ```json
  {
    "id": 1,
    "produtoId": 1,
    "quantidade": 2,
    "precoUnitario": 4500,
    "total": 9000,
    "clienteEmail": "aluno@estudante.ifms.edu.br",
    "status": "confirmado",
    "notificacaoStatus": "nao_enviada",
    "criadoEm": "2026-11-05T02:50:00.000Z"
  }
  ```

---

## 5. Bateria de Testes (Caminho Feliz e Tratamento de Erros)

| Cenário | Requisição | Esperado | Comportamento |
|---|---|---|---|
| **1. Pedido válido** | `POST http://localhost:3000/pedidos` <br> `{"produtoId": 1, "quantidade": 2, "clienteEmail": "aluno@estudante.ifms.edu.br"}` | `201 Created` | Pedido é criado com `total` calculado (`precoUnitario * quantidade`). O estoque do Catálogo reduz. |
| **2. Body incompleto** | `POST http://localhost:3000/pedidos` sem `clienteEmail` | `400 Bad Request` | Pedidos valida antes da chamada e rejeita a criação. Nenhum pedido é salvo. |
| **3. Quantidade inválida** | `POST http://localhost:3000/pedidos` com `quantidade: 0` | `400 Bad Request` | Rejeitado por validação. |
| **4. Produto inexistente** | `POST http://localhost:3000/pedidos` com `produtoId: 999` | `404 Not Found` | Catálogo responde 404, Pedidos traduz para 404. Nenhum pedido salvo. |
| **5. Sem estoque** | `POST http://localhost:3000/pedidos` com quantidade acima do disponível | `409 Conflict` | Catálogo recusa com 409, Pedidos traduz para 409. Nenhum pedido salvo. |
| **6. Catálogo fora do ar** | Desligar Catálogo (:3001) e chamar `POST /pedidos` | `502 Bad Gateway` | Pedidos trata falha de rede/conexão e responde 502 controlado sem stack trace. |
| **7. Integridade após erros** | `GET http://localhost:3000/pedidos` | `200 OK` | Apenas os pedidos de requisições bem-sucedidas constam na listagem. |
| **8. Consulta por ID** | `GET http://localhost:3000/pedidos/1` | `200 OK` ou `404 Not Found` | Retorna o pedido existente ou 404 se não existir. |

---

## 6. Estrutura do Projeto

```
Web_Services_Projeto_Final_Parte_02/
├── .gitignore
├── README.md
├── catalogo-service/
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types.ts
│       └── index.ts
└── pedidos-service/
    ├── .env
    ├── .env.example
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── types.ts
        ├── errors/
        │   └── app.error.ts
        ├── data/
        │   └── pedidos.ts
        ├── clients/
        │   └── catalogo.client.ts
        ├── services/
        │   └── pedidos.service.ts
        ├── controllers/
        │   └── pedidos.controller.ts
        ├── routes/
        │   └── pedidos.routes.ts
        └── server.ts
```

---

## 7. Checklist da Entrega (Parte 2)

- [x] Catálogo inicia em `:3001` e Pedidos inicia em `:3000`.
- [x] `CATALOG_URL` lido a partir das variáveis de ambiente (`process.env.CATALOG_URL`).
- [x] Reserva devolve `precoUnitario` no sucesso (`200 OK`).
- [x] `POST /pedidos` valida `produtoId`, `quantidade` e `clienteEmail`.
- [x] O cliente **não** envia preço nem total (calculado internamente).
- [x] Pedido só é persistido (`pedidos.push`) após confirmação da reserva no catálogo.
- [x] Status `400`, `404` e `409` tratados corretamente.
- [x] Catálogo indisponível gera `502 Bad Gateway` controlado e limpo (sem stack trace).
- [x] `GET /pedidos` e `GET /pedidos/:id` funcionando.
- [x] `README.md` documentando arquitetura, endpoints, variáveis e testes.
- [x] `.env` e `node_modules` ignorados pelo `.gitignore`.
