/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  updateDoc, 
  doc,
  deleteDoc,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { 
  Home, 
  CheckSquare, 
  ShoppingBag, 
  Users, 
  LogOut,
  Bell,
  Sparkles,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppNotification } from '../types';
import { NotificationPanel } from './NotificationPanel';
import { NotificationService } from '../services/NotificationService';

interface LayoutProps {
  children: ReactNode;
  currentView: 'dashboard' | 'tasks' | 'shop' | 'household' | 'history';
  onNavigate: (view: any) => void;
}

import { useTranslation } from '../i18n/LanguageContext';
import { Reward } from '../types';

export function Layout({ children, currentView, onNavigate }: LayoutProps) {
  const { profile, logout } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [targetReward, setTargetReward] = useState<Reward | null>(null);

  useEffect(() => {
    if (profile?.id) {
      NotificationService.requestPermission();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.targetRewardId) {
      setTargetReward(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'rewards', profile.targetRewardId), (docSnap) => {
      if (docSnap.exists()) {
        setTargetReward({ id: docSnap.id, ...docSnap.data() } as Reward);
      } else {
        setTargetReward(null);
      }
    });
    return () => unsub();
  }, [profile?.targetRewardId]);

  const pointsNeeded = targetReward ? Math.max(0, targetReward.cost - (profile?.points || 0)) : null;

  useEffect(() => {
    if (!profile?.id) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.id),
      limit(20)
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
      // Manual sort since we might not have the index yet
      docs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      
      // Trigger browser notification for new unread notifications
      const newUnread = docs.filter(n => !n.read && !notifications.find(prev => prev.id === n.id));
      if (newUnread.length > 0) {
        newUnread.forEach(n => {
          NotificationService.sendNotification(n.message, {
            body: 'Nieuwe update in FamilyChores!'
          });
        });
      }
      
      setNotifications(docs);
    });

    return () => unsub();
  }, [profile]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error(err);
    }
  };

  const clearAllNotifications = async () => {
    if (!profile?.id) return;
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', profile.id));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      console.error(err);
    }
  };

  const hasUnread = notifications.some(n => !n.read);

  const navItems = [
    { id: 'dashboard', label: 'Overzicht', icon: Home },
    { id: 'tasks', label: 'Taken', icon: CheckSquare },
    { id: 'shop', label: 'Winkel', icon: ShoppingBag },
    { id: 'household', label: 'Gezin', icon: Users },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-72 bg-white border-r border-slate-100 flex-col shrink-0">
        <div className="p-8 flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200">
            <Sparkles className="text-white" size={28} />
          </div>
          <span className="text-2xl font-black text-slate-900 tracking-tighter">FamilyChores</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as any)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${
                currentView === item.id 
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <item.icon size={22} />
              {t(`common.${item.id}`)}
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut size={20} />
            {t('common.logout')}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header Bar */}
        <header className="h-16 sm:h-20 bg-white/80 backdrop-blur-md border-b border-white px-4 sm:px-12 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative group cursor-pointer" onClick={() => onNavigate('household')}>
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profiel" className="w-10 h-10 rounded-xl border-2 border-white shadow-md object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black uppercase shadow-sm">
                  {profile?.displayName?.charAt(0)}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-black text-indigo-600 block leading-tight">FamilyChores</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {profile?.role === 'parent' ? 'Ouder' : 'Held'}
                </span>
                {profile?.role === 'child' && pointsNeeded !== null && (
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
                    • <Star fill="currentColor" size={10} /> {pointsNeeded} {t('common.xp')} to go
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setLanguage(language === 'nl' ? 'en' : 'nl')}
               className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm transition-all"
             >
               {language === 'nl' ? 'English' : 'Nederlands'}
             </button>
             <button 
               onClick={() => setShowNotifications(true)}
               className="relative p-2 text-slate-400 hover:text-indigo-600 transition-colors"
             >
                <Bell size={24} />
                {hasUnread && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
             </button>
          </div>
        </header>

        <AnimatePresence>
          {showNotifications && (
            <NotificationPanel 
              notifications={notifications}
              onClose={() => setShowNotifications(false)}
              onMarkRead={markAsRead}
              onDelete={deleteNotification}
              onClearAll={clearAllNotifications}
            />
          )}
        </AnimatePresence>

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-12 pb-48 md:pb-16 bg-[#F8FAFC]">
          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="min-h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-xl border border-white/20 h-16 flex items-center justify-around rounded-[2rem] shadow-[0_12px_40px_-10px_rgba(0,0,0,0.15)] px-4 w-[calc(100%-3rem)] max-w-sm">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as any)}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all ${
                currentView === item.id ? 'text-white bg-indigo-600 shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <item.icon size={22} strokeWidth={currentView === item.id ? 3 : 2} />
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

