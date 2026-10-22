'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Sorting, filters and sliders live in the URL so a view can be shared.
 * Uses history.replaceState (Next keeps useSearchParams in sync) rather than
 * router.replace, so a filter change is not a navigation and does not trigger
 * the page cross-fade.
 */
export function useUrlState() {
  const params = useSearchParams();
  const pathname = usePathname();
  const get = useCallback((k: string, fallback = '') => params.get(k) ?? fallback, [params]);
  const getNum = useCallback((k: string, fallback: number) => {
    const v = params.get(k);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  }, [params]);
  const set = useCallback((patch: Record<string, string | number | null | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === '') next.delete(k);
      else next.set(k, String(v));
    }
    const qs = next.toString();
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
  }, [params, pathname]);
  const reset = useCallback((keys: string[]) => {
    const next = new URLSearchParams(params.toString());
    for (const k of keys) next.delete(k);
    const qs = next.toString();
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
  }, [params, pathname]);
  return { get, getNum, set, reset, params };
}
