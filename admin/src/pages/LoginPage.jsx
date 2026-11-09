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

  async function submit(event) {
    event.preventDefault();
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

  async function changePassword(event) {
    event.preventDefault();
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
        body: JSON.stringify({ currentPassword: pw, newPassword: newPw }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to change password.');
      onLogin({ ...pendingSession, must_change_password: false });
    } catch (error) {
      setErr(error.message || 'Unable to change password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <style>{`
        .login-shell{min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);background:#fafafa url('/images/login-green-waves.png') center/100% 100% no-repeat;color:#142d29;font:14px/1.5 Inter,system-ui,sans-serif}
        .login-story{min-width:0;padding:clamp(28px,4.5vw,76px);color:#f6f8ed}
        .login-story-brand{font-size:31px;font-weight:750;letter-spacing:-.03em}
        .login-story-heading{margin:clamp(32px,6vh,64px) 0 16px;font-size:clamp(26px,2.3vw,40px);font-weight:750;line-height:1.2;letter-spacing:-.025em;color:#f6f8ed}
        .login-story-description{max-width:460px;margin:0;font-size:clamp(15px,1.2vw,19px);line-height:1.5;color:#e0ece5}
        .login-story-features{display:grid;gap:26px;margin-top:38px;width:48%;max-width:320px}
        .login-story-feature{display:flex;align-items:flex-start;gap:12px}
        .login-story-icon{flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:12px;background:linear-gradient(145deg,#e7f4ec,#a9d6b7);color:#086b50;box-shadow:inset 0 0 0 1px rgba(255,255,255,.3),0 3px 10px rgba(1,56,38,.12)}
        .login-story-icon svg{display:block;width:31px;height:31px}
        .login-story-feature h3{margin:0 0 5px;color:#f6f8ed;font-size:16px;line-height:1.35;font-weight:700}
        .login-story-feature p{margin:0;color:#e0ece5;font-size:14px;line-height:1.5}
        @media(min-width:781px) and (max-width:1100px){.login-story{padding:32px 24px}.login-story-features{width:50%;gap:20px}.login-story-feature{gap:8px}.login-story-icon{width:28px;height:28px}.login-story-icon svg{width:17px;height:17px}.login-story-feature h3{font-size:14px}.login-story-feature p{font-size:12px}}
        .login-panel{display:grid;place-items:center;padding:clamp(24px,5vw,72px);background:transparent;position:relative}.login-form-wrap{width:min(100%,420px)}.login-form-wrap h2{margin:0;color:#172b24;font-size:32px;line-height:1.15;letter-spacing:-.04em}.login-subtitle{margin:7px 0 26px;color:#61756c;font-size:14px}.login-field{display:grid;gap:7px;margin-bottom:17px}.login-field label{color:#263a32;font-size:12px;font-weight:650}.login-input-wrap{position:relative}.login-field-icon{position:absolute;top:50%;left:13px;z-index:1;display:grid;place-items:center;transform:translateY(-50%);color:#64796f;pointer-events:none}.login-field-icon svg{display:block;width:18px;height:18px}.login-input{width:100%;height:52px;padding:0 14px 0 43px;border:1px solid #d4e3d7;border-radius:9px;background:#fff;color:#172b24;font:inherit;outline:none;transition:border .15s,box-shadow .15s}.login-input:focus{border-color:#086b50;box-shadow:0 0 0 3px rgba(8,107,80,.12)}.login-input.has-toggle{padding-right:44px}.login-eye{position:absolute;top:50%;right:12px;transform:translateY(-50%);display:grid;place-items:center;border:0;background:transparent;color:#61756c;cursor:pointer}.login-eye svg{display:block;width:19px;height:19px}
        .login-options{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 21px;font-size:12px}.login-remember{display:flex;align-items:center;gap:7px;color:#40564d}.login-remember input{width:15px;height:15px;margin:0;accent-color:#013826}.login-forgot{padding:0;border:0;background:transparent;color:#013826;font:inherit;font-weight:650;cursor:pointer}.login-submit{width:100%;height:48px;border:0;border-radius:9px;background:#086b50;color:#fff;font:inherit;font-weight:700;cursor:pointer;transition:background .15s}.login-submit:hover{background:#003526}.login-submit:disabled{opacity:.65;cursor:wait}.login-error{margin:12px 0 0;color:#b42318;font-size:12px}.login-footer{margin:22px 0 0;color:#718078;text-align:center;font-size:11px}
        /* Login form styling matched to the supplied reference. */
        .login-form-wrap{width:min(100%,404px)}
        .login-form-wrap h2{color:#013826;font-size:36px;font-weight:800;line-height:1.15;letter-spacing:-.035em}
        .login-subtitle{margin:6px 0 22px;color:#4b5563;font-size:15px;line-height:1.5}
        .login-field{gap:5px;margin-bottom:14px}
        .login-field label{color:#013826;font-size:13px;font-weight:750}
        .login-input{height:52px;border:1px solid #d6dedb;border-radius:12px;padding-left:47px;background:rgba(255,255,255,.9);color:#374151;font-size:14px;box-shadow:0 1px 2px rgba(1,56,38,.025)}
        .login-input::placeholder{color:#4b5563;opacity:1}
        .login-field-icon{left:16px;color:#086b50}
        .login-field-icon svg{width:18px;height:18px;stroke-width:2.2}
        .login-eye{right:14px;color:#086b50;padding:3px}
        .login-eye svg{width:21px;height:21px;stroke-width:2.2}
        .login-input:focus{border-color:#7fa699;box-shadow:0 0 0 2px rgba(8,107,80,.08)}
        .login-options{margin:18px 0 24px;font-size:13px}
        .login-remember{gap:9px;color:#374151}
        .login-remember input{appearance:none;width:17px;height:17px;border:1px solid #739c8c;border-radius:3px;background:#fff;display:grid;place-content:center;cursor:pointer}
        .login-remember input:checked{background:#086b50;border-color:#086b50}
        .login-remember input:checked::after{content:'';width:8px;height:4px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:translateY(-1px) rotate(-45deg)}
        .login-remember input:focus-visible{outline:2px solid #0a966b;outline-offset:3px}
        .login-forgot{color:#005439;font-size:13px;font-weight:750}
        .login-submit{height:50px;border:1px solid #086b50;border-radius:11px;background:linear-gradient(110deg,#00543b,#005b3f);font-size:16px;font-weight:750;box-shadow:0 2px 5px rgba(1,56,38,.08)}
        .login-submit:hover{background:#013826}
        .login-footer{margin-top:22px;color:#5b616b;font-size:12px}
        .login-field > .login-input{padding-left:14px}
        @media(max-width:780px){.login-shell{grid-template-columns:1fr;background:#fafafa}.login-story{background:#086b50;padding:30px 26px}.login-story-heading{margin-top:28px;max-width:480px}.login-story-features{width:100%;max-width:480px;gap:20px;margin-top:28px}.login-panel{padding:40px 24px 52px}}
        @media(max-width:480px){.login-panel{padding:34px 22px 42px}.login-form-wrap h2{font-size:29px}}
      `}</style>
      <section className="login-story" aria-label="About VetIntel">
        <div className="login-story-brand">VetIntel</div>
        <h1 className="login-story-heading">Smarter veterinary care.<br />Connected clinic records.</h1>
        <p className="login-story-description">Better patient records. More informed decisions.<br />Connected clinics.</p>
        <div className="login-story-features">
          <div className="login-story-feature"><span className="login-story-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 29V9l8-5 8 5v20M3 29V15h5M24 15h5v14M1 29h30M13 29v-7h6v7" /><path d="M14 8h4v3h3v4h-3v3h-4v-3h-3v-4h3Z" fill="currentColor" stroke="none" /><path d="M4 19h1m-1 4h1m22-4h1m-1 4h1M11 20h1m8 0h1" /></svg></span><div><h3>Multi-Clinic Network</h3><p>Connect participating clinics through shared disease insights.</p></div></div>
          <div className="login-story-feature"><span className="login-story-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3c4 3 8 4 12 4v9c0 6-5 10-12 14C9 26 4 22 4 16V7c4 0 8-1 12-4Z" /><path d="M16 11v10m-5-5h10" /></svg></span><div><h3>Privacy-First Architecture</h3><p>Keep identifiable patient records within the clinic.</p></div></div>
          <div className="login-story-feature"><span className="login-story-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 8-8 6 5L28 3M21 3h7v7" /><path d="M3 23h5v7H3zm10-5h5v12h-5zm10-4h5v16h-5z" fill="currentColor" stroke="none" /></svg></span><div><h3>Disease Risk Monitoring</h3><p>Monitor reported cases and identify potential disease trends.</p></div></div>
        </div>
      </section>
      <section className="login-panel"><div className="login-form-wrap">
        <h2>{mustChange ? 'Set a new password' : 'Welcome back'}</h2>
        <p className="login-subtitle">{mustChange ? 'Your temporary password must be changed before access.' : 'Sign in to your clinic node'}</p>
        <form onSubmit={mustChange ? changePassword : submit}>
          <div className="login-field"><label htmlFor="login-email">Email address</label><div className="login-input-wrap"><span className="login-field-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="m4.5 7 7.5 6 7.5-6" /></svg></span><input className="login-input" id="login-email" type="email" placeholder="you@clinic.com" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div></div>
          <div className="login-field"><label htmlFor="login-password">Password</label><div className="login-input-wrap"><span className="login-field-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10" width="15" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><circle cx="12" cy="15.5" r="1" /></svg></span><input className="login-input has-toggle" id="login-password" type={show ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" value={pw} onChange={(event) => setPw(event.target.value)} required /><button className="login-eye" type="button" onClick={() => setShow((value) => !value)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? Icons.eyeOff : Icons.eye}</button></div></div>
          {mustChange && <><div className="login-field"><label htmlFor="new-password">New password</label><input className="login-input" id="new-password" type="password" value={newPw} onChange={(event) => setNewPw(event.target.value)} minLength={8} required /></div><div className="login-field"><label htmlFor="confirm-password">Confirm new password</label><input className="login-input" id="confirm-password" type="password" value={confirmPw} onChange={(event) => setConfirmPw(event.target.value)} minLength={8} required /></div></>}
          {!mustChange && <div className="login-options"><label className="login-remember"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />Remember me</label><button className="login-forgot" type="button" onClick={() => setErr('Password reset is not available yet. Please contact your clinic administrator.')}>Forgot password?</button></div>}
          <button className="login-submit" type="submit" disabled={loading}>{loading ? 'Please wait…' : mustChange ? 'Change password and continue' : 'Sign in'} <span aria-hidden="true">→</span></button>
          {err && <p className="login-error" role="alert">{err}</p>}
        </form>
        <p className="login-footer">Restricted access · VetIntel v2.4.1</p>
      </div></section>
    </main>
  );
}
