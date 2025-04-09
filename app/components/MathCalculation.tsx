import React from 'react';

type CalculationStep = {
  step: number;
  expression: string;
  result: string | number;
  timestamp: string;
};

type MathCalculationProps = {
  calculationSteps: CalculationStep[];
  finalAnswer?: string;
};

export default function MathCalculation({ calculationSteps, finalAnswer }: MathCalculationProps) {
  if (!calculationSteps || calculationSteps.length === 0) return null;

  return (
    <div className="math-calculation-container overflow-hidden">
      <div className="p-4">        
        <div className="space-y-2.5">
          {calculationSteps.map((step) => (
            <div key={step.step} className="calculation-step rounded-md overflow-hidden">
              <div className="p-3 flex items-center">
                <span className="text-xs text-muted-foreground bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] py-1 px-2 rounded mr-3 font-medium">
                  Step {step.step}
                </span>
                <div className="font-mono text-sm flex-1">
                  <span className="mr-1">{step.expression} =</span>
                  <span className="font-bold">{step.result}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 