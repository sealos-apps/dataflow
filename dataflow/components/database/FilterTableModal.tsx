import React, { useState, useEffect } from "react";
import { X, Filter, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface FilterCondition {
    id: string;
    column: string;
    operator: string;
    value: string;
}

interface FilterTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    columns: string[];
    onApply: (selectedColumns: string[], conditions: FilterCondition[]) => void;
    initialSelectedColumns?: string[];
    initialConditions?: FilterCondition[];
}

export function FilterTableModal({
    isOpen,
    onClose,
    columns,
    onApply,
    initialSelectedColumns,
    initialConditions
}: FilterTableModalProps) {
    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(columns));
    const [conditions, setConditions] = useState<FilterCondition[]>([]);

    useEffect(() => {
        if (isOpen) {
            if (initialSelectedColumns && initialSelectedColumns.length > 0) {
                setSelectedColumns(new Set(initialSelectedColumns));
            } else {
                setSelectedColumns(new Set(columns));
            }

            if (initialConditions) {
                setConditions(initialConditions);
            } else {
                setConditions([]);
            }
        }
    }, [isOpen, columns, initialSelectedColumns, initialConditions]);

    if (!isOpen) return null;

    const toggleColumn = (col: string) => {
        const newSelected = new Set(selectedColumns);
        if (newSelected.has(col)) {
            newSelected.delete(col);
        } else {
            newSelected.add(col);
        }
        setSelectedColumns(newSelected);
    };

    const toggleAllColumns = () => {
        if (selectedColumns.size === columns.length) {
            setSelectedColumns(new Set());
        } else {
            setSelectedColumns(new Set(columns));
        }
    };

    const addCondition = () => {
        setConditions([
            ...conditions,
            {
                id: Math.random().toString(36).substring(7),
                column: columns[0] || '',
                operator: '=',
                value: ''
            }
        ]);
    };

    const removeCondition = (id: string) => {
        setConditions(conditions.filter(c => c.id !== id));
    };

    const updateCondition = (id: string, field: keyof FilterCondition, value: string) => {
        setConditions(conditions.map(c =>
            c.id === id ? { ...c, [field]: value } : c
        ));
    };

    const handleApply = () => {
        onApply(Array.from(selectedColumns), conditions);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-xl bg-background shadow-2xl border animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                        <Filter className="h-5 w-5 text-primary" />
                        Filter & Columns
                    </h2>
                    <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Column Visibility Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                Visible Columns
                            </h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleAllColumns}
                                className="h-6 text-xs"
                            >
                                {selectedColumns.size === columns.length ? 'Deselect All' : 'Select All'}
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {columns.map(col => (
                                <div
                                    key={col}
                                    className={`
                                        flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors
                                        ${selectedColumns.has(col)
                                            ? 'bg-primary/5 border-primary/30 text-foreground'
                                            : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50'}
                                    `}
                                    onClick={() => toggleColumn(col)}
                                >
                                    <div className={`
                                        h-4 w-4 rounded border flex items-center justify-center
                                        ${selectedColumns.has(col) ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'}
                                    `}>
                                        {selectedColumns.has(col) && <Check className="h-3 w-3" />}
                                    </div>
                                    <span className="text-sm truncate" title={col}>{col}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-border" />

                    {/* Filter Conditions Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                Filter Conditions
                            </h3>
                            <Button
                                onClick={addCondition}
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                            >
                                <Plus className="h-3 w-3" />
                                Add Condition
                            </Button>
                        </div>

                        {conditions.length === 0 ? (
                            <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground text-sm">
                                No filters applied. Add a condition to filter data.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {conditions.map((condition) => (
                                    <div key={condition.id} className="flex items-center gap-2">
                                        <select
                                            className="h-9 rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            value={condition.column}
                                            onChange={(e) => updateCondition(condition.id, 'column', e.target.value)}
                                        >
                                            {columns.map(col => (
                                                <option key={col} value={col}>{col}</option>
                                            ))}
                                        </select>

                                        <select
                                            className="h-9 w-24 rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            value={condition.operator}
                                            onChange={(e) => updateCondition(condition.id, 'operator', e.target.value)}
                                        >
                                            <option value="=">=</option>
                                            <option value="!=">!=</option>
                                            <option value=">">&gt;</option>
                                            <option value=">=">&gt;=</option>
                                            <option value="<">&lt;</option>
                                            <option value="<=">&lt;=</option>
                                            <option value="LIKE">LIKE</option>
                                            <option value="NOT LIKE">NOT LIKE</option>
                                            <option value="IN">IN</option>
                                            <option value="IS NULL">IS NULL</option>
                                            <option value="IS NOT NULL">IS NOT NULL</option>
                                        </select>

                                        <Input
                                            className="flex-1 h-9"
                                            placeholder="Value"
                                            value={condition.value}
                                            onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                                            disabled={['IS NULL', 'IS NOT NULL'].includes(condition.operator)}
                                        />

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-muted-foreground hover:text-red-500"
                                            onClick={() => removeCondition(condition.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t bg-muted/5 px-6 py-4 shrink-0">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleApply} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        Apply Filters
                    </Button>
                </div>
            </div>
        </div>
    );
}
