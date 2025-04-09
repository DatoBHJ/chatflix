'use client';

import { MODEL_CONFIGS } from '@/lib/models/config';
import { useState } from 'react';

export default function ModelStatsSummary() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  
  // Calculate statistics
  const totalModels = MODEL_CONFIGS.length;
  const enabledModels = MODEL_CONFIGS.filter(model => model.isEnabled).length;
  const activatedModels = MODEL_CONFIGS.filter(model => model.isEnabled && model.isActivated).length;
  
  // Count models by provider
  const providerCounts = MODEL_CONFIGS.reduce((counts: Record<string, number>, model) => {
    const provider = model.provider;
    counts[provider] = (counts[provider] || 0) + 1;
    return counts;
  }, {});
  
  // Count models by level
  const levelCounts = MODEL_CONFIGS.reduce((counts: Record<string, number>, model) => {
    const level = model.rateLimit.level;
    counts[level.toUpperCase()] = (counts[level.toUpperCase()] || 0) + 1;
    return counts;
  }, {});

  // Calculate feature stats
  const featureStats = {
    vision: MODEL_CONFIGS.filter(m => m.supportsVision).length,
    pdf: MODEL_CONFIGS.filter(m => m.supportsPDFs).length,
    Agent: MODEL_CONFIGS.filter(m => m.isAgentEnabled).length,
    reasoning: MODEL_CONFIGS.filter(m => m.reasoning?.enabled).length
  };

  const statCardStyle = {
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    borderRadius: '0.5rem',
    transition: 'all 0.2s ease-in-out',
  };

  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Total Models */}
      <div className="p-5 shadow-sm hover:shadow-md" style={statCardStyle}>
        <h3 className="text-lg font-bold mb-3">Total Models</h3>
        <p className="text-4xl font-bold mb-3">{totalModels}</p>
        <div className="flex gap-3 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            <span>{enabledModels} Enabled</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span>{activatedModels} Activated</span>
          </div>
        </div>
      </div>
      
      {/* Models by Provider */}
      <div 
        className="p-5 shadow-sm hover:shadow-md cursor-pointer"
        style={statCardStyle} 
        onClick={() => toggleSection('provider')}
      >
        <h3 className="text-lg font-bold mb-3 flex justify-between items-center">
          <span>Models by Provider</span>
          <span className="text-xs">{Object.keys(providerCounts).length} providers</span>
        </h3>
        <div className="mt-2 space-y-2">
          {Object.entries(providerCounts)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, expandedSection === 'provider' ? undefined : 4)
            .map(([provider, count]) => (
              <div key={provider} className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="capitalize">{provider}</span>
                </div>
                <span className="font-semibold text-lg">{count}</span>
              </div>
            ))}
          {Object.keys(providerCounts).length > 4 && expandedSection !== 'provider' && (
            <div className="text-center text-sm opacity-70 mt-2">
              + {Object.keys(providerCounts).length - 4} more
            </div>
          )}
        </div>
      </div>
      
      {/* Models by Rate Limit */}
      <div 
        className="p-5 shadow-sm hover:shadow-md cursor-pointer"
        style={statCardStyle}
        onClick={() => toggleSection('rateLimit')}
      >
        <h3 className="text-lg font-bold mb-3 flex justify-between items-center">
          <span>Models by Rate Limit</span>
          <span className="text-xs">{Object.keys(levelCounts).length} levels</span>
        </h3>
        <div className="mt-2 space-y-2">
          {Object.entries(levelCounts)
            .sort((a, b) => {
              const levelA = a[0].replace('LEVEL', '');
              const levelB = b[0].replace('LEVEL', '');
              return parseInt(levelA) - parseInt(levelB);
            })
            .map(([level, count]) => (
              <div key={level} className="flex justify-between items-center">
                <div className="flex items-center">
                  <div 
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ 
                      backgroundColor: level === 'LEVEL1' ? '#4ade80' : 
                                      level === 'LEVEL2' ? '#22d3ee' : 
                                      level === 'LEVEL3' ? '#a78bfa' : 
                                      level === 'LEVEL4' ? '#fb923c' : 
                                      level === 'LEVEL5' ? '#f87171' : '#94a3b8'
                    }}
                  ></div>
                  <span className="uppercase">{level}</span>
                </div>
                <span className="font-semibold text-lg">{count}</span>
              </div>
            ))}
        </div>
      </div>
      
      {/* Features Support */}
      <div className="p-5 shadow-sm hover:shadow-md" style={statCardStyle}>
        <h3 className="text-lg font-bold mb-3">Features Support</h3>
        <div className="mt-2 space-y-2">
          <div className="flex justify-between items-center">
            <span>Vision Support</span>
            <span className="font-semibold text-lg">{featureStats.vision}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>PDF Support</span>
            <span className="font-semibold text-lg">{featureStats.pdf}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Web Search</span>
            <span className="font-semibold text-lg">{featureStats.Agent}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Reasoning</span>
            <span className="font-semibold text-lg">{featureStats.reasoning}</span>
          </div>
        </div>
      </div>
    </div>
  );
} 