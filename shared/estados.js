const TRANSICIONES = {
  'null': ['PEDIDO_CREADO'], // Estado inicial (ninguno)
  'PEDIDO_CREADO': ['PEDIDO_ACEPTADO', 'PEDIDO_CANCELADO'],
  'PEDIDO_ACEPTADO': ['PEDIDO_EN_PREPARACION', 'PEDIDO_CANCELADO'],
  'PEDIDO_EN_PREPARACION': ['PEDIDO_DESPACHADO', 'PEDIDO_CANCELADO'],
  'PEDIDO_DESPACHADO': ['PEDIDO_ENTREGADO'],
  'PEDIDO_ENTREGADO': [],
  'PEDIDO_CANCELADO': []
};

function transicionValida(anterior, nuevo) {
  const estadoAnterior = anterior || 'null';
  const posibles = TRANSICIONES[estadoAnterior] || [];
  return posibles.includes(nuevo);
}

module.exports = { transicionValida };