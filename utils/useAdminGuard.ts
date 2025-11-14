import { useSession, signIn } from 'next-auth/react';
import { useEffect } from 'react';

export default function useAdminGuard() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;
    const role = (session?.user as unknown)?.role;
    if (!session || role !== 'admin') {
      signIn();
    }
  }, [session, status]);

  const isAdmin = !!session && (session.user as unknown)?.role === 'admin';
  return { ready: status === 'authenticated' && isAdmin, isAdmin, status };
}
