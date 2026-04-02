import { create } from 'zustand'

import { toWidgetConfig, type ChartConfig } from '@/components/analysis/chart-utils'
import { graphqlClient } from '@/config/graphql-client'
import { getActiveDashboard, useAnalysisDefinitionStore } from '@/stores/analysisDefinitionStore'
import { RawExecuteDocument, type RawExecuteQuery, type RawExecuteQueryVariables } from '@graphql'

export type WidgetRuntimeState = {
  status: 'idle' | 'loading' | 'success' | 'error'
  config?: any
  data?: any
  executedAt?: string
  error?: string
  isStale: boolean
}

type AnalysisRuntimeState = {
  widgetStatesById: Record<string, WidgetRuntimeState>
  refreshDashboard: (dashboardId: string) => Promise<void>
  refreshWidget: (widgetId: string) => Promise<void>
  clearDashboardRuntime: (dashboardId: string) => void
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unknown refresh error'
}

export const useAnalysisRuntimeStore = create<AnalysisRuntimeState>((set) => ({
  widgetStatesById: {},

  refreshDashboard: async (dashboardId) => {
    const dashboard = useAnalysisDefinitionStore.getState().dashboards.find(item => item.id === dashboardId)
    if (!dashboard) return

    await Promise.all(dashboard.widgets.map(widget => useAnalysisRuntimeStore.getState().refreshWidget(widget.id)))
  },

  refreshWidget: async (widgetId) => {
    const dashboard = getActiveDashboard() ?? useAnalysisDefinitionStore.getState().dashboards
      .find(item => item.widgets.some(widget => widget.id === widgetId))
    const widget = dashboard?.widgets.find(item => item.id === widgetId)
    if (!widget || !widget.query || !widget.visualization?.chartConfig) return

    set(state => ({
      widgetStatesById: {
        ...state.widgetStatesById,
        [widgetId]: {
          ...state.widgetStatesById[widgetId],
          status: 'loading',
          error: undefined,
          isStale: !!widget.snapshot,
        },
      },
    }))

    try {
      const { data, errors } = await graphqlClient.query<RawExecuteQuery, RawExecuteQueryVariables>({
        query: RawExecuteDocument,
        variables: { query: widget.query },
        fetchPolicy: 'no-cache',
        context: widget.queryContext?.database ? { database: widget.queryContext.database } : undefined,
      })

      if (errors?.length) {
        throw new Error(errors[0].message)
      }

      const raw = data?.RawExecute
      if (!raw) {
        throw new Error('No query result returned')
      }

      const columns = raw.Columns.map(column => column.Name)
      const rows = raw.Rows.map(row => Object.fromEntries(columns.map((column, index) => [column, row[index]])))

      const chartConfig = widget.visualization.chartConfig as ChartConfig
      const { config, data: widgetData } = toWidgetConfig(chartConfig, {
        columns,
        rows,
        query: widget.query,
        database: widget.queryContext?.database,
        schema: widget.queryContext?.schema,
      })

      const executedAt = new Date().toISOString()
      set(state => ({
        widgetStatesById: {
          ...state.widgetStatesById,
          [widgetId]: {
            status: 'success',
            config,
            data: widgetData,
            executedAt,
            error: undefined,
            isStale: false,
          },
        },
      }))

      void useAnalysisDefinitionStore.getState().updateWidgetSnapshot(widgetId, {
        config,
        data: widgetData,
        executedAt,
      })
    } catch (error) {
      set(state => ({
        widgetStatesById: {
          ...state.widgetStatesById,
          [widgetId]: {
            status: 'error',
            error: toErrorMessage(error),
            isStale: true,
          },
        },
      }))
    }
  },

  clearDashboardRuntime: (dashboardId) => {
    const dashboard = useAnalysisDefinitionStore.getState().dashboards.find(item => item.id === dashboardId)
    if (!dashboard) return

    const ids = new Set(dashboard.widgets.map(widget => widget.id))
    set(state => ({
      widgetStatesById: Object.fromEntries(
        Object.entries(state.widgetStatesById).filter(([id]) => !ids.has(id)),
      ),
    }))
  },
}))
