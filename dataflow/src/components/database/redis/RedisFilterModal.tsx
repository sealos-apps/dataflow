import React, { useState, useEffect } from 'react';
import { X, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

interface RedisFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (pattern: string, types: string[]) => void;
    initialPattern: string;
    initialTypes: string[];
}

const REDIS_TYPES = ['string', 'hash', 'list', 'set', 'zset', 'stream'];

export function RedisFilterModal({
    isOpen,
    onClose,
    onApply,
    initialPattern,
    initialTypes
}: RedisFilterModalProps) {
    const [pattern, setPattern] = useState(initialPattern);
    const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(initialTypes));
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setPattern(initialPattern);
            setSelectedTypes(new Set(initialTypes));
        } else {
            const timer = setTimeout(() => setIsVisible(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen, initialPattern, initialTypes]);

    const handleTypeToggle = (type: string) => {
        const newTypes = new Set(selectedTypes);
        if (newTypes.has(type)) {
            newTypes.delete(type);
        } else {
            newTypes.add(type);
        }
        setSelectedTypes(newTypes);
    };

    const handleApply = () => {
        onApply(pattern, Array.from(selectedTypes));
        onClose();
    };

    const handleReset = () => {
        setPattern('*');
        setSelectedTypes(new Set());
    };

    if (!isVisible && !isOpen) return null;

    const content = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className={cn(
                    "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
                    isOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={onClose}
            />
            <div
                className={cn(
                    "bg-background w-full max-w-md rounded-xl shadow-2xl border transition-all duration-200 transform z-10",
                    isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
                )}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Filter className="h-5 w-5 text-primary" />
                        Filter Keys
                    </h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 rounded-full"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Pattern Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                            Key Pattern
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={pattern}
                                onChange={(e) => setPattern(e.target.value)}
                                placeholder="e.g. user:*, *cache*"
                                className="pl-9"
                                autoFocus
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Supports glob patterns: <code>*</code> matches all, <code>?</code> matches one, <code>[abc]</code> matches set.
                        </p>
                    </div>

                    {/* Types Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-foreground flex items-center justify-between">
                            Data Types
                            <span className="text-xs font-normal text-muted-foreground">
                                {selectedTypes.size === 0 ? 'All types' : `${selectedTypes.size} selected`}
                            </span>
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {REDIS_TYPES.map((type) => (
                                <button
                                    key={type}
                                    onClick={() => handleTypeToggle(type)}
                                    className={cn(
                                        "flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                                        selectedTypes.has(type)
                                            ? "bg-primary/10 border-primary text-primary"
                                            : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    {type.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20 rounded-b-xl">
                    <Button
                        variant="outline"
                        onClick={handleReset}
                        className="hover:bg-muted"
                    >
                        Reset
                    </Button>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button onClick={handleApply}>
                            Apply Filter
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(content, document.body);
}
