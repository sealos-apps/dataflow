import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { useAnalysisStore, type DashboardComponent } from '@/stores/useAnalysisStore'
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

/** Context value for the chart creation/editing wizard. */
interface ChartCreateCtxValue {
    // State
    activeView: ModalView
    title: string
    chartConfig: ChartConfig
    queryData: QueryData | null
    sqlQuery: string
    isEditing: boolean

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
    editComponent?: DashboardComponent | null
    onClose: () => void
    children: ReactNode
}

/** Owns all state and business logic for the chart creation/editing wizard. */
export function ChartCreateProvider({ editComponent, onClose, children }: ChartCreateProviderProps) {
    const { addComponent, updateComponent } = useAnalysisStore()
    const { connections } = useConnectionStore()

    const isEditing = !!editComponent
    const initialQueryData = editComponent ? fromWidgetConfig(editComponent) : null

    const [activeView, setActiveView] = useState<ModalView>('chart-config')
    const [title, setTitle] = useState(editComponent?.title ?? '')
    const [chartConfig, setChartConfig] = useState<ChartConfig>(
        editComponent?.config?.chartConfig ?? DEFAULT_CHART_CONFIG,
    )
    const [queryData, setQueryData] = useState<QueryData | null>(initialQueryData)
    const [sqlQuery, setSqlQuery] = useState(editComponent?.query ?? '')

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
        const payload = {
            title: title.trim(),
            config,
            data,
            query: queryData.query,
            queryContext: { database: queryData.database, schema: queryData.schema },
        }

        if (editComponent) {
            updateComponent(editComponent.id, payload)
        } else {
            addComponent('chart', payload)
        }
        onClose()
    }, [queryData, title, chartConfig, addComponent, updateComponent, editComponent, onClose])

    return (
        <ChartCreateCtx value={{
            activeView, title, chartConfig, queryData, sqlQuery, isEditing,
            canSave, previewOption, editorContext,
            setActiveView, setTitle, handleConfigChange, setSqlQuery, handleQueryResults, handleSave,
        }}>
            {children}
        </ChartCreateCtx>
    )
}
