import { redirect } from 'next/navigation';
import { getCurrentUserId } from '@/lib/session';

export default async function HomePage() {
  const userId = await getCurrentUserId();
  redirect(userId ? '/dashboard' : '/login');
}
