import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useIsAdmin() {
  const { user, isLoading: authLoading } = useAuth();

  return useQuery({
    queryKey: ['has_role', 'admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin',
      });
      if (error) throw error;
      return Boolean(data);
    },
    enabled: !authLoading && !!user?.id,
    staleTime: 60_000,
  });
}
