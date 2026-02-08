/**
 * Converts E2B code-interpreter chart metadata to ECharts option.
 * Supports: bar, line, scatter, pie, box_and_whisker, superchart.
 * See docs/e2b/Code Interpreting/Charts & visualizations/1_Interactive charts.md
 */

import type { EChartsOption } from 'echarts';

export interface E2BChartElement {
  label: string;
  value: number | number[];
  group?: string;
}

export interface E2BChart {
  type?: string;
  title?: string;
  x_label?: string;
  y_label?: string;
  x_unit?: string | null;
  y_unit?: string | null;
  elements?: E2BChartElement[];
  /** superchart: raw ECharts option from E2B */
  option?: Record<string, unknown>;
}

const ECHARTS_COLORS = [
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452',
  '#9a60b4',
];

function normalizeType(t: unknown): string {
  if (typeof t !== 'string') return '';
  const s = t.toLowerCase().trim();
  if (s === 'box and whisker' || s === 'boxplot' || s === 'box_whisker') return 'box_and_whisker';
  return s;
}

function isBoxplotValue(v: unknown): v is [number, number, number, number, number] {
  return (
    Array.isArray(v) &&
    v.length >= 5 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

/**
 * Converts E2B chart to ECharts option. Returns null for invalid or unsupported data.
 * For superchart, returns the inner option with minimal validation.
 */
export function e2bChartToEChartsOption(e2b: unknown): EChartsOption | null {
  if (!e2b || typeof e2b !== 'object') return null;
  const c = e2b as E2BChart;
  const type = normalizeType(c.type);
  const title = typeof c.title === 'string' ? c.title : undefined;
  const xLabel = typeof c.x_label === 'string' ? c.x_label : undefined;
  const yLabel = typeof c.y_label === 'string' ? c.y_label : undefined;

  // superchart: pass through raw ECharts option
  if (type === 'superchart' && c.option && typeof c.option === 'object') {
    return c.option as EChartsOption;
  }

  const elements = Array.isArray(c.elements) ? c.elements : [];
  const validElements = elements.filter(
    (e): e is E2BChartElement =>
      e != null &&
      typeof e === 'object' &&
      typeof (e as E2BChartElement).label === 'string' &&
      (typeof (e as E2BChartElement).value === 'number' ||
        isBoxplotValue((e as E2BChartElement).value))
  );
  if (validElements.length === 0 && type !== 'superchart') return null;

  const baseTitle = title ? { text: title, left: 'center' as const } : undefined;

  switch (type) {
    case 'bar': {
      const labelOrder: string[] = [];
      const labelSet = new Set<string>();
      for (const e of validElements) {
        if (typeof e.value !== 'number') continue;
        if (!labelSet.has(e.label)) {
          labelSet.add(e.label);
          labelOrder.push(e.label);
        }
      }
      const groupNames = [...new Set(validElements.map((e) => e.group ?? 'Series 1'))];
      const series = groupNames.map((groupName, i) => ({
        name: groupName,
        type: 'bar' as const,
        data: labelOrder.map((l) => {
          const e = validElements.find(
            (x) => x.label === l && (x.group ?? 'Series 1') === groupName && typeof x.value === 'number'
          );
          return e ? (e.value as number) : 0;
        }),
        itemStyle: { color: ECHARTS_COLORS[i % ECHARTS_COLORS.length] },
      }));
      return {
        title: baseTitle,
        tooltip: { trigger: 'axis' as const },
        legend: { top: 24, data: groupNames },
        xAxis: { type: 'category' as const, data: labelOrder, name: xLabel },
        yAxis: { type: 'value' as const, name: yLabel },
        series,
      };
    }

    case 'line': {
      const labelOrder: string[] = [];
      const labelSet = new Set<string>();
      for (const e of validElements) {
        if (typeof e.value !== 'number') continue;
        if (!labelSet.has(e.label)) {
          labelSet.add(e.label);
          labelOrder.push(e.label);
        }
      }
      const groupNames = [...new Set(validElements.map((e) => e.group ?? 'Series 1'))];
      const series = groupNames.map((groupName, i) => ({
        name: groupName,
        type: 'line' as const,
        data: labelOrder.map((l) => {
          const e = validElements.find(
            (x) => x.label === l && (x.group ?? 'Series 1') === groupName && typeof x.value === 'number'
          );
          return e ? (e.value as number) : null;
        }),
        itemStyle: { color: ECHARTS_COLORS[i % ECHARTS_COLORS.length] },
      }));
      return {
        title: baseTitle,
        tooltip: { trigger: 'axis' as const },
        legend: { top: 24, data: groupNames },
        xAxis: { type: 'category' as const, data: labelOrder, name: xLabel },
        yAxis: { type: 'value' as const, name: yLabel },
        series,
      };
    }

    case 'scatter': {
      const data = validElements
        .filter((e): e is E2BChartElement & { value: number } => typeof e.value === 'number')
        .map((e, i) => {
          const x = Number.isFinite(Number(e.label)) ? Number(e.label) : i;
          return [x, e.value];
        });
      return {
        title: baseTitle,
        tooltip: { trigger: 'item' as const },
        xAxis: { type: 'value' as const, name: xLabel },
        yAxis: { type: 'value' as const, name: yLabel },
        series: [
          {
            type: 'scatter',
            data,
            itemStyle: { color: ECHARTS_COLORS[0] },
            symbolSize: 8,
          },
        ],
      };
    }

    case 'pie': {
      const pieData = validElements
        .filter((e): e is E2BChartElement & { value: number } => typeof e.value === 'number')
        .map((e, i) => ({
          name: e.label,
          value: e.value,
          itemStyle: { color: ECHARTS_COLORS[i % ECHARTS_COLORS.length] },
        }));
      return {
        title: baseTitle,
        tooltip: { trigger: 'item' as const },
        series: [
          {
            type: 'pie',
            radius: '60%',
            data: pieData,
            label: { show: true },
          },
        ],
      };
    }

    case 'box_and_whisker': {
      // E2B boxplot: elements with value as [min, Q1, median, Q3, max]
      const boxData: [number, number, number, number, number][] = [];
      const categories: string[] = [];
      for (const e of validElements) {
        if (!isBoxplotValue(e.value)) continue;
        categories.push(e.label);
        boxData.push(e.value);
      }
      if (boxData.length === 0) return null;
      return {
        title: baseTitle,
        tooltip: { trigger: 'item' as const },
        xAxis: { type: 'category' as const, data: categories, name: xLabel },
        yAxis: { type: 'value' as const, name: yLabel },
        series: [
          {
            type: 'boxplot',
            data: boxData,
            itemStyle: { color: ECHARTS_COLORS[0] },
          },
        ],
      };
    }

    default:
      return null;
  }
}
