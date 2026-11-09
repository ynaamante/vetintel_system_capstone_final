import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Activity, Eye, EyeOff } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-[#172b5c] via-[#1d3f93] to-[#2459d4] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo and Header */}
        <div className="bg-white rounded-xl shadow-2xl px-8 py-7">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="flex items-center justify-center w-9 h-9 bg-[#086b50] rounded-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="text-base font-semibold text-[#172b24]">VetIntel</div>
              <div className="text-[11px] text-[#7995c9]">Super Admin Portal</div>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-[#101b33] text-center mb-1">Sign In</h2>
          <p className="text-xs text-[#a3b9e1] text-center mb-7">Access the platform administration center</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-[#46649a] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#d4e3d7] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="admin@vetintel.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#46649a] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#d4e3d7] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-xs text-[#526B62]">Remember me</span>
              </label>
              <a href="#" className="text-xs text-[#086b50] hover:text-blue-700">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              className="w-full bg-[#086b50] text-white py-2.5 rounded-lg hover:bg-blue-700 text-xs font-semibold transition-colors shadow-[0_8px_18px_-10px_rgba(33,97,232,.9)]"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[10px] text-[#b3c5e7]">
              VetIntel Platform v2.4.1 · Restricted Access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
