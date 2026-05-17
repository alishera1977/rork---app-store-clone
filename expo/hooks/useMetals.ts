import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { getMetalsData, filterMetalsByCity, ApiMetal, TEMPORARILY_CLOSED_CITIES } from '@/services/metalsApi';

const CACHE_VERSION = 'v10';

async function fetchAllMetalsFromApi(): Promise<ApiMetal[]> {
  console.log('[useMetals] Fetching from API...');
  const result = await getMetalsData();
  if (result.metals.length > 0) {
    console.log('[useMetals] API returned', result.metals.length, 'metals');
    return result.metals;
  }
  console.log('[useMetals] API returned empty');
  return [];
}

function useAllMetals() {
  return useQuery<ApiMetal[]>({
    queryKey: ['metals-all', CACHE_VERSION],
    queryFn: fetchAllMetalsFromApi,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMetalsByCity(cityId: string) {
  const query = useAllMetals();

  const metals = useMemo(() => {
    if (!query.data) return [];
    return filterMetalsByCity(query.data, cityId);
  }, [query.data, cityId]);

  const isTemporarilyClosed = TEMPORARILY_CLOSED_CITIES.includes(cityId);

  return {
    metals,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isError: query.isError,
    isTemporarilyClosed,
    refetch: query.refetch,
  };
}

export function useMetalNames(cityId: string) {
  const { metals } = useMetalsByCity(cityId);
  return metals.map((m) => m.name);
}

export function useForceRefreshMetals() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    try {
      const result = await getMetalsData();
      if (result.metals.length > 0) {
        queryClient.setQueryData(['metals-all', CACHE_VERSION], result.metals);
        console.log('[useMetals] Force refreshed all metals');
      }
    } catch (error) {
      console.log('[useMetals] Force refresh failed:', error);
    }
  }, [queryClient]);
}
