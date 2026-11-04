const { iniciarConsumidor } = require('../shared/consumidor');
const { crearKafka } = require('../shared/kafka');

// Creamos un productor exclusivo para audit[cite: 8]
const kafka = crearKafka('audit-producer');
const producer = kafka.producer();

async function procesar(evento) {
  // Aquí se publica en el timeline de auditoría legible[cite: 8]
  const registro = {
    pedidoId: evento.pedidoId,
    quien: evento.actor ? `${evento.actor.usuario} (${evento.actor.rol})` : 'desconocido',
    que: evento.tipo,
    cuando: evento.fecha,
    desdeDonde: evento.origen || 'desconocido',
    eventId: evento.eventId || 'n/a'
  };

  await producer.send({
    topic: 'audit.timeline',
    messages: [{
      key: evento.pedidoId, 
      value: JSON.stringify(registro)
    }]
  });
  
  console.log(`[audit] Guardado en timeline: ${registro.que} por ${registro.quien}`);
}

async function start() {
  await producer.connect();
  // Iniciamos el consumidor con su propio grupo "audit"[cite: 8]
  await iniciarConsumidor({ clientId: 'audit-client', groupId: 'audit', procesar, fromBeginning: true })
    .catch(console.error);
}

start();