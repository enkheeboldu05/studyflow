import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import type { User } from '../types';

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.post<{ user: User }>(`/auth/${mode}`, {
        username: form.get('username'),
        email: form.get('email'),
        password: form.get('password'),
      });
      onAuthenticated(result.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not continue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <a className="wordmark" href="#">Study<span>Flow</span></a>
        <div>
          <p className="kicker">A quieter way to plan</p>
          <h1>Give today a<br /><em>clear shape.</em></h1>
          <p className="auth-lede">Gather loose thoughts, choose what matters, and carry unfinished work forward without guilt.</p>
        </div>
        <ul>
          <li><CheckCircle2 size={16} /> Private and stored on your computer</li>
          <li><CheckCircle2 size={16} /> Designed around your study week</li>
        </ul>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="kicker">{mode === 'login' ? 'Welcome back' : 'Your local workspace'}</p>
          <h2>{mode === 'login' ? 'Start your day.' : 'Create your account.'}</h2>
          <p>{mode === 'login' ? 'Your plan is waiting where you left it.' : 'No cloud services or external accounts required.'}</p>
          <form onSubmit={submit}>
            {mode === 'signup' && <label>Username<input name="username" required minLength={2} autoComplete="username" /></label>}
            <label>Email<input name="email" type="email" required autoComplete="email" /></label>
            <label>Password<input name="password" type="password" required minLength={mode === 'signup' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'} <ArrowRight size={17} />
            </button>
          </form>
          <button className="text-button auth-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
            {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
          </button>
        </div>
      </section>
    </main>
  );
}
