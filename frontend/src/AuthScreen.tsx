import React, { useState } from 'react';

export function AuthScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const endpoint = isRegister ? '/register' : '/login';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (data.status === 'success') {
        localStorage.setItem('vayago_user', JSON.stringify(data.user));
        onLogin(data.user);
      } else {
        setError(data.message || 'Authentication failed.');
      }
    } catch (err) {
      setError('Cannot connect to server. Please make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] flex flex-col justify-between">
      <div className="h-2 w-full flex">
        <div className="w-1/2 bg-[#FCD116]" />
        <div className="w-1/4 bg-[#003893]" />
        <div className="w-1/4 bg-[#CE1126]" />
      </div>

      <div className="max-w-md w-full mx-auto px-4 my-auto py-12">
        <div className="bg-white border-2 border-[#FCD116] rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#003893] to-[#001F52] p-6 text-white text-center border-b-4 border-[#FCD116]">
            <span className="inline-block bg-[#CE1126] text-white text-[10px] font-black uppercase px-3 py-0.5 rounded-full mb-2">
              VIP Boarding Pass
            </span>
            <h1 className="text-3xl font-black tracking-tight">VAYA<span className="text-[#FCD116]">GO</span></h1>
            <p className="text-blue-100 text-xs font-medium mt-1">
              {isRegister ? 'Create your free fan pass to unlock live daytrips.' : 'Sign in to scan live €29–€50 European escapes.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-black">
              <button type="button" onClick={() => { setIsRegister(false); setError(null); }} className={`w-1/2 py-2 rounded-xl transition cursor-pointer ${!isRegister ? 'bg-[#003893] text-[#FCD116] shadow-xs' : 'text-slate-600'}`}>
                Log In
              </button>
              <button type="button" onClick={() => { setIsRegister(true); setError(null); }} className={`w-1/2 py-2 rounded-xl transition cursor-pointer ${isRegister ? 'bg-[#003893] text-[#FCD116] shadow-xs' : 'text-slate-600'}`}>
                Create Account
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-[#CE1126]/30 text-[#CE1126] text-xs font-bold p-3 rounded-xl">
                ⚠️ {error}
              </div>
            )}

            {isRegister && (
              <div>
                <label className="text-[10px] font-black text-[#003893] uppercase block mb-1">First Name / Nickname</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jamie" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:border-[#003893]" />
              </div>
            )}

            <div>
              <label className="text-[10px] font-black text-[#003893] uppercase block mb-1">Email Address</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:border-[#003893]" />
            </div>

            <div>
              <label className="text-[10px] font-black text-[#003893] uppercase block mb-1">Password</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:border-[#003893]" />
            </div>

            <button type="submit" disabled={loading} className="w-full py-3 bg-[#FCD116] hover:brightness-95 text-[#003893] text-sm font-black uppercase rounded-2xl shadow-md cursor-pointer border-b-4 border-[#d9b100]">
              {loading ? 'Checking Boarding Pass...' : isRegister ? '🎟️ Get Instant Access' : '🛫 Board VayaGo'}
            </button>
          </form>
        </div>
      </div>

      <footer className="pb-6 text-center text-xs font-bold text-slate-400">
        🌍 VayaGo • Private Fan Portal
      </footer>
    </div>
  );
}