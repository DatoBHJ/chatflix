'use client';

import React, { useRef, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Download } from 'lucide-react';

interface E2BChartEChartsProps {
  option: EChartsOption;
  height?: number;
  resultLabel?: string;
  chartIndex?: number;
  /** When true, hide the Save image button (e.g. for inline preview). */
  hideSaveButton?: boolean;
}

export function E2BChartECharts({
  option,
  height = 320,
  chartIndex = 0,
  hideSaveButton = false,
}: E2BChartEChartsProps) {
  const chartRef = useRef<ReactECharts>(null);

  const handleSaveImage = useCallback(() => {
    try {
      const instance = chartRef.current?.getEchartsInstance();
      if (!instance) return;
      const dataUrl = instance.getDataURL({ type: 'png', pixelRatio: 2 });
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `chart-${chartIndex + 1}.png`;
      link.click();
    } catch {
      // ignore
    }
  }, [chartIndex]);

  return (
    <div className="w-full">
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: `${height}px`, width: '100%' }}
        notMerge
        opts={{ renderer: 'canvas' }}
      />
      {!hideSaveButton && (
        <div className="mt-2">
          <button
            type="button"
            onClick={handleSaveImage}
            className="flex items-center gap-1.5 text-xs text-(--muted) hover:text-(--foreground)"
          >
            <Download size={12} /> Save image
          </button>
        </div>
      )}
    </div>
  );
}
