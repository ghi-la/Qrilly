import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import AuthForm from '@/components/AuthForm';

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');
  if (process.env.ALLOW_REGISTRATION === 'false') redirect('/login');
  return <AuthForm mode="register" />;
}
