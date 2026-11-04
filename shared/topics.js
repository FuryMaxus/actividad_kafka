// Nombres y configuración de los tópicos (cada número tiene una razón)
const PEDIDOS = 'pedidos.eventos';
const DLT_REPORT = `${PEDIDOS}.report.dlt`;
const DLT_AUDIT = `${PEDIDOS}.audit.dlt`;
const TIMELINE = 'audit.timeline';

const TOPICOS = [
  // Tópico principal de eventos de pedidos (3 particiones para escalar, retención de 7 días)
  { topic: PEDIDOS, particiones: 3, retencionDias: 7, cleanupPolicy: 'delete' },
  
  // DLT específica para el consumidor 'report' (retención de 14 días para análisis)
  { topic: DLT_REPORT, particiones: 3, retencionDias: 14, cleanupPolicy: 'delete' },
  
  // DLT específica para el consumidor 'audit' (retención de 14 días)
  { topic: DLT_AUDIT, particiones: 3, retencionDias: 14, cleanupPolicy: 'delete' },
  
  // Tópico de auditoría en línea de tiempo (compact, delete con 30 días de retención)
  { topic: TIMELINE, particiones: 3, retencionDias: 30, cleanupPolicy: 'compact,delete' },
];

module.exports = { PEDIDOS, DLT: DLT_REPORT, TOPICOS };