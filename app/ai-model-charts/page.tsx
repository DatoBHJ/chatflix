'use client';

import dynamic from 'next/dynamic';
import Head from 'next/head';
import React from 'react';

// Dynamically import the ChartComponent with SSR turned off
const DynamicChart = dynamic(() => import('../components/charts/DynamicChart'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[450px] w-full bg-[var(--card-bg)] rounded-lg shadow-md">
      <p className="text-[var(--muted-foreground)]">Loading Chart...</p>
      {/* You can add a spinner or a more sophisticated skeleton loader here */}
    </div>
  ),
});

// Sample Bar Chart Configuration (Claude 4 vs Gemini 2.5 Pro)
const barChartConfigFromGrok = {
  type: 'bar',
  data: {
    labels: ['SWE-bench (Coding)', 'GPQA (Reasoning)', 'AIME (Math)'],
    datasets: [
      {
        label: 'Claude 4',
        data: [72.5, 86.0, 82.0],
        backgroundColor: 'rgba(255, 107, 107, 0.7)', // Using RGBA for semi-transparent fill
        borderColor: '#C44545',
        borderWidth: 1,
        borderRadius: 5, // Rounded bars
      },
      {
        label: 'Gemini 2.5 Pro',
        data: [63.8, 84.0, 92.0],
        backgroundColor: 'rgba(78, 205, 196, 0.7)', // Using RGBA for semi-transparent fill
        borderColor: '#3A9A93',
        borderWidth: 1,
        borderRadius: 5, // Rounded bars
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Performance (%)',
          font: { size: 14, weight: 'bold' as const },
          color: 'var(--foreground)',
        },
        ticks: { color: 'var(--muted-foreground)' },
        grid: { color: 'var(--border)' },
      },
      x: {
        title: {
          display: true,
          text: 'Benchmark',
          font: { size: 14, weight: 'bold' as const },
          color: 'var(--foreground)',
        },
        ticks: { color: 'var(--muted-foreground)' },
        grid: { color: 'var(--border)' },
      },
    },
    plugins: {
      title: {
        display: true,
        text: 'Claude 4 vs Gemini 2.5 Pro: Benchmark Comparison',
        font: { size: 18, weight: 'bold' as const },
        color: 'var(--foreground)',
        padding: { top: 10, bottom: 20 },
      },
      legend: {
        position: 'top' as const,
        labels: { 
            color: 'var(--foreground)',
            font: { size: 12 },
        },
      },
      tooltip: {
        backgroundColor: 'var(--popover-bg)',
        titleColor: 'var(--popover-foreground)',
        bodyColor: 'var(--popover-foreground)',
        borderColor: 'var(--border)',
        borderWidth: 1,
      }
    },
    // Added some padding to the chart area
    layout: {
        padding: 10
    }
  },
};

// Sample Bubble Chart Configuration
const bubbleChartConfigFromGrok = {
  type: 'bubble',
  data: {
    datasets: [
      {
        label: 'Claude 4',
        data: [
          { x: 1, y: 72.5, r: 20 }, // Increased radius for better visibility
          { x: 2, y: 86.0, r: 15 },
          { x: 3, y: 82.0, r: 18 },
        ],
        backgroundColor: 'rgba(255, 107, 107, 0.6)',
        borderColor: '#C44545',
      },
      {
        label: 'Gemini 2.5 Pro',
        data: [
          { x: 1, y: 63.8, r: 20 },
          { x: 2, y: 84.0, r: 15 },
          { x: 3, y: 92.0, r: 18 },
        ],
        backgroundColor: 'rgba(78, 205, 196, 0.6)',
        borderColor: '#3A9A93',
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Performance (%)',
          font: { size: 14, weight: 'bold' as const },
          color: 'var(--foreground)',
        },
        ticks: { color: 'var(--muted-foreground)' },
        grid: { color: 'var(--border)' },
      },
      x: {
        min: 0,
        max: 4, // Adjusted for better spacing
        ticks: {
          color: 'var(--muted-foreground)',
          callback: function (value: number) {
            // Ensure value is treated as number for array indexing
            return ['', 'SWE-bench', 'GPQA', 'AIME', ''][value] || '';
          },
        },
        title: {
          display: true,
          text: 'Benchmark',
          font: { size: 14, weight: 'bold' as const },
          color: 'var(--foreground)',
        },
        grid: { color: 'var(--border)' },
      },
    },
    plugins: {
      title: {
        display: true,
        text: 'Claude 4 vs Gemini 2.5 Pro: Bubble Comparison',
        font: { size: 18, weight: 'bold' as const },
        color: 'var(--foreground)',
        padding: { top: 10, bottom: 20 },
      },
      legend: {
        position: 'top' as const,
        labels: { 
            color: 'var(--foreground)',
            font: { size: 12 },
        },
      },
      tooltip: {
        backgroundColor: 'var(--popover-bg)',
        titleColor: 'var(--popover-foreground)',
        bodyColor: 'var(--popover-foreground)',
        borderColor: 'var(--border)',
        borderWidth: 1,
        callbacks: {
            label: function(context: any) {
                let label = context.dataset.label || '';
                if (label) {
                    label += ': ';
                }
                if (context.parsed.y !== null) {
                    label += `Performance: ${context.parsed.y}%, Size: ${context.raw.r}`;
                }
                return label;
            }
        }
      }
    },
    layout: {
        padding: 10
    }
  },
};

export default function MyChartPage() {
  const chartConfigs = [
    barChartConfigFromGrok,
    bubbleChartConfigFromGrok,
    // You can add more chart configurations here
  ];

  return (
    <>
      <Head>
        <title>Chatflix - AI Model Comparison Charts</title>
      </Head>
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-8 md:mb-12 text-[var(--primary)]">
            AI Model Performance Comparison
          </h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {chartConfigs.map((config, index) => (
              <div 
                key={index} 
                className="bg-[var(--card-bg)] rounded-xl shadow-xl overflow-hidden flex flex-col"
              >
                {/* Chart Title - Extracted for better styling and consistency */}
                <h2 className="text-xl font-semibold p-4 text-center bg-[var(--card-header-bg)] border-b border-[var(--border)]">
                  {config.options?.plugins?.title?.text || `${config.type.charAt(0).toUpperCase() + config.type.slice(1)} Chart`}
                </h2>
                {/* DynamicChart component is rendered inside a div that will take up remaining space */}
                <div className="flex-grow p-2 md:p-4">
                    <DynamicChart chartConfig={config} />
                </div>
              </div>
            ))}
          </div>

          {/* Placeholder for more content or a dashboard layout */}
          <div className="mt-12 p-6 bg-[var(--card-bg)] rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-3">Chart Data Notes:</h3>
            <ul className="list-disc list-inside text-[var(--muted-foreground)] text-sm space-y-1">
              <li>All performance metrics are illustrative examples.</li>
              <li>SWE-bench focuses on coding capabilities.</li>
              <li>GPQA tests general-purpose question answering and reasoning.</li>
              <li>AIME evaluates mathematical problem-solving skills.</li>
              <li>Bubble sizes in the bubble chart are arbitrary and for visual distinction.</li>
            </ul>
          </div>

        </div>
      </main>
    </>
  );
} 