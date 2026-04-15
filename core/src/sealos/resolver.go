package sealos

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/clidey/whodb/core/src/engine"
	"github.com/clidey/whodb/core/src/env"
	yaml "go.yaml.in/yaml/v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// BootstrapInput describes the public Sealos bootstrap request.
type BootstrapInput struct {
	Kubeconfig   string
	DBType       string
	ResourceName string
	DatabaseName string
	Host         string
	Port         string
	Namespace    string
}

// ResolvedBootstrap is the dbprovider-compatible bootstrap result returned to GraphQL.
type ResolvedBootstrap struct {
	Namespace    string
	ResourceName string
	DBType       string
	Host         string
	Port         string
	DatabaseName string
	K8sUsername  string
	Credentials  *engine.Credentials
}

// BootstrapResolver resolves Sealos bootstrap metadata into database credentials.
type BootstrapResolver interface {
	ResolveBootstrap(context.Context, BootstrapInput) (*ResolvedBootstrap, error)
}

// BootstrapResolverFactory creates a resolver from a Sealos kubeconfig.
type BootstrapResolverFactory func(kubeconfig string) (BootstrapResolver, error)

// DefaultBootstrapResolverFactory creates the production Sealos bootstrap resolver.
var DefaultBootstrapResolverFactory BootstrapResolverFactory = NewBootstrapResolver

type kubeconfig struct {
	CurrentContext string `yaml:"current-context"`
	Contexts       []struct {
		Name    string `yaml:"name"`
		Context struct {
			Namespace string `yaml:"namespace"`
			User      string `yaml:"user"`
		} `yaml:"context"`
	} `yaml:"contexts"`
	Users []struct {
		Name string `yaml:"name"`
	} `yaml:"users"`
}

// SecretName returns the dbprovider-compatible secret name for a database resource.
func SecretName(resourceName string) string {
	return resourceName + "-conn-credential"
}

// NormalizeSecretHost returns the dbprovider-compatible host value from a secret.
func NormalizeSecretHost(host string, namespace string) string {
	if strings.Contains(host, ".svc") {
		return host
	}
	return host + "." + namespace + ".svc"
}

// NamespaceFromKubeconfig resolves the effective namespace from a Sealos kubeconfig.
func NamespaceFromKubeconfig(raw string) (string, error) {
	var cfg kubeconfig
	if err := yaml.Unmarshal([]byte(raw), &cfg); err != nil {
		return "", fmt.Errorf("parse kubeconfig: %w", err)
	}

	for _, ctx := range cfg.Contexts {
		if ctx.Name == cfg.CurrentContext {
			if strings.TrimSpace(ctx.Context.Namespace) != "" {
				return strings.TrimSpace(ctx.Context.Namespace), nil
			}
			if strings.TrimSpace(ctx.Context.User) != "" {
				return "ns-" + strings.TrimSpace(ctx.Context.User), nil
			}
		}
	}

	if len(cfg.Contexts) > 0 {
		namespace := strings.TrimSpace(cfg.Contexts[0].Context.Namespace)
		if namespace != "" {
			return namespace, nil
		}
		user := strings.TrimSpace(cfg.Contexts[0].Context.User)
		if user != "" {
			return "ns-" + user, nil
		}
	}

	if len(cfg.Users) > 0 && strings.TrimSpace(cfg.Users[0].Name) != "" {
		return "ns-" + strings.TrimSpace(cfg.Users[0].Name), nil
	}

	return "", errors.New("namespace not found in kubeconfig")
}

type resolver struct {
	kubeconfig string
	clientset  kubernetes.Interface
}

// NewBootstrapResolver creates the production Sealos bootstrap resolver.
func NewBootstrapResolver(kubeconfig string) (BootstrapResolver, error) {
	if strings.TrimSpace(kubeconfig) == "" {
		return nil, errors.New("kubeconfig is required")
	}

	config, err := clientConfigFromKubeconfig(kubeconfig)
	if err != nil {
		return nil, err
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("create kubernetes client: %w", err)
	}

	return &resolver{
		kubeconfig: kubeconfig,
		clientset:  clientset,
	}, nil
}

// ResolveBootstrap resolves bootstrap metadata into database credentials.
func (r *resolver) ResolveBootstrap(ctx context.Context, input BootstrapInput) (*ResolvedBootstrap, error) {
	spec, ok := dbTypeSpecs[input.DBType]
	if !ok {
		return nil, fmt.Errorf("unsupported dbType %q", input.DBType)
	}

	resourceName := strings.TrimSpace(input.ResourceName)
	if resourceName == "" {
		return nil, errors.New("resourceName is required")
	}

	namespace := strings.TrimSpace(input.Namespace)
	if namespace == "" {
		var err error
		namespace, err = NamespaceFromKubeconfig(r.kubeconfig)
		if err != nil {
			return nil, err
		}
	}

	secret, err := r.clientset.CoreV1().Secrets(namespace).Get(ctx, SecretName(resourceName), metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("read secret: %w", err)
	}
	if secret.Data == nil {
		return nil, errors.New("secret is empty")
	}

	username := decodeSecretField(secret.Data[spec.UsernameKey])
	password := decodeSecretField(secret.Data[spec.PasswordKey])
	host := NormalizeSecretHost(decodeSecretField(secret.Data[spec.HostKey]), namespace)
	port := decodeSecretField(secret.Data[spec.PortKey])

	if username == "" || password == "" || host == "" || port == "" {
		return nil, errors.New("secret missing required fields")
	}

	if requestedHost := strings.TrimSpace(input.Host); requestedHost != "" && requestedHost != host {
		return nil, fmt.Errorf("host mismatch: requested %q resolved %q", requestedHost, host)
	}
	if requestedPort := strings.TrimSpace(input.Port); requestedPort != "" && requestedPort != port {
		return nil, fmt.Errorf("port mismatch: requested %q resolved %q", requestedPort, port)
	}

	databaseName := strings.TrimSpace(input.DatabaseName)
	if databaseName == "" {
		databaseName = spec.DefaultDatabase
	}

	credentials := &engine.Credentials{
		Type:     spec.EngineType,
		Hostname: host,
		Username: username,
		Password: password,
		Database: databaseName,
	}
	if port != "" {
		credentials.Advanced = []engine.Record{{Key: "Port", Value: port}}
	}

	return &ResolvedBootstrap{
		Namespace:    namespace,
		ResourceName: resourceName,
		DBType:       spec.EngineType,
		Host:         host,
		Port:         port,
		DatabaseName: databaseName,
		K8sUsername:  currentUserName(r.kubeconfig),
		Credentials:  credentials,
	}, nil
}

type dbTypeSpec struct {
	EngineType      string
	UsernameKey     string
	PasswordKey     string
	HostKey         string
	PortKey         string
	DefaultDatabase string
}

var dbTypeSpecs = map[string]dbTypeSpec{
	"postgresql": {
		EngineType:      string(engine.DatabaseType_Postgres),
		UsernameKey:     "username",
		PasswordKey:     "password",
		HostKey:         "host",
		PortKey:         "port",
		DefaultDatabase: "postgres",
	},
	"apecloud-mysql": {
		EngineType:      string(engine.DatabaseType_MySQL),
		UsernameKey:     "username",
		PasswordKey:     "password",
		HostKey:         "host",
		PortKey:         "port",
		DefaultDatabase: "",
	},
	"mongodb": {
		EngineType:      string(engine.DatabaseType_MongoDB),
		UsernameKey:     "username",
		PasswordKey:     "password",
		HostKey:         "host",
		PortKey:         "port",
		DefaultDatabase: "admin",
	},
	"redis": {
		EngineType:      string(engine.DatabaseType_Redis),
		UsernameKey:     "username",
		PasswordKey:     "password",
		HostKey:         "host",
		PortKey:         "port",
		DefaultDatabase: "",
	},
	"clickhouse": {
		EngineType:      string(engine.DatabaseType_ClickHouse),
		UsernameKey:     "username",
		PasswordKey:     "password",
		HostKey:         "host",
		PortKey:         "port",
		DefaultDatabase: "default",
	},
}

func decodeSecretField(value []byte) string {
	return strings.TrimSpace(string(value))
}

func currentUserName(raw string) string {
	var cfg kubeconfig
	if err := yaml.Unmarshal([]byte(raw), &cfg); err != nil {
		return ""
	}
	for _, ctx := range cfg.Contexts {
		if ctx.Name == cfg.CurrentContext {
			return strings.TrimSpace(ctx.Context.User)
		}
	}
	if len(cfg.Contexts) > 0 {
		return strings.TrimSpace(cfg.Contexts[0].Context.User)
	}
	if len(cfg.Users) > 0 {
		return strings.TrimSpace(cfg.Users[0].Name)
	}
	return ""
}

func clientConfigFromKubeconfig(raw string) (*rest.Config, error) {
	config, err := clientcmd.Load([]byte(raw))
	if err != nil {
		return nil, fmt.Errorf("load kubeconfig: %w", err)
	}

	cluster := currentCluster(config)
	if cluster != nil && !env.IsDevelopment {
		cluster.Server = effectiveAPIServer()
	}

	clientConfig := clientcmd.NewDefaultClientConfig(*config, &clientcmd.ConfigOverrides{})
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("build rest config: %w", err)
	}
	return restConfig, nil
}

func currentCluster(config *api.Config) *api.Cluster {
	if config == nil {
		return nil
	}
	if ctx, ok := config.Contexts[config.CurrentContext]; ok {
		return config.Clusters[ctx.Cluster]
	}
	if len(config.Contexts) > 0 {
		for _, ctx := range config.Contexts {
			return config.Clusters[ctx.Cluster]
		}
	}
	return nil
}

func effectiveAPIServer() string {
	host := strings.TrimSpace(os.Getenv("KUBERNETES_SERVICE_HOST"))
	port := strings.TrimSpace(os.Getenv("KUBERNETES_SERVICE_PORT"))
	if host != "" && port != "" {
		return "https://" + host + ":" + port
	}
	return "https://apiserver.cluster.local:6443"
}
