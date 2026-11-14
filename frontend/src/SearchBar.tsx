import { AIRPORT_DATABASE } from './cityData';

export function SearchBar(props: any) {
  const filtOrigin = AIRPORT_DATABASE.filter(a => a.name.toLowerCase().includes(props.originInput.toLowerCase()));
  const filtDest = AIRPORT_DATABASE.filter(a => a.name.toLowerCase().includes(props.destInput.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto px-4 -mt-9">
      <div className="bg-white border-2 border-[#FCD116] p-5 rounded-3xl shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
          <div className="md:col-span-3 bg-amber-50/40 p-3 rounded-2xl border border-slate-200 relative">
            <label className="text-[10px] text-[#003893] font-black uppercase block mb-0.5">🛫 Wheels Up From</label>
            <input type="text" value={props.originInput} onFocus={() => props.setShowOrigin(true)} onChange={(e) => { props.setOriginInput(e.target.value); props.setShowOrigin(true); }} className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none" />
            {props.showOrigin && props.originInput && filtOrigin.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-40 overflow-y-auto">
                {filtOrigin.map(a => (
                  <button key={a.code} type="button" onClick={() => { props.setOriginInput(a.name); props.setShowOrigin(false); }} className="w-full text-left px-3.5 py-2 hover:bg-amber-50 text-xs font-bold text-slate-700 block">{a.name}</button>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2 bg-amber-50/40 p-3 rounded-2xl border border-slate-200 relative">
            <label className="text-[10px] text-[#003893] font-black uppercase block mb-0.5">🛬 Touchdown In</label>
            <input type="text" value={props.destInput} placeholder="Everywhere" onFocus={() => props.setShowDest(true)} onChange={(e) => { props.setDestInput(e.target.value); props.setShowDest(true); }} className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none" />
            {props.showDest && props.destInput && filtDest.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-40 overflow-y-auto">
                {filtDest.map(a => (
                  <button key={a.code} type="button" onClick={() => { props.setDestInput(a.name); props.setShowDest(false); }} className="w-full text-left px-3.5 py-2 hover:bg-amber-50 text-xs font-bold text-slate-700 block">{a.name}</button>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2 bg-amber-50/40 p-3 rounded-2xl border border-slate-200">
            <label className="text-[10px] text-[#003893] font-black uppercase block mb-0.5">📆 Departure Day</label>
            <select value={props.targetWeekday} onChange={(e) => { props.setTargetWeekday(e.target.value); if (e.target.value !== '') props.setSpecificDate(''); }} className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer">
              <option value="">Any Day of Week</option>
              <option value="5">☀️ Saturdays Only</option>
              <option value="6">🌤️ Sundays Only</option>
              <option value="4">🎉 Fridays Only</option>
              <option value="0">Mondays Only</option>
              <option value="1">Tuesdays Only</option>
              <option value="2">Wednesdays Only</option>
              <option value="3">Thursdays Only</option>
            </select>
          </div>

          <div className="md:col-span-2 bg-amber-50/40 p-3 rounded-2xl border border-slate-200">
            <label className="text-[10px] text-[#003893] font-black uppercase block mb-0.5">🗓️ Duration</label>
            <select value={props.duration} onChange={(e) => props.setDuration(e.target.value)} className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer">
              <option value="daytrip">⚡ Same-Day (0N)</option>
              <option value="weekend">🏖️ Weekend (2–3N)</option>
              <option value="shortbreak">☀️ 5-Day (4–5N)</option>
              <option value="week">🌴 1 Week (6–8N)</option>
              <option value="twoweeks">🌎 2 Weeks (10–14N)</option>
            </select>
          </div>

          <div className="md:col-span-1 bg-amber-50/40 p-3 rounded-2xl border border-slate-200">
            <label className="text-[10px] text-[#003893] font-black uppercase block mb-0.5">Max (€)</label>
            <input type="number" value={props.maxBudget} onChange={(e) => props.setMaxBudget(Number(e.target.value))} className="w-full bg-transparent text-sm font-black text-slate-900 focus:outline-none" />
          </div>

          <div className="md:col-span-2">
            <button type="button" onClick={props.handleSearch} disabled={props.loading} className="w-full h-[62px] bg-[#FCD116] hover:brightness-95 text-[#003893] text-sm font-black uppercase rounded-2xl shadow-md cursor-pointer border-b-4 border-[#d9b100]">
              {props.loading ? 'Scanning...' : '✈️ Hunt Fares'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-3 border-t border-slate-100 text-xs font-bold text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={props.allowSplit} onChange={(e) => props.setAllowSplit(e.target.checked)} className="rounded text-[#003893]" />
              Mix & Match
            </label>
            <div className="flex items-center gap-1.5">
              <span>🎒 Bag:</span>
              <select value={props.baggageType} onChange={(e) => props.setBaggageType(e.target.value)} className="bg-amber-50 border border-amber-200/60 rounded-lg px-2 py-1 text-slate-800">
                <option value="none">Backpack Only</option>
                <option value="cabin">Cabin Bag</option>
                <option value="checked">Checked Bag</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span>📅 Exact Date:</span>
              <input type="date" value={props.specificDate} onChange={(e) => { props.setSpecificDate(e.target.value); if (e.target.value) props.setTargetWeekday(''); }} className="bg-amber-50 border border-amber-200/60 rounded-lg px-2 py-0.5 text-slate-800 cursor-pointer" />
              {props.specificDate && (
                <button type="button" onClick={() => props.setSpecificDate('')} className="text-[#CE1126] font-black hover:underline cursor-pointer">✕</button>
              )}
            </div>
          </div>
          {props.totalCount > 0 && <span className="text-[#CE1126] font-black">🎉 {props.filteredCount} of {props.totalCount} getaways ready for boarding</span>}
        </div>
      </div>
    </div>
  );
}