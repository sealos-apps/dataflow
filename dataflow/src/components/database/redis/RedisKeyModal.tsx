import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface RedisKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: {
        key: string;
        type: string;
        value: any;
        ttl?: number;
    } | null;
}

const REDIS_TYPES = ['string', 'hash', 'list', 'set', 'zset'];

export function RedisKeyModal({ isOpen, onClose, onSave, initialData }: RedisKeyModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [keyName, setKeyName] = useState('');
    const [keyType, setKeyType] = useState('string');
    const [ttl, setTtl] = useState('');

    // Value states for different types
    const [stringValue, setStringValue] = useState('');
    const [hashPairs, setHashPairs] = useState<{ field: string; value: string }[]>([{ field: '', value: '' }]);
    const [listItems, setListItems] = useState<string[]>(['']);
    const [zsetItems, setZsetItems] = useState<{ score: string; value: string }[]>([{ score: '0', value: '' }]);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setKeyName(initialData.key);
                setKeyType(initialData.type);
                setTtl(initialData.ttl?.toString() || '-1');

                // Initialize value based on type
                if (initialData.type === 'string') {
                    setStringValue(initialData.value || '');
                } else if (initialData.type === 'hash') {
                    if (initialData.value) {
                        // Hash value from API is { field1: val1, field2: val2 }
                        const pairs = Object.entries(initialData.value).map(([field, value]) => ({
                            field,
                            value: String(value)
                        }));
                        setHashPairs(pairs.length > 0 ? pairs : [{ field: '', value: '' }]);
                    } else {
                        setHashPairs([{ field: '', value: '' }]);
                    }
                } else if (initialData.type === 'list') {
                    if (Array.isArray(initialData.value)) {
                        setListItems(initialData.value.length > 0 ? initialData.value : ['']);
                    } else {
                        setListItems(['']);
                    }
                } else if (initialData.type === 'set') {
                    if (Array.isArray(initialData.value)) {
                        setListItems(initialData.value.length > 0 ? initialData.value : ['']);
                    } else {
                        setListItems(['']);
                    }
                } else if (initialData.type === 'zset') {
                    if (Array.isArray(initialData.value)) {
                        // ZSet value from API is [{score, value}, ...]
                        const items = initialData.value.map((item: any) => ({
                            score: String(item.score),
                            value: item.value
                        }));
                        setZsetItems(items.length > 0 ? items : [{ score: '0', value: '' }]);
                    } else {
                        setZsetItems([{ score: '0', value: '' }]);
                    }
                }
            } else {
                // Reset for add mode
                setKeyName('');
                setKeyType('string');
                setTtl('-1');
                setStringValue('');
                setHashPairs([{ field: '', value: '' }]);
                setListItems(['']);
                setZsetItems([{ score: '0', value: '' }]);
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsLoading(true);
        try {
            let valueData: any = stringValue;

            if (keyType === 'hash') {
                valueData = hashPairs.reduce((acc, curr) => {
                    if (curr.field) acc[curr.field] = curr.value;
                    return acc;
                }, {} as Record<string, string>);
            } else if (keyType === 'list' || keyType === 'set') {
                valueData = listItems.filter(i => i);
            } else if (keyType === 'zset') {
                valueData = zsetItems.filter(i => i.value).map(i => ({ score: Number(i.score), value: i.value }));
            }

            await onSave({
                key: keyName,
                type: keyType,
                value: valueData,
                ttl: parseInt(ttl) || -1
            });
            onClose();
        } catch (error) {
            console.error('Failed to save key:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background w-full max-w-2xl rounded-xl shadow-2xl border flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="text-lg font-semibold">
                        {initialData ? 'Edit Key' : 'Add New Key'}
                    </h3>
                    <Button variant="ghost" size="icon" onClick={onClose} disabled={isLoading}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Key, Type, TTL in one row: 50% - 25% - 25% */}
                    <div className="grid grid-cols-[2fr_1fr_1fr] gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Key Name</label>
                            <Input
                                value={keyName}
                                onChange={(e) => setKeyName(e.target.value)}
                                placeholder="e.g., users:1001"
                                disabled={isLoading}
                                className={cn(!!initialData && "border-blue-200 bg-blue-50/20")}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Type</label>
                            <Select
                                value={keyType}
                                onValueChange={(v) => {
                                    setKeyType(v);
                                    setStringValue('');
                                    setHashPairs([{ field: '', value: '' }]);
                                    setListItems(['']);
                                    setZsetItems([{ score: '0', value: '' }]);
                                }}
                                disabled={isLoading}
                            >
                                <SelectTrigger className="w-full h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {REDIS_TYPES.map(t => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">TTL (s)</label>
                            <Input
                                type="number"
                                value={ttl}
                                onChange={(e) => setTtl(e.target.value)}
                                placeholder="-1"
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Value</label>

                        {/* String Editor */}
                        {keyType === 'string' && (
                            <textarea
                                className="w-full min-h-[200px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                                value={stringValue}
                                onChange={(e) => setStringValue(e.target.value)}
                                placeholder="Enter string value..."
                                disabled={isLoading}
                            />
                        )}

                        {/* Hash Editor */}
                        {keyType === 'hash' && (
                            <div className="space-y-2">
                                {hashPairs.map((pair, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <Input
                                            placeholder="Field"
                                            value={pair.field}
                                            onChange={(e) => {
                                                const newPairs = [...hashPairs];
                                                newPairs[idx].field = e.target.value;
                                                setHashPairs(newPairs);
                                            }}
                                            className="flex-1 font-mono"
                                        />
                                        <Input
                                            placeholder="Value"
                                            value={pair.value}
                                            onChange={(e) => {
                                                const newPairs = [...hashPairs];
                                                newPairs[idx].value = e.target.value;
                                                setHashPairs(newPairs);
                                            }}
                                            className="flex-1 font-mono"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                const newPairs = hashPairs.filter((_, i) => i !== idx);
                                                setHashPairs(newPairs);
                                            }}
                                            disabled={hashPairs.length === 1}
                                        >
                                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setHashPairs([...hashPairs, { field: '', value: '' }])}
                                    className="w-full"
                                >
                                    <Plus className="h-4 w-4 mr-2" /> Add Field
                                </Button>
                            </div>
                        )}

                        {/* List/Set Editor */}
                        {(keyType === 'list' || keyType === 'set') && (
                            <div className="space-y-2">
                                {listItems.map((item, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <Input
                                            placeholder="Item value"
                                            value={item}
                                            onChange={(e) => {
                                                const newItems = [...listItems];
                                                newItems[idx] = e.target.value;
                                                setListItems(newItems);
                                            }}
                                            className="flex-1 font-mono"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                const newItems = listItems.filter((_, i) => i !== idx);
                                                setListItems(newItems);
                                            }}
                                            disabled={listItems.length === 1}
                                        >
                                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setListItems([...listItems, ''])}
                                    className="w-full"
                                >
                                    <Plus className="h-4 w-4 mr-2" /> Add Item
                                </Button>
                            </div>
                        )}

                        {/* ZSet Editor */}
                        {keyType === 'zset' && (
                            <div className="space-y-2">
                                {zsetItems.map((item, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <Input
                                            type="number"
                                            placeholder="Score"
                                            value={item.score}
                                            onChange={(e) => {
                                                const newItems = [...zsetItems];
                                                newItems[idx].score = e.target.value;
                                                setZsetItems(newItems);
                                            }}
                                            className="w-[100px] font-mono"
                                        />
                                        <Input
                                            placeholder="Member value"
                                            value={item.value}
                                            onChange={(e) => {
                                                const newItems = [...zsetItems];
                                                newItems[idx].value = e.target.value;
                                                setZsetItems(newItems);
                                            }}
                                            className="flex-1 font-mono"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                const newItems = zsetItems.filter((_, i) => i !== idx);
                                                setZsetItems(newItems);
                                            }}
                                            disabled={zsetItems.length === 1}
                                        >
                                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setZsetItems([...zsetItems, { score: '0', value: '' }])}
                                    className="w-full"
                                >
                                    <Plus className="h-4 w-4 mr-2" /> Add Member
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/20 rounded-b-xl">
                    <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!keyName || isLoading}>
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                            </div>
                        ) : 'Save'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

