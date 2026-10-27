import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const traceExporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces', // Send to Jaeger
});

export const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: 'nukrop-iot-gateway',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

// Initialize early
sdk.start();
console.log('[Tracing] OpenTelemetry SDK initialized. Exporting traces to Jaeger.');

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('[Tracing] SDK shut down successfully'))
    .catch((error) => console.log('[Tracing] Error shutting down SDK', error))
    .finally(() => process.exit(0));
});
