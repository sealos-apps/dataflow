import { createContext, use, useRef, useState, useCallback, type ReactNode } from 'react'

import { useAnalysisDefinitionStore, type ChartWidgetDefinition, type WidgetLayout } from '@/stores/analysisDefinitionStore'
import { useAnalysisRuntimeStore } from '@/stores/analysisRuntimeStore'
import { useConnectionStore } from '@/stores/useConnectionStore'
import {
    DEFAULT_CHART_CONFIG,
    buildEChartsOption,
    toWidgetConfig,
    fromWidgetConfig,
    type ChartConfig,
    type QueryData,
} from '../chart-utils'

type ModalView = 'chart-config' | 'data-config'

interface ChartCreateCtxValue {
    activeView: ModalView
    title: string
    chartConfig: ChartConfig
    queryData: QueryData | null
    sqlQuery: string
    isEditing: boolean
    canSave: boolean
    previewOption: ReturnType<typeof buildEChartsOption>
    editorContext: { connectionId: string; databaseName: string } | null
    setActiveView: (view: ModalView) => void
    setTitle: (title: string) => void
    handleConfigChange: (updates: Partial<ChartConfig>) => void
    setSqlQuery: (sql: string) => void
    handleQueryResults: (
        columns: string[],
        rows: Record<string, any>[],
        ctx: { database?: string; schema?: string },
    ) => void
    handleSave: () => void
}

const ChartCreateCtx = createContext<ChartCreateCtxValue | null>(null)

export function useChartCreateCtx(): ChartCreateCtxValue {
    const ctx = use(ChartCreateCtx)
    if (!ctx) throw new Error('useChartCreateCtx must be used within ChartCreateProvider')
    return ctx
}

interface ChartCreateProviderProps {
    editComponent?: ChartWidgetDefinition | null
    onClose: () => void
    children: ReactNode
}

function getNextWidgetLayout(widgets: ChartWidgetDefinition[]): WidgetLayout {
    const width = 4
    const height = 6

    if (widgets.length === 0) {
        return { i: crypto.randomUUID(), x: 0, y: 0, w: width, h: height }
    }

    const sorted = [...widgets].sort((a, b) => {
        if (a.layout.y !== b.layout.y) return a.layout.y - b.layout.y
        return a.layout.x - b.layout.x
    })
    const last = sorted[sorted.length - 1]!

    const maxY = widgets.reduce((currentMax, widget) => (
        Math.max(currentMax, widget.layout.y + widget.layout.h)
    ), 0)

    if (last.layout.x + last.layout.w + width <= 12) {
        return {
            i: crypto.randomUUID(),
            x: last.layout.x + last.layout.w,
            y: last.layout.y,
            w: width,
            h: height,
        }
    }

    return { i: crypto.randomUUID(), x: 0, y: maxY, w: width, h: height }
}

export function ChartCreateProvider({ editComponent, onClose, children }: ChartCreateProviderProps) {
    const addWidget = useAnalysisDefinitionStore(state => state.addWidget)
    const updateWidget = useAnalysisDefinitionStore(state => state.updateWidget)
    const dashboards = useAnalysisDefinitionStore(state => state.dashboards)
    const activeDashboardId = useAnalysisDefinitionStore(state => state.activeDashboardId)
    const { connections } = useConnectionStore()

    const isEditing = !!editComponent
    const initialQueryData = editComponent ? fromWidgetConfig(editComponent) : null

    const [activeView, setActiveView] = useState<ModalView>('chart-config')
    const [title, setTitle] = useState(editComponent?.title ?? '')
    const [chartConfig, setChartConfig] = useState<ChartConfig>(
        editComponent?.visualization?.chartConfig ?? DEFAULT_CHART_CONFIG,
    )
    const [queryData, setQueryData] = useState<QueryData | null>(initialQueryData)
    const [sqlQuery, setSqlQueryState] = useState(editComponent?.query ?? '')
    const sqlQueryRef = useRef(editComponent?.query ?? '')

    const connection = connections[0]
    const editorContext = connection
        ? { connectionId: connection.id, databaseName: connection.database }
        : null

    const setSqlQuery = useCallback((sql: string) => {
        sqlQueryRef.current = sql
        setSqlQueryState(sql)
    }, [])

    const handleConfigChange = useCallback((updates: Partial<ChartConfig>) => {
        setChartConfig(prev => ({
            ...prev,
            ...updates,
            options: updates.options ? { ...prev.options, ...updates.options } : prev.options,
        }))
    }, [])

    const handleQueryResults = useCallback((
        columns: string[],
        rows: Record<string, any>[],
        ctx: { database?: string; schema?: string },
    ) => {
        setQueryData({
            columns,
            rows,
            query: sqlQueryRef.current,
            database: ctx.database,
            schema: ctx.schema,
        })
        setChartConfig(prev => {
            const colSet = new Set(columns)
            return {
                ...prev,
                xAxisColumn: colSet.has(prev.xAxisColumn) ? prev.xAxisColumn : '',
                yAxisColumns: prev.yAxisColumns.filter(column => colSet.has(column)),
            }
        })
    }, [])

    const canSave = title.trim() !== ''
        && queryData !== null
        && chartConfig.xAxisColumn !== ''
        && chartConfig.yAxisColumns.length > 0

    const previewOption = buildEChartsOption(chartConfig, queryData)

    const handleSave = useCallback(async () => {
        if (!queryData || !title.trim()) return

        const { config, data } = toWidgetConfig(chartConfig, queryData)
        const executedAt = new Date().toISOString()
        const payload = {
            title: title.trim(),
            query: queryData.query,
            queryContext: { database: queryData.database, schema: queryData.schema },
            visualization: { chartConfig },
            snapshot: { config, data, executedAt },
        }

        let widgetId = editComponent?.id
        if (editComponent) {
            await updateWidget(editComponent.id, {
                ...payload,
                layout: editComponent.layout,
                sortOrder: editComponent.sortOrder,
            })
        } else if (activeDashboardId) {
            const activeDashboard = dashboards.find(dashboard => dashboard.id === activeDashboardId)
            const widget = await addWidget(activeDashboardId, {
                ...payload,
                layout: getNextWidgetLayout(activeDashboard?.widgets ?? []),
                sortOrder: activeDashboard?.widgets.length ?? 0,
            })
            widgetId = widget.id
        }

        if (widgetId) {
            useAnalysisRuntimeStore.setState(state => ({
                widgetStatesById: {
                    ...state.widgetStatesById,
                    [widgetId]: {
                        status: 'success',
                        config,
                        data,
                        executedAt,
                        isStale: false,
                    },
                },
            }))
        }

        onClose()
    }, [queryData, title, chartConfig, addWidget, updateWidget, editComponent, activeDashboardId, dashboards, onClose])

    return (
        <ChartCreateCtx value={{
            activeView,
            title,
            chartConfig,
            queryData,
            sqlQuery,
            isEditing,
            canSave,
            previewOption,
            editorContext,
            setActiveView,
            setTitle,
            handleConfigChange,
            setSqlQuery,
            handleQueryResults,
            handleSave,
        }}>
            {children}
        </ChartCreateCtx>
    )
}
