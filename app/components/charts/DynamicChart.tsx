import { Bar, Bubble, Doughnut, Line, Pie, PolarArea, Radar, Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
  LogarithmicScale,
  // BubbleController, // Import if explicitly needed and available
} from 'chart.js';
import React from 'react';

// Register all necessary Chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
  LogarithmicScale
  // BubbleController // Register if needed
);

interface ChartConfig {
  type: string;
  data: any; // Consider defining a more specific type later
  options?: any; // Consider defining a more specific type later
}

interface ChartComponentProps {
  chartConfig: ChartConfig;
}

const ChartComponent: React.FC<ChartComponentProps> = ({ chartConfig }) => {
  if (!chartConfig || !chartConfig.type || !chartConfig.data) {
    return <div className="p-4 text-center text-red-500">Chart configuration is invalid.</div>;
  }

  const { type, data, options } = chartConfig;
  const chartOptions = options || {};

  // Ensure responsive and maintain aspect ratio for charts
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false, // Allow height to be controlled by container
    ...chartOptions, // Merge with user-provided options
  };

  // Wrapper div to control chart size
  // Added a bit more vertical space for better layout with titles/legends
  const chartWrapperStyle = "relative h-[450px] w-full p-4 bg-[var(--card-bg)] rounded-lg shadow-md";

  switch (type.toLowerCase()) {
    case 'bar':
      return <div className={chartWrapperStyle}><Bar data={data} options={defaultOptions} /></div>;
    case 'bubble':
      return <div className={chartWrapperStyle}><Bubble data={data} options={defaultOptions} /></div>;
    case 'doughnut':
      return <div className={chartWrapperStyle}><Doughnut data={data} options={defaultOptions} /></div>;
    case 'line':
      return <div className={chartWrapperStyle}><Line data={data} options={defaultOptions} /></div>;
    case 'pie':
      return <div className={chartWrapperStyle}><Pie data={data} options={defaultOptions} /></div>;
    case 'polararea':
      return <div className={chartWrapperStyle}><PolarArea data={data} options={defaultOptions} /></div>;
    case 'radar':
      return <div className={chartWrapperStyle}><Radar data={data} options={defaultOptions} /></div>;
    case 'scatter':
      return <div className={chartWrapperStyle}><Scatter data={data} options={defaultOptions} /></div>;
    default:
      return <div className="p-4 text-center text-yellow-500">{type} chart type is not yet supported.</div>;
  }
};

export default ChartComponent; 