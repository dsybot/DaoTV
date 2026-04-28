'use client';

export interface RuntimeCustomCategory {
  name: string;
  type: 'movie' | 'tv';
  query: string;
}

export interface RuntimeConfigPatch {
  CUSTOM_CATEGORIES?: RuntimeCustomCategory[];
  ENABLE_WEB_LIVE?: boolean;
  EMBY_ENABLED?: boolean;
  PRIVATE_LIBRARY_ENABLED?: boolean;
  [key: string]: unknown;
}

type RuntimeWindow = Window & {
  RUNTIME_CONFIG?: RuntimeConfigPatch;
};

export function normalizeCustomCategories(
  value: unknown,
): RuntimeCustomCategory[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is RuntimeCustomCategory =>
        item !== null &&
        typeof item === 'object' &&
        typeof (item as RuntimeCustomCategory).name === 'string' &&
        ((item as RuntimeCustomCategory).type === 'movie' ||
          (item as RuntimeCustomCategory).type === 'tv') &&
        typeof (item as RuntimeCustomCategory).query === 'string',
    )
    .map((item) => ({
      name: item.name,
      type: item.type,
      query: item.query,
    }));
}

export function getWindowRuntimeConfig(): RuntimeConfigPatch {
  if (typeof window === 'undefined') return {};
  return ((window as RuntimeWindow).RUNTIME_CONFIG || {}) as RuntimeConfigPatch;
}

export function getWindowCustomCategories(): RuntimeCustomCategory[] {
  return normalizeCustomCategories(getWindowRuntimeConfig().CUSTOM_CATEGORIES);
}

export function applyRuntimeConfigPatch(
  patch: RuntimeConfigPatch,
): RuntimeConfigPatch {
  if (typeof window === 'undefined') return patch;

  const nextConfig = {
    ...getWindowRuntimeConfig(),
    ...patch,
  };
  (window as RuntimeWindow).RUNTIME_CONFIG = nextConfig;
  window.dispatchEvent(
    new CustomEvent('runtimeConfigUpdated', { detail: nextConfig }),
  );
  return nextConfig;
}

export async function fetchRuntimeConfig(): Promise<RuntimeConfigPatch> {
  const response = await fetch(`/api/server-config?_=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load runtime config: ${response.status}`);
  }

  const data = (await response.json()) as RuntimeConfigPatch;
  return applyRuntimeConfigPatch({
    CUSTOM_CATEGORIES: normalizeCustomCategories(data.CUSTOM_CATEGORIES),
    ENABLE_WEB_LIVE: Boolean(data.ENABLE_WEB_LIVE),
    EMBY_ENABLED: Boolean(data.EMBY_ENABLED),
    PRIVATE_LIBRARY_ENABLED: Boolean(data.PRIVATE_LIBRARY_ENABLED),
  });
}
