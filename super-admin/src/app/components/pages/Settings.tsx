import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Database,
  Mail,
  Save,
} from 'lucide-react';

type SettingKey =
  | 'emailNotifications'
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

type ClinicOption = {
  id: number;
  name: string;
};

const initialSettings: SettingsState = {
  emailNotifications: true,
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

export function Settings() {
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [globalSettingIds, setGlobalSettingIds] = useState<Record<SettingKey, number | null>>(initialSettingIds);
  const [clinicSettingIds, setClinicSettingIds] = useState<Record<SettingKey, number | null>>(initialSettingIds);
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'platform' | 'notifications'>('profile');
  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('vetintel_user') || '{}'); } catch { return {}; }
  })();
  const [profile, setProfile] = useState({ name: storedUser.name || 'Super Admin', email: storedUser.email || 'admin@vetintel.com', position: 'Platform Administrator' });
  const [avatar, setAvatar] = useState<string | null>(storedUser.avatar || null);
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const changeAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : null;
      setAvatar(value);
      if (value) {
        const user = { ...storedUser, ...profile, avatar: value };
        localStorage.setItem('vetintel_user', JSON.stringify(user));
        window.dispatchEvent(new Event('vetintel-user-updated'));
      }
    };
    reader.readAsDataURL(file);
  };
  const saveProfile = () => {
    const user = { ...storedUser, ...profile, avatar };
    localStorage.setItem('vetintel_user', JSON.stringify(user));
    window.dispatchEvent(new Event('vetintel-user-updated'));
    alert('Profile saved successfully.');
  };

  useEffect(() => {
    const fetchClinics = async () => {
      try {
        const response = await fetch('/api/clinics');
        if (!response.ok) throw new Error('Failed to fetch clinics');
        const data = (await response.json()) as any[];
        setClinics(data.map((clinic: any) => ({ id: clinic.id, name: clinic.name })));
      } catch (error) {
        console.error('Failed to load clinics:', error);
      }
    };

    fetchClinics();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings');
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
              const res = await fetch(`/api/settings/${clinicId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (!res.ok) throw new Error('Failed to update clinic setting');
              return { stateKey, payload: await res.json(), scope: 'clinic' };
            }
            const res = await fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clinic_id: selectedClinic, ...body }),
            });
            if (!res.ok) throw new Error('Failed to create clinic setting');
            return { stateKey, payload: await res.json(), scope: 'clinic' };
          } else {
            const globalId = globalSettingIds[stateKey];
            if (globalId) {
              const res = await fetch(`/api/settings/${globalId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (!res.ok) throw new Error('Failed to update global setting');
              return { stateKey, payload: await res.json(), scope: 'global' };
            }
            const res = await fetch('/api/settings', {
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

  const inputClass = 'w-full max-w-[440px] rounded-lg border border-[#d4e3d7] bg-white px-3 py-2 text-sm text-[#172b24] outline-none focus:border-[#086b50]';
  const toggle = (key: 'emailNotifications' | 'securityAlerts' | 'maintenanceMode' | 'autoBackup') => (
    <button type="button" aria-label={`Toggle ${key}`} onClick={() => updateSetting(key, !settings[key])} className={`relative h-5 w-10 rounded-full ${settings[key] ? 'bg-[#086b50]' : 'bg-[#c4d6f5]'}`}>
      <span className={`absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition-transform ${settings[key] ? 'translate-x-5' : ''}`} />
    </button>
  );
  const tabs = [
    ['profile', 'Profile'],
    ['password', 'Password & Security'],
    ['platform', 'Platform Settings'],
    ['notifications', 'Notification Settings'],
  ] as const;

  return (
    <div className="min-h-full bg-[#fafbf8] p-5 text-[#172b24]">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[164px_minmax(0,1fr)]">
        <nav className="h-fit overflow-hidden rounded-xl border border-[#d4e3d7] bg-white">
          {tabs.map(([key, label]) => <button key={key} type="button" onClick={() => setActiveTab(key)} className={`block w-full border-b border-[#e3ecfb] px-3 py-3 text-left text-xs font-medium last:border-b-0 ${activeTab === key ? 'bg-[#e7f4ec] text-[#086b50]' : 'text-[#526B62]'}`}>{label}</button>)}
        </nav>
        <section className="min-h-[376px] rounded-xl border border-[#d4e3d7] bg-white p-5">
          {loadError && <p className="mb-3 text-xs text-red-600">{loadError}</p>}
          {activeTab === 'profile' && <div className="max-w-[440px] space-y-3"><h2 className="mb-4 text-xs font-bold">Super Admin Profile</h2><div className="flex items-center gap-3 pb-1"><div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#086b50] text-lg font-semibold text-white">{avatar ? <img src={avatar} alt="Profile avatar" className="h-full w-full object-cover" /> : 'SA'}</div><label className="cursor-pointer text-xs font-semibold text-[#086b50]">Change avatar<input type="file" accept="image/*" onChange={changeAvatar} className="hidden" /></label></div><label className="block text-xs text-[#526B62]">Full Name<input className={`${inputClass} mt-1`} value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label><label className="block text-xs text-[#526B62]">Email Address<input className={`${inputClass} mt-1`} value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} /></label><label className="block text-xs text-[#526B62]">Position<input className={`${inputClass} mt-1`} value={profile.position} onChange={e => setProfile({ ...profile, position: e.target.value })} /></label><button type="button" onClick={saveProfile} className="rounded-lg bg-[#086b50] px-3 py-2 text-xs font-semibold text-white">Save Changes</button></div>}
          {activeTab === 'password' && <div className="max-w-[440px] space-y-3"><h2 className="mb-4 text-xs font-bold">Password & Security</h2>{[['current', 'Current Password'], ['next', 'New Password'], ['confirm', 'Confirm New Password']].map(([key, label]) => <label className="block text-xs text-[#526B62]" key={key}>{label}<input type="password" className={`${inputClass} mt-1`} value={password[key as keyof typeof password]} onChange={e => setPassword({ ...password, [key]: e.target.value })} /></label>)}<button type="button" className="rounded-lg bg-[#086b50] px-3 py-2 text-xs font-semibold text-white">Update Password</button><div className="mt-4 border-t border-[#e3ecfb] pt-3"><p className="mb-3 text-xs font-semibold">Two-Factor Authentication</p><div className="flex items-center justify-between rounded-lg bg-[#eef4ff] px-3 py-3 text-xs"><span>2FA via Authenticator App</span><span className="rounded-full bg-[#d8f7e9] px-2 py-1 text-[10px] text-[#078c63]">Enabled</span></div></div></div>}
          {activeTab === 'platform' && <div className="max-w-[440px] space-y-3"><h2 className="mb-4 text-xs font-bold">Platform Settings</h2><label className="block text-xs text-[#526B62]">Platform Name<input className={`${inputClass} mt-1`} value={settings.platformName} onChange={e => updateSetting('platformName', e.target.value)} /></label><label className="block text-xs text-[#526B62]">Support Email<input className={`${inputClass} mt-1`} value={settings.supportEmail} onChange={e => updateSetting('supportEmail', e.target.value)} /></label><label className="block text-xs text-[#526B62]">Max Clinics per Plan (Enterprise)<input type="number" className={`${inputClass} mt-1`} value={50} readOnly /></label><button type="button" onClick={handleSaveChanges} disabled={isSaving} className="rounded-lg bg-[#086b50] px-3 py-2 text-xs font-semibold text-white">{isSaving ? 'Saving...' : 'Save Settings'}</button></div>}
          {activeTab === 'notifications' && <div className="max-w-[440px]"><h2 className="mb-4 text-xs font-bold">Notification Settings</h2><div className="space-y-0">{[['emailNotifications', 'New clinic application submitted'], ['securityAlerts', 'New role request received'], ['maintenanceMode', 'New demo request'], ['autoBackup', 'Platform system alerts'], ['maintenanceMode', 'Weekly platform report']].map(([key, label], index) => <div className="flex items-center justify-between border-b border-[#e3ecfb] py-3 text-xs" key={`${key}-${index}`}><span>{label}</span>{toggle(key as 'emailNotifications' | 'securityAlerts' | 'maintenanceMode' | 'autoBackup')}</div>)}</div><button type="button" onClick={handleSaveChanges} disabled={isSaving} className="mt-3 rounded-lg bg-[#086b50] px-3 py-2 text-xs font-semibold text-white">{isSaving ? 'Saving...' : 'Save Preferences'}</button></div>}
        </section>
      </div>
    </div>
  );
}
