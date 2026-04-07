import React, { useRef, useEffect, useState, memo, useImperativeHandle } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import {
    TitleComponent,
    TooltipComponent,
    GridComponent,
    LegendComponent,
    DataZoomComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

// Register ECharts components
echarts.use([
    BarChart,
    LineChart,
    PieChart,
    ScatterChart,
    TitleComponent,
    TooltipComponent,
    GridComponent,
    LegendComponent,
    DataZoomComponent,
    SVGRenderer,
]);

export interface NativeEChartsHandle {
    exportPNG: (pixelRatio?: number) => Promise<Blob | null>;
}

interface NativeEChartsProps {
    option: any;
    style?: React.CSSProperties;
    className?: string;
    ref?: React.Ref<NativeEChartsHandle>;
}

/**
 * Native ECharts component that bypasses echarts-for-react completely
 * to avoid the resize observer crash bug in React 18 StrictMode
 */
export const NativeECharts = memo(function NativeECharts({ option, style, className, ref }: NativeEChartsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<echarts.ECharts | null>(null);
    const [isReady, setIsReady] = useState(false);
    const observerRef = useRef<ResizeObserver | null>(null);

    useImperativeHandle(ref, () => ({
        exportPNG: async (pixelRatio = 2) => {
            const chart = chartRef.current;
            const container = containerRef.current;
            if (!chart || chart.isDisposed() || !container) return null;

            const svgDataURL = chart.getDataURL({ type: 'svg' });
            const width = container.clientWidth;
            const height = container.clientHeight;

            const { svgDataURLToPNG } = await import('@/utils/export-utils');
            return svgDataURLToPNG(svgDataURL, width, height, pixelRatio);
        },
    }));

    // Initialize chart when container is ready with dimensions
    useEffect(() => {
        let mounted = true;
        let attempts = 0;
        const maxAttempts = 30;

        const initChart = () => {
            if (!mounted) return;

            const container = containerRef.current;
            if (!container) return;

            // Wait for container to have dimensions
            if (container.clientWidth <= 0 || container.clientHeight <= 0) {
                if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(initChart, 50);
                    return;
                }
            }

            // Dispose existing chart if any
            if (chartRef.current) {
                chartRef.current.dispose();
                chartRef.current = null;
            }

            // Create new chart instance
            chartRef.current = echarts.init(container, undefined, { renderer: 'svg' });
            chartRef.current.setOption(option);
            setIsReady(true);
        };

        // Small delay to let layout settle
        const timer = setTimeout(initChart, 150);

        return () => {
            mounted = false;
            clearTimeout(timer);
            // Safely dispose chart
            if (chartRef.current) {
                try {
                    chartRef.current.dispose();
                } catch (e) {
                    // Ignore disposal errors
                }
                chartRef.current = null;
            }
        };
    }, []);

    // Update option when it changes
    useEffect(() => {
        if (chartRef.current && isReady) {
            try {
                chartRef.current.setOption(option, { notMerge: true, lazyUpdate: true });
            } catch (e) {
                // Ignore option update errors
            }
        }
    }, [option, isReady]);

    // Handle resize with ResizeObserver
    useEffect(() => {
        if (!isReady) return;

        const resizeChart = () => {
            if (chartRef.current && !chartRef.current.isDisposed()) {
                try {
                    chartRef.current.resize();
                } catch (e) {
                    // Ignore resize errors
                }
            }
        };

        const container = containerRef.current;
        if (!container) return;

        // Set up ResizeObserver
        observerRef.current = new ResizeObserver(() => {
            requestAnimationFrame(resizeChart);
        });
        observerRef.current.observe(container);

        // Initial resize after layout settles
        const timers = [
            setTimeout(resizeChart, 100),
            setTimeout(resizeChart, 300),
            setTimeout(resizeChart, 600)
        ];

        return () => {
            timers.forEach(clearTimeout);
            if (observerRef.current) {
                try {
                    observerRef.current.disconnect();
                } catch (e) {
                    // Ignore cleanup errors
                }
                observerRef.current = null;
            }
        };
    }, [isReady]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{ width: '100%', height: '100%', minHeight: '200px', ...style }}
        />
    );
});
