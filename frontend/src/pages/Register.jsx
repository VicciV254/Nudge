import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/common/Logo.jsx';
import Icon from '../components/common/Icon.jsx';
import { ThemeToggle } from '../components/layout/AppShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { googleAuthUrl } from '../api/auth.js';
import { isEmail, passwordIssue } from '../utils/validators.js';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.displayName.trim()) errs.displayName = 'What should we call you?';
    if (!isEmail(form.email)) errs.email = 'Enter a valid email address';
    const pw = passwordIssue(form.password);
    if (pw) errs.password = pw;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      await register(form);
      navigate('/app', { replace: true });
    } catch (err) {
      setErrors({ form: err.message || 'Could not create that account' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__topbar">
        <Link to="/" className="auth__back"><Logo size={26} /></Link>
        <ThemeToggle />
      </div>

      <div className="auth__card card">
        <h1 className="auth__title">Create your account</h1>
        <p className="auth__sub">Free, and it stays free for personal use.</p>

        <a className="btn btn--ghost btn--block auth__google" href={googleAuthUrl()}>
          <Icon name="google" size={17} strokeWidth={1.6} />
          Continue with Google
        </a>

        <div className="auth__or"><span>or</span></div>

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="name">Name</label>
            <input id="name" className="input" value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              aria-invalid={Boolean(errors.displayName)} autoComplete="name" />
            {errors.displayName && <span className="field__error">{errors.displayName}</span>}
          </div>

          <div className="field" style={{ marginTop: 'var(--space-4)' }}>
            <label className="field__label" htmlFor="remail">Email</label>
            <input id="remail" className="input" type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              aria-invalid={Boolean(errors.email)} autoComplete="email" />
            {errors.email && <span className="field__error">{errors.email}</span>}
          </div>

          <div className="field" style={{ marginTop: 'var(--space-4)' }}>
            <label className="field__label" htmlFor="rpw">Password</label>
            <input id="rpw" className="input" type="password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              aria-invalid={Boolean(errors.password)} autoComplete="new-password" />
            {errors.password
              ? <span className="field__error">{errors.password}</span>
              : <span className="field__hint">At least 8 characters, mixed case, one number.</span>}
          </div>

          {errors.form && (
            <div className="authnote authnote--err">
              <Icon name="alert" size={15} />{errors.form}
            </div>
          )}

          <button className="btn btn--block btn--lg" style={{ marginTop: 'var(--space-5)' }} disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="auth__foot">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
