const ventasPorHora = {};
const pedidosAcumulados = {}; // Para calcular el lead time (fechas de CREADO y ENTREGADO)
const pedidosActivos = {};    // Para saber el último estado activo de cada pedido
const ventasProductos = {};   // Para el ranking del Top 3

function aplicar(evento) {
  // Ej: "2026-11-04T06" (agrupamos por hora)
  const hora = evento.fecha.substring(0, 13); 

  // 1. ventasPorHora[cite: 6]
  if (evento.tipo === 'PEDIDO_CREADO') {
    ventasPorHora[hora] = (ventasPorHora[hora] || 0) + evento.total;
  } else if (evento.tipo === 'PEDIDO_CANCELADO') {
    ventasPorHora[hora] = (ventasPorHora[hora] || 0) - evento.total;
  }

  // 2. Acumulador para leadTimePromedioSeg[cite: 6]
  if (!pedidosAcumulados[evento.pedidoId]) pedidosAcumulados[evento.pedidoId] = {};
  if (evento.tipo === 'PEDIDO_CREADO') pedidosAcumulados[evento.pedidoId].creado = new Date(evento.fecha);
  if (evento.tipo === 'PEDIDO_ENTREGADO') pedidosAcumulados[evento.pedidoId].entregado = new Date(evento.fecha);

  // 3. pedidosPorEstado[cite: 6]
  if (['PEDIDO_ENTREGADO', 'PEDIDO_CANCELADO'].includes(evento.tipo)) {
    delete pedidosActivos[evento.pedidoId]; // Ya no está activo
  } else {
    pedidosActivos[evento.pedidoId] = evento.tipo;
  }

  // 4. topProductos
  if (evento.tipo === 'PEDIDO_CREADO' && evento.items) {
    for (const item of evento.items) {
      ventasProductos[item.productoId] = (ventasProductos[item.productoId] || 0) + item.cantidad;
    }
  }
}

function obtener() {
  // Calculamos el Lead Time al vuelo[cite: 6]
  let sumaSegundos = 0, cantidadEntregados = 0;
  for (const p of Object.values(pedidosAcumulados)) {
    if (p.creado && p.entregado) {
      sumaSegundos += (p.entregado - p.creado) / 1000;
      cantidadEntregados++;
    }
  }
  const leadTimePromedioSeg = cantidadEntregados ? (sumaSegundos / cantidadEntregados) : 0;

  // Calculamos el recuento de estados
  const pedidosPorEstado = {};
  for (const estado of Object.values(pedidosActivos)) {
    pedidosPorEstado[estado] = (pedidosPorEstado[estado] || 0) + 1;
  }

  // Ordenamos para sacar el Top 3
  const topProductos = Object.entries(ventasProductos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([productoId, unidades]) => ({ productoId, unidades }));

  return { ventasPorHora, leadTimePromedioSeg, pedidosPorEstado, topProductos };
}

module.exports = { aplicar, obtener };