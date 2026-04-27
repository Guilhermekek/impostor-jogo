// ══════════════════════════════════════════════════════════════
//  security-check-ci.js — Versão para GitHub Actions
//
//  Diferenças do security-test.js:
//  - Sem prompt nem auditoria de privacidade (não precisa de sala)
//  - Saída no formato adequado pro CI (logs claros, exit code)
//  - process.exit(1) se qualquer ataque passar
// ══════════════════════════════════════════════════════════════

const PROJECT = 'impostorjogo-76625';
const DB_URL  = `https://${PROJECT}-default-rtdb.firebaseio.com`;

const tests = [
  { method: 'GET',  path: 'rooms',                    name: 'Listar todas as salas' },
  { method: 'GET',  path: 'admin',                    name: 'Ler /admin' },
  { method: 'GET',  path: 'users',                    name: 'Ler /users' },
  { method: 'GET',  path: 'config',                   name: 'Ler /config' },
  { method: 'GET',  path: 'rooms/AB',                 name: 'Sala com código curto demais' },
  { method: 'GET',  path: 'rooms/CODIGOSUPERLONGOABC', name: 'Sala com código longo demais' },
  { method: 'PUT',  path: 'hacked',                   name: 'Escrever em /hacked',     body: { evil: 'data' } },
  { method: 'PUT',  path: 'admin/keys',               name: 'Escrever em /admin/keys', body: { stolen: true } },
  { method: 'PUT',  path: 'users/me',                 name: 'Escrever em /users/me',   body: { fake: true } },
];

(async () => {
  console.log('═══════════════════════════════════════');
  console.log('  AUDITORIA DE SEGURANÇA (CI)');
  console.log(`  Projeto: ${PROJECT}`);
  console.log(`  Data: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════\n');

  const failures = [];

  for (const t of tests) {
    const opts = { method: t.method };
    if (t.body) {
      opts.body = JSON.stringify(t.body);
      opts.headers = { 'Content-Type': 'application/json' };
    }

    let status, body;
    try {
      const r = await fetch(`${DB_URL}/${t.path}.json`, opts);
      status = r.status;
      body   = (await r.text()).slice(0, 100);
    } catch (e) {
      status = 0;
      body   = `Erro de rede: ${e.message}`;
    }

    const blocked = status === 401;
    const icon    = blocked ? '✅' : '❌';
    console.log(`${icon} [${t.method} /${t.path}] ${t.name}`);
    console.log(`   HTTP ${status} ${blocked ? '(bloqueado)' : '(ATAQUE PASSOU!)'}`);

    if (!blocked) {
      failures.push({ ...t, status, body });
    }
  }

  console.log('\n═══════════════════════════════════════');
  if (failures.length === 0) {
    console.log(`✅ TODOS OS ${tests.length} ATAQUES FORAM BLOQUEADOS`);
    console.log('═══════════════════════════════════════');
    process.exit(0);
  } else {
    console.log(`❌ ${failures.length}/${tests.length} ATAQUES PASSARAM`);
    console.log('═══════════════════════════════════════');
    console.log('\nFalhas detectadas:');
    failures.forEach(f => console.log(`  • ${f.name} → HTTP ${f.status}: ${f.body}`));
    console.log('\n⚠️  Revisar regras do Realtime Database imediatamente.');
    process.exit(1);
  }
})();
