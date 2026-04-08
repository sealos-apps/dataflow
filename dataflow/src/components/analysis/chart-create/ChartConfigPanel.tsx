import React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ChartType, SortTarget, SortOrder } from '../chart-utils';
import { useChartCreateCtx } from './ChartCreateProvider';
import { useI18n } from '@/i18n/useI18n'

/** Right-column configuration panel for chart creation: type, axes, options, and sort settings. */
export function ChartConfigPanel() {
    const { t } = useI18n()
    const { chartConfig: config, queryData, handleConfigChange: onConfigChange, setActiveView } = useChartCreateCtx()
    const columns = queryData?.columns ?? []

    const chartTypeLabels: Record<ChartType, string> = {
        bar: t('analysis.chart.type.bar'),
        line: t('analysis.chart.type.line'),
        pie: t('analysis.chart.type.pie'),
        area: t('analysis.chart.type.area'),
    };

    const yAxisAvailableColumns = columns.filter(col => col !== config.xAxisColumn);

    const toggleYAxisColumn = (col: string) => {
        const current = config.yAxisColumns;
        const next = current.includes(col)
            ? current.filter(c => c !== col)
            : [...current, col];
        onConfigChange({ yAxisColumns: next });
    };

    return (
        <div className="flex flex-col gap-4 p-6 overflow-y-auto h-full">

            {/* 1. Data Configuration button */}
            <div className="flex flex-col gap-1.5">
                <Button
                    onClick={() => setActiveView('data-config')}
                    className="w-full"
                >
                    {t('analysis.chart.dataConfiguration')}
                </Button>
                {queryData && (
                    <p className="text-xs text-muted-foreground">
                        {t('analysis.chart.dataStatus', {
                            columns: queryData.columns.length,
                            rows: queryData.rows.length,
                        })}
                    </p>
                )}
            </div>

            {/* 2. Chart Type selector */}
            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t('analysis.chart.type')}</label>
                <Select
                    value={config.chartType}
                    onValueChange={(value) => onConfigChange({ chartType: value as ChartType })}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(Object.entries(chartTypeLabels) as [ChartType, string][]).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* 3. X-Axis selector */}
            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t('analysis.chart.xAxis')}</label>
                <Select
                    value={config.xAxisColumn || undefined}
                    onValueChange={(value) => onConfigChange({ xAxisColumn: value })}
                    disabled={columns.length === 0}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('analysis.chart.selectXAxis')} />
                    </SelectTrigger>
                    <SelectContent>
                        {columns.map((col) => (
                            <SelectItem key={col} value={col}>
                                {col}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* 4. Y-Axis multi-select */}
            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t('analysis.chart.yAxis')}</label>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="w-full justify-between font-normal"
                            disabled={columns.length === 0}
                        >
                            <span className={cn(
                                'truncate',
                                !config.yAxisColumns.length && 'text-muted-foreground',
                            )}>
                                {config.yAxisColumns.length ? config.yAxisColumns.join(', ') : t('analysis.chart.selectYAxis')}
                            </span>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[220px]">
                        {yAxisAvailableColumns.map((col) => (
                            <DropdownMenuCheckboxItem
                                key={col}
                                checked={config.yAxisColumns.includes(col)}
                                onCheckedChange={() => toggleYAxisColumn(col)}
                            >
                                {col}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* 5. Chart Options */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">{t('analysis.chart.options')}</label>
                {(
                    [
                        { key: 'showLegend', label: t('analysis.chart.options.legend') },
                        { key: 'showGridLines', label: t('analysis.chart.options.gridLines') },
                        { key: 'showDataLabels', label: t('analysis.chart.options.dataLabels') },
                    ] as const
                ).map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => onConfigChange({ options: { ...config.options, [key]: !config.options[key] } })}
                        className="flex items-center gap-2 text-sm"
                    >
                        <span
                            className={cn(
                                'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                                config.options[key]
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'border',
                            )}
                        >
                            {config.options[key] && <Check className="w-3 h-3 text-white" />}
                        </span>
                        <span>{label}</span>
                    </button>
                ))}
            </div>

            {/* 6. Sort By */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">{t('analysis.chart.sortBy')}</label>
                {(
                    [
                        { value: 'data', label: t('analysis.chart.sort.dataOrder') },
                        { value: 'xAxis', label: t('analysis.chart.sort.xAxisValue') },
                        { value: 'yAxis', label: t('analysis.chart.sort.yAxisValue') },
                    ] as { value: SortTarget; label: string }[]
                ).map(({ value, label }) => (
                    <div key={value}>
                        <button
                            onClick={() => onConfigChange({ sortBy: value })}
                            className="flex items-center gap-2 text-sm"
                        >
                            <span
                                className={cn(
                                    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                                    config.sortBy === value ? 'border-primary' : 'border',
                                )}
                            >
                                {config.sortBy === value && (
                                    <span className="w-2 h-2 rounded-full bg-primary" />
                                )}
                            </span>
                            <span>{label}</span>
                        </button>

                        {/* Sort order sub-options when xAxis or yAxis selected */}
                        {config.sortBy === value && value !== 'data' && (
                            <div className="ml-6 mt-1.5 flex gap-3">
                                {(
                                    [
                                        { value: 'asc', label: t('analysis.chart.sort.ascending') },
                                        { value: 'desc', label: t('analysis.chart.sort.descending') },
                                    ] as { value: SortOrder; label: string }[]
                                ).map(order => (
                                    <button
                                        key={order.value}
                                        onClick={() => onConfigChange({ sortOrder: order.value })}
                                        className="flex items-center gap-1.5 text-sm"
                                    >
                                        <span
                                            className={cn(
                                                'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0',
                                                config.sortOrder === order.value ? 'border-primary' : 'border',
                                            )}
                                        >
                                            {config.sortOrder === order.value && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            )}
                                        </span>
                                        <span>{order.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

        </div>
    );
}
