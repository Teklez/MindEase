"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getResourceCategories,
  getResourceRecommendations,
  listResources,
  toggleResourceFavorite,
  trackResourceView,
  type ResourceFilters,
} from "@/lib/api";
import type {
  ResourceCategory,
  ResourceRecommendation,
  ResourceResponse,
} from "@/lib/types";

interface UseResources {
  resources: ResourceResponse[];
  categories: ResourceCategory[];
  recommendations: ResourceRecommendation[];
  isLoading: boolean;
  isLoadingRecommendations: boolean;
  total: number;
  toggleFavorite: (resourceId: string) => Promise<void>;
  trackView: (resourceId: string) => void;
  refresh: () => void;
}

export function useResources(filters: ResourceFilters = {}): UseResources {
  const { category, type, favorites_only } = filters;
  const [resources, setResources] = useState<ResourceResponse[]>([]);
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [recommendations, setRecommendations] = useState<ResourceRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);
  const [total, setTotal] = useState(0);
  const fetchTokenRef = useRef(0);

  const fetchList = useCallback(async () => {
    const token = ++fetchTokenRef.current;
    setIsLoading(true);
    const res = await listResources({ category, type, favorites_only });
    if (token !== fetchTokenRef.current) return;
    if (res.ok) {
      setResources(res.data.resources);
      setTotal(res.data.total);
    }
    setIsLoading(false);
  }, [category, type, favorites_only]);

  const fetchSidecar = useCallback(async () => {
    const [catsRes, recsRes] = await Promise.all([
      getResourceCategories(),
      getResourceRecommendations(3),
    ]);
    if (catsRes.ok) setCategories(catsRes.data);
    if (recsRes.ok) setRecommendations(recsRes.data);
    setIsLoadingRecommendations(false);
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchSidecar();
  }, [fetchSidecar]);

  const toggleFavorite = useCallback(async (resourceId: string) => {
    let prevValue: boolean | null = null;
    setResources((prev) =>
      prev.map((r) => {
        if (r.resource_id !== resourceId) return r;
        prevValue = r.is_favorite;
        return { ...r, is_favorite: !r.is_favorite };
      }),
    );
    setRecommendations((prev) =>
      prev.map((rec) =>
        rec.resource.resource_id === resourceId
          ? { ...rec, resource: { ...rec.resource, is_favorite: !rec.resource.is_favorite } }
          : rec,
      ),
    );
    const res = await toggleResourceFavorite(resourceId);
    if (!res.ok && prevValue !== null) {
      const reverted = prevValue;
      setResources((prev) =>
        prev.map((r) => (r.resource_id === resourceId ? { ...r, is_favorite: reverted } : r)),
      );
      setRecommendations((prev) =>
        prev.map((rec) =>
          rec.resource.resource_id === resourceId
            ? { ...rec, resource: { ...rec.resource, is_favorite: reverted } }
            : rec,
        ),
      );
    }
  }, []);

  const trackView = useCallback((resourceId: string) => {
    setResources((prev) =>
      prev.map((r) => (r.resource_id === resourceId ? { ...r, is_viewed: true } : r)),
    );
    void trackResourceView(resourceId);
  }, []);

  return {
    resources,
    categories,
    recommendations,
    isLoading,
    isLoadingRecommendations,
    total,
    toggleFavorite,
    trackView,
    refresh: fetchList,
  };
}
