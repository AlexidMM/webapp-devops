// instrumentation.js
import { register } from 'node:module';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

const ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT; // http://<host>:5080/api/default
const USER = process.env.OTEL_EXPORTER_OTLP_USER;         // email del root de OO
const PASS = process.env.OTEL_EXPORTER_OTLP_PASS;         // password del root de OO

if (ENDPOINT && USER && PASS) {
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

  const auth = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: `${ENDPOINT}/v1/traces`,
      headers: { Authorization: auth, 'stream-name': 'app_traces' },
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${ENDPOINT}/v1/metrics`,
        headers: { Authorization: auth },
      }),
      exportIntervalMillis: 10_000,
    }),
    logRecordProcessors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({
          url: `${ENDPOINT}/v1/logs`,
          headers: { Authorization: auth, 'stream-name': 'app_logs' },
        })
      ),
    ],
    instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
  });

  sdk.start();
  console.log(`[OTEL] Exportando a ${ENDPOINT}`);

  const shutdown = () => sdk.shutdown().finally(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} else {
  console.log('[OTEL] Deshabilitado (faltan OTEL_EXPORTER_OTLP_ENDPOINT/USER/PASS)');
}