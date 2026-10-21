import { useState } from 'react';
import { Icons } from '../icons';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [mustChange, setMustChange] = useState(false);
  const [pendingSession, setPendingSession] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setErr('');

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: pw }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErr(data.error || 'Incorrect email or password.');
        return;
      }

      if (data.must_change_password) {
        setPendingSession(data);
        setMustChange(true);
      } else {
        onLogin(data);
      }
    } catch (error) {
      console.error('Login failed', error);
      setErr('Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();

    if (newPw.length < 8 || newPw !== confirmPw) {
      setErr('Use at least 8 characters and make both passwords match.');
      return;
    }

    setLoading(true);
    setErr('');

    try {
      const response = await fetch(`${API_URL}/password/change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pendingSession.token}`,
        },
        body: JSON.stringify({
          currentPassword: pw,
          newPassword: newPw,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to change password.');
      }

      onLogin({
        ...pendingSession,
        must_change_password: false,
      });
    } catch (error) {
      setErr(error.message || 'Unable to change password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell" style={s.wrap}>
      <div className="login-left-panel" style={s.left}>
        <div className="login-brand-block">
          <div style={s.brandRow}>
            <div style={s.brandIcon}>{Icons.activity}</div>
            <div style={s.brand}>VetIntel</div>
          </div>
        </div>

        <h1 className="login-headline" style={s.headline}>
          Care that keeps every patient on track.
        </h1>

        <div className="login-features" style={s.features}>
          {[
            {
              icon: Icons.building,
              title: 'Multi-clinic network',
              body: 'Connect multiple clinics into one intelligence network.',
            },
            {
              icon: Icons.shield,
              title: 'Privacy-first architecture',
              body: 'Patient data never leaves your clinic node.',
            },
            {
              icon: Icons.activity,
              title: 'Early outbreak detection',
              body: 'Get alerted before issues become critical.',
            },
          ].map((f) => (
            <div key={f.title} style={s.feat}>
              <div style={s.featIcon}>{f.icon}</div>
              <div style={s.featText}>
                <strong style={s.featTitle}>{f.title}</strong>
                <span>{f.body}</span>
              </div>
            </div>
          ))}
        </div>

      </div>

      <div className="login-right-panel" style={s.right}>
        <div className="login-form-wrap" style={s.formWrap}>
          <h2 style={s.heading}>
            {mustChange ? 'Set a new password' : 'Welcome back'}
          </h2>

          <p style={s.sub}>
            {mustChange
              ? 'Your temporary password must be changed before access.'
              : 'Sign in to your clinic node'}
          </p>

          <form onSubmit={mustChange ? changePassword : submit}>
            <div style={s.fieldWrap}>
              <label style={s.label} htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                style={s.input}
                type="email"
                placeholder="you@clinic.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div style={s.fieldWrap}>
              <label style={s.label} htmlFor="login-password">Password</label>
              <div style={s.pwGroup}>
                <input
                  id="login-password"
                  style={{ ...s.input, paddingRight: 42 }}
                  type={show ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                />

                <button
                  type="button"
                  style={s.eyeBtn}
                  onClick={() => setShow((value) => !value)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  <span style={{ width: 16, height: 16, display: 'flex', color: '#64748b' }}>
                    {show ? Icons.eyeOff : Icons.eye}
                  </span>
                </button>
              </div>
            </div>

            {mustChange && (
              <div style={s.fieldWrap}>
                <label style={s.label}>New password</label>
                <input
                  style={s.input}
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            )}

            {mustChange && (
              <div style={s.fieldWrap}>
                <label style={s.label}>Confirm new password</label>
                <input
                  style={s.input}
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            )}

            {!mustChange && (
              <div style={s.optionsRow}>
                <label style={s.rememberLabel}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={s.checkbox}
                  />
                  <span>Remember me</span>
                </label>
                <a href="#forgot-password" style={s.forgotLink} onClick={(e) => {
                  e.preventDefault();
                  setErr('Password reset is not available yet. Please contact your clinic administrator.');
                }}>
                  Forgot password?
                </a>
              </div>
            )}

            <button type="submit" style={s.btnPrimary} disabled={loading}>
              {loading
                ? 'Please wait…'
                : mustChange
                  ? 'Change password and continue'
                  : 'Sign in'}
            </button>

            {err && <p style={s.err}>{err}</p>}
          </form>
          <p style={s.footer}>Restricted access · VetIntel v2.4.1</p>
        </div>
      </div>
    </div>
  );
}

const s = {
  wrap: {
    display: 'flex',
    minHeight: '100vh',
    background: '#fff',
    color: '#102125',
    fontSize: 14,
    lineHeight: 1.45,
    textAlign: 'left',
  },
  left: {
    width: '45%',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #2fc89e 0%, #087c61 100%)',
    padding: '48px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: 10 },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    background: 'rgba(255,255,255,.18)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  brand: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 23,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-.02em',
  },
  headline: {
    maxWidth: 420,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 30,
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: '-.02em',
    color: '#fff',
  },
  features: { marginTop: 0, marginBottom: 0 },
  feat: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  featIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: 'rgba(255,255,255,.18)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 11,
  },
  featText: { display: 'flex', flexDirection: 'column', gap: 1, fontSize: 14, color: 'rgba(255,255,255,.94)', lineHeight: 1.4 },
  featTitle: { color: '#fff', fontWeight: 700, fontSize: 15 },
  right: {
    width: '55%',
    flex: 1,
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formWrap: { width: 'min(calc(100% - 48px), 373px)' },
  heading: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 30,
    fontWeight: 700,
    color: '#102125',
    letterSpacing: '-.035em',
    marginBottom: 4,
  },
  sub: { fontSize: 15, color: '#647b7e', marginBottom: 26 },
  fieldWrap: { marginBottom: 16 },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#18292b',
    marginBottom: 7,
    letterSpacing: '.01em',
  },
  input: {
    width: '100%',
    height: 52,
    padding: '0 14px',
    border: '1px solid #d2e0dd',
    borderRadius: 10,
    fontSize: 15,
    color: '#102125',
    background: '#fff',
    outline: 'none',
  },
  pwGroup: { position: 'relative' },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  optionsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 26,
  },
  rememberLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    color: '#304346',
    fontSize: 13,
    cursor: 'pointer',
  },
  checkbox: {
    width: 19,
    height: 19,
    margin: 0,
    accentColor: '#005447',
  },
  footer: {
    color: '#708184',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
  forgotLink: {
    fontSize: 13,
    fontWeight: 600,
    color: '#005447',
    textDecoration: 'none',
  },
  btnPrimary: {
    width: '100%',
    height: 52,
    padding: '0 14px',
    background: '#005447',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: '.01em',
    cursor: 'pointer',
  },
  err: {
    fontSize: 12,
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 12,
  },
};