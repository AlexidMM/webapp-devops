import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { trace } from '@opentelemetry/api';

const otelLogger = logs.getLogger('webapp-devops');

const SEVERITY = {
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

const horaMexico = () =>
  new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City', hour12: false });

/**
 * Log estructurado: sale por consola (JSON) y se emite por OTLP a OpenObserve.
 * Si el SDK de OpenTelemetry no está activo, la parte OTLP es un no-op.
 */
export function log(level, message, attributes = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    timestamp_mx: horaMexico(),
    level,
    message,
    ...attributes,
  };

  if (process.env.NODE_ENV !== 'test') {
    console.log(JSON.stringify(record));
  }

  const spanContext = trace.getActiveSpan()?.spanContext();

  otelLogger.emit({
    severityNumber: SEVERITY[level] ?? SeverityNumber.INFO,
    severityText: level.toUpperCase(),
    body: message,
    attributes: {
      timestamp_mx: record.timestamp_mx,
      ...(spanContext ? { trace_id: spanContext.traceId, span_id: spanContext.spanId } : {}),
      ...attributes,
    },
  });
}