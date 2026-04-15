package sealos

import "testing"

func TestNormalizeNamespaceMatchesDbproviderFallback(t *testing.T) {
	t.Run("prefer explicit context namespace", func(t *testing.T) {
		namespace, err := NamespaceFromKubeconfig(testKubeconfig("workspace-a"))
		if err != nil {
			t.Fatalf("namespace from kubeconfig: %v", err)
		}
		if namespace != "workspace-a" {
			t.Fatalf("expected explicit namespace, got %q", namespace)
		}
	})

	t.Run("fallback to ns-user", func(t *testing.T) {
		namespace, err := NamespaceFromKubeconfig(testKubeconfig(""))
		if err != nil {
			t.Fatalf("namespace from kubeconfig: %v", err)
		}
		if namespace != "ns-demo-user" {
			t.Fatalf("expected dbprovider-compatible fallback, got %q", namespace)
		}
	})
}

func TestNormalizeSecretHostMatchesDbprovider(t *testing.T) {
	if got := NormalizeSecretHost("db-host", "workspace-a"); got != "db-host.workspace-a.svc" {
		t.Fatalf("expected namespace svc host, got %q", got)
	}
	if got := NormalizeSecretHost("db-host.workspace-a.svc", "workspace-a"); got != "db-host.workspace-a.svc" {
		t.Fatalf("expected .svc host to remain unchanged, got %q", got)
	}
	if got := NormalizeSecretHost("db-host.workspace-a.svc.cluster.local", "workspace-a"); got != "db-host.workspace-a.svc.cluster.local" {
		t.Fatalf("expected cluster-local host to remain unchanged, got %q", got)
	}
}

func TestSecretNameMatchesDbproviderConvention(t *testing.T) {
	if got := SecretName("my-db"); got != "my-db-conn-credential" {
		t.Fatalf("expected dbprovider secret naming, got %q", got)
	}
}

func testKubeconfig(namespace string) string {
	if namespace == "" {
		return `apiVersion: v1
kind: Config
clusters:
- name: demo-cluster
  cluster:
    server: https://example.invalid
users:
- name: demo-user
  user:
    token: test
contexts:
- name: demo-user@demo-cluster
  context:
    cluster: demo-cluster
    user: demo-user
current-context: demo-user@demo-cluster
`
	}

	return `apiVersion: v1
kind: Config
clusters:
- name: demo-cluster
  cluster:
    server: https://example.invalid
users:
- name: demo-user
  user:
    token: test
contexts:
- name: demo-user@demo-cluster
  context:
    cluster: demo-cluster
    user: demo-user
    namespace: ` + namespace + `
current-context: demo-user@demo-cluster
`
}
