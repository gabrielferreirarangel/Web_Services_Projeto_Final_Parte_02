// Script de automação de testes para a Parte 2 do Projeto Integrador de Web Services
import http from "http";

const CATALOG_PORT = 3001;
const PEDIDOS_PORT = 3000;

function request(method, path, body = null, port = PEDIDOS_PORT) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "localhost",
        port,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {})
        }
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(responseBody);
          } catch {
            json = responseBody;
          }
          resolve({ status: res.statusCode, data: json });
        });
      }
    );

    req.on("error", (err) => {
      reject(err);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function run() {
  console.log("==================================================");
  console.log("   INICIANDO BATERIA DE TESTES - PARTE 2");
  console.log("==================================================\n");

  let passed = 0;
  let total = 0;

  function assert(title, condition, extraInfo = "") {
    total++;
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title} - ${extraInfo}`);
    }
  }

  // 1. Verificar catálogo direto
  console.log("--- 1. Testando Catálogo diretamente ---");
  const catProdutos = await request("GET", "/produtos", null, CATALOG_PORT);
  assert("Catálogo responde GET /produtos com 200", catProdutos.status === 200);
  assert("Catálogo possui produtos iniciais", Array.isArray(catProdutos.data) && catProdutos.data.length >= 3);

  const produto1Antes = await request("GET", "/produtos/1", null, CATALOG_PORT);
  assert("GET /produtos/1 retorna 200", produto1Antes.status === 200);
  const estoqueOriginal = produto1Antes.data.estoque;
  const precoProduto1 = produto1Antes.data.preco;
  console.log(`Produto 1: Estoque = ${estoqueOriginal}, Preco = ${precoProduto1}`);

  // 2. Caminho feliz: Pedido válido
  console.log("\n--- 2. Cenário: Pedido Válido (Caminho Feliz) ---");
  const qtdPedido = 2;
  const pedidoValido = await request("POST", "/pedidos", {
    produtoId: 1,
    quantidade: qtdPedido,
    clienteEmail: "aluno@estudante.ifms.edu.br"
  });

  assert("POST /pedidos retorna status 201", pedidoValido.status === 201, `Recebeu ${pedidoValido.status}`);
  assert("Pedido contém id gerado", pedidoValido.data?.id === 1);
  assert("Pedido contém status 'confirmado'", pedidoValido.data?.status === "confirmado");
  assert("Pedido contém notificacaoStatus 'nao_enviada'", pedidoValido.data?.notificacaoStatus === "nao_enviada");
  assert("Pedido contém precoUnitario vindo do catálogo", pedidoValido.data?.precoUnitario === precoProduto1);
  assert("Pedido calculou total correto (precoUnitario * quantidade)", pedidoValido.data?.total === precoProduto1 * qtdPedido);

  // Verificar se o estoque no catálogo foi reduzido
  const produto1Depois = await request("GET", "/produtos/1", null, CATALOG_PORT);
  assert(
    "Estoque no Catálogo reduziu exatamente a quantidade pedida",
    produto1Depois.data.estoque === estoqueOriginal - qtdPedido,
    `Esperado: ${estoqueOriginal - qtdPedido}, Atual: ${produto1Depois.data.estoque}`
  );

  // 3. Body incompleto
  console.log("\n--- 3. Cenário: Body incompleto (sem clienteEmail) ---");
  const bodyIncompleto = await request("POST", "/pedidos", {
    produtoId: 1,
    quantidade: 1
  });
  assert("Body incompleto retorna status 400", bodyIncompleto.status === 400, `Recebeu ${bodyIncompleto.status}`);

  // 4. Quantidade inválida
  console.log("\n--- 4. Cenário: Quantidade inválida (0 ou negativa) ---");
  const qtdInvalida = await request("POST", "/pedidos", {
    produtoId: 1,
    quantidade: 0,
    clienteEmail: "aluno@estudante.ifms.edu.br"
  });
  assert("Quantidade = 0 retorna status 400", qtdInvalida.status === 400, `Recebeu ${qtdInvalida.status}`);

  // 5. Produto inexistente
  console.log("\n--- 5. Cenário: Produto Inexistente (produtoId: 999) ---");
  const produtoInexistente = await request("POST", "/pedidos", {
    produtoId: 999,
    quantidade: 1,
    clienteEmail: "aluno@estudante.ifms.edu.br"
  });
  assert("Produto inexistente retorna status 404", produtoInexistente.status === 404, `Recebeu ${produtoInexistente.status}`);

  // 6. Sem estoque suficiente
  console.log("\n--- 6. Cenário: Sem Estoque Suficiente ---");
  const semEstoque = await request("POST", "/pedidos", {
    produtoId: 1,
    quantidade: 9999,
    clienteEmail: "aluno@estudante.ifms.edu.br"
  });
  assert("Quantidade acima do estoque retorna status 409", semEstoque.status === 409, `Recebeu ${semEstoque.status}`);

  // 7. Integridade após erros
  console.log("\n--- 7. Cenário: Integridade da Coleção após Erros ---");
  const listaPedidos = await request("GET", "/pedidos");
  assert("GET /pedidos retorna status 200", listaPedidos.status === 200);
  assert(
    "Nenhum pedido indevido foi persistido (somente o pedido válido original)",
    Array.isArray(listaPedidos.data) && listaPedidos.data.length === 1,
    `Tamanho atual da lista: ${listaPedidos.data?.length}`
  );

  // 8. Consulta por ID
  console.log("\n--- 8. Cenário: Consulta de Pedido por ID ---");
  const consultaExistente = await request("GET", "/pedidos/1");
  assert("GET /pedidos/1 retorna 200 para pedido existente", consultaExistente.status === 200);
  assert("GET /pedidos/1 possui dados consistentes", consultaExistente.data?.id === 1);

  const consultaInexistente = await request("GET", "/pedidos/999");
  assert("GET /pedidos/999 retorna 404 para pedido inexistente", consultaInexistente.status === 404);

  console.log("\n==================================================");
  console.log(`   RESULTADO: ${passed}/${total} TESTES PASSARAM COM SUCESSO!`);
  console.log("==================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Erro na execução dos testes:", err);
  process.exit(1);
});
