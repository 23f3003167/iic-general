import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRecruiters,
  getRecruiter,
  createRecruiter,
  updateRecruiter,
} from '@/lib/firestoreService';
import type { Recruiter } from '@/types';

export function useRecruiters(status?: string, company?: string) {
  return useQuery({
    queryKey: ['recruiters', status ?? 'all', company ?? 'all'],
    queryFn: async () => {
      const recruiters = await getRecruiters();
      return recruiters.filter((recruiter) => {
        if (status && status !== 'all' && recruiter.status !== status) {
          return false;
        }
        if (company && company !== '' && !recruiter.companyName.toLowerCase().includes(company.toLowerCase())) {
          return false;
        }
        return true;
      });
    },
  });
}

export function useRecruiter(id: string) {
  return useQuery({
    queryKey: ['recruiter', id],
    queryFn: () => getRecruiter(id),
    enabled: Boolean(id),
  });
}

export function useCreateRecruiter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<Recruiter, 'id'>) => createRecruiter(payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['recruiters']);
    },
  });
}

export function useUpdateRecruiter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<Recruiter, 'id'>> }) =>
      updateRecruiter(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['recruiters']);
      queryClient.invalidateQueries(['recruiter']);
    },
  });
}
