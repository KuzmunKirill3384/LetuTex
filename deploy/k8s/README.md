# LetuTEX Kubernetes deployment

1. Build and push images for each service (web-api, document-updater, clsi, file-store, git-bridge).
2. Create Secrets for CLSI_API_KEY, GIT_BRIDGE_API_KEY, JWT_SECRET, etc.
3. Apply base: `kubectl apply -f deploy/k8s/base/`
4. Configure TLS (e.g. cert-manager) and replace letutex.example.com with your domain.
5. For monitoring: deploy Prometheus (e.g. kube-prometheus-stack) and scrape /api/health; optional Grafana dashboards.
