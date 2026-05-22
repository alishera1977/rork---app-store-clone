import { useEffect, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiMetal } from '@/services/metalsApi';

const STORAGE_KEY = 'price-snapshots-daily-v1';

interface StoredSnapshot {
  date: string;
  prices: Record<string, number>;
}

interface MemorySnapshot {
  currentDate: string;
  /** Previous-day prices keyed by metal.id */
  previous: Record<string, number>;
  /** Today's prices being collected */
  today: Record<string, number>;
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pickPrice(metal: ApiMetal): number | null {
  const candidates = [
    metal.priceCardFrom50,
    metal.priceCardUpto50,
    metal.priceAccountLegal,
    metal.pricePerKg,
  ];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) return c;
  }
  return null;
}

/**
 * Tracks daily price changes per metal using AsyncStorage.
 * Returns positive deltas only (price increases) keyed by metal.id.
 * When today's price <= previous-day's price, no delta is returned.
 */
export function usePriceDeltas(cityId: string, metals: ApiMetal[]): Record<string, number> {
  const storageKey = `${STORAGE_KEY}:${cityId}`;
  const [snapshot, setSnapshot] = useState<MemorySnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (cancelled) return;
        const today = todayKey();
        if (!raw) {
          setSnapshot({ currentDate: today, previous: {}, today: {} });
          return;
        }
        try {
          const parsed = JSON.parse(raw) as StoredSnapshot;
          if (parsed.date === today) {
            setSnapshot({ currentDate: today, previous: {}, today: parsed.prices ?? {} });
          } else {
            setSnapshot({ currentDate: today, previous: parsed.prices ?? {}, today: {} });
          }
        } catch {
          setSnapshot({ currentDate: today, previous: {}, today: {} });
        }
      })
      .catch(() => {
        if (!cancelled) setSnapshot({ currentDate: todayKey(), previous: {}, today: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const persist = useCallback(
    (prices: Record<string, number>) => {
      const payload: StoredSnapshot = { date: todayKey(), prices };
      AsyncStorage.setItem(storageKey, JSON.stringify(payload)).catch(() => {});
    },
    [storageKey],
  );

  useEffect(() => {
    if (!snapshot || metals.length === 0) return;
    const next: Record<string, number> = { ...snapshot.today };
    let changed = false;
    for (const m of metals) {
      const price = pickPrice(m);
      if (price == null) continue;
      if (next[m.id] !== price) {
        next[m.id] = price;
        changed = true;
      }
    }
    if (changed) {
      setSnapshot({ ...snapshot, today: next });
      persist(next);
    }
  }, [metals, snapshot, persist]);

  const deltas = useMemo(() => {
    if (!snapshot) return {};
    const result: Record<string, number> = {};
    for (const id of Object.keys(snapshot.today)) {
      const prev = snapshot.previous[id];
      const today = snapshot.today[id];
      if (typeof prev !== 'number' || typeof today !== 'number') continue;
      const diff = today - prev;
      if (diff > 0) result[id] = Math.round(diff);
    }
    return result;
  }, [snapshot]);

  return deltas;
}
