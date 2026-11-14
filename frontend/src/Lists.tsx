import React, { useState } from 'react';
import { CITY_INTEL } from './cityData';

export function extractCode(s: string) {
  if (!s) return 'STN';
  return s.includes('(') ? s.split('(').pop()?.split(')').shift()?.trim().toUpperCase() || 'STN' : 'STN';
}

function formatClock(iso?: string) {
  const part = iso && iso.includes('T') ? iso.split('T').pop() : '';
  return part ? part.slice(0, 5) : '--:--';
}

function buildBookingLink(origin: string, destCode: string, outIso: string, inIso: string) {
  const outDate = outIso ? outIso.slice(0, 10) : '2026-12-01';
  const inDate = inIso ? inIso.slice(0, 10) : outDate;
  const base = ['https:', '', '://ryanair.com', 'ie', 'en', 'trip', 'flights', 'select'].join('/');
  return `${base}?adults=1&dateOut=${outDate}&dateIn=${inDate}&isReturn=true&originIata=${origin}&destinationIata=${destCode}`;
}

function FlightRow({ deal, isSelected, onSelect, isSaved, onToggleSave, includeTransfer }: any) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const code = extractCode(deal.destination || '');
  const intel = CITY_INTEL[code] || { transit: 'Local airport bus/train', transitCost: '€15 est.', transferEur: 15, highlights: 'Old town & main square' };
  const transferFee = Number(intel.transferEur ?? 15);

  const diffMs = new Date(deal.inbound_time).getTime() - new Date(deal.outbound_time).getTime();
  const hrs = Math.floor(Math.max(0, diffMs) / 3600000);
  const mins = Math.floor((Math.max(0, diffMs) % 3600000) / 60000);
  const ground = diffMs > 0 ? `${hrs}h ${mins}m` : 'Multi-day';
  const dateLabel = deal.outbound_time ? new Date(deal.outbound_time).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Upcoming';
  const bookUrl = buildBookingLink(deal.origin, code, deal.outbound_time, deal.inbound_time);

  const displayPrice = Number(deal.total_price || 0) + (includeTransfer ? transferFee : 0);

  const handleCopy = (e: any) => {
    e.stopPropagation();
    const summary = `✈️ VayaGo Trip: ${deal.origin} ➔ ${deal.destination} on ${dateLabel} (${formatClock(deal.out_dep_time)}–${formatClock(deal.in_arr_time)}) • ⏱️ ${ground} exploring • €${displayPrice.toFixed(2)} return`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <React.Fragment>
      <tr onClick={onSelect} className={`border-b border-slate-100 cursor-pointer ${isSelected ? 'bg-amber-50' : 'hover:bg-blue-50/40 bg-white'}`}>
        <td className="py-3.5 px-4">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={(e) => { e.stopPropagation(); onToggleSave(); }}>{isSaved ? '❤️' : '🤍'}</button>
            <div>
              <div className="font-black text-slate-900 text-sm">{deal.destination}</div>
              <div className="text-[11px] font-bold text-slate-400">{deal.origin} • {deal.flight_number}</div>
            </div>
          </div>
        </td>
        <td className="py-3.5 px-3 whitespace-nowrap"><span className="font-bold text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">{dateLabel}</span></td>
        <td className="py-3.5 px-3 whitespace-nowrap text-xs font-bold text-slate-700"><span className="text-[#003893]">{formatClock(deal.out_dep_time)}</span> ➔ {formatClock(deal.outbound_time)}</td>
        <td className="py-3.5 px-3 whitespace-nowrap text-xs font-bold text-slate-700"><span className="text-[#003893]">{formatClock(deal.inbound_time)}</span> ➔ {formatClock(deal.in_arr_time)}</td>
        <td className="py-3.5 px-3 whitespace-nowrap"><span className="px-2.5 py-1 rounded-full text-xs font-black bg-[#FCD116]/30 text-[#003893]">⏱️ {ground}</span></td>
        <td className="py-3.5 px-3 whitespace-nowrap">
          <div className="text-base font-black text-[#003893]">€{displayPrice.toFixed(2)}</div>
          <div className="text-[10px] font-bold text-emerald-600">{includeTransfer ? `+€${transferFee} transfer incl.` : deal.deal_tier}</div>
        </td>
        <td className="py-3.5 px-4 whitespace-nowrap text-right">
          <div className="flex items-center justify-end gap-1.5">
            <button type="button" onClick={handleCopy} className="px-2 py-1.5 rounded-xl text-[11px] font-black bg-amber-50 hover:bg-amber-100 text-[#003893] cursor-pointer" title="Copy trip for WhatsApp">
              {copied ? '✅' : '📋'}
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="px-2.5 py-1.5 rounded-xl text-[11px] font-black bg-slate-100 text-[#003893] cursor-pointer">{expanded ? 'Hide ▲' : '✨ Plan ▼'}</button>
            <a href={bookUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="px-3.5 py-1.5 bg-[#CE1126] text-white text-xs font-black uppercase rounded-xl">Book ➔</a>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-blue-50/60 border-b border-blue-100">
          <td colSpan={7} className="px-6 py-3 text-xs text-slate-700">
            <div className="flex flex-wrap justify-between gap-4">
              <div><span className="font-black text-[#003893] uppercase mr-2">🚆 Transfer:</span>{intel.transit} ({intel.transitCost})</div>
              <div><span className="font-black text-[#CE1126] uppercase mr-2">📍 Sights:</span>{intel.highlights}</div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

export function ResultsGrid({ deals, selectedId, setSelectedId, savedIds, toggleSave, hasRawDeals, errorMsg, setSortBy, includeTransfer }: any) {
  if (errorMsg) return null;
  if (!deals || deals.length === 0) {
    return (
      <div className="bg-white border-2 border-dashed border-[#FCD116] text-center p-14 rounded-3xl">
        <div className="text-4xl mb-3">🧳</div>
        <h3 className="text-base font-black text-[#003893]">{hasRawDeals ? 'Nothing on this flight path' : 'Your passport is gathering dust'}</h3>
        <p className="text-xs font-medium text-slate-500 mt-1">{hasRawDeals ? 'Clear a quick-filter pill above to open up more routes.' : 'Pick your departure airport and hit Hunt Fares to see where you can fly today.'}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-slate-200/90 rounded-3xl shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#003893] text-white text-[11px] font-black uppercase border-b-4 border-[#FCD116] select-none">
              <th onClick={() => setSortBy('dest')} className="py-3.5 px-4 cursor-pointer hover:text-[#FCD116]">Destination</th>
              <th onClick={() => setSortBy('date')} className="py-3.5 px-3 cursor-pointer hover:text-[#FCD116]">Date</th>
              <th className="py-3.5 px-3">🛫 Outbound</th>
              <th className="py-3.5 px-3">🛬 Return</th>
              <th onClick={() => setSortBy('groundTime')} className="py-3.5 px-3 cursor-pointer hover:text-[#FCD116]">Ground Time</th>
              <th onClick={() => setSortBy('price')} className="py-3.5 px-3 cursor-pointer hover:text-[#FCD116]">{includeTransfer ? 'Door-to-Door' : 'Return Price'}</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d: any) => (
              <FlightRow
                key={d.id}
                deal={d}
                isSelected={selectedId === d.id}
                onSelect={() => setSelectedId(d.id)}
                isSaved={savedIds.includes(d.id)}
                onToggleSave={() => toggleSave(d.id)}
                includeTransfer={includeTransfer}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}