import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOpportunities,
  getOpportunity,
  createOpportunity,
  updateOpportunity,
  getApplications,
} from '@/lib/firestoreService';
import type { Opportunity } from '@/types';

export function useOpportunities(type?: string, status?: string) {
  return useQuery({
    queryKey: ['opportunities', type ?? 'all', status ?? 'all'],
    queryFn: async () => {
      const opportunities = await getOpportunities();
      return opportunities.filter((opportunity) => {
        if (type && type !== 'all' && opportunity.type !== type) {
          return false;
        }
        if (status && status !== 'all' && opportunity.status !== status) {
          return false;
        }
        return true;
      });
    },
  });
}

export function useOpportunity(id: string) {
  return useQuery({
    queryKey: ['opportunity', id],
    queryFn: () => getOpportunity(id),
    enabled: Boolean(id),
  });
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<Opportunity, 'id'>) => createOpportunity(payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['opportunities']);
    },
  });
}

export function useUpdateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<Opportunity, 'id'>> }) =>
      updateOpportunity(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['opportunities']);
      queryClient.invalidateQueries(['opportunity']);
    },
  });
}

export function useApplications() {
  return useQuery({
    queryKey: ['applications'],
    queryFn: () => getApplications(),
  });
}
