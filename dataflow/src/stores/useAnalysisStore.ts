import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { createTranslator } from '@/i18n/messages';
import type { MessageKey } from '@/i18n/messages';
import { resolveLocaleFromSearch } from '@/i18n/locale';

export type ComponentType = 'chart' | 'text' | 'image' | 'stats' | 'filter' | 'table';

export type RefreshRule = 'on-demand' | 'by-minute';

export interface DashboardComponent {
    id: string;
    type: ComponentType;
    title: string;
    description?: string;
    layout: {
        i: string;
        x: number;
        y: number;
        w: number;
        h: number;
    };
    data?: any;
    config?: any;
    /** SQL query string bound to this component for data refresh. */
    query?: string;
    /** Database/schema context for re-executing the query. */
    queryContext?: {
        database?: string;
        schema?: string;
    };
}

export interface Dashboard {
    id: string;
    name: string;
    description?: string;
    refreshRule: RefreshRule;
    thumbnail?: string;
    createdAt: number;
    updatedAt: number;
    components: DashboardComponent[];
}

const DEFAULT_TITLE_KEYS: Record<ComponentType, MessageKey> = {
    chart: 'analysis.defaultTitle.chart',
    table: 'analysis.defaultTitle.table',
    text: 'analysis.defaultTitle.text',
    image: 'analysis.defaultTitle.image',
    stats: 'analysis.defaultTitle.stats',
    filter: 'analysis.defaultTitle.filter',
};

function createAnalysisTranslator() {
    const locale = typeof window === 'undefined' ? 'zh' : resolveLocaleFromSearch(window.location.search);
    return createTranslator(locale);
}

interface AnalysisState {
    dashboards: Dashboard[];
    activeDashboardId: string | null;
    selectedComponentId: string | null;
    isEditorMode: boolean;
    isInitialized: boolean;

    // Actions
    initializeFromAPI: () => Promise<void>;
    createDashboard: (name: string, description?: string, refreshRule?: RefreshRule) => void;
    deleteDashboard: (id: string) => void;
    openDashboard: (id: string) => void;
    updateDashboard: (id: string, updates: Partial<Dashboard>) => void;

    addComponent: (type: ComponentType, config?: any) => void;
    removeComponent: (id: string) => void;
    updateComponent: (id: string, updates: Partial<DashboardComponent>) => void;
    updateLayout: (layout: any[]) => void;
    selectComponent: (id: string | null) => void;
    toggleEditorMode: () => void;

    // Modal State
    isChartModalOpen: boolean;
    toggleChartModal: (isOpen: boolean) => void;

    // Helper
    isDashboardNameExists: (name: string, excludeId?: string) => boolean;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
    dashboards: [],
    activeDashboardId: null,
    selectedComponentId: null,
    isEditorMode: false,
    isInitialized: false,

    initializeFromAPI: async () => {
        // No persistence backend — dashboards are in-memory only for now
        set({ isInitialized: true });
    },

    createDashboard: (name, description, refreshRule = 'on-demand') => {
        const id = uuidv4();
        const newDashboard: Dashboard = {
            id,
            name,
            description,
            refreshRule,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            components: []
        };

        set(state => ({
            dashboards: [newDashboard, ...state.dashboards],
            activeDashboardId: id,
            isEditorMode: true
        }));
    },

    deleteDashboard: (id) => {
        set(state => ({
            dashboards: state.dashboards.filter(d => d.id !== id),
            activeDashboardId: state.activeDashboardId === id ? null : state.activeDashboardId
        }));
    },

    openDashboard: (id) => {
        set({ activeDashboardId: id, isEditorMode: false, selectedComponentId: null });
    },

    updateDashboard: (id, updates) => {
        set(state => ({
            dashboards: state.dashboards.map(d =>
                d.id === id ? { ...d, ...updates, updatedAt: Date.now() } : d
            )
        }));
    },

    addComponent: (type, config: any = {}) => {
        const { activeDashboardId, dashboards } = get();
        if (!activeDashboardId) return;

        const dashboard = dashboards.find(d => d.id === activeDashboardId);
        if (!dashboard) return;

        const w = 4;
        const h = 6;
        let x = 0;
        let y = 0;

        const components = dashboard.components || [];
        if (components.length > 0) {
            const sorted = [...components].sort((a, b) => {
                const ay = a.layout.y === Infinity ? 999999 : a.layout.y;
                const by = b.layout.y === Infinity ? 999999 : b.layout.y;
                if (ay !== by) return ay - by;
                return a.layout.x - b.layout.x;
            });
            const last = sorted[sorted.length - 1];

            const maxY = components.reduce((max, c) => {
                if (c.layout.y === Infinity) return max;
                return Math.max(max, c.layout.y + c.layout.h);
            }, 0);

            const lastY = last.layout.y === Infinity ? maxY : last.layout.y;

            if (last.layout.x + last.layout.w + w <= 12) {
                x = last.layout.x + last.layout.w;
                y = lastY;
            } else {
                x = 0;
                y = maxY;
            }
        }

        const t = createAnalysisTranslator();
        const newComponent: DashboardComponent = {
            id: uuidv4(),
            type,
            title: config.title || t(DEFAULT_TITLE_KEYS[type]),
            ...config,
            layout: { i: uuidv4(), x, y, w, h },
        };

        set(state => ({
            dashboards: state.dashboards.map(d =>
                d.id === activeDashboardId
                    ? { ...d, components: [...d.components, newComponent], updatedAt: Date.now() }
                    : d
            ),
            selectedComponentId: newComponent.id
        }));
    },

    removeComponent: (id) => {
        const { activeDashboardId } = get();
        if (!activeDashboardId) return;

        set(state => ({
            dashboards: state.dashboards.map(d =>
                d.id === activeDashboardId
                    ? { ...d, components: d.components.filter(c => c.id !== id), updatedAt: Date.now() }
                    : d
            ),
            selectedComponentId: null
        }));
    },

    updateComponent: (id, updates) => {
        const { activeDashboardId } = get();
        if (!activeDashboardId) return;

        set(state => ({
            dashboards: state.dashboards.map(d =>
                d.id === activeDashboardId
                    ? {
                        ...d,
                        components: d.components.map(c => c.id === id ? { ...c, ...updates } : c),
                        updatedAt: Date.now()
                    }
                    : d
            )
        }));
    },

    updateLayout: (layout) => {
        const { activeDashboardId } = get();
        if (!activeDashboardId) return;

        set(state => ({
            dashboards: state.dashboards.map(d =>
                d.id === activeDashboardId
                    ? {
                        ...d,
                        components: d.components.map(c => {
                            const layoutItem = layout.find((l: any) => l.i === c.layout.i);
                            if (layoutItem) {
                                return {
                                    ...c,
                                    layout: {
                                        ...c.layout,
                                        x: layoutItem.x,
                                        y: layoutItem.y,
                                        w: layoutItem.w,
                                        h: layoutItem.h
                                    }
                                };
                            }
                            return c;
                        }),
                        updatedAt: Date.now()
                    }
                    : d
            )
        }));
    },

    selectComponent: (id) => set({ selectedComponentId: id }),
    toggleEditorMode: () => set(state => ({ isEditorMode: !state.isEditorMode })),

    isChartModalOpen: false,
    toggleChartModal: (isOpen) => set({ isChartModalOpen: isOpen }),

    isDashboardNameExists: (name, excludeId) => {
        const { dashboards } = get();
        const normalizedName = name.trim().toLowerCase();
        return dashboards.some(d =>
            d.name.trim().toLowerCase() === normalizedName && d.id !== excludeId
        );
    }
}));
