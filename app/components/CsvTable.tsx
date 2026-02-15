'use client';

import React from 'react';

export function CsvTable({ rows }: { rows: string[][] }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] bg-(--muted/20)">
      <table className="min-w-max w-full text-xs md:text-[13px] border-collapse">
        <thead>
          <tr>
            {rows[0].map((cell, j) => (
              <th
                key={j}
                className="text-left font-medium px-3 py-2 whitespace-nowrap border-b border-[color-mix(in_srgb,var(--foreground)_15%,transparent)] bg-(--muted/30) text-(--foreground)"
                title={cell}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((row, i) => (
            <tr
              key={i}
              className="border-b border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] last:border-b-0 hover:bg-(--muted/20)"
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-3 py-2 text-(--foreground) whitespace-nowrap max-w-[200px] truncate"
                  title={cell}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

