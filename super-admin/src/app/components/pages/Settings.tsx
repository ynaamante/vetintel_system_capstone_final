import { useState, useEffect, useRef } from 'react';
import { Camera, Eye, EyeOff, Pencil, X } from 'lucide-react';

type SettingKey =
  | 'emailNotifications'
  | 'clinicApplicationNotifications'
  | 'weeklyPlatformReport'
  | 'inboxNotifications'
  | 'securityAlerts'
  | 'maintenanceMode'
  | 'autoBackup'
  | 'sessionTimeout'
  | 'maxLoginAttempts'
  | 'passwordExpiryDays'
  | 'platformName'
  | 'supportEmail'
  | 'smtpHost'
  | 'smtpPort'
  | 'fromEmail'
  | 'backupRetentionDays';

type SettingsState = {
  emailNotifications: boolean;
  clinicApplicationNotifications: boolean;
  weeklyPlatformReport: boolean;
  inboxNotifications: boolean;
  securityAlerts: boolean;
  maintenanceMode: boolean;
  autoBackup: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  passwordExpiryDays: number;
  platformName: string;
  supportEmail: string;
  smtpHost: string;
  smtpPort: number;
  fromEmail: string;
  backupRetentionDays: number;
};

const initialSettings: SettingsState = {
  emailNotifications: true,
  clinicApplicationNotifications: true,
  weeklyPlatformReport: true,
  inboxNotifications: true,
  securityAlerts: true,
  maintenanceMode: false,
  autoBackup: true,
  sessionTimeout: 30,
  maxLoginAttempts: 5,
  passwordExpiryDays: 90,
  platformName: 'VetIntel',
  supportEmail: 'support@vetintel.com',
  smtpHost: 'smtp.vetintel.com',
  smtpPort: 587,
  fromEmail: 'noreply@vetintel.com',
  backupRetentionDays: 30,
};

const initialSettingIds: Record<SettingKey, number | null> = {
  emailNotifications: null,
  clinicApplicationNotifications: null,
  weeklyPlatformReport: null,
  inboxNotifications: null,
  securityAlerts: null,
  maintenanceMode: null,
  autoBackup: null,
  sessionTimeout: null,
  maxLoginAttempts: null,
  passwordExpiryDays: null,
  platformName: null,
  supportEmail: null,
  smtpHost: null,
  smtpPort: null,
  fromEmail: null,
  backupRetentionDays: null,
};

const apiKeyMap: Record<SettingKey, string> = {
  emailNotifications: 'email_notifications',
  clinicApplicationNotifications: 'clinic_application_notifications',
  weeklyPlatformReport: 'weekly_platform_report',
  inboxNotifications: 'inbox_notifications',
  securityAlerts: 'security_alerts',
  maintenanceMode: 'maintenance_mode',
  autoBackup: 'automatic_backups',
  sessionTimeout: 'session_timeout_minutes',
  maxLoginAttempts: 'max_login_attempts',
  passwordExpiryDays: 'password_expiry_days',
  platformName: 'platform_name',
  supportEmail: 'support_email',
  smtpHost: 'smtp_host',
  smtpPort: 'smtp_port',
  fromEmail: 'smtp_from_email',
  backupRetentionDays: 'backup_retention_days',
};

const getApiKey = (key: SettingKey) => apiKeyMap[key];
const apiKeyToState = Object.fromEntries(
  Object.entries(apiKeyMap).map(([stateKey, apiKey]) => [apiKey, stateKey])
) as Record<string, SettingKey>;

const settingsFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const token = localStorage.getItem('vetintel_token');
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
};
export function Settings() {
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [globalSettingIds, setGlobalSettingIds] = useState<Record<SettingKey, number | null>>(initialSettingIds);
  const [clinicSettingIds, setClinicSettingIds] = useState<Record<SettingKey, number | null>>(initialSettingIds);
  const selectedClinic: number | null = null;
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('vetintel_user') || '{}'); } catch { return {}; }
  })();
  const [profile, setProfile] = useState({
    name: storedUser.name || 'Super Admin',
    email: storedUser.email || 'admin@vetintel.com',
    avatar: String(storedUser.avatar || ''),
    role: String(storedUser.role || 'Super Admin'),
    is_active: storedUser.is_active !== false,
    created_at: storedUser.created_at || '',
  });
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ name: profile.name, email: profile.email, avatar: profile.avatar });
  const [profileEmailCode, setProfileEmailCode] = useState('');
  const [profileEmailCodeSent, setProfileEmailCodeSent] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [visiblePasswordFields, setVisiblePasswordFields] = useState({ current: false, next: false, confirm: false });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorSetupOpen, setTwoFactorSetupOpen] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'phone'>('email');
  const [verificationEmail, setVerificationEmail] = useState(String(storedUser.email || ''));
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(String(storedUser.phone || ''));
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [twoFactorFeedback, setTwoFactorFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const profileRequest = async (path: string, method = 'GET', body?: Record<string, unknown>) => {
    const token = localStorage.getItem('vetintel_token');
    const response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Profile request failed.');
    return result;
  };

  useEffect(() => {
    profileRequest('/api/profile')
      .then(result => {
        const nextProfile = {
          name: String(result.name || ''), email: String(result.email || ''), avatar: String(result.avatar || ''),
          role: String(result.role || 'Super Admin'), is_active: result.is_active !== false, created_at: String(result.created_at || ''),
        };
        setProfile(nextProfile);
        setProfileDraft({ name: nextProfile.name, email: nextProfile.email, avatar: nextProfile.avatar });
        localStorage.setItem('vetintel_user', JSON.stringify({ ...storedUser, ...nextProfile }));
        window.dispatchEvent(new Event('vetintel-user-updated'));
      })
      .catch(error => setProfileFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load your profile.' }));
  }, []);

  const openProfileEditor = () => {
    setProfileDraft({ name: profile.name, email: profile.email, avatar: profile.avatar });
    setProfileEmailCode('');
    setProfileEmailCodeSent(false);
    setProfileFeedback(null);
    setProfileModalOpen(true);
  };

  const selectProfileAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileFeedback({ kind: 'error', message: 'Choose a valid image file.' });
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfileDraft(current => ({ ...current, avatar: typeof reader.result === 'string' ? reader.result : current.avatar }));
    reader.readAsDataURL(file);
  };

  const sendProfileEmailCode = async () => {
    setProfileBusy(true);
    setProfileFeedback(null);
    try {
      const result = await profileRequest('/api/profile/email/send-code', 'POST', { email: profileDraft.email });
      setProfileEmailCodeSent(true);
      setProfileFeedback({ kind: 'success', message: `Verification code sent to ${result.destination}. It expires in 10 minutes.` });
    } catch (error) {
      setProfileFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Could not send the email verification code.' });
    } finally {
      setProfileBusy(false);
    }
  };

  const saveProfileChanges = async () => {
    setProfileBusy(true);
    setProfileFeedback(null);
    const emailChanged = profileDraft.email.trim().toLowerCase() !== profile.email.trim().toLowerCase();
    try {
      let result;
      if (emailChanged) {
        if (!profileEmailCodeSent) throw new Error('Send a verification code to your new email address first.');
        const verified = await profileRequest('/api/profile/email/verify-code', 'POST', {
          email: profileDraft.email, code: profileEmailCode, name: profileDraft.name, avatar: profileDraft.avatar,
        });
        result = verified.profile;
      } else {
        result = await profileRequest('/api/profile', 'PUT', { name: profileDraft.name, avatar: profileDraft.avatar });
      }
      const nextProfile = {
        name: String(result.name || ''), email: String(result.email || ''), avatar: String(result.avatar || ''),
        role: String(result.role || profile.role), is_active: result.is_active !== false, created_at: String(result.created_at || profile.created_at),
      };
      setProfile(nextProfile);
      localStorage.setItem('vetintel_user', JSON.stringify({ ...storedUser, ...nextProfile }));
      window.dispatchEvent(new Event('vetintel-user-updated'));
      setProfileModalOpen(false);
      setProfileFeedback(null);
    } catch (error) {
      setProfileFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Could not save your profile.' });
    } finally {
      setProfileBusy(false);
    }
  };

  const twoFactorRequest = async (path: string, body?: Record<string, string>) => {
    const token = localStorage.getItem('vetintel_token');
    const response = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Two-factor authentication request failed.');
    return result;
  };

  useEffect(() => {
    twoFactorRequest('/api/settings/two-factor')
      .then(result => {
        setTwoFactorEnabled(Boolean(result.enabled));
        if (result.phone) setPhoneNumber(String(result.phone));
        if (result.email) setVerificationEmail(String(result.email));
      })
      .catch(error => setTwoFactorFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load two-factor status.' }));
  }, []);

  const toggleTwoFactor = async () => {
    setTwoFactorFeedback(null);
    if (twoFactorSetupOpen) {
      setTwoFactorSetupOpen(false);
      setVerificationCode('');
      return;
    }
    if (!twoFactorEnabled) {
      setVerificationMethod('email');
      setTwoFactorSetupOpen(true);
      setVerificationCode('');
      return;
    }

    setTwoFactorBusy(true);
    try {
      await twoFactorRequest('/api/settings/two-factor/disable', {});
      setTwoFactorEnabled(false);
      setTwoFactorFeedback(null);
    } catch (error) {
      setTwoFactorFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Could not disable two-factor authentication.' });
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const sendTwoFactorCode = async () => {
    setTwoFactorBusy(true);
    setTwoFactorFeedback(null);
    setVerificationCode('');
    try {
      const result = await twoFactorRequest('/api/settings/two-factor/send-code', {
        method: verificationMethod,
        phone: phoneNumber.trim(),
      });
      setTwoFactorFeedback({ kind: 'success', message: `Verification code sent to ${result.destination}. It expires in 10 minutes.` });
    } catch (error) {
      setTwoFactorFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Could not send the verification code.' });
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const verifyTwoFactorCode = async () => {
    setTwoFactorBusy(true);
    setTwoFactorFeedback(null);
    try {
      await twoFactorRequest('/api/settings/two-factor/verify-code', { method: verificationMethod, code: verificationCode });
      setTwoFactorEnabled(true);
      setTwoFactorSetupOpen(false);
      setVerificationCode('');
      setTwoFactorFeedback(null);
    } catch (error) {
      setTwoFactorFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Could not verify the code.' });
    } finally {
      setTwoFactorBusy(false);
    }
  };
  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordFeedback(null);
    if (password.next !== password.confirm) {
      setPasswordFeedback({ kind: 'error', message: 'New password and confirmation do not match.' });
      return;
    }
    if (password.next.length < 8) {
      setPasswordFeedback({ kind: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const token = localStorage.getItem('vetintel_token');
      const response = await fetch('/api/password/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword: password.current, newPassword: password.next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update password.');
      setPassword({ current: '', next: '', confirm: '' });
      setPasswordFeedback({ kind: 'success', message: 'Password updated successfully.' });
    } catch (error) {
      setPasswordFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Failed to update password.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsFetch('/api/settings');
        if (!response.ok) throw new Error('Failed to fetch settings');
        const data = (await response.json()) as any[];

        const loadedGlobalIds = { ...initialSettingIds };
        const loadedClinicIds = { ...initialSettingIds };
        const globalValues: Record<string, any> = {};
        const clinicValues: Record<string, any> = {};

        data.forEach((row: any) => {
          const stateKey = apiKeyToState[row.key];
          if (!stateKey) return;
          if (row.clinic_id == null) {
            loadedGlobalIds[stateKey] = row.id;
            globalValues[stateKey] = row.value;
          } else if (selectedClinic && Number(row.clinic_id) === Number(selectedClinic)) {
            loadedClinicIds[stateKey] = row.id;
            clinicValues[stateKey] = row.value;
          }
        });

        const loadedSettings: SettingsState = { ...initialSettings };
        Object.keys(globalValues).forEach((k) => (loadedSettings as Record<string, any>)[k] = globalValues[k]);
        Object.keys(clinicValues).forEach((k) => (loadedSettings as Record<string, any>)[k] = clinicValues[k]);

        setSettings(loadedSettings);
        setGlobalSettingIds(loadedGlobalIds);
        setClinicSettingIds(loadedClinicIds);
      } catch (error) {
        console.error('Failed to load settings:', error);
        setLoadError('Failed to load settings. Please check your server connection.');
      }
    };

    loadSettings();
  }, [selectedClinic]);

  const updateSetting = (key: SettingKey, value: string | number | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);

    try {
      const entries = Object.entries(settings) as [SettingKey, string | number | boolean][];
      const results = await Promise.all(
        entries.map(async ([stateKey, value]) => {
          const apiKey = getApiKey(stateKey);
          const body = { key: apiKey, value };

          if (selectedClinic) {
            const clinicId = clinicSettingIds[stateKey];
            if (clinicId) {
              const res = await settingsFetch(`/api/settings/${clinicId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (!res.ok) throw new Error('Failed to update clinic setting');
              return { stateKey, payload: await res.json(), scope: 'clinic' };
            }
            const res = await settingsFetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clinic_id: selectedClinic, ...body }),
            });
            if (!res.ok) throw new Error('Failed to create clinic setting');
            return { stateKey, payload: await res.json(), scope: 'clinic' };
          } else {
            const globalId = globalSettingIds[stateKey];
            if (globalId) {
              const res = await settingsFetch(`/api/settings/${globalId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (!res.ok) throw new Error('Failed to update global setting');
              return { stateKey, payload: await res.json(), scope: 'global' };
            }
            const res = await settingsFetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clinic_id: null, ...body }),
            });
            if (!res.ok) throw new Error('Failed to create global setting');
            return { stateKey, payload: await res.json(), scope: 'global' };
          }
        })
      );

      const updatedGlobal = { ...globalSettingIds };
      const updatedClinic = { ...clinicSettingIds };
      results.forEach(({ stateKey, payload, scope }: any) => {
        if (!payload?.id) return;
        const sk = stateKey as SettingKey;
        if (scope === 'clinic') updatedClinic[sk] = payload.id;
        else updatedGlobal[sk] = payload.id;
      });
      setGlobalSettingIds(updatedGlobal);
      setClinicSettingIds(updatedClinic);

      alert('Settings saved successfully.');
    } catch (error) {
      console.error('Save settings failed:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const accountInputClass = 'w-full rounded-lg border border-[#c6e5e1] bg-[#f7fbfa] px-3 py-2 text-sm font-normal text-[#315f5e] outline-none transition focus:border-[#105f5a] focus:ring-2 focus:ring-[#105f5a]/10';
  const displayRole = profile.role.replace(/[_-]/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
  const memberSinceDate = profile.created_at ? new Date(profile.created_at) : null;
  const memberSince = memberSinceDate && !Number.isNaN(memberSinceDate.getTime())
    ? memberSinceDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Not provided';
  const profileInitials = profile.name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'VA';
  const toggle = (key: 'emailNotifications' | 'clinicApplicationNotifications' | 'weeklyPlatformReport' | 'inboxNotifications' | 'securityAlerts' | 'maintenanceMode' | 'autoBackup') => (
    <button type="button" role="switch" aria-checked={settings[key]} aria-label={`Toggle ${key}`} onClick={() => updateSetting(key, !settings[key])} className={`relative h-5 w-10 shrink-0 rounded-full transition ${settings[key] ? 'bg-[#16837d]' : 'bg-[#c5d8d4]'}`}>
      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${settings[key] ? 'translate-x-5' : ''}`} />
    </button>
  );

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_45%_0%,rgba(229,244,241,0.72),transparent_35%),radial-gradient(ellipse_at_85%_100%,rgba(198,229,225,0.6),transparent_38%),linear-gradient(135deg,#f7fbfa,#e5f4f1)] p-3 text-[#173f40] sm:p-5 lg:p-6">
      <div className="w-full space-y-3">
          {loadError && <p role="alert" className="mb-4 rounded-lg border border-[#f5c2c7] bg-[#fff5f5] px-3 py-2 text-sm text-[#b42318]">{loadError}</p>}
          <section className="relative isolate overflow-hidden rounded-xl border border-[#c6e5e1] bg-white/90 p-4 shadow-[0_3px_14px_rgba(16,95,90,0.06)] sm:px-6 sm:py-4">
            <div className="relative flex items-start justify-between gap-4">
              <div><h2 className="text-base font-semibold text-[#105f5a]">Profile</h2></div>
              <button type="button" onClick={openProfileEditor} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#8ebfb4] bg-white px-3 py-1.5 text-xs font-semibold text-[#16837d] transition hover:bg-[#f1faf8]"><Pencil className="h-3.5 w-3.5" /> Edit Profile</button>
            </div>
            {profileFeedback && !profileModalOpen && <p role={profileFeedback.kind === 'error' ? 'alert' : 'status'} className={`relative mt-2 rounded-lg px-3 py-2 text-xs ${profileFeedback.kind === 'error' ? 'bg-[#fff5f5] text-[#b42318]' : 'bg-[#e5f4f1] text-[#16837d]'}`}>{profileFeedback.message}</p>}
            <div className="relative mt-3 grid items-center gap-4 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-5">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#e5f4f1] text-lg font-bold text-[#16837d]">{profile.avatar ? <img src={profile.avatar} alt="Profile avatar" className="h-full w-full object-cover" /> : profileInitials}</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="border-l border-[#c6e5e1] pl-3"><p className="text-xs font-semibold text-[#315f5e]">Full Name</p><p className="mt-1 text-sm text-[#173f40]">{profile.name}</p></div>
                <div className="border-l border-[#c6e5e1] pl-3"><p className="text-xs font-semibold text-[#315f5e]">Email Address</p><p className="mt-1 break-all text-sm text-[#173f40]">{profile.email}</p></div>
                <div className="border-l border-[#c6e5e1] pl-3"><p className="text-xs font-semibold text-[#315f5e]">Role</p><p className="mt-1 text-sm text-[#173f40]">{displayRole}</p></div>
                <div className="border-l border-[#c6e5e1] pl-3"><p className="text-xs font-semibold text-[#315f5e]">Account Status</p><p className={`mt-1 text-sm font-semibold ${profile.is_active ? 'text-[#16837d]' : 'text-[#b42318]'}`}>{profile.is_active ? 'Active' : 'Inactive'}</p></div>
                <div className="border-l border-[#c6e5e1] pl-3"><p className="text-xs font-semibold text-[#315f5e]">Member Since</p><p className="mt-1 text-sm text-[#173f40]">{memberSince}</p></div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#c6e5e1] bg-white/90 p-4 shadow-[0_3px_14px_rgba(16,95,90,0.06)] sm:px-6 sm:py-4">
            <h2 className="text-base font-semibold text-[#105f5a]">Password &amp; Security</h2>
            <form onSubmit={updatePassword} aria-busy={isUpdatingPassword}>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {([
                    ['current', 'Current Password', 'Enter current password'],
                    ['next', 'New Password', 'Enter new password'],
                    ['confirm', 'Confirm New Password', 'Confirm new password'],
                  ] as const).map(([key, label, placeholder]) => (
                    <label className="block text-xs font-semibold text-[#315f5e]" key={key}>
                      {label}
                      <span className="relative mt-2 block">
                        <input
                          type={visiblePasswordFields[key] ? 'text' : 'password'}
                          autoComplete={key === 'current' ? 'current-password' : 'new-password'}
                          value={password[key]}
                          onChange={event => setPassword(current => ({ ...current, [key]: event.target.value }))}
                          placeholder={placeholder}
                          className="h-9 w-full rounded-lg border border-[#c6e5e1] bg-white px-3 pr-10 text-xs font-normal text-[#173f40] outline-none transition placeholder:text-[#829e9b] focus:border-[#105f5a] focus:ring-0 focus:shadow-none"
                        />
                        <button
                          type="button"
                          onClick={() => setVisiblePasswordFields(current => ({ ...current, [key]: !current[key] }))}
                          aria-label={`${visiblePasswordFields[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#315273] transition hover:text-[#16837d]"
                        >
                          {visiblePasswordFields[key] ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                        </button>
                      </span>
                    </label>
                  ))}
              </div>
                {passwordFeedback && (
                  <p role={passwordFeedback.kind === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-lg px-3 py-2 text-sm ${passwordFeedback.kind === 'error' ? 'bg-[#fff5f5] text-[#b42318]' : 'bg-[#e5f4f1] text-[#16837d]'}`}>
                    {passwordFeedback.message}
                  </p>
                )}
                <button type="submit" disabled={isUpdatingPassword} className="mt-3 rounded-lg bg-gradient-to-r from-[#16837d] to-[#105f5a] px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-[#105f5a] hover:to-[#105f5a] disabled:cursor-not-allowed disabled:opacity-60">{isUpdatingPassword ? 'Updating...' : 'Update Password'}</button>
            </form>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#c6e5e1] pt-3">
                <div>
                  <h3 className="text-xs font-semibold text-[#173f40]">Two-Factor Authentication</h3>
                  <p className="text-xs text-[#527b79]">Add an extra layer of security to your account.</p>
                  {twoFactorEnabled && <p className="mt-1 text-xs font-semibold text-[#16837d]">Enabled</p>}
                </div>
                <button type="button" role="switch" aria-checked={twoFactorEnabled || twoFactorSetupOpen} aria-label="Two-Factor Authentication" disabled={twoFactorBusy} onClick={toggleTwoFactor} className={`relative h-5 w-10 shrink-0 rounded-full transition disabled:opacity-60 ${(twoFactorEnabled || twoFactorSetupOpen) ? 'bg-[#16837d]' : 'bg-[#c5d8d4]'}`}><span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${(twoFactorEnabled || twoFactorSetupOpen) ? 'translate-x-5' : ''}`} /></button>
              </div>
              {twoFactorSetupOpen && (
                <div className="mt-3 rounded-xl border border-[#c6e5e1] bg-[#f7fbfa] p-4 sm:p-5">
                  <div className="mb-4 inline-flex rounded-full border border-[#c6e5e1] bg-white p-1">
                    <button type="button" onClick={() => { setVerificationMethod('email'); setVerificationCode(''); setTwoFactorFeedback(null); }} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${verificationMethod === 'email' ? 'bg-[#105f5a] text-white' : 'text-[#315f5e] hover:bg-[#f1faf8]'}`}>Email Verification</button>
                    <button type="button" onClick={() => { setVerificationMethod('phone'); setVerificationCode(''); setTwoFactorFeedback(null); }} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${verificationMethod === 'phone' ? 'bg-[#105f5a] text-white' : 'text-[#315f5e] hover:bg-[#f1faf8]'}`}>Phone Number Verification</button>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="border-b border-[#c6e5e1] pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-5">
                      <h4 className="text-sm font-semibold text-[#173f40]">{verificationMethod === 'email' ? 'Verify Your Email' : 'Verify Your Phone Number'}</h4>
                      <p className="mt-1 text-xs leading-5 text-[#527b79]">We'll send a six-digit code to your {verificationMethod === 'email' ? 'registered email address' : 'phone number'}.</p>
                      {verificationMethod === 'email' ? (
                        <p className="mt-3 text-sm font-semibold text-[#244b3e]">{verificationEmail}</p>
                      ) : (
                        <label className="mt-3 block text-xs font-semibold text-[#315f5e]">Phone number
                          <input type="tel" autoComplete="tel" value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} placeholder="+639171234567" className="mt-1 h-10 w-full rounded-lg border border-[#c6e5e1] bg-white px-3 text-sm font-normal text-[#173f40] outline-none focus:border-[#105f5a] focus:ring-0 focus:shadow-none" />
                        </label>
                      )}
                      <button type="button" onClick={sendTwoFactorCode} disabled={twoFactorBusy || (verificationMethod === 'phone' && !phoneNumber.trim())} className="mt-4 rounded-full border border-[#8ebfb4] bg-white px-5 py-2 text-xs font-semibold text-[#16837d] transition hover:bg-[#f1faf8] disabled:cursor-not-allowed disabled:opacity-50">{twoFactorBusy ? 'Sending...' : 'Send Code'}</button>
                    </div>
                    <div className="md:pl-1">
                      <label className="block text-sm font-semibold text-[#173f40]" htmlFor="two-factor-code">Enter Verification Code</label>
                      <input id="two-factor-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={verificationCode} onChange={event => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter 6-digit code" className="mt-3 h-12 w-full max-w-xs rounded-lg border border-[#c6e5e1] bg-white px-4 text-center text-sm tracking-normal text-[#173f40] outline-none placeholder:text-sm placeholder:tracking-normal focus:border-[#105f5a] focus:ring-0 focus:shadow-none" />
                      <p className="mt-2 text-xs text-[#527b79]">Codes expire in 10 minutes.</p>
                      <button type="button" onClick={verifyTwoFactorCode} disabled={twoFactorBusy || verificationCode.length !== 6} className="mt-4 rounded-full bg-gradient-to-r from-[#16837d] to-[#105f5a] px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:from-[#105f5a] hover:to-[#105f5a] disabled:cursor-not-allowed disabled:opacity-50">{twoFactorBusy ? 'Verifying...' : 'Verify and Enable'}</button>
                    </div>
                  </div>
                </div>
              )}
              {twoFactorFeedback && <p role={twoFactorFeedback.kind === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-lg px-3 py-2 text-xs ${twoFactorFeedback.kind === 'error' ? 'bg-[#fff5f5] text-[#b42318]' : 'bg-[#e5f4f1] text-[#16837d]'}`}>{twoFactorFeedback.message}</p>}
          </section>

          <section className="relative isolate overflow-hidden rounded-xl border border-[#c6e5e1] bg-white/90 p-4 shadow-[0_3px_14px_rgba(16,95,90,0.06)] sm:px-6 sm:py-4">
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-20 h-40 w-60 rotate-[-18deg] rounded-[50%] border-[22px] border-[#c9ebe5]/40" />
            <h2 className="relative text-base font-semibold text-[#105f5a]">Notification Settings</h2>
            <div className="relative mt-2">
              {[
                ['clinicApplicationNotifications', 'New Clinic Application', 'Get notified when a new clinic applies.'],
                ['securityAlerts', 'New Role Request', 'Get notified when a new role is requested.'],
                ['maintenanceMode', 'New Demo Request', 'Get notified when a demo is requested.'],
                ['autoBackup', 'System Alerts', 'Receive alerts about critical system events.'],
                ['weeklyPlatformReport', 'Weekly Platform Report', 'Get a weekly summary of platform activity.'],
                ['inboxNotifications', 'New Inbox Message', 'Get notified when a new message arrives in your inbox.'],
              ].map(([key, label, description], index) => (
                <div className="flex min-h-10 items-center justify-between gap-4 border-b border-[#c6e5e1] py-1.5 last:border-0" key={`${key}-${index}`}>
                  <div><h3 className="text-xs font-semibold text-[#173f40]">{label}</h3><p className="text-[11px] text-[#527b79]">{description}</p></div>
                  {toggle(key as 'emailNotifications' | 'clinicApplicationNotifications' | 'weeklyPlatformReport' | 'inboxNotifications' | 'securityAlerts' | 'maintenanceMode' | 'autoBackup')}
                </div>
              ))}
            </div>
          </section>
          <div className="flex justify-end pb-1">
            <button type="button" onClick={handleSaveChanges} disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#16837d] to-[#105f5a] px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-[#105f5a] hover:to-[#105f5a] disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? 'Saving...' : 'Save All Changes'}</button>
          </div>
      </div>
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !profileBusy) setProfileModalOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="edit-profile-title" className="relative my-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(16,95,90,0.18)]">
            <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-[#105f5a] to-[#16837d] px-5 py-3 text-white sm:px-6">
              <div><h2 id="edit-profile-title" className="text-sm font-semibold">Edit Profile</h2><p className="mt-1 text-xs text-white/80">Update your account details and profile photo.</p></div>
              <button type="button" aria-label="Close edit profile" disabled={profileBusy} onClick={() => setProfileModalOpen(false)} className="rounded-lg p-1 text-white/90 transition hover:bg-white/10 hover:text-white disabled:opacity-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 bg-[#f7fbfa] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e5f4f1] text-lg font-bold text-[#16837d]">{profileDraft.avatar ? <img src={profileDraft.avatar} alt="Profile preview" className="h-full w-full object-cover" /> : profileInitials}</div>
                <div>
                  <input ref={avatarInputRef} type="file" accept="image/*" onChange={selectProfileAvatar} className="hidden" />
                  <button type="button" onClick={() => avatarInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-[#c6e5e1] bg-white px-3 py-2 text-xs font-semibold text-[#16837d] transition hover:bg-[#f1faf8]"><Camera className="h-4 w-4" /> Choose Photo</button>
                  {profileDraft.avatar && <button type="button" onClick={() => setProfileDraft(current => ({ ...current, avatar: '' }))} className="ml-2 rounded-lg px-2 py-2 text-xs font-semibold text-[#527b79] transition hover:bg-[#f1faf8]">Remove</button>}
                  <p className="mt-1 text-[11px] text-[#829e9b]">Optional profile photo.</p>
                </div>
              </div>
              <label className="block text-xs font-semibold text-[#315f5e]">Full Name<input autoComplete="name" value={profileDraft.name} onChange={event => setProfileDraft(current => ({ ...current, name: event.target.value }))} className={`${accountInputClass} mt-1 bg-white`} /></label>
              <label className="block text-xs font-semibold text-[#315f5e]">Email Address<input type="email" autoComplete="email" value={profileDraft.email} onChange={event => { setProfileDraft(current => ({ ...current, email: event.target.value })); setProfileEmailCodeSent(false); setProfileEmailCode(''); setProfileFeedback(null); }} className={`${accountInputClass} mt-1 bg-white`} /></label>
              {profileDraft.email.trim().toLowerCase() !== profile.email.trim().toLowerCase() && (
                <div className="rounded-xl border border-[#c6e5e1] bg-[#f7fbfa] p-3">
                  <p className="text-xs leading-5 text-[#527b79]">Verify the new email address before it replaces your current address.</p>
                  {!profileEmailCodeSent ? (
                    <button type="button" onClick={sendProfileEmailCode} disabled={profileBusy} className="mt-2 rounded-lg border border-[#8ebfb4] bg-white px-4 py-2 text-xs font-semibold text-[#16837d] transition hover:bg-[#f1faf8] disabled:opacity-50">{profileBusy ? 'Sending...' : 'Send Verification Code'}</button>
                  ) : (
                    <label className="mt-3 block text-xs font-semibold text-[#315f5e]">Verification Code
                      <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={profileEmailCode} onChange={event => setProfileEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter 6-digit code" className="mt-1 h-10 w-full rounded-lg border border-[#c6e5e1] bg-white px-3 text-sm tracking-normal text-[#173f40] outline-none focus:border-[#105f5a] focus:ring-0 focus:shadow-none" />
                    </label>
                  )}
                </div>
              )}
              {profileFeedback && profileModalOpen && <p role={profileFeedback.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-xs ${profileFeedback.kind === 'error' ? 'bg-[#fff5f5] text-[#b42318]' : 'bg-[#e5f4f1] text-[#16837d]'}`}>{profileFeedback.message}</p>}
            </div>
            <div className="flex flex-col-reverse justify-end gap-2 border-t border-[#c6e5e1] bg-[#e5f4f1] px-5 py-4 sm:flex-row sm:px-6">
              <button type="button" disabled={profileBusy} onClick={() => setProfileModalOpen(false)} className="rounded-lg border border-[#c6e5e1] bg-white px-4 py-2 text-xs font-semibold text-[#527b79] transition hover:bg-[#f1faf8] disabled:opacity-50">Cancel</button>
              <button type="button" disabled={profileBusy || (profileDraft.email.trim().toLowerCase() !== profile.email.trim().toLowerCase() && (!profileEmailCodeSent || profileEmailCode.length !== 6))} onClick={saveProfileChanges} className="rounded-lg bg-gradient-to-r from-[#16837d] to-[#105f5a] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-[#105f5a] hover:to-[#105f5a] disabled:cursor-not-allowed disabled:opacity-50">{profileBusy ? 'Saving...' : profileDraft.email.trim().toLowerCase() !== profile.email.trim().toLowerCase() ? 'Verify Email & Save' : 'Save Changes'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
