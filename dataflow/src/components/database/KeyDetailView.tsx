import React, { useEffect, useState } from "react";
import { Key, Loader2, Database } from "lucide-react";
import { useConnectionStore } from "@/stores/useConnectionStore";

interface KeyDetailViewProps {
    connectionId: string;
    databaseName: string;
    keyName: string;
}

export function KeyDetailView({ connectionId, databaseName, keyName }: KeyDetailViewProps) {
    const { connections } = useConnectionStore();
    const [loading, setLoading] = useState(true);
    const [keyData, setKeyData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);

            const conn = connections.find(c => c.id === connectionId);
            if (!conn) {
                setError("Connection not found");
                setLoading(false);
                return;
            }

            try {
                const response = await fetch('/api/connections/fetch-key-value', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: conn.type.toLowerCase(),
                        host: conn.host,
                        port: conn.port,
                        password: conn.password,
                        database: databaseName,
                        key: keyName
                    }),
                });

                const result = await response.json();
                if (result.success) {
                    setKeyData(result.data);
                } else {
                    setError(result.error || 'Failed to fetch key value');
                }
            } catch (err: any) {
                setError(err.message || 'Failed to fetch key value');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [connectionId, databaseName, keyName, connections]);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="border-b px-6 py-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Key className="h-5 w-5 text-orange-500" />
                    {keyName}
                </h2>
                {keyData && (
                    <p className="text-sm text-muted-foreground mt-1">
                        Type: {keyData.type} • TTL: {keyData.ttl === -1 ? 'No expiration' : `${keyData.ttl}s`}
                    </p>
                )}
            </div>

            <div className="flex-1 overflow-auto p-6">
                {keyData ? (
                    <div className="rounded-lg border bg-muted/5 p-4">
                        <div className="mb-2 text-xs font-medium text-muted-foreground uppercase">Value</div>
                        <pre className="text-sm overflow-x-auto">
                            {typeof keyData.value === 'object'
                                ? JSON.stringify(keyData.value, null, 2)
                                : String(keyData.value)
                            }
                        </pre>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground">No data found for this key</p>
                    </div>
                )}
            </div>
        </div>
    );
}
