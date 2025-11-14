import { getProviders, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function Login() {
  const [providers, setProviders] = useState<unknown>({});
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { error } = router.query as { error?: string };

  useEffect(() => { getProviders().then(setProviders as unknown); }, []);

  const onCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn('credentials', { email, password, callbackUrl: '/auth/admin' });
  };

  return (
    <>
      <Head><title>Admin Login</title></Head>
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md border rounded-2xl p-8 bg-white space-y-5">
          <h1 className="text-2xl font-bold">Admin Login</h1>

          {error && (
            <div className="text-sm text-red-600">
              {error === 'CredentialsSignin' ? 'Incorrect email or password' : error}
            </div>
          )}

          <form className="space-y-3" onSubmit={onCreds}>
            <input className="w-full border rounded p-2" type="email" placeholder="Email"
                   value={email} onChange={e=>setEmail(e.target.value)} />
            <input className="w-full border rounded p-2" type="password" placeholder="Password"
                   value={password} onChange={e=>setPassword(e.target.value)} />
            <button className="w-full px-4 py-2 rounded bg-black text-white" type="submit">
              Sign in with Email
            </button>
          </form>

          <div className="h-px bg-neutral-200" />
          {providers && Object.values(providers).map((p: unknown) => (
            p.id === 'credentials' ? null : (
              <button key={p.id} onClick={() => signIn(p.id, { callbackUrl: '/auth/admin' })}
                      className="w-full px-4 py-2 rounded bg-black text-white">
                Sign in with {p.name}
              </button>
            )
          ))}
        </div>
      </div>
    </>
  );
}
