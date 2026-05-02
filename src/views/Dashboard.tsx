/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc, increment, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { UserProfile, Task, AppNotification, OperationType, HistoryEntry, Reward } from '../types';
import { 
  Trophy, 
  CheckCircle, 
  Bell, 
  AlertCircle, 
  TrendingUp, 
  ArrowRight, 
  Sparkles,
  Award,
  Gamepad,
  User,
  Plus,
  CheckCircle2,
  Clock,
  ChevronRight,
  Users as UsersIcon,
  CheckCircle as LucideCheckCircle,
  Star,
  Gift
} from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { TaskDetailModal } from '../components/TaskDetailModal';

import { useTranslation } from '../i18n/LanguageContext';

export function Dashboard({ onNavigate }: { onNavigate?: (view: any) => void }) {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDirectCompleting, setIsDirectCompleting] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [recyclingTask, setRecyclingTask] = useState<Task | null>(null);
  const [concurrencyError, setConcurrencyError] = useState<{ currentTask: Task, nextTask: Task } | null>(null);

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [hasSuggestions, setHasSuggestions] = useState(false);

  useEffect(() => {
    if (!profile?.householdId) return;
    const q = query(collection(db, 'rewards'), where('householdId', '==', profile.householdId));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Reward));
      setRewards(data);
      setHasSuggestions(data.some(r => r.isSuggestion));
    });
  }, [profile]);

  useEffect(() => {
    if (!profile?.householdId) return;

    // 1. Members
    const qMembers = query(collection(db, 'users'), where('householdId', '==', profile.householdId));
    const unsubMembers = onSnapshot(qMembers, (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    });

    // 2. Pending Tasks (for parents to approve)
    const qTasks = query(
      collection(db, 'tasks'), 
      where('householdId', '==', profile.householdId)
    );
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      const allTasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setPendingTasks(allTasks.filter(t => t.status === 'pending'));
      setActiveTasks(allTasks.filter(t => t.status === 'active'));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'tasks');
      setLoading(false);
    });

    // 4. Recent Notifications - Simplified to avoid index for now
    const qNotifs = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.id),
      limit(20)
    );
    const unsubNotifs = onSnapshot(qNotifs, (snap) => {
      // Sort manually to avoid index requirement
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as AppNotification))
        .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))
        .slice(0, 5);
      setNotifications(sorted);
    }, (err) => {
      console.error("Notifications error:", err);
    });

    return () => {
      unsubMembers();
      unsubTasks();
      unsubNotifs();
    };
  }, [profile]);

  const myActiveTasks = activeTasks.filter(t => {
    if (profile?.role === 'parent') return true;
    if (t.assignedTo === profile?.id) return true;
    if (t.type === 'first_come') {
      if (t.distributionType === 'everyone_must') {
        return !t.completedByList?.includes(profile?.id || '');
      }
      return true;
    }
    return false;
  });

  const handleApprove = async (task: Task) => {
    if (profile?.role !== 'parent') return;
    try {
      if (task.completedBy) {
        // 1. Give points to child
        await updateDoc(doc(db, 'users', task.completedBy), {
          points: increment(task.points)
        });

        // 2. Add to history
        await addDoc(collection(db, 'history'), {
          userId: task.completedBy,
          householdId: profile.householdId,
          amount: task.points,
          type: 'earn',
          description: `Quest voltooid: ${task.title}`,
          timestamp: serverTimestamp()
        });

        // 3. Notify child
        await addDoc(collection(db, 'notifications'), {
          userId: task.completedBy,
          householdId: profile.householdId,
          message: `Hoera! Je quest "${task.title}" is goedgekeurd. Je hebt ${task.points} XP gekregen! 🏆`,
          read: false,
          timestamp: serverTimestamp()
        });

        // 3b. Notify other parents
        const child = members.find(m => m.id === task.completedBy);
        const otherParents = members.filter(m => m.role === 'parent' && m.id !== profile.id);
        for (const p of otherParents) {
          await addDoc(collection(db, 'notifications'), {
            userId: p.id,
            householdId: profile.householdId,
            message: `📢 Quest "${task.title}" van ${child?.displayName || 'een kind'} is goedgekeurd door ${profile.displayName}.`,
            read: false,
            timestamp: serverTimestamp()
          });
        }
      }

      // 4. Show recycling choice modal
      setRecyclingTask(task);
      setSelectedTask(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const handleReject = async (task: Task) => {
    if (profile?.role !== 'parent') return;
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        status: 'active',
        completedBy: null,
        proofUrl: null,
        updatedAt: serverTimestamp()
      });

      if (task.completedBy) {
        await addDoc(collection(db, 'notifications'), {
          userId: task.completedBy,
          householdId: profile.householdId,
          message: `❌ Je quest "${task.title}" is niet goedgekeurd door ${profile.displayName}. Probeer het opnieuw!`,
          read: false,
          timestamp: serverTimestamp()
        });
      }
      setSelectedTask(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const handleRecycle = async (taskId: string, action: 'keep' | 'delete') => {
    try {
      if (action === 'keep') {
        await updateDoc(doc(db, 'tasks', taskId), {
          status: 'active',
          completedBy: null,
          proofUrl: null,
          updatedAt: serverTimestamp()
        });
      } else {
        await deleteDoc(doc(db, 'tasks', taskId));
      }
      setRecyclingTask(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjustPoints = async () => {
    if (!selectedUser || !profile || !adjustReason) return;
    setIsAdjusting(true);
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), {
        points: increment(adjustAmount)
      });

      await addDoc(collection(db, 'history'), {
        userId: selectedUser.id,
        householdId: profile.householdId,
        amount: Math.abs(adjustAmount),
        type: adjustAmount > 0 ? 'earn' : 'spend',
        description: adjustReason,
        timestamp: serverTimestamp()
      });

      await addDoc(collection(db, 'notifications'), {
        userId: selectedUser.id,
        householdId: profile.householdId,
        message: adjustAmount > 0 
          ? `Fantastisch! Je hebt ${adjustAmount} bonus XP gekregen: ${adjustReason}`
          : `Oei! Er is ${Math.abs(adjustAmount)} XP afgetrokken: ${adjustReason}`,
        read: false,
        timestamp: serverTimestamp()
      });

      // Notify other parents
      const otherParents = members.filter(m => m.role === 'parent' && m.id !== profile.id);
      for (const p of otherParents) {
        await addDoc(collection(db, 'notifications'), {
          userId: p.id,
          householdId: profile.householdId,
          message: `📢 XP van ${selectedUser.displayName} is aangepast door ${profile.displayName}: ${adjustAmount > 0 ? '+' : ''}${adjustAmount} (${adjustReason})`,
          read: false,
          timestamp: serverTimestamp()
        });
      }

      setSelectedUser(null);
      setAdjustAmount(0);
      setAdjustReason('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${selectedUser.id}`);
    } finally {
      setIsAdjusting(false);
    }
  };

  const submitTask = async (task: Task, proofDataUrl: string) => {
    if (profile?.role !== 'child') return;

    try {
      if (task.distributionType === 'everyone_must') {
        const alreadyDone = task.completedByList?.includes(profile.id);
        if (alreadyDone) return;
        
        await updateDoc(doc(db, 'tasks', task.id), {
          completedByList: [...(task.completedByList || []), profile.id],
          status: 'active',
          claimedBy: null,
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, 'tasks', task.id), {
          status: 'pending',
          completedBy: profile.id,
          claimedBy: null,
          proofUrl: proofDataUrl || null,
          updatedAt: serverTimestamp()
        });

        // Notify parents that a task is ready for review
        const parents = members.filter(m => m.role === 'parent');
        for (const parent of parents) {
          await addDoc(collection(db, 'notifications'), {
            userId: parent.id,
            householdId: profile.householdId,
            message: `🔔 ${profile.displayName} heeft de quest "${task.title}" voltooid en wacht op goedkeuring!`,
            read: false,
            timestamp: serverTimestamp()
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const startTask = async (task: Task) => {
    if (profile?.role !== 'child') return;
    
    // Check for concurrency
    const currentActive = activeTasks.find(t => t.status === 'in_progress' && t.claimedBy === profile.id);
    if (currentActive && currentActive.id !== task.id) {
      setConcurrencyError({ currentTask: currentActive, nextTask: task });
      return;
    }

    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        status: 'in_progress',
        claimedBy: profile.id,
        updatedAt: serverTimestamp()
      });
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
    }
  };

  const cancelTask = async (taskId: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'active',
        claimedBy: null,
        updatedAt: serverTimestamp()
      });
      setConcurrencyError(null);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  const totalFamilyXP = members.reduce((acc, m) => acc + m.points, 0);
  const rewardsClaimedTotal = 0; // Would need a query on history for 'spend'

  if (profile?.role === 'parent') {
    return (
      <div className="space-y-10 pb-10">
        {/* Welcome Section */}
        <section className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter">{t('dashboard.welcome', { name: profile.displayName.split(' ')[0] })}</h1>
            </div>
            <p className="text-slate-500 font-bold">{pendingTasks.length} {t('dashboard.pending_review')}</p>
          </div>
        </section>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-200 group hover:scale-[1.02] transition-transform">
             <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-4">{t('dashboard.family_xp')}</p>
                <p className="text-4xl font-black tracking-tighter">{totalFamilyXP.toLocaleString()}</p>
             </div>
             <Trophy className="absolute bottom-6 right-6 text-white/10 group-hover:scale-110 transition-transform" size={80} strokeWidth={3} />
          </div>
          <div className="bg-amber-400 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-amber-100 group hover:scale-[1.02] transition-transform">
             <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-4">Beloningen Verzilverd</p>
                <p className="text-4xl font-black tracking-tighter">{rewardsClaimedTotal}</p>
             </div>
             <Award className="absolute bottom-6 right-6 text-white/20 group-hover:rotate-12 transition-transform" size={80} strokeWidth={3} />
          </div>
          <div 
            onClick={() => onNavigate?.('shop')}
            className="col-span-2 lg:col-span-1 bg-white border border-slate-100 rounded-[2.5rem] p-8 text-slate-900 relative overflow-hidden shadow-xl shadow-slate-200/50 group hover:scale-[1.02] transition-transform cursor-pointer"
          >
             <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('dashboard.suggestions')}</p>
                   {hasSuggestions && (
                     <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                     </span>
                   )}
                </div>
                <p className="text-lg font-black tracking-tight text-slate-600 leading-tight">{t('dashboard.suggestions_desc')}</p>
             </div>
             <Sparkles className={`absolute bottom-6 right-6 ${hasSuggestions ? 'text-amber-400' : 'text-slate-100'} group-hover:scale-125 transition-transform`} size={60} strokeWidth={3} />
          </div>
        </div>

        {/* Recent Activity (Pending Reviews) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{t('dashboard.recent_activity')}</h2>
            <button 
              onClick={() => onNavigate?.('tasks')}
              className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
            >
              {t('dashboard.view_all')}
            </button>
          </div>
          <div className="space-y-3">
            {pendingTasks.length > 0 ? (
              pendingTasks.map((task) => {
                const child = members.find(m => m.id === task.completedBy);
                return (
                  <motion.div 
                    layout
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="bg-white p-6 rounded-[2.5rem] border border-slate-50 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm group-hover:scale-110 transition-transform">
                        <CheckCircle2 size={28} strokeWidth={3} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-600 tracking-tight">
                          <span className="text-indigo-600 font-black">{child?.displayName}</span> is klaar met:
                        </p>
                        <h3 className="text-lg font-black text-slate-900 leading-tight tracking-tight">{task.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">+{task.points} XP Wachtend</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleApprove(task)}
                      className="px-8 py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all"
                    >
                      Goedkeuren
                    </button>
                  </motion.div>
                );
              })
            ) : (
              <div className="bg-slate-50 border-4 border-dashed border-slate-200 p-12 rounded-[3rem] text-center">
                <p className="text-slate-400 font-bold italic">Geen taken wachten op review...</p>
              </div>
            )}
          </div>
        </section>

        {/* Family Squad */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{t('dashboard.family_team')}</h2>
            <button 
              onClick={() => onNavigate?.('household')}
              className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100"
            >
              <Plus size={16} strokeWidth={3} /> {profile.role === 'parent' ? t('household.members') : 'Team'}
            </button>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-4 -mx-1 px-1 no-scrollbar">
            {members.map((member) => (
              <div 
                key={member.id} 
                onClick={() => member.role === 'child' && setSelectedUser(member)}
                className={`min-w-[160px] bg-white p-8 rounded-[3rem] border border-slate-50 flex flex-col items-center shadow-sm relative group hover:shadow-xl hover:-translate-y-1 transition-all ${member.role === 'child' ? 'cursor-pointer' : ''}`}
              >
                <div className="relative">
                  {member.photoURL ? (
                    <img src={member.photoURL} className="w-20 h-20 rounded-[2rem] border-4 border-white shadow-xl object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-20 h-20 rounded-[2rem] bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-3xl uppercase shadow-inner">
                      {member.displayName.charAt(0)}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center shadow-lg">
                    <CheckCircle2 size={14} className="text-white" strokeWidth={4} />
                  </div>
                </div>
                <h4 className="mt-5 font-black text-slate-900 text-base tracking-tight">{member.displayName}</h4>
                <div className="mt-3 px-4 py-1.5 bg-amber-100 rounded-full shadow-inner">
                  <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">{member.points} XP</span>
                </div>
                {member.role === 'parent' && <span className="mt-2 text-[8px] font-black text-slate-400 uppercase tracking-widest px-2 py-0.5 bg-slate-50 rounded-lg">Beheerder</span>}
              </div>
            ))}
          </div>
        </section>

        {/* Notification Modal for Approving Task Choice */}
        <AnimatePresence>
          {recyclingTask && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-[4rem] p-10 max-w-md w-full relative z-10 text-center shadow-2xl"
              >
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <CheckCircle size={48} />
                </div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-4">Quest Goedgekeurd!</h3>
                <p className="text-slate-500 font-bold mb-10 leading-relaxed">
                  XP is uitgedeeld. Wat wil je met de quest <b>"{recyclingTask.title}"</b> doen?
                </p>
                <div className="grid gap-4">
                  <button 
                    onClick={() => handleRecycle(recyclingTask.id, 'keep')}
                    className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 transition-all"
                  >
                    Opnieuw Plaatsen (Recyclen)
                  </button>
                  <button 
                    onClick={() => handleRecycle(recyclingTask.id, 'delete')}
                    className="w-full py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Definitief Verwijderen
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Adjust Points Modal */}
        <AnimatePresence>
          {selectedUser && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
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
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-4xl mb-6 shadow-inner">
                    {selectedUser.photoURL ? (
                      <img src={selectedUser.photoURL} className="w-full h-full rounded-[2.5rem] object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      selectedUser.displayName.charAt(0)
                    )}
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">{selectedUser.displayName}</h3>
                  <div className="bg-amber-100 px-6 py-2 rounded-2xl mb-8">
                     <span className="text-sm font-black text-amber-800 uppercase tracking-wider">{selectedUser.points} XP</span>
                  </div>

                  <div className="w-full space-y-6">
                    {/* User's Active Tasks */}
                    <div className="space-y-4 text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-4">Lopende Quests</p>
                      <div className="space-y-3 max-h-[200px] overflow-y-auto px-2 no-scrollbar">
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
                            <div key={task.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{task.emoji || '✨'}</span>
                                <div>
                                  <p className="text-xs font-black text-slate-800">{task.title}</p>
                                  <p className="text-[9px] font-bold text-amber-600">{task.points} XP</p>
                                </div>
                              </div>
                              <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                            </div>
                          ))
                        ) : (
                          <p className="text-center py-4 text-slate-400 text-xs font-bold italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                             Geen actieve quests
                          </p>
                        )}
                      </div>
                    </div>

                      <div className="space-y-4 pt-4 border-t border-slate-50">
                        <div className="flex justify-between items-center px-4">
                           <p className={`text-xs font-black uppercase tracking-widest transition-all ${adjustAmount < 0 ? 'text-red-500' : 'text-slate-300'}`}>
                              {t('dashboard.punish')}
                           </p>
                           <p className={`text-xs font-black uppercase tracking-widest transition-all ${adjustAmount > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>
                              {t('dashboard.reward')}
                           </p>
                        </div>
                        <div className="relative">
                          <input 
                            type="number"
                            value={adjustAmount === 0 ? '' : adjustAmount}
                            onChange={(e) => setAdjustAmount(Number(e.target.value))}
                            className={`w-full p-5 border rounded-[2rem] focus:ring-4 focus:outline-none font-black text-center transition-all ${
                              adjustAmount < 0 
                                ? 'bg-red-50 border-red-200 text-red-600 focus:ring-red-100' 
                                : adjustAmount > 0 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600 focus:ring-emerald-100'
                                  : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-indigo-100'
                            }`}
                            placeholder="0"
                          />
                          <div className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-400">XP</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setAdjustAmount(25)} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all">+25</button>
                          <button onClick={() => setAdjustAmount(50)} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all">+50</button>
                          <button onClick={() => setAdjustAmount(100)} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all">+100</button>
                          <button onClick={() => setAdjustAmount(-25)} className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-red-400 hover:bg-red-50 transition-all">-25</button>
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
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Today's Tasks */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{t('dashboard.todays_quests')}</h2>
            <div 
              onClick={() => onNavigate?.('tasks')}
              className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 cursor-pointer hover:rotate-90 transition-transform duration-500"
            >
              <Plus size={28} strokeWidth={3} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTasks.slice(0, 4).map(task => (
              <div 
                key={task.id} 
                onClick={() => setSelectedTask(task)}
                className="bg-white p-6 rounded-[2.5rem] border border-slate-50 flex items-center justify-between shadow-sm group hover:shadow-xl transition-all cursor-pointer"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                    {task.icon === 'utensils' ? <Award size={28} /> : <Clock size={28} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight">{task.title}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                      {task.type === 'individual' ? 'Privé Quest' : 'Open Quest'} • <span className="text-indigo-500">+{task.points} XP</span>
                    </p>
                  </div>
                </div>
                <ChevronRight className="text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all" size={24} strokeWidth={3} />
              </div>
            ))}
          </div>
        </section>

        <AnimatePresence>
          {selectedTask && (
            <TaskDetailModal 
              task={selectedTask}
              onClose={() => {
                setSelectedTask(null);
                setIsDirectCompleting(false);
              }}
              profile={profile}
              members={members}
              initialSubmitting={isDirectCompleting}
              onComplete={(task, proofUrl) => submitTask(task, proofUrl)}
              onApprove={handleApprove}
              onReject={handleReject}
              onStartEdit={() => {
                 setSelectedTask(null);
                 onNavigate?.('tasks');
              }}
              onDelete={async (id) => {
                // Parents can delete tasks from here
                try {
                  await deleteDoc(doc(db, 'tasks', id));
                  setSelectedTask(null);
                } catch (err) {
                   console.error(err);
                }
              }}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // CHILD DASHBOARD
  const targetReward = rewardsClaimedTotal > -1 ? [] : []; // Placeholder for actual rewards check

  const profileTargetReward = rewards.find(r => r.id === profile?.targetRewardId);
  const pointsNeeded = profileTargetReward ? Math.max(0, profileTargetReward.cost - profile.points) : (500 - profile.points);
  const targetTitle = profileTargetReward ? profileTargetReward.title : 'volgende beloning';
  const progressPercent = profileTargetReward 
    ? (profile.points / profileTargetReward.cost) * 100 
    : (profile.points / 500) * 100;

  return (
    <div className="space-y-12 pb-10">
      {/* Top Section Grid (XP + Target Reward) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Point Header Card */}
        <section className="bg-gradient-to-br from-indigo-600 to-blue-500 rounded-[2.5rem] p-6 sm:p-8 text-white relative overflow-hidden shadow-[0_20px_50px_-20px_rgba(79,70,229,0.5)] text-center flex flex-col justify-center min-h-[220px]">
          <div className="relative z-10 flex flex-col items-center">
            <div className="px-4 py-1.5 bg-amber-400/90 rounded-full flex items-center gap-2 mb-4 shadow-lg scale-90">
               <Trophy size={14} fill="currentColor" strokeWidth={3} className="text-amber-900" />
               <span className="font-black text-[9px] uppercase tracking-[0.2em] text-amber-900">{t('dashboard.quest_master')}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black mb-2 tracking-tighter leading-none">{t('dashboard.xp_message', { points: profile.points })}</h1>
            <p className="text-indigo-100 font-bold text-[10px] mb-6 opacity-90">{t('dashboard.points_needed', { points: pointsNeeded, target: targetTitle })}</p>
            
            <div className="w-full max-w-[180px] bg-white/20 h-2 rounded-full mb-1 p-0.5 border border-white/10">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${Math.min(100, progressPercent)}%` }}
                 className="bg-amber-400 h-full rounded-full shadow-[0_0_10px_rgba(251,191,36,0.5)]"
               />
            </div>
          </div>
          
          {/* Background Decorative Elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
             <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
             <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-400/20 rounded-full blur-3xl"></div>
          </div>
        </section>

        {/* Target Reward Section (Children Only) */}
        {profile.role === 'child' && profileTargetReward ? (
          <section className="bg-white rounded-[2.5rem] p-6 border border-indigo-100 shadow-xl shadow-indigo-50 relative overflow-hidden group flex flex-col justify-center min-h-[220px]">
            <div className="absolute top-0 right-0 p-6 opacity-5 sm:opacity-10 group-hover:opacity-15 transition-opacity pointer-events-none">
              <Trophy size={80} className="text-indigo-600 rotate-12" />
            </div>
            <div className="relative z-10 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner shrink-0 leading-none">
                {profileTargetReward.emoji || '🎁'}
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1 block">{t('dashboard.next_reward')}</span>
                <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">{profileTargetReward.title}</h2>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs font-black text-amber-500 tracking-tight flex items-center gap-1.5 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                    <Star fill="currentColor" size={14} /> {pointsNeeded} {t('common.xp')}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => onNavigate?.('shop')}
                className="mt-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
              >
                Go to Shop
              </button>
            </div>
          </section>
        ) : (
          <div 
            onClick={() => onNavigate?.('shop')}
            className="bg-white border-2 border-dashed border-slate-100 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-indigo-200 transition-all min-h-[220px]"
          >
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-50 group-hover:text-indigo-400 transition-colors">
              <Plus size={32} />
            </div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Kies een doel</p>
          </div>
        )}
      </div>

      {/* Only for You */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <User className="text-indigo-600" size={28} strokeWidth={3} /> {t('dashboard.only_for_you')}
          </h2>
          <span className="px-4 py-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-full uppercase tracking-widest shadow-sm">
            {activeTasks.filter(t => t.assignedTo === profile.id).length} {t('quests.active')}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {myActiveTasks.filter(t => t.assignedTo === profile.id).map(task => (
            <div 
              key={task.id} 
              onClick={() => setSelectedTask(task)}
              className="bg-white p-6 rounded-[3rem] border-l-[12px] border-l-emerald-400 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] border border-slate-50 flex items-center justify-between group hover:scale-[1.02] transition-all cursor-pointer"
            >
               <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center text-emerald-600 shadow-sm">
                    {task.emoji ? <span className="text-3xl">{task.emoji}</span> : <Gamepad size={32} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight">{task.title}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('dashboard.morning_quest')}</p>
                  </div>
               </div>
               <div className="flex items-center gap-4">
                  <div className="bg-amber-50 px-5 py-3 rounded-[1.5rem] text-center border border-amber-100 shadow-sm relative overflow-hidden group-hover:bg-amber-100 transition-colors">
                     <p className="text-[9px] font-black text-amber-700 uppercase tracking-tighter mb-0.5 leading-none">XP</p>
                     <p className="text-lg font-black text-amber-700 tracking-tighter leading-none">+{task.points}</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDirectCompleting(true);
                      setSelectedTask(task);
                    }}
                    className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 hover:scale-110 active:scale-95 transition-all"
                  >
                    <CheckCircle2 size={24} strokeWidth={3} />
                  </button>
               </div>
            </div>
          ))}
        </div>
      </section>

      {/* Everyone */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <UsersIcon className="text-indigo-600" size={28} strokeWidth={3} /> {t('dashboard.open_for_everyone')}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myActiveTasks.filter(t => t.type === 'first_come').map(task => (
            <div 
              key={task.id} 
              onClick={() => setSelectedTask(task)}
              className="bg-white p-6 rounded-[3rem] border-l-[12px] border-l-indigo-400 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] border border-slate-50 flex items-center justify-between group hover:scale-[1.02] transition-all cursor-pointer"
            >
               <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 shadow-sm">
                    {task.emoji ? <span className="text-3xl">{task.emoji}</span> : <Award size={32} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight">{task.title}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                       {task.distributionType === 'everyone_must' ? t('dashboard.together_quest') : t('dashboard.family_quest')}
                    </p>
                  </div>
               </div>
               <div className="flex items-center gap-4">
                  <div className="bg-amber-50 px-5 py-3 rounded-[1.5rem] text-center border border-amber-100 shadow-sm relative overflow-hidden group-hover:bg-amber-100 transition-colors">
                     <p className="text-[9px] font-black text-amber-700 uppercase tracking-tighter mb-0.5 leading-none">XP</p>
                     <p className="text-lg font-black text-amber-700 tracking-tighter leading-none">+{task.points}</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDirectCompleting(true);
                      setSelectedTask(task);
                    }}
                    className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 hover:scale-110 active:scale-95 transition-all"
                  >
                    <CheckCircle2 size={24} strokeWidth={3} />
                  </button>
               </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Activity Mini */}
      <section className="bg-white rounded-[4rem] p-10 border border-slate-50 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        
        <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3 tracking-tight relative z-10">
          <Clock className="text-indigo-600" size={24} strokeWidth={3} /> {t('dashboard.latest_updates')}
        </h3>
        <div className="space-y-8 relative z-10">
          {notifications.slice(0, 3).map(notif => {
            const isReward = notif.type === 'suggestion' || notif.type === 'suggestion_approved' || notif.message.includes('beloning');
            return (
              <div key={notif.id} className="flex gap-5 items-start">
                 <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center shrink-0 shadow-sm ${isReward ? 'bg-amber-50 text-amber-500' : 'bg-indigo-50 text-indigo-600'}`}>
                    {isReward ? <Gift size={24} strokeWidth={3} /> : <CheckCircle2 size={24} strokeWidth={3} />}
                 </div>
                 <div className="flex-1">
                   <p className="text-base font-bold text-slate-800 leading-snug">{notif.message}</p>
                   {!isReward && (
                     <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-50 px-3 py-1 rounded-full">{t('dashboard.quest_complete_status')}</span>
                     </div>
                   )}
                   {isReward && (
                     <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${notif.type === 'suggestion' ? 'bg-indigo-50 text-indigo-500' : 'bg-amber-50 text-amber-500'}`}>
                           {notif.type === 'suggestion' ? t('dashboard.notification_reward_suggested') : t('dashboard.notification_reward_approved')}
                        </span>
                     </div>
                   )}
                 </div>
                 {notif.message.includes('XP') && !isReward && (
                   <div className="text-right">
                      <span className="text-lg font-black text-emerald-500 tracking-tighter">{notif.message.match(/\d+/)?.[0]} XP</span>
                   </div>
                 )}
              </div>
            );
          })}
          {notifications.length === 0 && (
             <p className="text-slate-400 font-bold italic text-center py-4">{t('dashboard.no_notifications')}</p>
          )}
        </div>
        
        {profile.role === 'parent' && (
          <div className="mt-12 flex justify-center">
             <motion.div 
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onNavigate?.('tasks')}
              className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-[0_15px_30px_-10px_rgba(79,70,229,0.5)] cursor-pointer transition-shadow hover:shadow-indigo-300"
            >
                <Plus size={40} className="text-white" strokeWidth={4} />
             </motion.div>
          </div>
        )}
      </section>

        {/* Concurrency Modal */}
        <AnimatePresence>
          {concurrencyError && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConcurrencyError(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white rounded-[4rem] p-10 max-w-md w-full relative z-10 text-center shadow-2xl">
                <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8">
                  <AlertCircle size={48} />
                </div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-4">{t('dashboard.concurrency_title')}</h3>
                <p className="text-slate-500 font-bold mb-10 leading-relaxed">
                  {t('dashboard.concurrency_desc', { task: concurrencyError.currentTask.title })}
                </p>
                <div className="grid gap-4">
                  <button onClick={() => { setSelectedTask(concurrencyError.currentTask); setConcurrencyError(null); }} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 transition-all">
                    {t('dashboard.concurrency_continue')}
                  </button>
                  <button onClick={() => cancelTask(concurrencyError.currentTask.id)} className="w-full py-5 bg-red-50 text-red-500 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-red-100 transition-all">
                    {t('dashboard.concurrency_stop')}
                  </button>
                  <button onClick={() => setConcurrencyError(null)} className="w-full py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all">
                    {t('dashboard.concurrency_later')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedTask && (
            <TaskDetailModal 
              task={selectedTask}
              onClose={() => {
                setSelectedTask(null);
                setIsDirectCompleting(false);
              }}
              profile={profile}
              members={members}
              initialSubmitting={isDirectCompleting}
              onComplete={(task, proofUrl) => submitTask(task, proofUrl)}
              onStart={startTask}
              onStartEdit={() => {
                setSelectedTask(null);
                onNavigate?.('tasks');
              }}
            />
          )}
        </AnimatePresence>
      </div>
  );
}

