/**
 * Converts E2B code-interpreter chart metadata to Chart.js config.
 * E2B returns { type, title, x_label, y_label, elements: [{ label, value, group? }] }.
 * See docs/e2b/Code Interpreting/Charts & visualizations/1_Interactive charts.md
 */

export interface E2BChartElement {
  label: string;
  value: number;
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
}

export interface ChartJsConfig {
  type: string;
  data: {
    labels?: string[];
    datasets: Array<{
      label?: string;
      data: number[] | Array<{ x: number; y: number }>;
      backgroundColor?: string | string[];
    }>;
  };
  options?: Record<string, unknown>;
}

const CHART_JS_COLORS = [
  'rgba(54, 162, 235, 0.8)',
  'rgba(255, 99, 132, 0.8)',
  'rgba(255, 206, 86, 0.8)',
  'rgba(75, 192, 192, 0.8)',
  'rgba(153, 102, 255, 0.8)',
  'rgba(255, 159, 64, 0.8)',
];

function normalizeType(t: unknown): string {
  if (typeof t !== 'string') return '';
  const s = t.toLowerCase().trim();
  if (s === 'box and whisker' || s === 'boxplot' || s === 'box_whisker') return 'boxplot';
  return s;
}

/**
 * Converts E2B chart to Chart.js config. Returns null for unsupported types (e.g. boxplot) or invalid data.
 */
export function e2bChartToChartJs(e2b: unknown): ChartJsConfig | null {
  if (!e2b || typeof e2b !== 'object') return null;
  const c = e2b as Record<string, unknown>;
  const type = normalizeType(c.type);
  const elements = Array.isArray(c.elements) ? c.elements : [];
  const title = typeof c.title === 'string' ? c.title : undefined;
  const xLabel = typeof c.x_label === 'string' ? c.x_label : undefined;
  const yLabel = typeof c.y_label === 'string' ? c.y_label : undefined;

  if (type === 'boxplot') return null;

  const validElements = elements.filter(
    (e): e is E2BChartElement =>
      e != null &&
      typeof e === 'object' &&
      typeof (e as E2BChartElement).label === 'string' &&
      typeof (e as E2BChartElement).value === 'number'
  );
  if (validElements.length === 0) return null;

  const buildOptions = (): ChartJsConfig['options'] => ({
    plugins: {
      title: title ? { display: true, text: title } : undefined,
    },
    scales:
      type === 'bar' || type === 'line' || type === 'scatter'
        ? {
            x: { title: xLabel ? { display: true, text: xLabel } : undefined },
            y: { title: yLabel ? { display: true, text: yLabel } : undefined },
          }
        : undefined,
  });

  switch (type) {
    case 'bar':
    case 'line': {
      const labelOrder: string[] = [];
      const labelSet = new Set<string>();
      for (const e of validElements) {
        if (!labelSet.has(e.label)) {
          labelSet.add(e.label);
          labelOrder.push(e.label);
        }
      }
      const groupNames = [...new Set(validElements.map((e) => e.group ?? 'Series 1'))];
      const datasets = groupNames.map((groupName, i) => ({
        label: groupName,
        data: labelOrder.map((l) => {
          const e = validElements.find((x) => x.label === l && (x.group ?? 'Series 1') === groupName);
          return e ? e.value : 0;
        }),
        backgroundColor: type === 'bar' ? CHART_JS_COLORS[i % CHART_JS_COLORS.length] : undefined,
      }));
      return {
        type,
        data: { labels: labelOrder, datasets },
        options: buildOptions(),
      };
    }
    case 'pie': {
      const labels = validElements.map((e) => e.label);
      const data = validElements.map((e) => e.value);
      return {
        type: 'pie',
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: labels.map((_, i) => CHART_JS_COLORS[i % CHART_JS_COLORS.length]),
            },
          ],
        },
        options: buildOptions(),
      };
    }
    case 'scatter': {
      const points = validElements.map((e, i) => {
        const x = Number.isFinite(Number(e.label)) ? Number(e.label) : i;
        return { x, y: e.value };
      });
      return {
        type: 'scatter',
        data: {
          datasets: [{ label: yLabel ?? 'Value', data: points }],
        },
        options: buildOptions(),
      };
    }
    default:
      return null;
  }
}
