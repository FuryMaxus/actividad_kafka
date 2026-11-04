const crypto = require('crypto');

const TIPOS = ['PEDIDO_CREADO', 'PEDIDO_ACEPTADO',
  'PEDIDO_EN_PREPARACION',
  'PEDIDO_DESPACHADO', 'PEDIDO_ENTREGADO',
  'PEDIDO_CANCELADO'];

function crearEvento(d) {
  return {
    eventId: d.eventId || crypto.randomUUID(),
    tipo: d.tipo,
    pedidoId: d.pedidoId,
    clienteId: d.clienteId,
    total: d.total,
    version: d.version,     
    origen: d.origen,       
    actor: d.actor,         
    items: d.items,
    fecha: d.fecha || new Date().toISOString(),
  };
}

function validar(e) {
  const err = [];

  if (e.version !== 2) throw new Error("El evento debe ser version 2");
  if (!e.origen) throw new Error("Falta el campo origen");
  if (!e.actor || !e.actor.usuario || !['CLIENTE', 'OPERADOR', 'ADMIN'].includes(e.actor.rol)) {
    throw new Error("Actor invalido o rol incorrecto");
  }
  if (e.tipo === 'PEDIDO_CREADO') {
    if (!e.items || e.items.length === 0) {
      throw new Error("El pedido creado debe tener items");
    }
    
    let sumaCalculada = 0;
    for (const item of e.items) {
      if (item.cantidad <= 0) throw new Error("La cantidad del item debe ser > 0");
      sumaCalculada += (item.cantidad * item.precio);
    }

    if (e.total !== sumaCalculada) {
      throw new Error(`El total (${e.total}) no cuadra con la suma de items (${sumaCalculada})`);
    }
  }
  if (!e.eventId) err.push('eventId requerido');
  if (!TIPOS.includes(e.tipo)) err.push('tipo invalido');
  if (!e.pedidoId) err.push('pedidoId requerido');
  if (typeof e.total !== 'number') err.push('total');
  return err;   // [] = valido
}

module.exports = { TIPOS, crearEvento, validar };
