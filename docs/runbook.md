# Runbook

This runbook collects the commands needed to develop, verify, package, and release DataFlow.

## Prerequisites

- Go 1.21+ for general development. The current `core/go.mod` toolchain may download a newer Go toolchain automatically.
- Node.js 22+.
- pnpm 10+.
- Docker with Buildx for runtime images.
- Helm for chart validation.
- Sealos CLI for local cluster-image packaging.

## Install Frontend Dependencies

```bash
cd dataflow
pnpm install --frozen-lockfile
```

If Corepack auto-adds a `packageManager` field during local commands, treat that as a local tooling side effect unless the project intentionally adopts it.

## Run Locally

Start the backend:

```bash
cd core
set -a
source .env.local
set +a
go run .
```

Start the frontend dev server:

```bash
cd dataflow
pnpm dev
```

The frontend dev server runs at `http://localhost:5173` and proxies backend API requests.

## Verification

Frontend:

```bash
cd dataflow
pnpm run typecheck
pnpm run build
pnpm run test
pnpm run lint
```

Backend build:

```bash
cd core
go build ./...
```

Backend tests:

```bash
cd core
go test ./...
```

Some backend packages load the BAML native library during tests. If the first run fails because the BAML download times out, retry after confirming the dylib exists in the local BAML cache, or set `BAML_LIBRARY_PATH` explicitly:

```bash
BAML_LIBRARY_PATH="$HOME/Library/Caches/baml/libs/0.218.1/libbaml_cffi-aarch64-apple-darwin.dylib" go test ./src/dashboard
```

Helm:

```bash
helm lint deploy/charts/dataflow
helm template dataflow deploy/charts/dataflow >/tmp/dataflow-helm-template.yaml
```

## Health Check

The stable health endpoint is `/healthz`. It is unauthenticated, sets `Cache-Control: no-store`, and returns `200` with `{"service":"dataflow","status":"ok"}` only when required runtime configuration is locally valid.

Invalid configuration returns `503` with `{"service":"dataflow","status":"error","checks":[...]}`. The checks expose field names and stable reason codes only; they do not include DSNs, session keys, tokens, API keys, or configured values.

```bash
curl -i http://localhost:8080/healthz
```

The Helm chart uses `/healthz` for startup, liveness, and readiness probes. The endpoint checks local configuration completeness and does not probe metadata database connectivity, AWS, LLM providers, or user database connections.

## Build Embedded Binary

```bash
cd dataflow
pnpm install --frozen-lockfile
pnpm run build

cd ..
rm -rf core/build
cp -R dataflow/build core/build

cd core
go build -tags prod -o dataflow-server .
```

Delete generated binaries after local testing unless they are intentional artifacts.

## Build Runtime Image

Build and publish both `amd64` and `arm64` images by default:

```bash
docker buildx build \
  -f core/Dockerfile \
  --platform linux/amd64,linux/arm64 \
  --build-arg VERSION=<version> \
  --build-arg PLATFORM=docker \
  -t <registry>/dataflow:<version> \
  --push .
```

Buildx supplies `TARGETARCH` for each platform; do not pin it to one architecture
in a multi-platform build. For test deployments, use
`crpi-7jr40k6elhldekqp.cn-hangzhou.personal.cr.aliyuncs.com/mlhiter` unless another
registry is explicitly requested.

If the registry rejects the build with `unknown manifest class for
application/vnd.oci.empty.v1+json`, rebuild with `--provenance=false --sbom=false`
and verify that the published index contains both target platforms. The existing
build layers can be reused.

If the Go compiler is killed while compiling Elasticsearch packages on a
memory-constrained builder, use a temporary Dockerfile with
`ENV GOGC=20 GOFLAGS=-p=1 GOMAXPROCS=2` immediately before the backend `go build`
step. This reduces compilation concurrency and memory pressure at the cost of
build time; keep these settings out of the final runtime stage.

Run locally:

```bash
docker run --rm -p 8080:8080 <registry>/dataflow:<version>
```

Open `http://localhost:8080`.

## Build Sealos Cluster Image Locally

See [deploy/README.md](../deploy/README.md) for the full packaging flow. The short version is:

1. Build and push a runtime image.
2. Update `deploy/charts/dataflow/values.yaml` image repository and tag.
3. Run `sealos registry save --registry-dir=registry_<arch> --arch <arch> .` from `deploy/`.
4. Build `deploy/Kubefile`.

## Release Preparation

Before pushing a new release tag:

1. Confirm the target branch is clean and synced with `origin/main`.
2. Run the frontend, backend, and Helm verification commands above.
3. Confirm GitHub Actions `Release` and `CodeQL` are green for the target commit.
4. Confirm the release-note comparison range. As of 2026-06-08, `v0.9.0` exists as a tag but does not have a GitHub Release.
5. Choose the next semantic version:
   - patch for fixes only.
   - minor when feature commits are included.
   - major only for breaking behavior or migration requirements.

Create and push the tag only after explicit release approval:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

The tag push triggers `.github/workflows/release.yaml`, which publishes runtime images, Sealos images, release tarballs, and the GitHub Release.

## Important Environment Variables

- `PORT`: backend HTTP port, default `8080`.
- `ENVIRONMENT=dev`: enables development-only GraphQL introspection/playground behavior.
- `WHODB_ALLOWED_ORIGINS`: comma-separated CORS origins.
- `WHODB_LOG_LEVEL`: log level.
- `WHODB_LOG_FORMAT`: use `json` for JSON logs.
- `WHODB_METADATA_DSN`: metadata database DSN. Required for healthy `/healthz`.
- `WHODB_SESSION_DSN`: auth session DSN. Falls back to metadata DSN when unset; one of the two DSNs is required for healthy `/healthz`.
- `WHODB_SESSION_ENCRYPTION_KEY`: server-side auth session encryption key. Must be 32 bytes for healthy `/healthz`.
- `WHODB_SESSION_TTL`: session lifetime, default `24h`; when set, must be a positive Go duration for healthy `/healthz`.
- `WHODB_SEALOS_BOOTSTRAP_ENABLED`: set to `false` to disable Sealos bootstrap. When set, must be `true` or `false` for healthy `/healthz`.
- `WHODB_STANDALONE_LOGIN_ENABLED`: set to `false` to disable standalone login. When set, must be `true` or `false` for healthy `/healthz`.
- `WHODB_TOKENS`: enables API gateway mode when non-empty.
- `WHODB_OPENAI_API_KEY`, `WHODB_ANTHROPIC_API_KEY`, `WHODB_OLLAMA_HOST`, `WHODB_OLLAMA_PORT`: AI provider configuration.
- `WHODB_AI_GENERIC_<ID>_*`: generic AI provider configuration.
- `WHODB_ENABLE_AWS_PROVIDER`: enables AWS provider functionality. When set, must be `true` or `false`; if enabled with `WHODB_AWS_PROVIDER`, that value must be a JSON array with non-empty provider regions for healthy `/healthz`.
- `BAML_LIBRARY_PATH`: explicit path to BAML native library for local macOS tests or bundled desktop builds.

## Troubleshooting

- Frontend `tsc: command not found`: run `pnpm install --frozen-lockfile` in `dataflow/`.
- Vite warns about large chunks: current bundle can exceed 1000 kB; treat as a performance follow-up unless release policy changes.
- Helm lint recommends `Chart.yaml` icon: informational only.
- `go test ./...` BAML failure on macOS: set `BAML_LIBRARY_PATH` after the native library is downloaded, then retry the affected package or full test suite.
