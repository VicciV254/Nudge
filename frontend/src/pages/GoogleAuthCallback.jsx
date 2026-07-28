import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mark } from '../components/common/Logo.jsx';
import { tokens } from '../api/client.js';
import { me } from '../api/auth.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Landing spot for the "Sign in with Google" redirect. The backend already
 * finished the OAuth exchange server-side and hands us finished session
 * tokens as query params — this page's only job is to store them, fetch the
 * user, and route into the app (or bounce back to /login with a reason).
 */
export default function GoogleAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode double-invoke guard
    ran.current = true;

    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (!accessToken || !refreshToken) {
      navigate('/login?google=failed', { replace: true });
      return;
    }

    tokens.set(accessToken, refreshToken);
    me()
      .then((user) => {
        setUser(user);
        navigate('/app', { replace: true });
      })
      .catch(() => {
        tokens.clear();
        navigate('/login?google=failed', { replace: true });
      });
  }, [params, navigate, setUser]);

  return (
    <div className="splash" role="status" aria-live="polite">
      <Mark size={46} className="splash__mark" />
      <span className="sr-only">Signing you in…</span>
    </div>
  );
}
