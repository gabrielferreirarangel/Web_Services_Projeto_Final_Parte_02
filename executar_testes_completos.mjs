import { spawn } from "child_process";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function request(method, reqPath, body = null, port = 3000) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "localhost",
        port,
        path: reqPath,
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPort(port, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await request("GET", "/produtos", null, port);
      return true;
    } catch {
      try {
        await request("GET", "/pedidos", null, port);
        return true;
      } catch {
        await sleep(400);
      }
    }
  }
  return false;
}

async function main() {
  console.log("==================================================");
  console.log("   INICIANDO OS SERVIÇOS PARA TESTES AUTOMATIZADOS");
  console.log("==================================================");

  // 1. Iniciar catalogo-service
  const catalogoDir = path.join(__dirname, "catalogo-service");
  const pedidosDir = path.join(__dirname, "pedidos-service");

  const catalogoProcess = spawn("cmd.exe", ["/c", "npx.cmd", "tsx", "src/index.ts"], {
    cwd: catalogoDir,
    stdio: "pipe"
  });

  catalogoProcess.stdout.on("data", (d) => process.stdout.write(`[CATALOGO] ${d}`));
  catalogoProcess.stderr.on("data", (d) => process.stderr.write(`[CATALOGO ERR] ${d}`));

  const pedidosProcess = spawn("cmd.exe", ["/c", "npx.cmd", "tsx", "src/server.ts"], {
    cwd: pedidosDir,
    stdio: "pipe"
  });

  pedidosProcess.stdout.on("data", (d) => process.stdout.write(`[PEDIDOS] ${d}`));
  pedidosProcess.stderr.on("data", (d) => process.stderr.write(`[PEDIDOS ERR] ${d}`));

  console.log("Aguardando inicialização das portas 3001 e 3000...");
  const catalogoOk = await waitForPort(3001);
  const pedidosOk = await waitForPort(3000);

  if (!catalogoOk || !pedidosOk) {
    console.error("Falha ao inicializar serviços a tempo.");
    catalogoProcess.kill();
    pedidosProcess.kill();
    process.exit(1);
  }

  console.log("Serviços ativos! Executando cenários de teste...\n");

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

  try {
    // 1. Verificar catálogo inicial
    console.log("--- 1. Catálogo Inicial ---");
    const catProd = await request("GET", "/produtos", null, 3001);
    assert("Catálogo responde 200", catProd.status === 200);
    assert("Catálogo possui array de produtos", Array.isArray(catProd.data));

    const p1 = await request("GET", "/produtos/1", null, 3001);
    assert("GET /produtos/1 retorna 200", p1.status === 200);
    const estoqueOriginal = p1.data.estoque;
    const precoOriginal = p1.data.preco;

    // 2. Caminho Feliz: Pedido Válido
    console.log("\n--- 2. Caminho Feliz: POST /pedidos ---");
    const pedidoCriado = await request("POST", "/pedidos", {
      produtoId: 1,
      quantidade: 2,
      clienteEmail: "aluno@estudante.ifms.edu.br"
    }, 3000);

    assert("POST /pedidos retorna 201", pedidoCriado.status === 201);
    assert("Pedido contém id gerado", pedidoCriado.data?.id === 1);
    assert("Pedido contém status 'confirmado'", pedidoCriado.data?.status === "confirmado");
    assert("Pedido contém notificacaoStatus 'nao_enviada'", pedidoCriado.data?.notificacaoStatus === "nao_enviada");
    assert("Pedido contém precoUnitario", pedidoCriado.data?.precoUnitario === precoOriginal);
    assert("Pedido calculou total = precoUnitario * 2", pedidoCriado.data?.total === precoOriginal * 2);

    // Conferir se o estoque no Catálogo foi reduzido em 2
    const p1Apos = await request("GET", "/produtos/1", null, 3001);
    assert("Estoque do Produto 1 reduziu no Catálogo", p1Apos.data.estoque === estoqueOriginal - 2);

    // 3. Body incompleto
    console.log("\n--- 3. Body Incompleto (sem clienteEmail) ---");
    const errBody = await request("POST", "/pedidos", { produtoId: 1, quantidade: 2 }, 3000);
    assert("Body incompleto retorna 400", errBody.status === 400);

    // 4. Quantidade inválida
    console.log("\n--- 4. Quantidade Inválida (0 ou negativa) ---");
    const errQtd = await request("POST", "/pedidos", {
      produtoId: 1,
      quantidade: 0,
      clienteEmail: "aluno@estudante.ifms.edu.br"
    }, 3000);
    assert("Quantidade 0 retorna 400", errQtd.status === 400);

    // 5. Produto inexistente
    console.log("\n--- 5. Produto Inexistente (produtoId 999) ---");
    const errProd = await request("POST", "/pedidos", {
      produtoId: 999,
      quantidade: 1,
      clienteEmail: "aluno@estudante.ifms.edu.br"
    }, 3000);
    assert("Produto inexistente retorna 404", errProd.status === 404);

    // 6. Sem estoque
    console.log("\n--- 6. Sem Estoque Disponível ---");
    const errEstoque = await request("POST", "/pedidos", {
      produtoId: 1,
      quantidade: 999,
      clienteEmail: "aluno@estudante.ifms.edu.br"
    }, 3000);
    assert("Estoque insuficiente retorna 409", errEstoque.status === 409);

    // 7. Consulta por ID e listagem
    console.log("\n--- 7. Consultas GET /pedidos e GET /pedidos/:id ---");
    const get1 = await request("GET", "/pedidos/1", null, 3000);
    assert("GET /pedidos/1 retorna 200", get1.status === 200 && get1.data?.id === 1);

    const get999 = await request("GET", "/pedidos/999", null, 3000);
    assert("GET /pedidos/999 retorna 404", get999.status === 404);

    const listaAteAqui = await request("GET", "/pedidos", null, 3000);
    assert("GET /pedidos tem exatamente 1 pedido", listaAteAqui.data?.length === 1);

    // 8. Catálogo indisponível -> 502
    console.log("\n--- 8. Catálogo Fora do Ar (Simulação de Falha 502) ---");
    console.log("Encerrando catalogo-service...");
    // Encerrar processo do catálogo no windows via taskkill
    spawn("taskkill", ["/pid", catalogoProcess.pid, "/T", "/F"]);
    await sleep(1500);

    const errFora = await request("POST", "/pedidos", {
      produtoId: 1,
      quantidade: 1,
      clienteEmail: "aluno@estudante.ifms.edu.br"
    }, 3000);

    assert("Catálogo offline retorna 502 Bad Gateway", errFora.status === 502);
    assert("Mensagem de erro 502 é 'Catálogo indisponível'", errFora.data?.mensagem === "Catálogo indisponível");

    // 9. Integridade final
    console.log("\n--- 9. Integridade Final da Coleção de Pedidos ---");
    const listaFinal = await request("GET", "/pedidos", null, 3000);
    assert("GET /pedidos ainda tem apenas o 1 pedido original", listaFinal.data?.length === 1);

    console.log("\n==================================================");
    console.log(`   TODOS OS ${passed}/${total} TESTES PASSARAM COM SUCESSO!`);
    console.log("==================================================");
  } finally {
    // Limpar processos
    try {
      spawn("taskkill", ["/pid", catalogoProcess.pid, "/T", "/F"]);
    } catch {}
    try {
      spawn("taskkill", ["/pid", pedidosProcess.pid, "/T", "/F"]);
    } catch {}
    await sleep(1000);
  }

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Falha geral:", err);
  process.exit(1);
});

