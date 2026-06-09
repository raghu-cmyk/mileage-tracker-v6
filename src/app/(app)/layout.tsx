import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { getCurrentUserId } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return <>{children}</>;
  }

  return (
    <div className="page-shell">
      <Nav />
      <main className="content-container">{children}</main>
    </div>
  );
}
