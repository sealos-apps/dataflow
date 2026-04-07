export type ChartType = 'bar' | 'line' | 'pie' | 'area';

export type SortTarget = 'data' | 'xAxis' | 'yAxis';
export type SortOrder = 'asc' | 'desc';

export interface ChartOptions {
    showLegend: boolean;
    showGridLines: boolean;
    showDataLabels: boolean;
}

export interface ChartConfig {
    chartType: ChartType;
    xAxisColumn: string;
    yAxisColumns: string[];
    options: ChartOptions;
    sortBy: SortTarget;
    sortOrder: SortOrder;
}

export interface QueryData {
    columns: string[];
    rows: Record<string, any>[];
    query: string;
    database?: string;
    schema?: string;
}

export const DEFAULT_CHART_CONFIG: ChartConfig = {
    chartType: 'bar',
    xAxisColumn: '',
    yAxisColumns: [],
    options: {
        showLegend: true,
        showGridLines: true,
        showDataLabels: false,
    },
    sortBy: 'data',
    sortOrder: 'asc',
};

/** Sort query rows based on chart config sort settings. */
export function sortQueryRows(
    rows: Record<string, any>[],
    config: ChartConfig,
): Record<string, any>[] {
    if (config.sortBy === 'data' || !rows.length) return rows;

    const column = config.sortBy === 'xAxis'
        ? config.xAxisColumn
        : config.yAxisColumns[0];

    if (!column) return rows;

    const sorted = [...rows].sort((a, b) => {
        const va = a[column];
        const vb = b[column];
        const na = Number(va);
        const nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(va ?? '').localeCompare(String(vb ?? ''));
    });

    return config.sortOrder === 'desc' ? sorted.reverse() : sorted;
}

/** Build an ECharts option from chart config + query data (for preview). */
export function buildEChartsOption(
    config: ChartConfig,
    queryData: QueryData | null,
): any | null {
    if (!queryData || !config.xAxisColumn || config.yAxisColumns.length === 0) {
        return null;
    }

    const sortedRows = sortQueryRows(queryData.rows, config);
    const xAxisData = sortedRows.map(row => String(row[config.xAxisColumn] ?? ''));

    const isPie = config.chartType === 'pie';

    if (isPie) {
        const yCol = config.yAxisColumns[0];
        return {
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            legend: config.options.showLegend
                ? { orient: 'horizontal', bottom: 0 }
                : undefined,
            series: [{
                type: 'pie',
                radius: ['40%', '70%'],
                itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 2 },
                data: sortedRows.map((row, i) => ({
                    value: Number(row[yCol]) || 0,
                    name: xAxisData[i],
                })),
                label: {
                    show: config.options.showDataLabels,
                    formatter: '{b}',
                },
            }],
        };
    }

    // Non-pie charts (bar, line, area)
    const series = config.yAxisColumns.map(col => {
        const seriesType = config.chartType === 'area' ? 'line' : config.chartType;
        return {
            name: col,
            type: seriesType,
            data: sortedRows.map(row => Number(row[col]) || 0),
            ...(config.chartType === 'area' ? { areaStyle: { opacity: 0.2 } } : {}),
            ...(config.chartType === 'bar' ? { itemStyle: { borderRadius: [4, 4, 0, 0] } } : {}),
            symbol: seriesType === 'line' ? 'circle' : undefined,
            symbolSize: 6,
            label: config.options.showDataLabels
                ? { show: true, position: 'top' }
                : undefined,
        };
    });

    return {
        tooltip: { trigger: 'axis' },
        legend: config.options.showLegend
            ? { data: config.yAxisColumns, bottom: 0 }
            : undefined,
        grid: { left: '3%', right: '4%', bottom: config.options.showLegend ? '12%' : '3%', top: '10%', containLabel: true },
        xAxis: {
            type: 'category',
            data: xAxisData,
            axisLine: { show: false },
            axisTick: { show: false },
        },
        yAxis: {
            type: 'value',
            splitLine: { show: config.options.showGridLines, lineStyle: { type: 'dashed' } },
        },
        series,
    };
}

/**
 * Build an ECharts option from a stored widget config.
 * Single source of truth for chart rendering — used by DashboardWidget,
 * MaximizeChartModal, and any other component that renders a saved chart.
 *
 * Reads `config.chartConfig.options` (legend, grid lines, data labels) when
 * available (charts created via ChartCreateModal), with sensible defaults
 * for legacy charts that lack it.
 */
export function buildWidgetChartOption(config: any): any | null {
    if (!config?.series) return null;

    const chartOpts = config.chartConfig as ChartConfig | undefined;
    const showLegend = chartOpts?.options?.showLegend ?? false;
    const showGridLines = chartOpts?.options?.showGridLines ?? true;
    const showDataLabels = chartOpts?.options?.showDataLabels ?? false;

    const isPie = config.type === 'pie';

    if (isPie) {
        return {
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            legend: showLegend ? { orient: 'horizontal', bottom: 0 } : undefined,
            series: config.series.map((s: any) => ({
                name: s.name,
                type: 'pie',
                radius: ['40%', '70%'],
                itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 2 },
                data: Array.isArray(s.data)
                    ? s.data.map((d: any, i: number) => {
                        if (typeof d === 'object' && d.value !== undefined) return d;
                        return { value: d, name: config.xAxis?.[i] || `Item ${i + 1}` };
                    })
                    : [],
                label: { show: showDataLabels, formatter: '{b}' },
                emphasis: {
                    itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' },
                },
            })),
        };
    }

    // Non-pie charts (bar, line, area)
    const isHorizontal = config.direction === 'horizontal';
    const useDualAxis = config.series.some((s: any) => s.yAxisIndex === 1);

    const series = config.series.map((s: any) => {
        let seriesType = s.type || config.type || 'bar';
        let extra: any = {};
        if (seriesType === 'area') {
            seriesType = 'line';
            extra = { areaStyle: { opacity: 0.2 } };
        }
        return {
            ...s,
            type: seriesType,
            ...extra,
            itemStyle: seriesType === 'bar'
                ? { borderRadius: isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0], ...s.itemStyle }
                : s.itemStyle,
            symbol: seriesType === 'line' ? 'circle' : undefined,
            symbolSize: 6,
            label: showDataLabels
                ? { show: true, position: isHorizontal ? 'right' : 'top' }
                : undefined,
        };
    });

    const option: any = {
        tooltip: { trigger: 'axis' },
        legend: showLegend
            ? { data: config.series.map((s: any) => s.name), bottom: 0 }
            : undefined,
        grid: {
            left: '3%', right: '4%',
            bottom: showLegend ? '12%' : '3%',
            top: '10%', containLabel: true,
        },
        series,
    };

    if (isHorizontal) {
        option.xAxis = { type: 'value', splitLine: { show: showGridLines, lineStyle: { type: 'dashed' } } };
        option.yAxis = { type: 'category', data: config.xAxis || [], axisLine: { show: false }, axisTick: { show: false } };
    } else {
        option.xAxis = { type: 'category', data: config.xAxis || [], axisLine: { show: false }, axisTick: { show: false } };
        option.yAxis = useDualAxis
            ? [{ type: 'value', splitLine: { show: showGridLines, lineStyle: { type: 'dashed' } } }, { type: 'value' }]
            : { type: 'value', splitLine: { show: showGridLines, lineStyle: { type: 'dashed' } } };
    }

    return option;
}

/**
 * Reconstruct QueryData from a stored widget component for editing.
 * Reverses `toWidgetConfig` by reading xAxis labels and series data
 * back into column/row form that the chart config panel needs.
 */
export function fromWidgetConfig(component: {
    visualization?: { chartConfig?: ChartConfig };
    snapshot?: { config?: any };
    query?: string;
    queryContext?: { database?: string; schema?: string };
}): QueryData | null {
    const chartConfig = component.visualization?.chartConfig as ChartConfig | undefined;
    const storedConfig = component.snapshot?.config;
    if (!chartConfig || !storedConfig?.series) return null;

    const xAxisColumn = chartConfig.xAxisColumn;
    const xAxisData: string[] = storedConfig.xAxis || [];
    const series: any[] = storedConfig.series;
    const isPie = storedConfig.type === 'pie';

    const columns = [xAxisColumn, ...chartConfig.yAxisColumns];
    const rows: Record<string, any>[] = xAxisData.map((xVal, i) => {
        const row: Record<string, any> = { [xAxisColumn]: xVal };
        for (const s of series) {
            if (isPie) {
                const pieItem = s.data?.[i];
                row[s.name] = pieItem?.value ?? pieItem ?? 0;
            } else {
                row[s.name] = s.data?.[i] ?? 0;
            }
        }
        return row;
    });

    return {
        columns,
        rows,
        query: component.query || '',
        database: component.queryContext?.database,
        schema: component.queryContext?.schema,
    };
}

/**
 * Convert ChartConfig + QueryData into the config/data shape
 * that DashboardWidget's WidgetContent expects for type='chart'.
 *
 * WidgetContent expects:
 *   config.type: 'bar' | 'line' | 'pie' | 'area'
 *   config.series: Array<{ name, type, data, areaStyle? }>
 *   config.xAxis: string[] (category labels)
 */
export function toWidgetConfig(
    config: ChartConfig,
    queryData: QueryData,
): { config: any; data: any } {
    const sortedRows = sortQueryRows(queryData.rows, config);
    const xAxisData = sortedRows.map(row => String(row[config.xAxisColumn] ?? ''));

    const series = config.yAxisColumns.map(col => {
        const seriesType = config.chartType === 'area' ? 'line' : config.chartType;
        return {
            name: col,
            type: seriesType,
            data: sortedRows.map(row => Number(row[col]) || 0),
            ...(config.chartType === 'area' ? { areaStyle: { opacity: 0.2 } } : {}),
        };
    });

    return {
        config: {
            type: config.chartType,
            series,
            xAxis: xAxisData,
            chartConfig: config,
        },
        data: {},
    };
}
