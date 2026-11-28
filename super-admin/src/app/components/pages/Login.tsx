import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { isSystemAdmin } from '../../../utils/permissionUtils';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      const response = await axios.post('/api/login', { email, password });
      const userRole = response.data.role;
      if (!isSystemAdmin(userRole)) {
        setError('You do not have System Administrator access.');
        return;
      }

      localStorage.setItem('vetintel_user', JSON.stringify({
        email: response.data.email,
        name: response.data.name,
        role: userRole,
      }));
      localStorage.setItem('vetintel_token', response.data.token);
      navigate('/');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Invalid email or password');
    }
  };

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#f7fbfa] via-[#e8f6f3] to-[#d8efec] p-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-32 h-[min(70vw,720px)] w-[min(70vw,720px)] rounded-full bg-white/55 blur-3xl" />
        <svg className="absolute inset-x-0 bottom-0 h-[48%] w-full" viewBox="0 0 1440 420" preserveAspectRatio="none">
          <path d="M0 130C180 260 290 215 475 420H0V130Z" fill="#c9ebe5" />
          <path d="M0 245C170 270 270 325 360 420H0V245Z" fill="#58a49b" />
          <path d="M1440 110C1280 205 1190 270 1080 420H1440V110Z" fill="#d8efec" />
          <path d="M0 350C155 300 285 355 445 420H0V350Z" fill="#16837d" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border border-[#c6e5e1] border-t-4 border-t-[#16837d] bg-white/95 px-7 py-8 shadow-[0_24px_70px_-24px_rgba(23,75,76,.2)] sm:px-9">
          <div className="mb-7 text-center">
            <div className="text-xl font-bold tracking-tight text-[#16837d]">VetIntel</div>
            <div className="text-xs font-medium text-[#527b79]">Super Admin Portal</div>
          </div>

          <h2 className="mb-1 text-center text-2xl font-bold text-[#173f40]">Sign In</h2>
          <p className="mb-7 text-center text-sm text-[#527b79]">Access the platform administration center</p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#315f5e]">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#438a84]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#c6e5e1] bg-white py-3 pl-10 pr-3 text-sm text-[#173f40] outline-none transition placeholder:text-[#829e9b] focus:border-[#16837d] focus:ring-0 focus:shadow-none"
                  placeholder="admin@vetintel.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#315f5e]">
                Password
              </label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#438a84]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#c6e5e1] bg-white py-3 pl-10 pr-12 text-sm text-[#173f40] outline-none transition placeholder:text-[#829e9b] focus:border-[#16837d] focus:ring-0 focus:shadow-none"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#739491] transition hover:text-[#16837d]"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#b9d8d3] text-[#16837d] accent-[#16837d] focus:ring-[#16837d]"
                />
                <span className="ml-2 text-xs text-[#527b79]">Remember me</span>
              </label>
              <a href="#" className="text-xs font-medium text-[#16837d] transition hover:text-[#105f5a]">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-[#16837d] to-[#105f5a] py-3 text-sm font-semibold text-white shadow-[0_10px_22px_-12px_rgba(22,131,125,.55)] transition hover:from-[#13756f] hover:to-[#0d524e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16837d]"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[10px] text-[#739491]">
              VetIntel Platform v2.4.1 · Restricted Access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
