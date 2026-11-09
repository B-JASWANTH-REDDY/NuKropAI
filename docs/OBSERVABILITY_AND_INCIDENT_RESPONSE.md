# NuKropAI — Observability, Telemetry & Incident Response Runbook

## Executive Summary
This document establishes the enterprise observability framework (Metrics, Logs, Traces) and on-call incident response protocols for NuKropAI production operations.

---

## 1. The Three Pillars of Observability

### A. Metrics (Prometheus & Grafana)
- Exposed at `GET /metrics` via `prom-client`.
- **System Metrics**: Process CPU, resident memory, garbage collection duration, event loop lag.
- **Agrarian Domain Metrics**:
  - `nukrop_mandi_queries_total`: Count of APMC rate queries partitioned by state and crop.
  - `nukrop_scanner_diagnostics_total`: Foliar scans partitioned by disease tag and authenticity status.
  - `nukrop_gramhaul_trips_total`: Freight trips partitioned by status (`REQUESTED`, `IN_TRANSIT`, `COMPLETED`).
  - `nukrop_iot_telemetry_latency_seconds`: Latency histogram for smart pump motor commands.

### B. Structured Logging (Pino & Loki)
- Standardized JSON formatting with fields: `level`, `time`, `pid`, `reqId`, `userId`, `traceId`, `msg`.
- Masking filters sanitize phone numbers, passwords, and tokens before log emission.

### C. Distributed Tracing (OpenTelemetry)
- Context propagation over W3C Trace Context headers (`traceparent`, `tracestate`).
- Exporter dispatches spans to OpenTelemetry Collector over HTTP (`:4318`).

---

## 2. Severity Levels & Incident Response Matrix

| Severity | Definition | Response SLA | Action Protocol |
| :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)**| Core service down (Auth failure, Database offline, >5% 5xx errors) | < 15 minutes | Auto-page On-Call Architect; trigger traffic failover; rollback recent deployment |
| **SEV-2 (Major)** | Major feature degraded (Mandi price ingestion lag, Scanner latency > 5s) | < 30 minutes | Alert secondary engineer; switch to cached mandi fallback; inspect external API quotas |
| **SEV-3 (Minor)** | Minor UI cosmetic glitch, single non-critical error | < 4 hours | Create Jira/GitHub issue for standard sprint triage |

---

## 3. Disaster Recovery & Rollback Procedure
1. Roll back Kubernetes deployment:
   ```bash
   kubectl rollout undo deployment/nukropai-backend -n nukropai
   ```
2. Verify rollback pod health:
   ```bash
   kubectl rollout status deployment/nukropai-backend -n nukropai
   ```
