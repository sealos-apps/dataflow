import React, { useState, useEffect } from "react";
import { Filter, X, Plus, Trash2, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

interface FilterCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filter: any) => void;
    fields: string[];
    initialFilter?: any;
}

interface FilterCondition {
    id: string;
    field: string;
    operator: string;
    value: string;
}

const OPERATORS = [
    { value: '$eq', label: 'Equals (=)' },
    { value: '$ne', label: 'Not Equals (!=)' },
    { value: '$regex', label: 'Contains' },
    { value: '$gt', label: 'Greater Than (>)' },
    { value: '$lt', label: 'Less Than (<)' },
    { value: '$gte', label: 'Greater/Equal (>=)' },
    { value: '$lte', label: 'Less/Equal (<=)' },
    { value: '$in', label: 'In (comma separated)' },
];

export function FilterCollectionModal({ isOpen, onClose, onApply, fields, initialFilter }: FilterCollectionModalProps) {
    const [conditions, setConditions] = useState<FilterCondition[]>([]);

    // Reset or load initial filter when opening
    useEffect(() => {
        if (isOpen) {
            if (initialFilter && Object.keys(initialFilter).length > 0) {
                // Try to parse existing filter back to conditions
                // This is a simplified parser and might not cover all cases
                const newConditions: FilterCondition[] = [];
                Object.entries(initialFilter).forEach(([key, value]: [string, any]) => {
                    if (typeof value === 'object' && value !== null) {
                        // Handle operators like { $eq: ... }
                        Object.entries(value).forEach(([op, val]) => {
                            if (OPERATORS.some(o => o.value === op)) {
                                newConditions.push({
                                    id: Math.random().toString(36).substr(2, 9),
                                    field: key,
                                    operator: op,
                                    value: Array.isArray(val) ? val.join(', ') : String(val)
                                });
                            }
                        });
                    } else {
                        // Simple equality { field: value }
                        newConditions.push({
                            id: Math.random().toString(36).substr(2, 9),
                            field: key,
                            operator: '$eq',
                            value: String(value)
                        });
                    }
                });
                setConditions(newConditions);
            } else {
                setConditions([{ id: '1', field: fields[0] || '', operator: '$eq', value: '' }]);
            }
        }
    }, [isOpen, initialFilter, fields]);

    const handleAddCondition = () => {
        setConditions([
            ...conditions,
            { id: Math.random().toString(36).substr(2, 9), field: fields[0] || '', operator: '$eq', value: '' }
        ]);
    };

    const handleRemoveCondition = (id: string) => {
        setConditions(conditions.filter(c => c.id !== id));
    };

    const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
        setConditions(conditions.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const handleApply = () => {
        const filterObj: any = {};

        conditions.forEach(c => {
            if (!c.field) return;

            let val: any = c.value;

            // Type inference basic
            if (!isNaN(Number(c.value)) && c.value.trim() !== '') {
                val = Number(c.value);
            } else if (c.value.toLowerCase() === 'true') {
                val = true;
            } else if (c.value.toLowerCase() === 'false') {
                val = false;
            } else if (c.value.toLowerCase() === 'null') {
                val = null;
            }

            // Handle $in operator
            if (c.operator === '$in') {
                val = c.value.split(',').map(v => {
                    const trimmed = v.trim();
                    if (!isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed);
                    return trimmed;
                });
            }

            // Handle $regex
            if (c.operator === '$regex') {
                // MongoDB regex needs options usually, simple contains
                // We pass string, backend or mongodb driver usually handles it if passed as regex object or $regex operator
                // Here we just pass the $regex operator with the string value
                // NOTE: For full regex support, simpler to just pass string. 
                // Frontend will send { field: { $regex: value, $options: 'i' } } ideally
            }

            if (c.operator === '$eq') {
                // Determine if we merge or overwrite. For simple UI, overwrite or use complex $and
                filterObj[c.field] = val;
            } else if (c.operator === '$regex') {
                filterObj[c.field] = { $regex: String(c.value), $options: 'i' };
            } else {
                filterObj[c.field] = { ...filterObj[c.field], [c.operator]: val };
            }
        });

        onApply(filterObj);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-2xl rounded-xl shadow-nebula-modal border animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Filter className="h-5 w-5 text-primary" />
                        Filter Collection
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

                <div className="p-6 overflow-y-auto flex-1">
                    {conditions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Filter className="h-10 w-10 mx-auto mb-3 opacity-20" />
                            <p>No filters applied</p>
                            <Button variant="outline" size="sm" onClick={handleAddCondition} className="mt-4">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Condition
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {conditions.map((condition, index) => (
                                <div key={condition.id} className="flex items-start gap-3 p-4 border rounded-lg bg-muted/5 group hover:bg-muted/10 transition-colors">
                                    <div className="flex-1 grid grid-cols-12 gap-3">
                                        {/* Field Selector */}
                                        <div className="col-span-4">
                                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Field</label>
                                            <div className="relative">
                                                <select
                                                    className="w-full text-sm bg-background border rounded-md h-9 px-3 appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                                                    value={condition.field}
                                                    onChange={(e) => updateCondition(condition.id, { field: e.target.value })}
                                                >
                                                    <option value="" disabled>Select field</option>
                                                    {fields.map(field => (
                                                        <option key={field} value={field}>{field}</option>
                                                    ))}
                                                </select>
                                                {/* Fallback input if field not in list (for dynamic schema) */}
                                                {/* For now assuming fields list covers it or we add 'custom' option */}
                                            </div>
                                        </div>

                                        {/* Operator Selector */}
                                        <div className="col-span-3">
                                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Operator</label>
                                            <select
                                                className="w-full text-sm bg-background border rounded-md h-9 px-3 appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                                                value={condition.operator}
                                                onChange={(e) => updateCondition(condition.id, { operator: e.target.value })}
                                            >
                                                {OPERATORS.map(op => (
                                                    <option key={op.value} value={op.value}>{op.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Value Input */}
                                        <div className="col-span-5">
                                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Value</label>
                                            <Input
                                                className="h-9 text-sm"
                                                value={condition.value}
                                                onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                                                placeholder={condition.operator === '$in' ? "e.g. val1, val2" : "Value"}
                                            />
                                        </div>
                                    </div>

                                    {/* Remove Button */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveCondition(condition.id)}
                                        className="h-9 w-9 mt-5 text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100 transition-opacity"
                                        title="Remove condition"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}

                            <Button variant="outline" size="sm" onClick={handleAddCondition} className="w-full border-dashed">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Another Condition
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between p-6 border-t bg-muted/20 rounded-b-xl">
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setConditions([]);
                            onApply({});
                            onClose();
                        }}
                        className="text-muted-foreground hover:text-destructive"
                    >
                        Clear Filters
                    </Button>
                    <div className="flex gap-3">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApply}
                            className="gap-2"
                        >
                            <Search className="h-4 w-4" />
                            Apply Filter
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
