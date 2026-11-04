// Puente SQS -> Kafka. En local simulamos los eventos de pedidos con este script.
//   npm run producer             -> 10 eventos con 3 pedidoId distintos
//   npm run producer -- 20       -> 20 eventos
//   npm run producer -- 12 1500  -> 12 eventos, uno cada 1,5 s (para verlos en vivo)
//   npm run producer -- --malo   -> JSON roto + evento sin pedidoId (terminan en la DLT)
//   npm run producer -- --falla  -> evento válido que report no puede procesar (reintentos + DLT)
const crypto = require('crypto');
const { Partitioners } = require('kafkajs');
const { crearKafka } = require('../shared/kafka');
const { crearEvento, validar } = require('../shared/dto');
const { PEDIDOS } = require('../shared/topics');

const producer = crearKafka('bridge').producer({
  idempotent: true,        // sin duplicados por red
  maxInFlightRequests: 1,
  createPartitioner: Partitioners.DefaultPartitioner,
});

async function publicar(datos, correlationId) {
  const evento = crearEvento(datos);
  const errores = validar(evento);
  
  // Validamos: Si dto.js devuelve un arreglo con errores o lanza error, lo atrapamos
  if (Array.isArray(errores) && errores.length) throw new Error(errores.join(', '));
  
  const [r] = await producer.send({
    topic: PEDIDOS,
    acks: -1,                // all
    messages: [{
      key: evento.pedidoId,  // mismo pedido, misma particion
      value: JSON.stringify(evento),
      headers: { correlationId },
    }],
  });
  console.log(`-> p${r.partition} off${r.baseOffset}  ${evento.pedidoId}  ${evento.tipo}`);
}

async function publicarCrudo(key, value) {
  await producer.send({
    topic: PEDIDOS,
    acks: -1,
    messages: [{ key, value, headers: { correlationId: crypto.randomUUID() } }],
  });
  console.log(`-> (crudo) ${value}`);
}

// 1. Agregado PEDIDO_EN_PREPARACION al flujo de estados
const FLUJO = ['PEDIDO_CREADO', 'PEDIDO_ACEPTADO', 'PEDIDO_EN_PREPARACION', 'PEDIDO_DESPACHADO', 'PEDIDO_ENTREGADO'];

// Le quitamos el total estático de aquí para calcularlo abajo
const PEDIDOS_DEMO = [
  { pedidoId: 'P-1001', clienteId: 'C-1' },
  { pedidoId: 'P-1002', clienteId: 'C-2' },
  { pedidoId: 'P-1003', clienteId: 'C-3' },
];

// 2. Catálogo de prueba para inyectar en PEDIDO_CREADO[cite: 4]
const ITEMS_MOCK = [
  { productoId: "PROD-1", cantidad: 2, precio: 8990 }, // Pizza familiar
  { productoId: "PROD-2", cantidad: 1, precio: 1990 }  // Bebida 1,5 L
];
const TOTAL_CORRECTO = 19970; // (2 * 8990) + (1 * 1990)

async function main() {
  const arg = process.argv[2];
  await producer.connect();

  if (arg === '--malo') {
    await publicarCrudo('P-ROTO', '{ esto no es JSON');
    await publicarCrudo('SIN-ID', JSON.stringify(crearEvento({ tipo: 'PEDIDO_CREADO', clienteId: 'C-9', total: 1000 })));
  } else if (arg === '--falla') {
    await publicar({ tipo: 'PEDIDO_CREADO', pedidoId: 'P-9999', clienteId: 'C-FALLA', total: 1000 }, crypto.randomUUID());
  } else if (arg === '--total-malo') {
    // 3. Caso especial que exige la rúbrica para probar la validación[cite: 4]
    await publicar({
      tipo: 'PEDIDO_CREADO',
      pedidoId: 'P-MALO',
      clienteId: 'C-9',
      version: 2,
      origen: 'web',
      actor: { usuario: "juan-cliente", rol: "CLIENTE" },
      items: ITEMS_MOCK,
      total: 99999 // Total intencionalmente falso[cite: 4]
    }, crypto.randomUUID());
  } else if (arg === '--salto') {
    await publicar({ 
      tipo: 'PEDIDO_CREADO', 
      pedidoId: 'P-2001', 
      clienteId: 'C-5', 
      version: 2, 
      origen: 'web', 
      actor: { usuario: 'cli', rol: 'CLIENTE' }, 
      items: ITEMS_MOCK, 
      total: TOTAL_CORRECTO 
    }, crypto.randomUUID());
    
    await publicar({ 
      tipo: 'PEDIDO_DESPACHADO', 
      pedidoId: 'P-2001', 
      clienteId: 'C-5', 
      version: 2, 
      origen: 'web', 
      actor: { usuario: 'op', rol: 'OPERADOR' },
      total: TOTAL_CORRECTO 
    }, crypto.randomUUID());
  } else if (arg === '--duplicado') {
    const payload = { tipo: 'PEDIDO_CREADO', pedidoId: 'P-DUP', clienteId: 'C-D', version: 2, origen: 'web', actor: { usuario: 'cli', rol: 'CLIENTE' }, items: ITEMS_MOCK, total: TOTAL_CORRECTO };
    await publicar(payload, crypto.randomUUID());
    await publicar(payload, crypto.randomUUID()); 
  }
    else {
    // Cada pedido avanza por su flujo
    const n = Number(arg) || 10;
    const pausa = Number(process.argv[3]) || 0;   // ms entre eventos
    for (let i = 0; i < n; i++) {
      const pedido = PEDIDOS_DEMO[i % PEDIDOS_DEMO.length];
      const tipo = FLUJO[Math.floor(i / PEDIDOS_DEMO.length) % FLUJO.length];
      
      // 4. Lógica de Actor: El Cliente crea, el Operador hace el resto[cite: 4]
      const actor = tipo === 'PEDIDO_CREADO' 
        ? { usuario: "juan-cliente", rol: "CLIENTE" } 
        : { usuario: "op-ana", rol: "OPERADOR" };

      await publicar({
        pedidoId: pedido.pedidoId,
        clienteId: pedido.clienteId,
        tipo,
        version: 2,
        origen: 'web',
        items: tipo === 'PEDIDO_CREADO' ? ITEMS_MOCK : undefined,
        total: TOTAL_CORRECTO,
        actor
      }, crypto.randomUUID());
      
      if (pausa) await new Promise(r => setTimeout(r, pausa));
    }
  }

  await producer.disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });