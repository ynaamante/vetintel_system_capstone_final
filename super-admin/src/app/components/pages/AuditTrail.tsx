import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';

type AuditEntry = {
  date: string;
  action: string;
  clinic: string;
  target: string;
  description: string;
};

const entries: AuditEntry[] = [
  { date: 'Sep 03, 2026 14:22', action: 'Approved clinic', clinic: 'Metro Pet Care Center', target: 'Clinic Account', description: 'Clinic application approved and roles provisioned.' },
  { date: 'Sep 03, 2026 11:05', action: 'Rejected application', clinic: 'Northpark Vet Specialists', target: 'Application #0082', description: 'Application rejected due to incomplete documentation.' },
  { date: 'Sep 02, 2026 16:40', action: 'Created clinic role', clinic: 'Greenfield Animal Hospital', target: 'Veterinarian Role', description: 'Role configured with 26/47 permissions.' },
  { date: 'Sep 02, 2026 10:15', action: 'Modified role permissions', clinic: 'Happy Tails Animal Clinic', target: 'Receptionist Role', description: "Added 'Send Notifications' permission." },
  { date: 'Sep 01, 2026 09:30', action: 'Provisioned role', clinic: 'CityVet Clinic', target: 'Starter Plan Roles', description: '3 roles provisioned to clinic owner.' },
  { date: 'Aug 30, 2026 15:00', action: 'Changed subscription plan', clinic: 'Metro Pet Care Center', target: 'Subscription', description: 'Upgraded from Starter to Professional plan.' },
  { date: 'Aug 29, 2026 11:20', action: 'Approved role request', clinic: 'ABC Veterinary Clinic', target: 'Billing Officer Role', description: 'Role request approved and configured with 14 permissions.' },
];

export function AuditTrail() {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => entries.filter(entry => `${entry.action} ${entry.clinic} ${entry.target} ${entry.description}`.toLowerCase().includes(search.toLowerCase())), [search]);

  const exportLogs = () => {
    const csv = ['Date & Time,Action,Clinic,Target,Description', ...entries.map(entry => [entry.date, entry.action, entry.clinic, entry.target, entry.description].map(value => `"${value}"`).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = 'audit-trail.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="min-h-full bg-[#fafbf8] p-5 text-[#172b24]">
      <section className="overflow-hidden rounded-xl border border-[#d4e3d7] bg-white">
        <div className="flex items-center justify-between border-b border-[#d4e3d7] px-5 py-4">
          <div className="flex gap-2">
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#a9d6b7]" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search actions..." className="w-48 rounded-lg border border-[#d4e3d7] bg-[#fafbf8] py-2 pl-9 pr-3 text-xs outline-none" /></div>
            <button onClick={exportLogs} className="rounded-lg bg-[#086b50] px-4 py-2 text-xs font-semibold text-white"><Download className="mr-1 inline h-3.5 w-3.5" />Export</button>
          </div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left"><thead className="bg-[#e7f4ec]"><tr>{['Date & Time', 'Super Admin', 'Action', 'Clinic', 'Target', 'Description'].map(heading => <th className="px-4 py-3 text-xs font-semibold text-[#526B62]" key={heading}>{heading}</th>)}</tr></thead><tbody>{filtered.map(entry => <tr className="border-t border-[#e3ecfb]" key={`${entry.date}-${entry.action}`}><td className="px-4 py-3 text-xs text-[#526B62]">{entry.date}</td><td className="px-4 py-3 text-xs font-semibold">Super Admin</td><td className="px-4 py-3 text-xs"><span className="rounded-full bg-[#e7f4ec] px-2 py-1 text-[#086b50]">{entry.action}</span></td><td className="px-4 py-3 text-xs text-[#526B62]">{entry.clinic}</td><td className="px-4 py-3 text-xs text-[#526B62]">{entry.target}</td><td className="px-4 py-3 text-xs text-[#526B62]">{entry.description}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}
