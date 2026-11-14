import { useState, useEffect } from 'react';

export function AdminUsersModal({ adminKey, onClose }: { adminKey: string; onClose: () => void }) {
  const [fans, setFans] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    fetch('/admin-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: adminKey })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') setFans(data.users || []);
      })
      .finally(() => setLoading(false));
  }, [adminKey]);

  const copyEmails = () => {
    const emails = fans.map(f => f.email).join(', ');
    navigator.clipboard.writeText(emails);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-[#FCD116] rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden">
        <div className="bg-[#003893] text-white p-5 flex justify-between items-center border-b-4 border-[#FCD116]">
          <div>
            <span className="text-[10px] font-black uppercase bg-[#CE1126] px-2 py-0.5 rounded-full">Admin Only</span>
            <h2 className="text-xl font-black mt-1">🎟️ VayaGo Fan Sign-Ups ({fans.length})</h2>
          </div>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white text-xl font-black cursor-pointer">✕</button>
        </div>

        <div className="p-5 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-sm font-bold text-slate-400">Loading fan list...</div>
          ) : fans.length === 0 ? (
            <div className="text-center py-8 text-sm font-bold text-slate-500">No fans have signed up yet. Share your public link to get started!</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[#003893] font-black uppercase">
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2 text-right">Joined</th>
                </tr>
              </thead>
              <tbody>
                {fans.map((f, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-2.5 font-bold text-slate-800">{f.name}</td>
                    <td className="py-2.5 text-slate-600">{f.email}</td>
                    <td className="py-2.5 text-right text-slate-400">
                      {f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : 'Recent'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          {fans.length > 0 ? (
            <button type="button" onClick={copyEmails} className="px-4 py-2 bg-[#FCD116] text-[#003893] text-xs font-black rounded-xl cursor-pointer">
              {copiedAll ? '✅ Emails Copied!' : '📋 Copy All Emails'}
            </button>
          ) : <div />}
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-black rounded-xl cursor-pointer">Close</button>
        </div>
      </div>
    </div>
  );
}