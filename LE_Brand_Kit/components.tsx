import React from 'react';

/**
 * Common LE Card Component
 * Usage: Dashboard widgets, lists, or static content containers.
 */
export function SoftCard({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-white border border-slate-200/50 p-6 rounded-2xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/**
 * Common Admin Card Component
 * Usage: Used for tables and data-heavy views in dark mode admin panels.
 */
export function AdminCard({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden p-6 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Common Pill/Badge Component
 * Usage: Status markers, scores, tags.
 */
export function Badge({ 
  children, 
  color = 'slate', 
  className = '' 
}: { 
  children: React.ReactNode, 
  color?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'cyan' | 'slate',
  className?: string 
}) {
  const colorStyles = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  return (
    <span className={`px-2 py-1 flex items-center justify-center rounded font-bold text-xs uppercase tracking-wider border ${colorStyles[color]} ${className}`}>
      {children}
    </span>
  );
}

/**
 * Section Eyebrow Label
 * Usage: The small, tracked-out text above a main heading or data point.
 */
export function Eyebrow({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <p className={`text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 ${className}`}>
      {children}
    </p>
  );
}
