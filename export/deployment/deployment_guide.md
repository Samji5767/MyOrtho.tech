# MyOrtho.tech - Production Deployment Guide

This guide details the procedure for deploying the **MyOrtho.tech** enterprise suite to a production-grade Kubernetes cluster.

---

## Prerequisites

1. **Kubernetes Cluster**: v1.26+ cluster running in a high-availability configuration across multiple zones (e.g., AWS EKS, Google GKE).
2. **Tools**: 
   - `kubectl` configured with admin credentials.
   - `helm` v3+ for package deployment.
3. **Cluster Ingress**: NGINX Ingress Controller installed in the cluster.
4. **Cert-Manager**: Installed for Let's Encrypt automated TLS certificate issuance.

---

## Step 1: Secret Configuration

Create the required namespace and inject production secrets before launching the Helm chart.

```bash
# Create namespace
kubectl create namespace myortho-prod

# Create database and API keys secret
kubectl create secret generic myortho-secrets \
  --namespace myortho-prod \
  --from-literal=database-url="postgresql://postgres:prod-secure-password@db.myortho.tech:5432/myortho" \
  --from-literal=supabase-url="https://prod-supabase-project.supabase.co" \
  --from-literal=supabase-anon-key="eyJhbGciOi..."
```

---

## Step 2: Deploying with Helm

Navigate to the Helm chart folder and release the templates.

```bash
# Verify Helm templates render correctly
helm template myortho ./deployment/k8s/helm -f ./deployment/k8s/helm/myortho-values.yaml

# Deploy the release
helm upgrade --install myortho ./deployment/k8s/helm \
  --namespace myortho-prod \
  -f ./deployment/k8s/helm/myortho-values.yaml \
  --create-namespace
```

---

## Step 3: Verify Pod and Scale Status

Ensure all deployments are successfully initialized and the Horizontal Pod Autoscalers (HPA) are binding.

```bash
# List all pods
kubectl get pods -n myortho-prod

# Check Horizontal Pod Autoscaler status
kubectl get hpa -n myortho-prod

# Check Pod Disruption Budgets
kubectl get pdb -n myortho-prod
```

---

## Step 4: Configure DNS & TLS

Update your cloud DNS registry to point `app.myortho.tech` and `api.myortho.tech` to your Kubernetes Ingress controller's load balancer IP.

Verify cert-manager is issuing the TLS certificate:

```bash
# Monitor certificate issuance status
kubectl get certificate myorthotech-tls-cert -n myortho-prod
```

---

## Step 5: Prometheus Scraper Configuration

Verify that the prometheus scraping is capturing metrics from the backend's `/metrics` endpoint on port 4000:

```bash
# Check metrics output from the backend pod
kubectl exec -it <backend-pod-name> -n myortho-prod -- curl http://localhost:4000/metrics
```
