import { useState, useCallback } from 'react';

export function useSort<K extends string>(initialKey: K, initialDir: 'asc' | 'desc' = 'asc') {
  const [sortKey, setSortKey] = useState<K>(initialKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialDir);

  const handleSort = useCallback((key: K) => {
    if (key === sortKey) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }, [sortKey]);

  const applySort = useCallback((key: K, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
  }, []);

  return { sortKey, sortDir, handleSort, applySort };
}

export const BTN_BASE = 'text-xs border rounded px-2 py-1 transition-colors';
export const BTN_INACTIVE = `${BTN_BASE} text-gray-500 hover:text-gray-700 border-gray-200 hover:border-gray-300`;
export const btnActive = (color: string) => `${BTN_BASE} ${color}`;
