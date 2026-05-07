/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, serverTimestamp, increment, addDoc, setDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { UserProfile, Household, OperationType, Task, AppNotification, HistoryEntry } from '../types';
import { Copy, Users, Settings, UserPlus, Shield, User, Coins, Trash2, ArrowRight, CheckCircle2, X, KeyRound, Loader2, LogOut, Sparkles, Clock, Star, Camera, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

import { useTranslation } from '../i18n/LanguageContext';

export function HouseholdView() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedTab, setSelectedTab] = useState<'tasks' | 'history' | 'actions'>('tasks');
  const [userHistory, setUserHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [userToRemove, setUserToRemove] = useState<UserProfile | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustType, setAdjustType] = useState<'plus' | 'minus'>('plus');
  const [adjustReason, setAdjustReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [isAddingChild, setIsAddingChild] = useState(false);

  useEffect(() => {
    if (selectedUser) {
      setHistoryLoading(true);
      setSelectedTab('tasks');
      const q = query(
        collection(db, 'history'),
        where('userId', '==', selectedUser.id),
        where('householdId', '==', profile?.householdId),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      
      const unsub = onSnapshot(q, (snap) => {
        setUserHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as HistoryEntry)));
        setHistoryLoading(false);
      }, (err) => {
        console.error('History fetch error:', err);
        setHistoryLoading(false);
      });
      
      return () => unsub();
    } else {
      setUserHistory([]);
      setSelectedTab('tasks');
    }
  }, [selectedUser]);

  useEffect(() => {
    if (!profile?.householdId) return;

    // 1. Members
    const qMembers = query(collection(db, 'users'), where('householdId', '==', profile.householdId));
    const unsubMembers = onSnapshot(qMembers, (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    });

    // 2. Tasks
    const qTasks = query(collection(db, 'tasks'), where('householdId', '==', profile.householdId), where('status', '==', 'active'));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      setActiveTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    });

    // 3. Household details
    const unsubHH = onSnapshot(doc(db, 'households', profile.householdId), (snap) => {
      if (snap.exists()) {
        setHousehold({ id: snap.id, ...snap.data() } as Household);
      }
      setLoading(false);
    });

    return () => {
      unsubMembers();
      unsubTasks();
      unsubHH();
    };
  }, [profile]);

  const handleAdjustPoints = async () => {
    if (!selectedUser || !profile || !adjustReason) return;
    setIsAdjusting(true);
    const finalAmount = adjustType === 'plus' ? Math.abs(adjustAmount) : -Math.abs(adjustAmount);
    try {
      const currentPoints = selectedUser.points || 0;
      const newPoints = Math.max(0, currentPoints + finalAmount);

      await updateDoc(doc(db, 'users', selectedUser.id), {
        points: newPoints
      });

      await addDoc(collection(db, 'history'), {
        userId: selectedUser.id,
        householdId: profile.householdId,
        amount: finalAmount,
        type: finalAmount > 0 ? 'earn' : 'spend',
        description: adjustReason,
        timestamp: serverTimestamp()
      });

      await addDoc(collection(db, 'notifications'), {
        userId: selectedUser.id,
        householdId: profile.householdId,
        message: finalAmount > 0 
          ? `Fantastisch! Je hebt ${finalAmount} bonus XP gekregen: ${adjustReason}`
          : `Oei! Er is ${Math.abs(finalAmount)} XP afgetrokken: ${adjustReason}`,
        read: false,
        timestamp: serverTimestamp()
      });

      setSelectedUser(null);
      setAdjustAmount(0);
      setAdjustReason('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${selectedUser.id}`);
    } finally {
      setIsAdjusting(false);
    }
  };

  const kickMember = async () => {
    if (!userToRemove || profile?.role !== 'parent') return;
    
    try {
      if (userToRemove.id.startsWith('child_') || !userToRemove.email.includes('@')) {
        // This is a placeholder child account, we can delete it
        await deleteDoc(doc(db, 'users', userToRemove.id));
      } else {
        // This is a real user, just remove from household
        await updateDoc(doc(db, 'users', userToRemove.id), {
          householdId: null,
          role: 'child'
        });
      }
      
      setUserToRemove(null);
      if (selectedUser?.id === userToRemove.id) setSelectedUser(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userToRemove.id}`);
    }
  };

  const handleAddChild = async () => {
    if (!newChildName || !profile?.householdId) return;
    setIsAddingChild(true);
    
    // Generate a simple 6-char code (mix of letters and numbers)
    const generateCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    const loginCode = generateCode();

    try {
      // Create a unique ID for the child
      const childId = `child_${Date.now()}`;
      
      await setDoc(doc(db, 'users', childId), {
        displayName: newChildName,
        role: 'child',
        points: 0,
        householdId: profile.householdId,
        parentId: profile.id,
        loginCode: loginCode,
        email: `child_${loginCode.toLowerCase()}@familychores.local`, // Dummy email
        createdAt: serverTimestamp()
      });

      setNewChildName('');
      setShowAddChild(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'users');
    } finally {
      setIsAddingChild(false);
    }
  };

  const copyLink = () => {
    if (!household?.inviteCode) return;
    const link = `${window.location.origin}?invite=${household.inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCode = () => {
    if (!household?.inviteCode) return;
    navigator.clipboard.writeText(household.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const changeRole = async (userId: string, newRole: 'parent' | 'child') => {
    if (profile?.role !== 'parent') return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const adjustPoints = async (userId: string) => {
    if (profile?.role !== 'parent') return;
    const amount = prompt('Hoeveel punten wil je toevoegen (+) of aftrekken (-)?');
    const description = prompt('Waarvoor zijn deze punten?');
    
    if (!amount || isNaN(Number(amount)) || !description) return;

    try {
      await updateDoc(doc(db, 'users', userId), {
        points: increment(Number(amount))
      });

      await addDoc(collection(db, 'history'), {
        userId,
        householdId: profile.householdId,
        amount: Number(amount),
        type: 'adj',
        description,
        timestamp: serverTimestamp()
      });

      alert('Punten aangepast!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-10 flex flex-col">
      {/* Household Members - Top */}
      <section className="space-y-6 order-1">
        <div className="flex items-center justify-between px-2">
           <h3 className="text-lg font-bold text-slate-800">{t('household.family_members')}</h3>
           <div className="flex items-center gap-4">
             {profile?.role === 'parent' && (
               <button
                 onClick={() => setShowAddChild(true)}
                 className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100 shadow-sm"
               >
                 <UserPlus size={14} />
                 Kind Toevoegen
               </button>
             )}
             <div className="text-xs font-black text-slate-400 uppercase tracking-widest">{members.length} {t('household.members')}</div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {members
            .sort((a, b) => {
              // First by role: children (child) before parents (parent)
              if (a.role !== b.role) {
                return a.role === 'child' ? -1 : 1;
              }
              // Then by name alphabetically
              return a.displayName.localeCompare(b.displayName);
            })
            .map((member) => (
            <motion.div
              layout
              key={member.id}
              onClick={() => member.role === 'child' && profile?.role === 'parent' && setSelectedUser(member)}
              className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5 relative group transition-all hover:shadow-xl hover:border-indigo-100 ${member.role === 'child' && profile?.role === 'parent' ? 'cursor-pointer' : ''}`}
            >
              <div className="relative">
                {member.photoURL ? (
                  <img src={member.photoURL} alt={member.displayName} className="w-16 h-16 rounded-2xl border-2 border-white shadow-md object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center font-black text-xl uppercase border-2 border-white shadow-md">
                    {member.displayName.charAt(0)}
                  </div>
                )}
                <div className={`absolute -bottom-1 -right-1 p-1.5 rounded-lg shadow-sm border-2 border-white ${member.role === 'parent' ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'}`}>
                  {member.role === 'parent' ? <Shield size={12} /> : <User size={12} />}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 text-lg truncate">{member.displayName}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full font-black text-[10px] uppercase tracking-tighter shadow-sm border border-indigo-100">
                    <Coins size={10} />
                    {member.points} {t('common.xp')}
                  </div>
                  {member.role === 'parent' && (
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('dashboard.admin')}</span>
                  )}
                  {member.role === 'child' && member.loginCode && profile?.role === 'parent' && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg font-mono text-[10px] font-black uppercase tracking-tighter shadow-inner">
                      <KeyRound size={10} />
                      {member.loginCode}
                    </div>
                  )}
                </div>
              </div>

              {profile?.role === 'parent' && member.id !== profile.id && (
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <select
                    value={member.role}
                    onChange={(e) => changeRole(member.id, e.target.value as any)}
                    className="text-[10px] font-black bg-slate-50 border-none rounded-lg p-1 px-2 focus:ring-0 uppercase tracking-tighter"
                  >
                    <option value="parent">{t('dashboard.parent')}</option>
                    <option value="child">{t('dashboard.child')}</option>
                  </select>
                  
                  <button
                    onClick={() => setUserToRemove(member)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    title="Lid verwijderen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Invite Area - Middle */}
      {profile?.role === 'parent' && (
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-900 p-8 sm:p-12 rounded-[2.5rem] shadow-2xl text-white text-center order-2">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Users size={120} strokeWidth={1} />
          </div>
          
          <div className="relative z-10 max-w-lg mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black mb-3">Bouw je team! 🚀</h2>
            <p className="text-indigo-100/80 mb-8 font-medium">Deel jullie unieke gezinscode om nieuwe leden toe te voegen aan {household?.name}.</p>
            
            <div className="flex flex-col gap-4">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-3xl flex flex-col items-center gap-4">
                <span className="text-4xl font-black tracking-[0.2em]">{household?.inviteCode}</span>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={copyCode}
                    className={`flex-1 py-3 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${copied ? 'bg-emerald-500 text-white' : 'bg-white text-indigo-900'}`}
                  >
                    <Copy size={20} />
                    {copied ? 'Gekopieerd!' : 'Kopieer Code'}
                  </button>
                  <button 
                    onClick={copyLink}
                    className="flex-1 py-3 px-6 rounded-2xl bg-indigo-500 text-white font-bold hover:bg-indigo-400 transition-all border border-indigo-400"
                  >
                    Stuur Link
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Adjust Points Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 text-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[3.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative z-10 p-8 sm:p-12"
            >
              <div className="flex flex-col items-center">
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-all"
                >
                  <X size={24} />
                </button>
                <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-4xl mb-6 shadow-inner">
                  {selectedUser.photoURL ? (
                    <img src={selectedUser.photoURL} className="w-full h-full rounded-[2.5rem] object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    selectedUser.displayName.charAt(0)
                  )}
                </div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">{selectedUser.displayName}</h3>
                
                {/* Tab Switcher */}
                <div className="flex bg-slate-100 p-1.5 rounded-[2rem] w-full mb-8 mt-4">
                  <button 
                    onClick={() => setSelectedTab('tasks')}
                    className={`flex-1 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${selectedTab === 'tasks' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Quests
                  </button>
                  <button 
                    onClick={() => setSelectedTab('history')}
                    className={`flex-1 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${selectedTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Historie
                  </button>
                  <button 
                    onClick={() => setSelectedTab('actions')}
                    className={`flex-1 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${selectedTab === 'actions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Acties
                  </button>
                </div>

                {selectedTab === 'tasks' && (
                  <div className="w-full space-y-6">
                    <div className="flex flex-col items-center gap-3 mb-4">
                      <div className="flex gap-3">
                        <div className="bg-amber-100 px-6 py-2 rounded-2xl">
                          <span className="text-sm font-black text-amber-800 uppercase tracking-wider">{selectedUser.points} XP</span>
                        </div>
                        {selectedUser.role === 'child' && selectedUser.loginCode && (
                          <div className="bg-emerald-100 px-6 py-2 rounded-2xl flex items-center gap-2 border border-emerald-200 shadow-sm">
                            <KeyRound size={16} className="text-emerald-600" />
                            <span className="text-sm font-mono font-black text-emerald-800 uppercase tracking-widest">{selectedUser.loginCode}</span>
                          </div>
                        )}
                      </div>
                      {selectedUser.role === 'child' && selectedUser.loginCode && (
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                          Login Code voor dit profiel
                        </p>
                      )}
                    </div>

                    {/* User's Active Tasks */}
                    <div className="space-y-4 text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-4">Lopende Quests</p>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto px-2 no-scrollbar">
                        {activeTasks.filter(t => 
                          t.assignedTo === selectedUser.id || 
                          (t.type === 'first_come' && t.distributionType === 'everyone_must' && !t.completedByList?.includes(selectedUser.id)) ||
                          (t.type === 'first_come' && t.distributionType !== 'everyone_must')
                        ).length > 0 ? (
                          activeTasks.filter(t => 
                            t.assignedTo === selectedUser.id || 
                            (t.type === 'first_come' && t.distributionType === 'everyone_must' && !t.completedByList?.includes(selectedUser.id)) ||
                            (t.type === 'first_come' && t.distributionType !== 'everyone_must')
                          ).map(task => (
                            <div key={task.id} className="p-5 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-between group">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-slate-50">
                                  {task.emoji || '✨'}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-slate-800 line-clamp-1">{task.title}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{task.points} XP</p>
                                    {task.requiresProof && <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[8px] scale-90 origin-left"><Camera size={8} strokeWidth={3} /> Foto</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-12 px-6 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-200 mx-auto mb-4 border border-slate-50">
                               <Clock size={20} />
                             </div>
                             <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Geen actieve quests</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedTab === 'history' && (
                  <div className="w-full space-y-4 text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-2">Activiteit</p>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto px-2 no-scrollbar">
                      {historyLoading ? (
                        <div className="space-y-3">
                          {[1,2,3].map(i => (
                            <div key={i} className="h-20 bg-slate-50 rounded-3xl animate-pulse" />
                          ))}
                        </div>
                      ) : userHistory.length > 0 ? (
                        userHistory.map(entry => (
                          <div key={entry.id} className="p-4 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm border border-white/50 ${
                                entry.type === 'earn' ? 'bg-emerald-50 text-emerald-600' : 
                                entry.type === 'spend' ? 'bg-amber-50 text-amber-600' : 
                                'bg-indigo-50 text-indigo-600'
                              }`}>
                                {entry.type === 'earn' ? '✨' : entry.type === 'spend' ? '🎁' : '⚙️'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-800 line-clamp-1">{entry.description}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {entry.timestamp?.toDate ? format(entry.timestamp.toDate(), 'd MMM, HH:mm', { locale: nl }) : 'Net geplaatst'}
                                </p>
                              </div>
                            </div>
                            {(() => {
                              const isPositive = entry.amount > 0 && entry.type !== 'spend';
                              return (
                                <div className={`text-sm font-black px-4 py-2 rounded-2xl shadow-sm border whitespace-nowrap ${
                                  isPositive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
                                }`}>
                                  {isPositive ? '+' : '-'}{Math.abs(entry.amount)} XP
                                </div>
                              );
                            })()}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 px-6 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                           <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-200 mx-auto mb-4 border border-slate-50">
                             <Sparkles size={20} />
                           </div>
                           <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Nog geen activiteiten</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedTab === 'actions' && (
                    <div className="w-full space-y-6">
                      <div className="space-y-4 pt-4">
                        <div className="flex justify-center gap-2 p-1 bg-slate-100 rounded-2xl">
                          <button
                            onClick={() => setAdjustType('plus')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black transition-all ${
                              adjustType === 'plus' 
                                ? 'bg-emerald-500 text-white shadow-lg' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            <Plus size={18} strokeWidth={3} />
                            Belonen
                          </button>
                          <button
                            onClick={() => setAdjustType('minus')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black transition-all ${
                              adjustType === 'minus' 
                                ? 'bg-red-500 text-white shadow-lg' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            <Minus size={18} strokeWidth={3} />
                            Straffen
                          </button>
                        </div>
                        <div className="relative">
                          <input 
                            type="number"
                            value={adjustAmount === 0 ? '' : adjustAmount}
                            onChange={(e) => setAdjustAmount(Math.abs(Number(e.target.value)))}
                            className={`w-full p-5 border rounded-[2rem] focus:ring-4 focus:outline-none font-black text-center transition-all ${
                              adjustType === 'minus' 
                                ? 'bg-red-50 border-red-200 text-red-600 focus:ring-red-100' 
                                : 'bg-emerald-50 border-emerald-200 text-emerald-600 focus:ring-emerald-100'
                            }`}
                            placeholder="0"
                          />
                          <div className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-400">
                            {adjustType === 'plus' ? '+' : '-'}
                          </div>
                          <div className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-400">XP</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setAdjustType('plus'); setAdjustAmount(25); }} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all">+25</button>
                          <button onClick={() => { setAdjustType('plus'); setAdjustAmount(50); }} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all">+50</button>
                          <button onClick={() => { setAdjustType('minus'); setAdjustAmount(25); }} className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all">-25</button>
                          <button onClick={() => { setAdjustType('minus'); setAdjustAmount(50); }} className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all">-50</button>
                        </div>
                      </div>
                  
                    <div className="space-y-2 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 text-center block">Waarom?</label>
                      <input 
                        type="text"
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        placeholder="bijv. Goed geholpen met tafel dekken"
                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-100 focus:outline-none font-bold text-slate-800 transition-all text-center"
                      />
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button 
                        onClick={() => setSelectedUser(null)}
                        className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                      >
                        Annuleer
                      </button>
                      <button 
                        onClick={handleAdjustPoints}
                        disabled={!adjustReason || adjustAmount === 0 || isAdjusting}
                        className="flex-1 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAdjusting ? 'Bezig...' : 'Bevestigen'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Remove Member Confirmation Modal */}
      <AnimatePresence>
        {userToRemove && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUserToRemove(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative z-10 p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Lid Verwijderen?</h3>
              <p className="text-slate-500 font-medium mb-8">
                Weet je zeker dat je <span className="font-bold text-slate-800">{userToRemove.displayName}</span> wilt verwijderen uit het gezin?
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setUserToRemove(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Annuleren
                </button>
                <button
                  onClick={kickMember}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-100"
                >
                  Verwijderen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Child Modal */}
      <AnimatePresence>
        {showAddChild && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddChild(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl relative z-10 p-8"
            >
              <div className="flex flex-col items-center text-center">
                <button 
                  onClick={() => setShowAddChild(false)}
                  className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-all"
                >
                  <X size={20} />
                </button>
                
                <div className="w-20 h-20 rounded-[2rem] bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6 shadow-inner">
                  <UserPlus size={32} />
                </div>
                
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">Kind Toevoegen</h3>
                <p className="text-slate-500 font-medium text-sm mb-8">Maak een profiel aan voor je kind. Ze krijgen een unieke inlogcode.</p>
                
                <div className="w-full space-y-4">
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Naam van het kind</label>
                    <input 
                      type="text"
                      value={newChildName}
                      onChange={(e) => setNewChildName(e.target.value)}
                      placeholder="bijv. Thomas"
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none font-bold text-slate-800 transition-all"
                    />
                  </div>
                  
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setShowAddChild(false)}
                      className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      Annuleren
                    </button>
                    <button 
                      onClick={handleAddChild}
                      disabled={!newChildName || isAddingChild}
                      className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isAddingChild ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                      {isAddingChild ? 'Bezig...' : 'Aanmaken'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Settings Card - Bottom */}
      {profile?.role === 'parent' && (
        <section className="bg-slate-900 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden group order-3">
          <div className="absolute bottom-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
             <Settings size={100} />
          </div>
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-2">Instellingen voor {household?.name}</h3>
            <p className="text-slate-400 text-sm mb-8">Pas je gezin aan of verwijder het volledig.</p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button className="flex-1 bg-white/10 hover:bg-white/20 p-4 rounded-2xl flex items-center justify-between transition-all group/item">
                <span className="font-bold">Gezinsnaam bijwerken</span>
                <span className="text-indigo-400 group-hover/item:translate-x-1 transition-transform">→</span>
              </button>
              <button className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 p-4 rounded-2xl flex items-center justify-between transition-all">
                <span className="font-bold">Huishouden Verwijderen</span>
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
