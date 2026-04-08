import { create } from 'zustand'

export type ActivityTab = 'connections' | 'analysis'

type LayoutState = {
  activeTab: ActivityTab
  setActiveTab: (tab: ActivityTab) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  activeTab: 'connections',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
