import { redirect } from 'next/navigation';
import { getRegistrationOpen } from '@/app/actions/auth';
import RegisterForm from './RegisterForm';

export default async function RegisterPage() {
  const open = await getRegistrationOpen();
  if (!open) {
    redirect('/login?error=Registration+is+closed');
  }
  return <RegisterForm />;
}
