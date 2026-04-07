import { beforeEach, describe, expect, it, vi } from 'vitest'

import { graphqlClient } from '@/config/graphql-client'
import { useAnalysisDefinitionStore } from '@/stores/analysisDefinitionStore'

describe('analysisDefinitionStore', () => {
  beforeEach(() => {
    useAnalysisDefinitionStore.setState({
      dashboards: [],
      activeDashboardId: null,
      isInitialized: false,
      loadError: null,
    })
  })

  it('hydrates dashboards from GetDashboards and selects the first dashboard', async () => {
    vi.spyOn(graphqlClient, 'query').mockResolvedValue({
      data: {
        GetDashboards: [{
          ID: 'dash-1',
          Name: 'Revenue',
          Description: 'Monthly revenue dashboard',
          RefreshRule: 'on-demand',
          CreatedAt: '2026-04-02T00:00:00Z',
          UpdatedAt: '2026-04-02T00:00:00Z',
          Widgets: [{
            ID: 'widget-1',
            Type: 'chart',
            Title: 'Monthly revenue',
            Description: 'Primary KPI',
            Layout: '{"i":"widget-1","x":0,"y":0,"w":4,"h":6}',
            Query: 'select month, revenue from revenue_by_month',
            QueryContext: '{"database":"analytics","schema":"public"}',
            Visualization: '{"chartConfig":{"chartType":"bar","xAxisColumn":"month","yAxisColumns":["revenue"],"options":{"showLegend":true,"showGridLines":true,"showDataLabels":false},"sortBy":"data","sortOrder":"asc"}}',
            Snapshot: '{"config":{"type":"bar","xAxis":["Jan"],"series":[{"name":"revenue","type":"bar","data":[10]}],"chartConfig":{"chartType":"bar","xAxisColumn":"month","yAxisColumns":["revenue"],"options":{"showLegend":true,"showGridLines":true,"showDataLabels":false},"sortBy":"data","sortOrder":"asc"}},"data":{},"executedAt":"2026-04-02T00:00:00Z"}',
            SortOrder: 0,
          }],
        }],
      },
    } as never)

    await useAnalysisDefinitionStore.getState().initializeFromAPI()

    const state = useAnalysisDefinitionStore.getState()
    expect(state.dashboards).toHaveLength(1)
    expect(state.activeDashboardId).toBe('dash-1')
    expect(state.dashboards[0]?.widgets[0]?.layout).toEqual({
      i: 'widget-1',
      x: 0,
      y: 0,
      w: 4,
      h: 6,
    })
    expect(state.dashboards[0]?.widgets[0]?.snapshot?.executedAt).toBe('2026-04-02T00:00:00Z')
  })
})
