# NuKropAI — Enterprise Kubernetes Deployment Guide

## Executive Summary
This guide provides complete instructions for provisioning, configuring, and operating the NuKropAI enterprise backend on Kubernetes clusters (GKE, EKS, AKS, or bare-metal k8s).

---

## 1. Directory Structure (`infra/k8s/`)

```
infra/k8s/
├── namespace.yaml           # Dedicated namespace with Pod Security Standards (restricted)
├── serviceaccount.yaml      # Least-privilege ServiceAccount (automountServiceAccountToken: false)
├── network-policy.yaml      # Strict Ingress/Egress NetworkPolicy
├── configmap.yaml           # Environment variables & OpenTelemetry configuration
├── secret-template.yaml     # Template for sensitive credentials (DATABASE_URL, JWT_REFRESH_SECRET)
├── redis.yaml               # Redis deployment & ClusterIP service (BullMQ & Mandi cache)
├── deployment.yaml          # Fastify API Pods, rolling update, health probes
├── worker-deployment.yaml   # BullMQ background workers (mandi & land survey ingestion)
├── service.yaml             # ClusterIP service definition on port 80 -> 3000
├── hpa.yaml                 # Horizontal Pod Autoscaler (3-30 replicas)
├── ingress.yaml             # NGINX Ingress controller with automated TLS
└── pdb.yaml                 # Pod Disruption Budget (minAvailable: 2)
```

---

## 2. Deployment Instructions

### Step 1: Create Namespace
```bash
kubectl create namespace nukropai
```

### Step 2: Configure Secrets
```bash
cp infra/k8s/secret-template.yaml infra/k8s/secrets.yaml
# Edit infra/k8s/secrets.yaml with verified production credentials
kubectl apply -f infra/k8s/secrets.yaml
```

### Step 3: Apply Infrastructure Manifests
```bash
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f infra/k8s/deployment.yaml
kubectl apply -f infra/k8s/service.yaml
kubectl apply -f infra/k8s/hpa.yaml
kubectl apply -f infra/k8s/pdb.yaml
kubectl apply -f infra/k8s/ingress.yaml
```

### Step 4: Verify Cluster Health
```bash
kubectl get pods -n nukropai -o wide
kubectl get svc -n nukropai
kubectl get hpa -n nukropai
kubectl get ingress -n nukropai
```

---

## 3. High-Availability & Disaster Recovery
- **Rolling Updates**: `maxSurge: 25%`, `maxUnavailable: 0` ensures zero dropped requests during new version rollouts.
- **Graceful Termination**: `preStop` hook sleeps for 5 seconds allowing active HTTP keep-alive connections to finish while new traffic routes away.
- **Horizontal Pod Autoscaling**: Automatically scales between 3 and 30 replicas based on 70% CPU and 80% Memory thresholds.

