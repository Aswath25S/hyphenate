'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/** Sorting, filters and sliders live in the URL so a view can be shared. */
export function useUrlState() {
  const params = useSearchParams();
  const router = useRouter();
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
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);
  const reset = useCallback((keys: string[]) => {
    const next = new URLSearchParams(params.toString());
    for (const k of keys) next.delete(k);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);
  return { get, getNum, set, reset, params };
}
