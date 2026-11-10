# NuKropAI Enterprise Kubernetes & Infrastructure Operational Guide

This document defines the production operational architecture, durability policies, and disaster recovery procedures for the NuKropAI enterprise platform running on Kubernetes.

---

## 1. Architectural Overview

The NuKropAI cluster infrastructure consists of:

| Component | Manifest | Replicas | Role & Persistence |
| :--- | :--- | :--- | :--- |
| **API Gateway / Backend** | `deployment.yaml` | 2-10 (HPA) | Stateless Fastify + TypeScript API handling REST, WebSockets, and JWT authentication. |
| **Mandi / AI Worker** | `worker-deployment.yaml` | 2 | Background processing workers consuming BullMQ queues for Agmarknet sync and foliar diagnostic tasks. |
| **Redis Broker & State** | `redis.yaml` | 1 (Recreate) | High-durability broker for BullMQ job queues and distributed rate-limiting. Backed by PVC. |
| **Network Security** | `network-policy.yaml` | - | Denies all cross-namespace traffic; strictly allows ingress to API and Redis access only to backend/worker pods. |
| **Pod Disruption** | `pdb.yaml` | - | Enforces minimum available replicas (`minAvailable: 1`) during cluster maintenance. |

---

## 2. Redis Durability & BullMQ Queue Integrity

### AOF Persistence
Redis is deployed with Append-Only File (AOF) persistence enabled:
```yaml
command: ["redis-server", "--appendonly", "yes", "--maxmemory", "512mb", "--maxmemory-policy", "noeviction"]
```
- **`--appendonly yes`**: Guarantees that every write operation to the BullMQ job queue (such as pending Agmarknet ETL batches or agro-chemical alerts) is recorded to disk (`/data/appendonly.aof`).
- **`--maxmemory-policy noeviction`**: Prevents Redis from evicting active BullMQ jobs under memory pressure. If memory reaches limits, Redis rejects writes rather than silently dropping agrarian pipeline tasks.

### Ephemeral Cache vs Durable Queue Separation
To prevent ephemeral HTTP cache eviction policies from degrading critical asynchronous queue durability:
- **Queue Database (`redis://...:6379/0`)**: Exclusively reserved for BullMQ durable jobs, retry backoffs, and farmer task state.
- **Cache Database (`redis://...:6379/1`)**: Used for volatile cached data (e.g. mandi price ticker caches) where keys have mandatory explicit TTLs (e.g. 900s).

---

## 3. Persistent Volume Claims (PVC) & Disaster Recovery

### Storage Architecture
- Claim Name: `nukropai-redis-pvc`
- Access Mode: `ReadWriteOnce`
- Mount Path: `/data` (holds `appendonly.aof` and `dump.rdb`)
- Storage Class: Configured with `reclaimPolicy: Retain` in production to prevent accidental data erasure upon pod termination.

### Disaster Recovery & Snapshot Procedure

#### Automated Volume Snapshot:
```bash
# Trigger volume snapshot via CSI driver
kubectl apply -f - <<EOF
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: nukropai-redis-snapshot-$(date +%Y%m%d%H%M)
  namespace: nukropai
spec:
  volumeSnapshotClassName: csi-aws-vsc # Or appropriate cloud CSI class
  source:
    persistentVolumeClaimName: nukropai-redis-pvc
EOF
```

#### Point-in-Time Recovery (PITR):
1. Scale down redis deployment to 0:
   ```bash
   kubectl scale deployment nukropai-redis --replicas=0 -n nukropai
   ```
2. Provision a new PVC restored from the latest valid `VolumeSnapshot`.
3. Update `claimName` in `redis.yaml` to the restored PVC.
4. Scale deployment back to 1:
   ```bash
   kubectl scale deployment nukropai-redis --replicas=1 -n nukropai
   ```
5. Verify Redis health:
   ```bash
   kubectl exec -it deployment/nukropai-redis -n nukropai -- redis-cli ping
   # Expected output: PONG
   ```

---

## 4. Secret Management & Authentication

All sensitive credentials (JWT signing secrets, Supabase Service Role keys, Redis passwords, external Government API keys) are strictly managed via Kubernetes Secrets:

```bash
# Apply secret template with populated production values
kubectl apply -f infra/k8s/secret-template.yaml -n nukropai
```

### Environment Variable Contract
Pods consume secrets via `envFrom: secretRef: name: nukropai-secrets`:
- `DATABASE_URL`: Primary PostgreSQL / Supabase connection URL.
- `JWT_SECRET`: 256-bit cryptographic signing secret for fail-closed authentication.
- `REDIS_PASSWORD`: Dynamic password protecting the Redis broker.
- `GOVT_API_KEY`: Mandatory API key for official Agmarknet data ingestion.

---

## 5. Network Isolation & Zero Trust Policies

The `network-policy.yaml` configuration enforces:
1. **Default Deny**: All ingress and egress traffic is denied by default across the `nukropai` namespace.
2. **Ingress Controller Exemption**: External HTTPS traffic is only admitted to `nukropai-backend` on port 3000 from the ingress controller.
3. **Internal Pod Comms**: Only pods labeled `app.kubernetes.io/name: nukropai-backend` and `app.kubernetes.io/name: nukropai-worker` are permitted to connect to Redis on port 6379.

