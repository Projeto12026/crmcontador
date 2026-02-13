import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useAutoBackup() {
  const isBackingUp = useRef(false);

  useEffect(() => {
    const performBackup = async () => {
      if (isBackingUp.current) return;
      isBackingUp.current = true;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-data`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            keepalive: true,
          }
        );

        if (response.ok) {
          const data = await response.json();
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10);
          const timeStr = now.toTimeString().slice(0, 5).replace(':', 'h');
          const filename = `dados CRM Contador - ${dateStr} ${timeStr}.json`;

          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);

          // Save last backup date
          await supabase.from('settings').upsert(
            { key: 'last_backup', value: { date: now.toISOString() } as any },
            { onConflict: 'key' }
          );
        }
      } catch (error) {
        console.error('Auto-backup error:', error);
      } finally {
        isBackingUp.current = false;
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      performBackup();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
}
