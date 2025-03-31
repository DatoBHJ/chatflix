'use client';

import React from 'react';

interface AnalyticsCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

const AnalyticsCard: React.FC<AnalyticsCardProps> = ({ title, children, className = '' }) => {
  return (
    <div 
      className={`p-4 rounded-lg ${className}`}
      style={{ 
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--card-border)'
      }}
    >
      <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
        {title}
      </h2>
      {children}
    </div>
  );
};

export default AnalyticsCard; 