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
  const [exportError, setExportError] = useState('');
  const filtered = useMemo(() => entries.filter(entry => `${entry.action} ${entry.clinic} ${entry.target} ${entry.description}`.toLowerCase().includes(search.toLowerCase())), [search]);

  const exportLogs = async () => {
    setExportError('');

    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'VetIntel Super Admin';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Audit Trail', {
        properties: { tabColor: { argb: 'FF086B50' } },
        views: [{ state: 'frozen', ySplit: 1 }],
      });
      worksheet.columns = [
        { header: 'Date & Time', key: 'date', width: 24 },
        { header: 'Super Admin', key: 'admin', width: 22 },
        { header: 'Action', key: 'action', width: 30 },
        { header: 'Clinic', key: 'clinic', width: 34 },
        { header: 'Target', key: 'target', width: 28 },
        { header: 'Description', key: 'description', width: 64 },
      ];
      worksheet.addRows(entries.map(entry => ({ ...entry, admin: 'Super Admin' })));
      worksheet.autoFilter = { from: 'A1', to: `F${worksheet.rowCount}` };

      worksheet.eachRow((row, rowNumber) => {
        row.height = rowNumber === 1 ? 28 : 24;
        row.eachCell(cell => {
          cell.alignment = { vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD4E3D7' } },
            right: { style: 'thin', color: { argb: 'FFD4E3D7' } },
            bottom: { style: 'thin', color: { argb: 'FFD4E3D7' } },
            left: { style: 'thin', color: { argb: 'FFD4E3D7' } },
          };

          if (rowNumber === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF086B50' } };
            cell.font = { name: 'Aptos', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
          } else {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: rowNumber % 2 === 0 ? 'FFF2F8F4' : 'FFFFFFFF' },
            };
            cell.font = { name: 'Aptos', size: 11, color: { argb: 'FF172B24' } };
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'audit-trail.xlsx';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      console.error('Failed to export audit trail:', error);
      setExportError('Unable to export the audit trail. Please try again.');
    }
  };

  return (
    <div className="min-h-full bg-[#fafbf8] p-5 text-[#172b24]">
      <section className="overflow-hidden rounded-xl border border-[#d4e3d7] bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[220px] max-w-[600px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#087a59]" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search actions..." className="w-full rounded-full border border-[#d4e3d7] bg-white py-2.5 pl-10 pr-3 text-sm text-[#172b24] outline-none transition focus:border-[#087a59] focus:ring-2 focus:ring-[#087a59]/20" />
          </div>
          <button onClick={exportLogs} className="rounded-full bg-[#087a59] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#065c44]"><Download className="mr-1 inline h-4 w-4" />Export</button>
        </div>
        {exportError && <p className="mb-3 text-xs text-[#b42318]" role="alert">{exportError}</p>}
        <div className="overflow-x-auto rounded-xl border border-[#d4e3d7]">
          <table className="w-full min-w-[1000px] text-left">
            <thead className="bg-gradient-to-r from-[#013826] to-[#087a59] text-white">
              <tr>{['Date & Time', 'Super Admin', 'Action', 'Clinic', 'Target', 'Description'].map(heading => <th className="px-4 py-3 text-xs font-semibold" key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr className="h-[50px] border-t border-[#e6eee9] transition-colors hover:bg-[#f7fbf8]" key={`${entry.date}-${entry.action}`}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[#526B62]">{entry.date}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-[#172b24]">Super Admin</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs"><span className="rounded-full bg-[#e7f4ec] px-2 py-1 text-[#086b50]">{entry.action}</span></td>
                  <td className="px-4 py-3 text-xs text-[#526B62]">{entry.clinic}</td>
                  <td className="px-4 py-3 text-xs text-[#526B62]">{entry.target}</td>
                  <td className="px-4 py-3 text-xs text-[#526B62]">{entry.description}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#789087]">No audit entries match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
