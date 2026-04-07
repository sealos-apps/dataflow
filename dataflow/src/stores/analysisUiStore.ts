import { create } from 'zustand'

type AnalysisUIState = {
  isChartModalOpen: boolean
  editingWidgetId: string | null
  selectedWidgetId: string | null
  maximizedWidgetId: string | null
  deletingWidgetId: string | null
  openCreateChartModal: () => void
  openEditChartModal: (widgetId: string) => void
  setChartModalOpen: (open: boolean) => void
  setSelectedWidgetId: (widgetId: string | null) => void
  setMaximizedWidgetId: (widgetId: string | null) => void
  setDeletingWidgetId: (widgetId: string | null) => void
}

export const useAnalysisUIStore = create<AnalysisUIState>((set) => ({
  isChartModalOpen: false,
  editingWidgetId: null,
  selectedWidgetId: null,
  maximizedWidgetId: null,
  deletingWidgetId: null,

  openCreateChartModal: () => set({
    isChartModalOpen: true,
    editingWidgetId: null,
  }),

  openEditChartModal: (widgetId) => set({
    isChartModalOpen: true,
    editingWidgetId: widgetId,
  }),

  setChartModalOpen: (open) => set(state => ({
    isChartModalOpen: open,
    editingWidgetId: open ? state.editingWidgetId : null,
  })),

  setSelectedWidgetId: (widgetId) => set({ selectedWidgetId: widgetId }),
  setMaximizedWidgetId: (widgetId) => set({ maximizedWidgetId: widgetId }),
  setDeletingWidgetId: (widgetId) => set({ deletingWidgetId: widgetId }),
}))
