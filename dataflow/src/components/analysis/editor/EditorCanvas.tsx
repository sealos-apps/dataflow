import { useMemo } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import { useAnalysisStore, Dashboard } from "@/stores/useAnalysisStore";
import { DashboardWidget } from "./DashboardWidget";

// Import RGL styles
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

interface EditorCanvasProps {
    dashboard: Dashboard;
    isReadOnly: boolean;
    onEditComponent?: (id: string) => void;
    onMaximizeComponent?: (id: string) => void;
    onDeleteComponent?: (id: string) => void;
}

export function EditorCanvas({ dashboard, isReadOnly, onEditComponent, onMaximizeComponent, onDeleteComponent }: EditorCanvasProps) {
    const { updateLayout, selectComponent, selectedComponentId } = useAnalysisStore();

    const layouts = useMemo(() => {
        return {
            lg: dashboard.components.map(c => c.layout),
            md: dashboard.components.map((c, i) => ({
                ...c.layout,
                w: 5,
                h: 6, // Fixed height for consistency
                x: (i % 2) * 5,
                y: Math.floor(i / 2) * 6
            })),
            sm: dashboard.components.map((c, i) => ({
                ...c.layout,
                w: 3,
                h: 6, // Fixed height for consistency
                x: (i % 2) * 3,
                y: Math.floor(i / 2) * 6
            })),
            xs: dashboard.components.map((c, i) => ({ ...c.layout, w: 4, x: 0, y: i })), // 1 col
            xxs: dashboard.components.map((c, i) => ({ ...c.layout, w: 2, x: 0, y: i })) // 1 col
        };
    }, [dashboard.components]);

    const handleLayoutChange = (layout: any[]) => {
        if (!isReadOnly) {
            updateLayout(layout);
        }
    };

    return (
        <div className="p-4 min-h-[800px]">
            <ResponsiveGridLayout
                className="layout"
                layouts={layouts}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={60}
                isDraggable={!isReadOnly}
                isResizable={!isReadOnly}
                onLayoutChange={handleLayoutChange}
                margin={[16, 16]}
                containerPadding={[0, 0]}
                draggableHandle=".drag-handle"
            >
                {dashboard.components.map(component => (
                    <div key={component.layout.i} className="h-full">
                        <DashboardWidget
                            component={component}
                            isReadOnly={isReadOnly}
                            isSelected={selectedComponentId === component.id}
                            onEdit={onEditComponent}
                            onMaximize={onMaximizeComponent}
                            onDelete={onDeleteComponent}
                            onSelect={selectComponent}
                        />
                    </div>
                ))}
            </ResponsiveGridLayout>
        </div>
    );
}
