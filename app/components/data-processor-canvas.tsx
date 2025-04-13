import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Download, ExternalLink, Filter, List, BarChart, FileSpreadsheet, Database } from 'lucide-react';

type DataProcessorCanvasProps = {
  data: {
    processingResults: Array<{
      operation: string;
      format: string;
      timestamp: string;
      data: any;
      summary: any;
      error?: string;
    }>;
  };
};

// CSV/JSON data table display component
const DataTable = ({ data, maxRows = 10 }: { data: any[], maxRows?: number }) => {
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(false);
  
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-sm text-red-500">Invalid data format</div>;
  }
  
  // Get headers (field names)
  const headers = Object.keys(data[0] || {});
  if (headers.length === 0) {
    return <div className="text-sm text-red-500">No fields in data</div>;
  }
  
  // Data pagination
  const pageCount = Math.ceil(data.length / maxRows);
  const displayData = expanded ? data : data.slice(page * maxRows, (page + 1) * maxRows);
  
  // Navigate to next/previous page
  const nextPage = () => {
    if (page < pageCount - 1) setPage(page + 1);
  };
  
  const prevPage = () => {
    if (page > 0) setPage(page - 1);
  };
  
  return (
    <div className="mt-2 text-sm">
      <div className="flex justify-between items-center mb-2">
        <div className="text-[color-mix(in_srgb,var(--foreground)_70%,transparent)]">
          Total {data.length} records {expanded ? 'showing all' : `(${page * maxRows + 1}-${Math.min((page + 1) * maxRows, data.length)}/${data.length})`}
        </div>
        
        <div className="flex gap-2">
          {pageCount > 1 && !expanded && (
            <div className="flex items-center gap-1">
              <button 
                onClick={prevPage} 
                disabled={page === 0}
                className={`p-1 rounded ${page === 0 ? 'text-[color-mix(in_srgb,var(--foreground)_30%,transparent)]' : 'text-[color-mix(in_srgb,var(--foreground)_70%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]'}`}
              >
                <ChevronUp size={16} />
              </button>
              <span className="text-xs">{page + 1}/{pageCount}</span>
              <button 
                onClick={nextPage} 
                disabled={page === pageCount - 1}
                className={`p-1 rounded ${page === pageCount - 1 ? 'text-[color-mix(in_srgb,var(--foreground)_30%,transparent)]' : 'text-[color-mix(in_srgb,var(--foreground)_70%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]'}`}
              >
                <ChevronDown size={16} />
              </button>
            </div>
          )}
          
          <button 
            onClick={() => setExpanded(!expanded)}
            className="text-xs px-2 py-0.5 bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] rounded flex items-center gap-1"
          >
            {expanded ? 'Collapse' : 'Show All'}
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] rounded">
        <table className="min-w-full divide-y divide-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
          <thead className="bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)]">
            <tr>
              {headers.map((header, index) => (
                <th 
                  key={index}
                  className="px-3 py-2 text-left text-xs font-medium text-[color-mix(in_srgb,var(--foreground)_70%,transparent)] tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-[color-mix(in_srgb,var(--background)_100%,transparent)] divide-y divide-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
            {displayData.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]' : ''}>
                {headers.map((header, colIndex) => (
                  <td 
                    key={`${rowIndex}-${colIndex}`}
                    className="px-3 py-2 whitespace-nowrap text-xs text-[color-mix(in_srgb,var(--foreground)_80%,transparent)]"
                  >
                    {renderCellValue(row[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Statistics data display component
const StatsDisplay = ({ stats }: { stats: any }) => {
  if (!stats || typeof stats !== 'object') {
    return null;
  }
  
  // Filter only displayable statistics
  const displayableStats = Object.entries(stats).filter(([key, value]) => {
    return key !== 'data' && key !== 'processingResults';
  });
  
  if (displayableStats.length === 0) {
    return null;
  }
  
  return (
    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {displayableStats.map(([key, value]) => (
        <div key={key} className="bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] p-3 rounded-lg">
          <h4 className="text-sm font-medium mb-1 capitalize">{formatStatLabel(key)}</h4>
          <div className="text-sm">{renderStatValue(key, value)}</div>
        </div>
      ))}
    </div>
  );
};

// Field analysis display component
const FieldsAnalysis = ({ summary }: { summary: any }) => {
  if (!summary?.fieldTypes || !Array.isArray(summary.fieldTypes)) {
    return null;
  }
  
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium mb-2">Field Type Analysis</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {summary.fieldTypes.map((field: any, index: number) => (
          <div key={index} className="bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] p-3 rounded-lg">
            <div className="text-sm font-medium">{field.name}</div>
            <div className="text-xs text-[color-mix(in_srgb,var(--foreground)_70%,transparent)] mt-1">
              Type: <span className="font-medium capitalize">{field.type}</span>
              {field.values && (
                <div className="mt-1">
                  {field.type === 'number' ? (
                    <>
                      <div>Min: {field.min !== undefined ? formatNumber(field.min) : 'N/A'}</div>
                      <div>Max: {field.max !== undefined ? formatNumber(field.max) : 'N/A'}</div>
                      <div>Mean: {field.mean !== undefined ? formatNumber(field.mean) : 'N/A'}</div>
                    </>
                  ) : field.type === 'string' && field.uniqueValues ? (
                    <div>Unique values: {field.uniqueValues}</div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Cell value rendering helper function
const renderCellValue = (value: any): React.ReactNode => {
  if (value === null || value === undefined) {
    return <span className="text-[color-mix(in_srgb,var(--foreground)_40%,transparent)]">-</span>;
  } else if (typeof value === 'object') {
    try {
      return <span className="font-mono text-xs">{JSON.stringify(value)}</span>;
    } catch (e) {
      return <span className="italic text-[color-mix(in_srgb,var(--foreground)_40%,transparent)]">[Object]</span>;
    }
  } else if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  } else {
    return String(value);
  }
};

// Statistic label format function
const formatStatLabel = (key: string): string => {
  const labelMap: Record<string, string> = {
    recordCount: 'Record Count',
    fields: 'Fields',
    operation: 'Operation',
    criteria: 'Filter Criteria',
    inputCount: 'Input Records',
    outputCount: 'Output Records',
    groupBy: 'Group By',
    metrics: 'Metrics',
    groupCount: 'Group Count',
    select: 'Selected Fields',
    rename: 'Field Renaming',
    insights: 'Insights',
    fieldCount: 'Field Count',
    format: 'Format',
    correlations: 'Correlations',
    duplicateRecords: 'Duplicate Records',
    nullValues: 'Null Values',
    outliers: 'Outliers',
    patterns: 'Patterns',
    dataCompleteness: 'Data Completeness',
    fieldTypes: 'Field Types'
  };
  
  return labelMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

// Number format function
const formatNumber = (num: number): string => {
  if (isNaN(num)) return 'N/A';
  
  // Return as is if it's an integer
  if (Number.isInteger(num)) return num.toString();
  
  // Limit decimal places
  return num.toFixed(2).replace(/\.00$/, '');
};

// Statistic value rendering function
const renderStatValue = (key: string, value: any): React.ReactNode => {
  if (value === null || value === undefined) {
    return <span className="text-[color-mix(in_srgb,var(--foreground)_40%,transparent)]">-</span>;
  }
  
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc list-inside">
        {value.map((item, index) => (
          <li key={index} className="text-xs mb-1">
            {typeof item === 'object' ? JSON.stringify(item) : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  
  if (typeof value === 'object') {
    if (key === 'correlations' && Array.isArray(value.pairs)) {
      return (
        <div>
          {value.pairs.slice(0, 5).map((pair: any, index: number) => (
            <div key={index} className="mb-1 text-xs">
              <span className="font-medium">{pair.field1}</span> ↔ <span className="font-medium">{pair.field2}</span>: {formatNumber(pair.value)}
            </div>
          ))}
        </div>
      );
    }
    
    if (key === 'criteria') {
      return (
        <div className="font-mono text-xs">{JSON.stringify(value, null, 1)}</div>
      );
    }
    
    return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>;
  }
  
  return String(value);
};

// Data download function
const downloadData = (data: any, format: string, operation: string) => {
  try {
    let content = '';
    let filename = `data_${operation}_${new Date().toISOString().slice(0, 10)}.`;
    let type = '';
    
    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      filename += 'json';
      type = 'application/json';
    } else if (format === 'csv') {
      // Simple CSV conversion
      if (Array.isArray(data) && data.length > 0) {
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => 
          Object.values(row)
            .map(value => {
              if (typeof value === 'string') {
                // Strings with commas or quotes need to be quoted and internal quotes escaped
                if (value.includes(',') || value.includes('"')) {
                  return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
              }
              return String(value);
            })
            .join(',')
        ).join('\n');
        
        content = `${headers}\n${rows}`;
      }
      filename += 'csv';
      type = 'text/csv';
    } else {
      content = JSON.stringify(data, null, 2);
      filename += 'txt';
      type = 'text/plain';
    }
    
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (err) {
    console.error('Error downloading data:', err);
  }
};

// Operation icon component
const OperationIcon = ({ operation }: { operation: string }) => {
  switch (operation) {
    case 'parse':
      return <FileSpreadsheet size={18} className="text-blue-500" />;
    case 'filter':
      return <Filter size={18} className="text-green-500" />;
    case 'transform':
      return <List size={18} className="text-purple-500" />;
    case 'aggregate':
      return <Database size={18} className="text-orange-500" />;
    case 'analyze':
      return <BarChart size={18} className="text-red-500" />;
    default:
      return <FileSpreadsheet size={18} />;
  }
};

// Tool Selection UI - new component to show tool selection in green
const ToolSelection = () => {
  const [selectedTools, setSelectedTools] = useState<Record<string, boolean>>({
    parse: false,
    filter: false,
    transform: false, 
    aggregate: false,
    analyze: false
  });
  
  const toggleTool = (tool: string) => {
    setSelectedTools(prev => ({
      ...prev,
      [tool]: !prev[tool]
    }));
  };
  
  return (
    <div className="mt-4 mb-2">
      {/* <h3 className="text-sm font-medium mb-2">Select Tools</h3> */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(selectedTools).map(([tool, isSelected]) => (
          <button
            key={tool}
            onClick={() => toggleTool(tool)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
              isSelected 
                ? "bg-gradient-to-r from-green-500/20 to-green-500/10 shadow-sm border border-green-500/20" 
                : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] border border-transparent"
            }`}
          >
            {tool === 'parse' && <FileSpreadsheet size={14} className={isSelected ? "text-green-500" : "text-[var(--muted)]"} />}
            {tool === 'filter' && <Filter size={14} className={isSelected ? "text-green-500" : "text-[var(--muted)]"} />}
            {tool === 'transform' && <List size={14} className={isSelected ? "text-green-500" : "text-[var(--muted)]"} />}
            {tool === 'aggregate' && <Database size={14} className={isSelected ? "text-green-500" : "text-[var(--muted)]"} />}
            {tool === 'analyze' && <BarChart size={14} className={isSelected ? "text-green-500" : "text-[var(--muted)]"} />}
            <span className={`text-xs font-medium capitalize ${isSelected ? "text-green-500" : ""}`}>{tool}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// Main data processor canvas component
const DataProcessorCanvas: React.FC<DataProcessorCanvasProps> = ({ data }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);
  
  if (!data || !data.processingResults || data.processingResults.length === 0) {
    return (
      <div className="p-4 text-center text-[color-mix(in_srgb,var(--foreground)_70%,transparent)]">
        No data processing results available.
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <ToolSelection />
      
      {data.processingResults.map((result, index) => (
        <div 
          key={index}
          className="border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] rounded-lg overflow-hidden bg-[color-mix(in_srgb,var(--foreground)_1%,transparent)]"
        >
          <div 
            className="flex items-center justify-between p-3 cursor-pointer bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)]"
            onClick={() => setActiveIndex(activeIndex === index ? null : index)}
          >
            <div className="flex items-center gap-2">
              <OperationIcon operation={result.operation} />
              <div>
                <h3 className="text-sm font-medium capitalize">
                  {result.operation} {result.format === 'csv' ? 'CSV' : 'JSON'} Data
                </h3>
                <div className="text-xs text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">
                  {new Date(result.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {result.error ? (
                <span className="text-xs text-red-500">Error occurred</span>
              ) : (
                <div className="text-xs text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">
                  {result.summary?.recordCount ? `${result.summary.recordCount} records` : ''}
                  {result.summary?.fieldCount ? `, ${result.summary.fieldCount} fields` : ''}
                </div>
              )}
              <button
                className="p-1 rounded hover:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]"
                aria-label={activeIndex === index ? "Collapse" : "Expand"}
              >
                {activeIndex === index ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>
          
          {activeIndex === index && (
            <div className="p-4">
              {result.error ? (
                <div className="text-red-500 p-3 bg-red-50 dark:bg-red-950 rounded-md">
                  <h4 className="font-medium mb-1">Error</h4>
                  <p className="text-sm">{result.error}</p>
                </div>
              ) : (
                <>
                  {/* Summary information */}
                  {result.summary && (
                    <div className="mb-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium mb-2">Summary</h4>
                        <button
                          onClick={() => downloadData(result.data, result.format, result.operation)}
                          className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] transition-colors"
                        >
                          <Download size={14} />
                          <span>Download</span>
                        </button>
                      </div>
                      <StatsDisplay stats={result.summary} />
                      
                      {/* Field analysis (for analyze operation) */}
                      {result.operation === 'analyze' && (
                        <FieldsAnalysis summary={result.summary} />
                      )}
                    </div>
                  )}
                  
                  {/* Data table */}
                  {Array.isArray(result.data) && result.data.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Data Display</h4>
                      <DataTable data={result.data} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default DataProcessorCanvas; 