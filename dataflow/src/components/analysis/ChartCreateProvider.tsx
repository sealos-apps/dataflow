import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { useAnalysisStore } from '@/stores/useAnalysisStore'
import { useConnectionStore } from '@/stores/useConnectionStore'
import {
    DEFAULT_CHART_CONFIG,
    buildEChartsOption,
    toWidgetConfig,
    type ChartConfig,
    type QueryData,
} from './chart-utils'

type ModalView = 'chart-config' | 'data-config'

/** Context value for the chart creation wizard. */
interface ChartCreateCtxValue {
    // State
    activeView: ModalView
    title: string
    chartConfig: ChartConfig
    queryData: QueryData | null
    sqlQuery: string

    // Derived
    canSave: boolean
    previewOption: ReturnType<typeof buildEChartsOption>
    editorContext: { connectionId: string; databaseName: string } | null

    // Actions
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

/** Hook to access ChartCreate context. Throws outside provider. */
export function useChartCreateCtx(): ChartCreateCtxValue {
    const ctx = use(ChartCreateCtx)
    if (!ctx) throw new Error('useChartCreateCtx must be used within ChartCreateProvider')
    return ctx
}

interface ChartCreateProviderProps {
    onClose: () => void
    children: ReactNode
}

/** Owns all state and business logic for the chart creation wizard. */
export function ChartCreateProvider({ onClose, children }: ChartCreateProviderProps) {
    const { addComponent } = useAnalysisStore()
    const { connections } = useConnectionStore()

    const [activeView, setActiveView] = useState<ModalView>('chart-config')
    const [title, setTitle] = useState('')
    const [chartConfig, setChartConfig] = useState<ChartConfig>(DEFAULT_CHART_CONFIG)
    const [queryData, setQueryData] = useState<QueryData | null>(null)
    const [sqlQuery, setSqlQuery] = useState('')

    const connection = connections[0]
    const editorContext = connection
        ? { connectionId: connection.id, databaseName: connection.database }
        : null

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
        setQueryData({ columns, rows, query: sqlQuery, database: ctx.database, schema: ctx.schema })
        setChartConfig(prev => {
            const colSet = new Set(columns)
            return {
                ...prev,
                xAxisColumn: colSet.has(prev.xAxisColumn) ? prev.xAxisColumn : '',
                yAxisColumns: prev.yAxisColumns.filter(c => colSet.has(c)),
            }
        })
    }, [sqlQuery])

    const canSave = title.trim() !== ''
        && queryData !== null
        && chartConfig.xAxisColumn !== ''
        && chartConfig.yAxisColumns.length > 0

    const previewOption = buildEChartsOption(chartConfig, queryData)

    const handleSave = useCallback(() => {
        if (!queryData || !title.trim()) return
        const { config, data } = toWidgetConfig(chartConfig, queryData)
        addComponent('chart', {
            title: title.trim(),
            config,
            data,
            query: queryData.query,
            queryContext: { database: queryData.database, schema: queryData.schema },
        })
        onClose()
    }, [queryData, title, chartConfig, addComponent, onClose])

    return (
        <ChartCreateCtx value={{
            activeView, title, chartConfig, queryData, sqlQuery,
            canSave, previewOption, editorContext,
            setActiveView, setTitle, handleConfigChange, setSqlQuery, handleQueryResults, handleSave,
        }}>
            {children}
        </ChartCreateCtx>
    )
}
