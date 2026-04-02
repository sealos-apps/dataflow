import { create } from 'zustand'

import { graphqlClient } from '@/config/graphql-client'
import type { ChartConfig, QueryData } from '@/components/analysis/chart-utils'
import {
  AddWidgetDocument,
  type AddWidgetMutation,
  type AddWidgetMutationVariables,
  CreateDashboardDocument,
  type CreateDashboardMutation,
  type CreateDashboardMutationVariables,
  DeleteDashboardDocument,
  type DeleteDashboardMutation,
  type DeleteDashboardMutationVariables,
  DeleteWidgetDocument,
  type DeleteWidgetMutation,
  type DeleteWidgetMutationVariables,
  GetDashboardsDocument,
  type GetDashboardsQuery,
  type GetDashboardsQueryVariables,
  type LayoutInput as GqlLayoutInput,
  type SnapshotInput as GqlSnapshotInput,
  UpdateDashboardDocument,
  type UpdateDashboardMutation,
  type UpdateDashboardMutationVariables,
  UpdateWidgetDocument,
  type UpdateWidgetInput as GqlUpdateWidgetInput,
  type UpdateWidgetMutation,
  type UpdateWidgetMutationVariables,
  UpdateWidgetLayoutsDocument,
  type UpdateWidgetLayoutsMutation,
  type UpdateWidgetLayoutsMutationVariables,
  UpdateWidgetSnapshotDocument,
  type UpdateWidgetSnapshotMutation,
  type UpdateWidgetSnapshotMutationVariables,
  type WidgetInput as GqlWidgetInput,
} from '@graphql'

export type RefreshRule = 'on-demand' | 'by-minute'

export type WidgetLayout = {
  i: string
  x: number
  y: number
  w: number
  h: number
}

export type WidgetQueryContext = {
  database?: string
  schema?: string
}

export type WidgetVisualization = {
  chartConfig: ChartConfig
}

export type WidgetSnapshot = {
  config: any
  data: any
  executedAt: string
}

export type ChartWidgetDefinition = {
  id: string
  type: 'chart'
  title: string
  description?: string
  layout: WidgetLayout
  query?: string
  queryContext?: WidgetQueryContext
  visualization?: WidgetVisualization
  snapshot?: WidgetSnapshot
  sortOrder: number
}

export type DashboardDefinition = {
  id: string
  name: string
  description?: string
  refreshRule: RefreshRule
  widgets: ChartWidgetDefinition[]
  createdAt: string
  updatedAt: string
}

export type WidgetMutationPayload = {
  title?: string
  description?: string
  layout: WidgetLayout
  query?: string
  queryContext?: WidgetQueryContext
  visualization?: WidgetVisualization
  snapshot?: WidgetSnapshot
  sortOrder?: number
}

type DashboardNode = GetDashboardsQuery['GetDashboards'][number]
type WidgetNode = DashboardNode['Widgets'][number]

type AnalysisDefinitionState = {
  dashboards: DashboardDefinition[]
  activeDashboardId: string | null
  isInitialized: boolean
  loadError: string | null
  initializeFromAPI: () => Promise<void>
  openDashboard: (id: string) => void
  createDashboard: (name: string, description?: string, refreshRule?: RefreshRule) => Promise<DashboardDefinition>
  updateDashboard: (id: string, updates: { name?: string; description?: string; refreshRule?: RefreshRule }) => Promise<DashboardDefinition>
  deleteDashboard: (id: string) => Promise<void>
  addWidget: (dashboardId: string, payload: WidgetMutationPayload) => Promise<ChartWidgetDefinition>
  updateWidget: (id: string, payload: Partial<WidgetMutationPayload>) => Promise<ChartWidgetDefinition>
  deleteWidget: (id: string) => Promise<void>
  updateWidgetLayouts: (dashboardId: string, layouts: WidgetLayout[]) => Promise<void>
  updateWidgetSnapshot: (id: string, snapshot: WidgetSnapshot) => Promise<void>
  isDashboardNameExists: (name: string, excludeId?: string) => boolean
}

function parseJSONField<T>(value?: string | null): T | undefined {
  if (!value) return undefined
  return JSON.parse(value) as T
}

function mapWidget(node: WidgetNode): ChartWidgetDefinition {
  return {
    id: node.ID,
    type: 'chart',
    title: node.Title,
    description: node.Description ?? undefined,
    layout: parseJSONField<WidgetLayout>(node.Layout)!,
    query: node.Query ?? undefined,
    queryContext: parseJSONField<WidgetQueryContext>(node.QueryContext),
    visualization: parseJSONField<WidgetVisualization>(node.Visualization),
    snapshot: parseJSONField<WidgetSnapshot>(node.Snapshot),
    sortOrder: node.SortOrder,
  }
}

function mapDashboard(node: DashboardNode): DashboardDefinition {
  return {
    id: node.ID,
    name: node.Name,
    description: node.Description ?? undefined,
    refreshRule: node.RefreshRule as RefreshRule,
    widgets: [...node.Widgets].map(mapWidget).sort((a, b) => a.sortOrder - b.sortOrder),
    createdAt: node.CreatedAt,
    updatedAt: node.UpdatedAt,
  }
}

function widgetToGraphQLInput(payload: WidgetMutationPayload): GqlWidgetInput {
  return {
    Type: 'chart',
    Title: payload.title ?? '',
    Description: payload.description,
    Layout: JSON.stringify(payload.layout),
    Query: payload.query,
    QueryContext: payload.queryContext ? JSON.stringify(payload.queryContext) : undefined,
    Visualization: payload.visualization ? JSON.stringify(payload.visualization) : undefined,
    Snapshot: payload.snapshot ? JSON.stringify(payload.snapshot) : undefined,
    SortOrder: payload.sortOrder,
  }
}

function widgetToGraphQLUpdateInput(payload: Partial<WidgetMutationPayload>): GqlUpdateWidgetInput {
  return {
    Title: payload.title,
    Description: payload.description,
    Layout: payload.layout ? JSON.stringify(payload.layout) : undefined,
    Query: payload.query,
    QueryContext: payload.queryContext ? JSON.stringify(payload.queryContext) : undefined,
    Visualization: payload.visualization ? JSON.stringify(payload.visualization) : undefined,
    Snapshot: payload.snapshot ? JSON.stringify(payload.snapshot) : undefined,
    SortOrder: payload.sortOrder,
  }
}

function getNextActiveDashboardId(dashboards: DashboardDefinition[], deletedId: string): string | null {
  const remaining = dashboards.filter(dashboard => dashboard.id !== deletedId)
  return remaining[0]?.id ?? null
}

export const useAnalysisDefinitionStore = create<AnalysisDefinitionState>((set, get) => ({
  dashboards: [],
  activeDashboardId: null,
  isInitialized: false,
  loadError: null,

  initializeFromAPI: async () => {
    try {
      const { data } = await graphqlClient.query<GetDashboardsQuery, GetDashboardsQueryVariables>({
        query: GetDashboardsDocument,
      })
      const dashboards = data.GetDashboards.map(mapDashboard)
      set(state => ({
        dashboards,
        activeDashboardId: state.activeDashboardId && dashboards.some(d => d.id === state.activeDashboardId)
          ? state.activeDashboardId
          : dashboards[0]?.id ?? null,
        isInitialized: true,
        loadError: null,
      }))
    } catch (error: any) {
      set({
        dashboards: [],
        activeDashboardId: null,
        isInitialized: true,
        loadError: error.message ?? 'Failed to load dashboards',
      })
    }
  },

  openDashboard: (id) => set({ activeDashboardId: id }),

  createDashboard: async (name, description, refreshRule = 'on-demand') => {
    const { data } = await graphqlClient.mutate<CreateDashboardMutation, CreateDashboardMutationVariables>({
      mutation: CreateDashboardDocument,
      variables: {
        name,
        description,
        refreshRule,
      },
    })

    const dashboard = mapDashboard(data!.CreateDashboard)
    set(state => ({
      dashboards: [dashboard, ...state.dashboards],
      activeDashboardId: dashboard.id,
      loadError: null,
    }))
    return dashboard
  },

  updateDashboard: async (id, updates) => {
    const { data } = await graphqlClient.mutate<UpdateDashboardMutation, UpdateDashboardMutationVariables>({
      mutation: UpdateDashboardDocument,
      variables: {
        id,
        name: updates.name,
        description: updates.description,
        refreshRule: updates.refreshRule,
      },
    })

    const dashboard = mapDashboard(data!.UpdateDashboard)
    set(state => ({
      dashboards: state.dashboards.map(item => item.id === id ? dashboard : item),
    }))
    return dashboard
  },

  deleteDashboard: async (id) => {
    await graphqlClient.mutate<DeleteDashboardMutation, DeleteDashboardMutationVariables>({
      mutation: DeleteDashboardDocument,
      variables: { id },
    })

    set(state => ({
      dashboards: state.dashboards.filter(dashboard => dashboard.id !== id),
      activeDashboardId: state.activeDashboardId === id
        ? getNextActiveDashboardId(state.dashboards, id)
        : state.activeDashboardId,
    }))
  },

  addWidget: async (dashboardId, payload) => {
    const { data } = await graphqlClient.mutate<AddWidgetMutation, AddWidgetMutationVariables>({
      mutation: AddWidgetDocument,
      variables: {
        dashboardId,
        input: widgetToGraphQLInput(payload),
      },
    })

    const widget = mapWidget({
      ...data!.AddWidget,
    } as WidgetNode)

    set(state => ({
      dashboards: state.dashboards.map(dashboard => dashboard.id === dashboardId
        ? {
            ...dashboard,
            widgets: [...dashboard.widgets, widget].sort((a, b) => a.sortOrder - b.sortOrder),
          }
        : dashboard),
    }))

    return widget
  },

  updateWidget: async (id, payload) => {
    const { data } = await graphqlClient.mutate<UpdateWidgetMutation, UpdateWidgetMutationVariables>({
      mutation: UpdateWidgetDocument,
      variables: {
        id,
        input: widgetToGraphQLUpdateInput(payload),
      },
    })

    const widget = mapWidget({
      ...data!.UpdateWidget,
    } as WidgetNode)

    set(state => ({
      dashboards: state.dashboards.map(dashboard => ({
        ...dashboard,
        widgets: dashboard.widgets.map(item => item.id === id ? widget : item),
      })),
    }))

    return widget
  },

  deleteWidget: async (id) => {
    await graphqlClient.mutate<DeleteWidgetMutation, DeleteWidgetMutationVariables>({
      mutation: DeleteWidgetDocument,
      variables: { id },
    })

    set(state => ({
      dashboards: state.dashboards.map(dashboard => ({
        ...dashboard,
        widgets: dashboard.widgets.filter(widget => widget.id !== id),
      })),
    }))
  },

  updateWidgetLayouts: async (dashboardId, layouts) => {
    set(state => ({
      dashboards: state.dashboards.map(dashboard => dashboard.id === dashboardId
        ? {
            ...dashboard,
            widgets: dashboard.widgets.map(widget => {
              const layout = layouts.find(item => item.i === widget.layout.i)
              if (!layout) return widget
              return { ...widget, layout }
            }),
          }
        : dashboard),
    }))

    const gqlLayouts: GqlLayoutInput[] = layouts.map(layout => ({
      WidgetID: get().dashboards
        .find(dashboard => dashboard.id === dashboardId)
        ?.widgets.find(widget => widget.layout.i === layout.i)?.id ?? '',
      Layout: JSON.stringify(layout),
    }))

    await graphqlClient.mutate<UpdateWidgetLayoutsMutation, UpdateWidgetLayoutsMutationVariables>({
      mutation: UpdateWidgetLayoutsDocument,
      variables: {
        dashboardId,
        layouts: gqlLayouts,
      },
    })
  },

  updateWidgetSnapshot: async (id, snapshot) => {
    set(state => ({
      dashboards: state.dashboards.map(dashboard => ({
        ...dashboard,
        widgets: dashboard.widgets.map(widget => widget.id === id ? { ...widget, snapshot } : widget),
      })),
    }))

    const gqlSnapshot: GqlSnapshotInput = {
      Config: JSON.stringify(snapshot.config),
      Data: JSON.stringify(snapshot.data),
      ExecutedAt: snapshot.executedAt,
    }

    await graphqlClient.mutate<UpdateWidgetSnapshotMutation, UpdateWidgetSnapshotMutationVariables>({
      mutation: UpdateWidgetSnapshotDocument,
      variables: {
        id,
        snapshot: gqlSnapshot,
      },
    })
  },

  isDashboardNameExists: (name, excludeId) => {
    const normalized = name.trim().toLowerCase()
    return get().dashboards.some(dashboard => dashboard.id !== excludeId && dashboard.name.trim().toLowerCase() === normalized)
  },
}))

export function getActiveDashboard(): DashboardDefinition | undefined {
  const state = useAnalysisDefinitionStore.getState()
  return state.dashboards.find(dashboard => dashboard.id === state.activeDashboardId)
}

export function buildQueryDataFromWidget(widget: ChartWidgetDefinition): QueryData | null {
  if (!widget.query) return null
  return {
    columns: [],
    rows: [],
    query: widget.query,
    database: widget.queryContext?.database,
    schema: widget.queryContext?.schema,
  }
}
