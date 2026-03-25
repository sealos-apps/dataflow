"use client";

import React, { useState, useEffect } from "react";

import { X, Database, Server, HardDrive, Cloud, Save, Loader2, Check, AlertCircle, Eye, EyeOff, ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { useConnections, Connection } from "@/contexts/ConnectionContext";

interface ConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Connection;
}

type ConnectionType = "MYSQL" | "POSTGRES" | "MONGODB" | "REDIS";

const CONNECTION_TYPES = [
    { id: "MYSQL", name: "MySQL", icon: <img src="/images/mysql.svg" alt="MySQL" className="h-8 w-8" /> },
    { id: "POSTGRES", name: "PostgreSQL", icon: <img src="/images/postgresql.svg" alt="PostgreSQL" className="h-8 w-8" /> },
    { id: "MONGODB", name: "MongoDB", icon: <img src="/images/mongodb.svg" alt="MongoDB" className="h-8 w-8" /> },
    { id: "REDIS", name: "Redis", icon: <img src="/images/redis.svg" alt="Redis" className="h-8 w-8" /> },
];

export function ConnectionModal({ isOpen, onClose, initialData }: ConnectionModalProps) {
    const { addConnection, editConnection } = useConnections();
    const [step, setStep] = useState<"select" | "config">(initialData ? "config" : "select");
    const [selectedType, setSelectedType] = useState<ConnectionType | null>(
        initialData ? (initialData.type as ConnectionType) : null
    );
    const [connectionName, setConnectionName] = useState(initialData?.name || "");
    const [host, setHost] = useState(initialData?.host || "");
    const [port, setPort] = useState(initialData?.port || "");
    const [username, setUsername] = useState(initialData?.user || "");
    const [password, setPassword] = useState(initialData?.password || "");
    const [database, setDatabase] = useState(initialData?.database || "");
    const [connectionString, setConnectionString] = useState("");
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [parseResult, setParseResult] = useState<{ success: boolean; message: string } | null>(null);

    // Reset form when modal opens/closes or initialData changes
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setStep("config");
                setSelectedType(initialData.type as ConnectionType);
                setConnectionName(initialData.name);
                setHost(initialData.host);
                setPort(initialData.port);
                setUsername(initialData.user);
                setPassword(initialData.password);
                setDatabase(initialData.database);
            } else {
                setStep("select");
                setSelectedType(null);
                setConnectionName("");
                setHost("");
                setPort("");
                setUsername("");
                setPassword("");
                setDatabase("");
            }
            setTestResult(null);
            setParseResult(null);
        }
    }, [isOpen, initialData]);

    const handleTypeSelect = (type: ConnectionType) => {
        setSelectedType(type);
        setStep("config");
        // Set default ports
        switch (type) {
            case "MYSQL": setPort("3306"); break;
            case "POSTGRES": setPort("5432"); break;
            case "MONGODB": setPort("27017"); break;
            case "REDIS": setPort("6379"); break;
        }
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            const response = await fetch('/api/connections/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: selectedType?.toLowerCase(),
                    host,
                    port: parseInt(port),
                    user: username,
                    password,
                    database
                }),
            });

            const data = await response.json();

            // Simulate a slight delay for better UX
            await new Promise(resolve => setTimeout(resolve, 800));

            if (data.success) {
                setTestResult({ success: true, message: "Connection successful!" });
            } else {
                setTestResult({ success: false, message: data.error || "Connection failed" });
            }
        } catch (error) {
            setTestResult({ success: false, message: "Network error occurred" });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = () => {
        if (!selectedType) return;

        const connectionData = {
            name: connectionName || `${selectedType} Connection`,
            type: selectedType,
            host,
            port,
            user: username,
            password,
            database,
        };

        if (initialData) {
            editConnection(initialData.id, connectionData);
        } else {
            addConnection(connectionData);
        }
        onClose();
    };

    const handleParseConnectionString = async () => {
        if (!connectionString.trim()) {
            setParseResult({ success: false, message: 'Please enter a connection string' });
            return;
        }

        setParseResult(null); // Clear previous results

        try {
            const response = await fetch('/api/connections/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uri: connectionString }),
            });

            const data = await response.json();

            if (data.success && data.data) {
                const parsed = data.data;
                if (parsed.type) setSelectedType(parsed.type.toUpperCase() as ConnectionType);
                if (parsed.host) setHost(parsed.host);
                if (parsed.port) setPort(parsed.port.toString());
                if (parsed.user) setUsername(parsed.user);
                if (parsed.password) setPassword(parsed.password);
                if (parsed.database) setDatabase(parsed.database);

                // Clear the connection string after successful parse
                setConnectionString('');

                // Show success feedback
                setParseResult({ success: true, message: 'Connection string parsed successfully!' });
            } else {
                setParseResult({
                    success: false,
                    message: data.error || 'Failed to parse connection string. Please check the format.'
                });
            }
        } catch (error) {
            console.error("Failed to parse connection string", error);
            setParseResult({ success: false, message: 'Network error. Please try again.' });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-xl bg-background shadow-2xl border animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between border-b px-6 py-4">
                    <div className="flex items-center gap-2">
                        {step === "config" && !initialData && (
                            <button
                                onClick={() => setStep("select")}
                                className="rounded-full p-1 -ml-2 hover:bg-muted transition-colors mr-1"
                                title="Back to Type Selection"
                            >
                                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                            </button>
                        )}
                        <h2 className="text-lg font-semibold">
                            {step === "select" ? "Select Data Source" : (initialData ? "Edit Connection" : "New Connection")}
                        </h2>
                    </div>
                    <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6">
                    {step === "select" ? (
                        <div className="grid grid-cols-2 gap-4">
                            {CONNECTION_TYPES.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => handleTypeSelect(type.id as ConnectionType)}
                                    className="flex flex-col items-center gap-3 rounded-lg border p-6 hover:bg-muted/50 hover:border-primary transition-all group"
                                >
                                    <div className="rounded-full bg-muted p-3 group-hover:bg-background transition-colors">
                                        {type.icon}
                                    </div>
                                    <span className="font-medium">{type.name}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 border-b pb-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/20 p-2 ring-1 ring-border/50">
                                    {CONNECTION_TYPES.find(t => t.id === selectedType)?.icon}
                                </div>
                                <div>
                                    <h3 className="font-medium">{CONNECTION_TYPES.find(t => t.id === selectedType)?.name}</h3>
                                    <p className="text-sm text-muted-foreground">Configure connection details</p>
                                </div>
                                {/* Change Type button removed */}
                            </div>

                            <div className="space-y-4">
                                {!initialData && (
                                    <div className="rounded-lg bg-muted/50 p-4">
                                        <label className="mb-2 block text-xs font-medium text-muted-foreground uppercase">
                                            Quick Import
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Paste connection string (e.g., mysql://user:pass@host:3306/db)"
                                                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                                                value={connectionString}
                                                onChange={(e) => {
                                                    setConnectionString(e.target.value);
                                                    setParseResult(null); // Clear parse result when user edits
                                                }}
                                            />
                                            <button
                                                onClick={handleParseConnectionString}
                                                className="rounded-md bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
                                            >
                                                Parse
                                            </button>
                                        </div>

                                        {/* Parse Result Feedback */}
                                        {parseResult && (
                                            <div className={cn(
                                                "mt-2 flex items-center gap-2 rounded-md p-3 text-sm",
                                                parseResult.success ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                            )}>
                                                {parseResult.success ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                                {parseResult.message}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">
                                        Connection Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="My Production DB"
                                        className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                                        value={connectionName}
                                        onChange={(e) => setConnectionName(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">
                                            Host
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="localhost"
                                            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                                            value={host}
                                            onChange={(e) => setHost(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">
                                            Port
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="3306"
                                            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                                            value={port}
                                            onChange={(e) => setPort(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">
                                            Username
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="root"
                                            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">
                                            Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary pr-10"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">
                                        Database Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="main_db"
                                        className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                                        value={database}
                                        onChange={(e) => setDatabase(e.target.value)}
                                    />
                                </div>
                            </div>

                            {testResult && (
                                <div className={cn(
                                    "flex items-center gap-2 rounded-md p-3 text-sm",
                                    testResult.success ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                )}>
                                    {testResult.success ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                    {testResult.message}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t bg-muted/5 px-6 py-4">
                    {step === "config" && (
                        <button
                            onClick={handleTestConnection}
                            disabled={isTesting}
                            className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
                        >
                            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test Connection"}
                        </button>
                    )}

                    <button
                        onClick={onClose}
                        className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                    >
                        Cancel
                    </button>

                    {step === "config" && (
                        <button
                            onClick={handleSave}
                            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            {initialData ? "Save Changes" : "Save Connection"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
