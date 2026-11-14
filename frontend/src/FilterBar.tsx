export function FilterBar(props: any) {
  const pill = (active: boolean, activeCls: string, idleCls: string) =>
    `px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer border ${active ? activeCls : idleCls}`;

  const blueActive = 'bg-[#003893] text-[#FCD116] border-[#003893]';
  const blueIdle = 'bg-slate-100 text-slate-600 border-slate-100';
  const redActive = 'bg-[#CE1126] text-white border-[#CE1126]';
  const redIdle = 'bg-white text-slate-600 border-slate-200';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-3.5 rounded-2xl mb-6 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-black text-[#003893] uppercase mr-1">Sort:</span>
        <button type="button" onClick={() => props.setSortBy('price')} className={pill(props.sortBy === 'price', blueActive, blueIdle)}>💶 Lowest Fare</button>
        <button type="button" onClick={() => props.setSortBy('groundTime')} className={pill(props.sortBy === 'groundTime', blueActive, blueIdle)}>⏱️ Max Explore Time</button>
        <button type="button" onClick={() => props.setSortBy('date')} className={pill(props.sortBy === 'date', blueActive, blueIdle)}>📅 Next Departure</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => props.setIncludeTransfer(!props.includeTransfer)} className={pill(props.includeTransfer, blueActive, 'bg-amber-50 text-[#003893] border-[#FCD116]')}>🚆 + Transfer Cost</button>
        <button type="button" onClick={() => props.setNoEarlyAlarm(!props.noEarlyAlarm)} className={pill(props.noEarlyAlarm, redActive, redIdle)}>🌅 After 07:30</button>
        <button type="button" onClick={() => props.setDayFilter(props.dayFilter === 'saturday' ? 'all' : 'saturday')} className={pill(props.dayFilter === 'saturday', redActive, redIdle)}>☀️ Saturdays</button>
        <button type="button" onClick={() => props.setDayFilter(props.dayFilter === 'sunday' ? 'all' : 'sunday')} className={pill(props.dayFilter === 'sunday', redActive, redIdle)}>🌤️ Sundays</button>
        <button type="button" onClick={() => props.setMinHours8(!props.minHours8)} className={pill(props.minHours8, redActive, redIdle)}>⏳ 8+ Hrs</button>
        <button type="button" onClick={() => props.setUnder50Only(!props.under50Only)} className={pill(props.under50Only, redActive, redIdle)}>🔥 Under €50</button>
      </div>
    </div>
  );
}