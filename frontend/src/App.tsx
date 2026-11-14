import { useState, useMemo, useEffect } from 'react';
import { ResultsGrid, extractCode } from './Lists';
import { CITY_INTEL } from './cityData';
import { SearchBar } from './SearchBar';
import { FilterBar } from './FilterBar';
import { AuthScreen } from './AuthScreen';
import { AdminUsersModal } from './AdminUsersModal';

export default function App() {
  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('vayago_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [checkingKey, setCheckingKey] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vipKey = params.get('vip');
    if (vipKey) {
      setCheckingKey(true);
      fetch('/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: vipKey })
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            localStorage.setItem('vayago_user', JSON.stringify(data.user));
            setUser(data.user);
            window.history.replaceState({}, '', '/');
          }
        })
        .finally(() => setCheckingKey(false));
    }
  }, []);

  const [originInput, setOriginInput] = useState('Dublin (DUB)');
  const [destInput, setDestInput] = useState('');
  const [specificDate, setSpecificDate] = useState('');
  const [targetWeekday, setTargetWeekday] = useState('');
  const [showOrigin, setShowOrigin] = useState(false);
  const [showDest, setShowDest] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deals, setDeals] = useState<Array<any>>(Array());
  const [savedIds, setSavedIds] = useState<Array<string>>(Array());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [duration, setDuration] = useState('daytrip');
  const [maxBudget, setMaxBudget] = useState(150);
  const [baggageType, setBaggageType] = useState('none');
  const [allowSplit, setAllowSplit] = useState(true);

  const [sortBy, setSortBy] = useState<'price' | 'groundTime' | 'date' | 'dest'>('price');
  const [dayFilter, setDayFilter] = useState<'all' | 'saturday' | 'sunday' | 'weekend'>('all');
  const [minHours8, setMinHours8] = useState(false);
  const [under50Only, setUnder50Only] = useState(false);
  const [noEarlyAlarm, setNoEarlyAlarm] = useState(false);
  const [includeTransfer, setIncludeTransfer] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('vayago_user');
    setUser(null);
  };

  const toggleSave = (id: string) => {
    setSavedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleSearch = async () => {
    setLoading(true);
    setDeals(Array());
    setErrorMsg(null);
    setShowSavedOnly(false);
    setDayFilter('all');
    try {
      const res = await fetch('/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: originInput, destination: destInput, specific_date: specificDate,
          target_weekday: targetWeekday, trip_duration_type: duration, max_budget: maxBudget,
          baggage_type: baggageType, allow_split_tickets: allowSplit
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setDeals(data.deals);
        if (data.deals.length === 0) setErrorMsg('No seats found for that day/budget—try raising max fare or choosing Any Day.');
      } else {
        setErrorMsg(data.message || 'Backend returned an error.');
      }
    } catch {
      setErrorMsg('Cannot reach the runway. Please make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const getEffectivePrice = (d: any) => {
    const base = Number(d.total_price || 0);
    if (!includeTransfer) return base;
    const intel = CITY_INTEL[extractCode(d.destination)];
    return base + (intel ? intel.transferEur : 15);
  };

  const filteredDeals = useMemo(() => {
    let list = [...deals];
    if (showSavedOnly) list = list.filter(d => savedIds.includes(d.id));
    if (under50Only) list = list.filter(d => getEffectivePrice(d) <= 50);

    if (noEarlyAlarm) {
      list = list.filter(d => {
        const part = d.out_dep_time?.split('T').pop() || '08:00';
        return Number(part.slice(0, 2)) * 60 + Number(part.slice(3, 5)) >= 450;
      });
    }

    if (dayFilter === 'saturday') list = list.filter(d => new Date(d.outbound_time).getDay() === 6);
    if (dayFilter === 'sunday') list = list.filter(d => new Date(d.outbound_time).getDay() === 0);
    if (minHours8) list = list.filter(d => (new Date(d.inbound_time).getTime() - new Date(d.outbound_time).getTime()) / 3600000 >= 8);

    if (sortBy === 'price') list.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
    if (sortBy === 'groundTime') list.sort((a, b) => (new Date(b.inbound_time).getTime() - new Date(b.outbound_time).getTime()) - (new Date(a.inbound_time).getTime() - new Date(a.outbound_time).getTime()));
    if (sortBy === 'date') list.sort((a, b) => new Date(a.outbound_time).getTime() - new Date(b.outbound_time).getTime());
    if (sortBy === 'dest') list.sort((a, b) => a.destination.localeCompare(b.destination));
    return list;
  }, [deals, sortBy, dayFilter, minHours8, under50Only, noEarlyAlarm, includeTransfer, showSavedOnly, savedIds]);

  if (checkingKey) {
    return <div className="min-h-screen bg-[#003893] text-[#FCD116] flex items-center justify-center font-black text-lg">🔑 Verifying VIP Admin Pass...</div>;
  }

  if (!user) {
    return <AuthScreen onLogin={setUser} />;
  }

  const searchProps = {
    originInput, setOriginInput, showOrigin, setShowOrigin, destInput, setDestInput, showDest, setShowDest,
    specificDate, setSpecificDate, targetWeekday, setTargetWeekday, duration, setDuration,
    maxBudget, setMaxBudget, baggageType, setBaggageType, allowSplit, setAllowSplit,
    loading, handleSearch, filteredCount: filteredDeals.length, totalCount: deals.length
  };

  const filterProps = {
    sortBy, setSortBy, includeTransfer, setIncludeTransfer, noEarlyAlarm, setNoEarlyAlarm,
    dayFilter, setDayFilter, minHours8, setMinHours8, under50Only, setUnder50Only
  };

  const gridProps = {
    deals: filteredDeals, selectedId, setSelectedId, savedIds, toggleSave,
    hasRawDeals: deals.length > 0, errorMsg, setSortBy, includeTransfer
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-slate-800 font-sans antialiased pb-12 flex flex-col justify-between">
      <div>
        <div className="h-2 w-full flex">
          <div className="w-1/2 bg-[#FCD116]" />
          <div className="w-1/4 bg-[#003893]" />
          <div className="w-1/4 bg-[#CE1126]" />
        </div>
        <div className="bg-gradient-to-r from-[#003893] via-[#002B70] to-[#001F52] text-white pt-8 pb-16 px-4 shadow-md">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-[#FCD116] text-[#003893] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">No Hotels Needed</span>
                <span className="bg-[#CE1126] text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">Pack Light, Fly Far</span>
              </div>
              <h1 className="text-4xl font-black tracking-tight">VAYA<span className="text-[#FCD116]">GO</span></h1>
              <p className="text-blue-100 text-sm font-medium mt-1">Breakfast at home, espresso in Europe, back in your own bed by midnight.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {user.isAdmin && (
                <button type="button" onClick={() => setShowAdminModal(true)} className="bg-[#FCD116] hover:brightness-95 text-[#003893] px-3.5 py-2 rounded-2xl text-xs font-black cursor-pointer">👥 Fan List</button>
              )}
              {savedIds.length > 0 && (
                <button type="button" onClick={() => setShowSavedOnly(!showSavedOnly)} className={`px-3.5 py-2 rounded-2xl text-xs font-black cursor-pointer border ${showSavedOnly ? 'bg-[#CE1126] text-white border-white' : 'bg-white text-[#003893] border-[#FCD116]'}`}>❤️ Saved ({savedIds.length})</button>
              )}
              <div className="bg-white/10 border border-[#FCD116]/40 px-3.5 py-2 rounded-2xl text-xs font-bold text-[#FCD116]">👋 Hi, {user.name}</div>
              <button type="button" onClick={handleLogout} className="bg-[#CE1126] hover:bg-[#a80d1e] text-white px-3.5 py-2 rounded-2xl text-xs font-black cursor-pointer">Log Out</button>
            </div>
          </div>
        </div>
        <SearchBar {...searchProps} />
        <div className="max-w-6xl mx-auto px-4 mt-8">
          {errorMsg && <div className="bg-red-50 border-2 border-[#CE1126]/30 text-[#CE1126] p-4 rounded-2xl text-sm font-bold mb-6 shadow-sm">⚠️ {errorMsg}</div>}
          {deals.length > 0 && <FilterBar {...filterProps} />}
          <ResultsGrid {...gridProps} />
        </div>
      </div>
      {showAdminModal && user.adminKey && <AdminUsersModal adminKey={user.adminKey} onClose={() => setShowAdminModal(false)} />}
      <footer className="max-w-6xl mx-auto px-4 mt-14 pt-6 border-t border-amber-200/60 text-center text-xs font-bold text-slate-400">🌍 VayaGo • Built for spontaneous explorers who travel light and live large.</footer>
    </div>
  );
}