import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Logo } from '../components/common/Logo.jsx';
import Icon from '../components/common/Icon.jsx';
import { ThemeToggle } from '../components/layout/AppShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { googleAuthUrl } from '../api/auth.js';
import { isEmail } from '../utils/validators.js';

const GOOGLE_ERRORS = {
  denied: 'Google sign-in was cancelled.',
  invalid: 'That Google sign-in link was invalid.',
  expired: 'That Google sign-in link expired — please try again.',
  no_email: "Your Google account doesn't have an email we can use.",
  unavailable: 'Google sign-in is not available right now.',
  failed: 'Google sign-in failed. Please try again or use your email and password.',
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const googleError = GOOGLE_ERRORS[searchParams.get('google')];

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!isEmail(form.email)) errs.email = 'Enter a valid email address';
    if (!form.password) errs.password = 'Enter your password';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from?.pathname || '/app', { replace: true });
    } catch (err) {
      setErrors({ form: err.message || 'That email and password combination did not work' });
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
        <h1 className="auth__title">Welcome back</h1>
        <p className="auth__sub">Pick up where you left off.</p>

        {googleError && (
          <div className="authnote authnote--err" style={{ marginBottom: 'var(--space-4)' }}>
            <Icon name="alert" size={15} />
            {googleError}
          </div>
        )}

        <a className="btn btn--ghost btn--block auth__google" href={googleAuthUrl()}>
          <Icon name="google" size={17} strokeWidth={1.6} />
          Continue with Google
        </a>

        <div className="auth__or"><span>or</span></div>

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && <span className="field__error">{errors.email}</span>}
          </div>

          <div className="field" style={{ marginTop: 'var(--space-4)' }}>
            <label className="field__label" htmlFor="password">Password</label>
            <div className="input-group">
              <input
                id="password"
                className="input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                aria-invalid={Boolean(errors.password)}
              />
              <button
                type="button"
                className="input-group__btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                tabIndex={-1}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} strokeWidth={1.6} />
              </button>
            </div>
            {errors.password && <span className="field__error">{errors.password}</span>}
          </div>

          {errors.form && (
            <div className="authnote authnote--err">
              <Icon name="alert" size={15} />
              {errors.form}
            </div>
          )}

          <button className="btn btn--block btn--lg" style={{ marginTop: 'var(--space-5)' }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth__foot">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
