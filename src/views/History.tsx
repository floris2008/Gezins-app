/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { HistoryEntry, OperationType } from '../types';
import { ArrowUpRight, ArrowDownLeft, Info, Calendar, Search, Filter, History as HistoryIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

export function HistoryView() {
  const { profile } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.householdId) return;

    const q = query(
      collection(db, 'history'),
      where('householdId', '==', profile.householdId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as HistoryEntry));
      setHistory(entries.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      }));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'history');
    });

    return () => unsub();
  }, [profile]);

  if (loading) return null;

  return (
    <div className="space-y-8">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
        <div>
           <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Activiteiten</h2>
           <p className="text-slate-500 font-medium text-sm">Bekijk alle verdiende en uitgegeven XP.</p>
        </div>
        <div className="flex gap-2 p-1.5 bg-white rounded-2xl shadow-sm border border-slate-100">
           <button className="px-6 py-2 bg-indigo-600 shadow-md shadow-indigo-100 rounded-xl text-xs font-black text-white uppercase tracking-widest">Alles</button>
           <button className="px-6 py-2 text-slate-400 text-xs font-black uppercase tracking-widest hover:text-indigo-600 transition-colors">Inkomsten</button>
           <button className="px-6 py-2 text-slate-400 text-xs font-black uppercase tracking-widest hover:text-indigo-600 transition-colors">Uitgaven</button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="bg-white p-32 rounded-[4rem] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center text-center space-y-6">
           <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
             <HistoryIcon size={48} strokeWidth={1} />
           </div>
           <div>
             <h3 className="text-xl font-black text-slate-800 tracking-tight">Nog geen activiteiten</h3>
             <p className="text-slate-400 font-bold max-w-xs mx-auto mt-2">Zodra er XP wordt verdiend of uitgegeven, zie je dat hier verschijnen!</p>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {history.map((entry) => {
            const isEarn = entry.type === 'earn' || (entry.type === 'adj' && entry.amount > 0);
            
            const dateStr = entry.timestamp?.seconds 
              ? format(new Date(entry.timestamp.seconds * 1000), 'd MMM HH:mm', { locale: nl })
              : 'Zojuist';

            return (
              <motion.div
                layout
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group bg-white p-6 rounded-[2.5rem] border border-slate-50 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] flex items-center justify-between hover:shadow-xl hover:border-indigo-100 transition-all"
              >
                <div className="flex items-center gap-6">
                  <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-3 ${
                    isEarn ? 'bg-emerald-500 text-white shadow-emerald-100' : 'bg-red-500 text-white shadow-red-100'
                  }`}>
                    {isEarn ? <ArrowUpRight size={32} strokeWidth={3} /> : <ArrowDownLeft size={32} strokeWidth={3} />}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-lg tracking-tight group-hover:text-indigo-600 transition-colors leading-tight">{entry.description}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{dateStr}</span>
                      <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-50">#{entry.id.slice(0, 6)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                   <div className={`flex items-baseline gap-1 ${isEarn ? 'text-emerald-500' : 'text-red-500'}`}>
                      <span className="text-2xl font-black tracking-tighter">{isEarn ? '+' : ''}{entry.amount}</span>
                      <span className="text-xs font-black uppercase tracking-widest italic">XP</span>
                   </div>
                   <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all -translate-y-2 group-hover:translate-y-0">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${isEarn ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {isEarn ? 'Verdiend' : 'Uitgegeven'}
                      </span>
                   </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

