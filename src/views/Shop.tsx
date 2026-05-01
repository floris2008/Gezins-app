/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, increment, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Reward, OperationType } from '../types';
import { 
  Plus, 
  ShoppingBag, 
  Trash2, 
  X, 
  Image as ImageIcon,
  Camera,
  Clock,
  CheckCircle,
  Gift,
  Star,
  Coins,
  IceCream,
  Gamepad2,
  Film,
  ShoppingCart,
  ChevronRight,
  Sparkles,
  Search,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { REWARD_ICONS } from '../constants';

const ICON_MAP: Record<string, any> = {
  'gift': Gift,
  'star': Star,
  'coins': Coins,
  'ice-cream': IceCream,
  'gamepad-2': Gamepad2,
  'film': Film,
  'shopping-cart': ShoppingCart,
  'sparkles': Sparkles,
  'shopping-bag': ShoppingBag
};

import { useTranslation } from '../i18n/LanguageContext';

export function Shop() {
  const { profile, refreshProfile } = useAuth();
  const { t } = useTranslation();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('Alles');

  // New reward form
  const [newTitle, setNewTitle] = useState('');
  const [newEmoji, setNewEmoji] = useState('🎁');
  const [newCost, setNewCost] = useState(500);
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('Alles');
  const [newUsageType, setNewUsageType] = useState<'once' | 'always'>('always');
  const [selectedIcon, setSelectedIcon] = useState('gift');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageSource, setShowImageSource] = useState<'camera' | null>(null);
  const [claimingReward, setClaimingReward] = useState<Reward | null>(null);

  useEffect(() => {
    if (!profile?.householdId) return;

    const q = query(collection(db, 'rewards'), where('householdId', '==', profile.householdId));
    const unsub = onSnapshot(q, (snap) => {
      setRewards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reward)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'rewards');
    });

    const qMembers = query(collection(db, 'users'), where('householdId', '==', profile.householdId));
    const unsubMembers = onSnapshot(qMembers, (snap) => {
       setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsub();
      unsubMembers();
    };
  }, [profile]);

  const addReward = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile?.householdId) return;

    try {
      const rewardData: any = {
        title: newTitle,
        emoji: newEmoji,
        description: newDesc,
        cost: Number(newCost),
        category: newCategory === 'Alles' ? 'Plezier' : newCategory,
        usageType: newUsageType,
        icon: selectedIcon,
        imageUrl: imageUrl || null,
        householdId: profile.householdId
      };

      if (isSuggesting) {
        rewardData.isSuggestion = true;
        rewardData.status = 'pending';
        rewardData.suggestedBy = profile.displayName;
        rewardData.suggestedByPhoto = profile.photoURL || null;

        // Notify parents about the suggestion
        const parents = members.filter(m => m.role === 'parent');
        for (const parent of parents) {
          await addDoc(collection(db, 'notifications'), {
            userId: parent.id,
            householdId: profile.householdId,
            message: `💡 ${profile.displayName} heeft een nieuwe beloning voorgesteld: "${newTitle}"`,
            type: 'suggestion',
            read: false,
            timestamp: serverTimestamp()
          });
        }
      }

      if (editingReward?.id) {
        // If parent edit suggestion, approve it
        if (profile.role === 'parent' && editingReward.isSuggestion) {
          rewardData.isSuggestion = false;
          rewardData.status = 'approved';
        }
        await updateDoc(doc(db, 'rewards', editingReward.id), rewardData);
      } else {
        await addDoc(collection(db, 'rewards'), rewardData);
      }
      
      setIsAdding(false);
      setIsSuggesting(false);
      setEditingReward(null);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'rewards');
    }
  };

  const hasSuggestions = rewards.some(r => r.isSuggestion);
  const mySuggestionsCount = rewards.filter(r => r.isSuggestion && r.suggestedBy === profile?.displayName).length;

  const setAsTarget = async (rewardId: string) => {
    if (!profile) return;
    try {
      const isCurrentlyTarget = profile.targetRewardId === rewardId;
      await updateDoc(doc(db, 'users', profile.id), {
        targetRewardId: isCurrentlyTarget ? null : rewardId
      });
      if (refreshProfile) await refreshProfile();
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setNewTitle('');
    setNewEmoji('🎁');
    setNewCost(500);
    setNewDesc('');
    setNewCategory('Alles');
    setSelectedIcon('gift');
    setImageUrl('');
    setShowImageSource(null);
  };

  const startEdit = (reward: Reward) => {
    setEditingReward(reward);
    setNewTitle(reward.title);
    setNewEmoji(reward.emoji || '🎁');
    setNewCost(reward.cost);
    setNewDesc(reward.description || '');
    setNewCategory(reward.category || 'Alles');
    setNewUsageType(reward.usageType || 'always');
    setSelectedIcon(reward.icon || 'gift');
    setImageUrl(reward.imageUrl || '');
    setIsAdding(true);
  };

  const buyReward = async (reward: Reward) => {
    if (!profile) return;
    if (profile.role !== 'child') return;
    if (profile.points < reward.cost) return;

    try {
      // 1. Decrease user points
      await updateDoc(doc(db, 'users', profile.id), {
        points: increment(-reward.cost)
      });

      // 2. Create history entry
      await addDoc(collection(db, 'history'), {
        userId: profile.id,
        householdId: profile.householdId,
        amount: -reward.cost,
        type: 'spend',
        description: `Verzilverd: ${reward.title}`,
        timestamp: serverTimestamp()
      });

      // 3. Mark reward as claimed if single use
      if (reward.usageType === 'once') {
        await updateDoc(doc(db, 'rewards', reward.id), {
          claimed: true,
          claimedBy: profile.id,
          claimedAt: serverTimestamp()
        });
      }

      // 4. Notify parents
      const parents = (await import('firebase/firestore')).query(collection(db, 'users'), where('householdId', '==', profile.householdId), where('role', '==', 'parent'));
      const parentSnap = await (await import('firebase/firestore')).getDocs(parents);
      
      for (const p of parentSnap.docs) {
        await addDoc(collection(db, 'notifications'), {
          userId: p.id,
          householdId: profile.householdId,
          message: `🎁 ${profile.displayName} heeft de beloning "${reward.title}" verzilverd!`,
          read: false,
          timestamp: serverTimestamp()
        });
      }

      await refreshProfile();
      setClaimingReward(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.id}`);
    }
  };

  const deleteReward = async (id: string | undefined) => {
    if (!id) return;
    if (profile?.role !== 'parent') return;
    if (!confirm('Weet je zeker dat je deze beloning wilt verwijderen?')) return;
    try {
       await deleteDoc(doc(db, 'rewards', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `rewards/${id}`);
    }
  };

  const approveSuggestion = async (reward: Reward) => {
    if (profile?.role !== 'parent') return;
    try {
      await updateDoc(doc(db, 'rewards', reward.id), {
        isSuggestion: false,
        status: 'approved',
        updatedAt: serverTimestamp()
      });
      
      // Notify child
      const child = members.find(m => m.displayName === reward.suggestedBy);
      if (child) {
        await addDoc(collection(db, 'notifications'), {
          userId: child.id,
          householdId: profile.householdId,
          message: `✅ Je suggestie "${reward.title}" is goedgekeurd door ${profile.displayName}!`,
          type: 'suggestion_approved',
          read: false,
          timestamp: serverTimestamp()
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredRewards = rewards.filter(r => {
    // Hide single-use claimed rewards except for parents and the claimant (for 3 days)
    if (r.claimed && r.usageType === 'once') {
      if (profile?.role === 'parent') return true;
      if (r.claimedBy === profile?.id) {
        const claimedTime = r.claimedAt?.toMillis() || Date.now();
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        return (Date.now() - claimedTime) < threeDaysMs;
      }
      return false;
    }

    if (activeFilter === 'Suggesties') {
      if (profile?.role === 'parent') return r.isSuggestion;
      return r.isSuggestion && r.suggestedBy === profile?.displayName;
    }

    if (r.isSuggestion) return false;
    if (activeFilter === 'Alles') return true;
    return r.category === activeFilter;
  });

  return (
    <div className="space-y-8">
      {/* Search & Actions */}
      <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
        <div className="flex flex-wrap gap-2 p-1.5 bg-white rounded-2xl shadow-sm border border-slate-100 w-full lg:w-auto">
          {['Alles', 'Gamen', 'Eten', 'Plezier', 'Uitje', 'Suggesties'].map(filter => (
            <button 
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all relative ${activeFilter === filter ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-slate-400 hover:text-indigo-600'}`}
            >
              {filter === 'Alles' ? t('shop.all') : filter === 'Suggesties' ? t('shop.suggestions') : filter}
              {filter === 'Suggesties' && hasSuggestions && profile?.role === 'parent' && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
              )}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="flex-1 lg:flex-none flex items-center justify-between gap-4 px-6 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
             <div className="flex items-center gap-2">
               <Coins className="text-amber-500" size={20} strokeWidth={3} />
               <span className="text-sm font-black text-slate-800 tracking-tight">{t('shop.your_balance')}</span>
             </div>
             <span className="text-lg font-black text-indigo-600 tracking-tighter">{profile?.points} XP</span>
          </div>
           {profile?.role === 'parent' ? (
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 group"
            >
              <Plus size={20} strokeWidth={3} className="group-hover:rotate-90 transition-transform" /> {t('shop.add_reward')}
            </button>
          ) : (
            mySuggestionsCount < 3 && (
              <button 
                onClick={() => { setIsAdding(true); setIsSuggesting(true); }}
                className="bg-amber-400 text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-amber-500 transition-all shadow-xl shadow-amber-100 hover:scale-105 active:scale-95 group"
              >
                <Sparkles size={20} strokeWidth={3} className="animate-pulse" /> {t('shop.make_suggestion')} ({mySuggestionsCount}/3)
              </button>
            )
          )}
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
             <div className="bg-white p-8 rounded-[3rem] border border-indigo-100 shadow-2xl mb-8 relative">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">
                  {isSuggesting ? t('shop.new_suggestion') : editingReward ? t('shop.edit_reward') : t('shop.add_new_reward')}
                </h3>
                <button onClick={() => { setIsAdding(false); setEditingReward(null); setIsSuggesting(false); resetForm(); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-all">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={addReward} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex justify-between items-center">
                      <span>Titel van de Prijs</span>
                      <span className="text-indigo-600">Icoon: {newEmoji}</span>
                    </label>
                    <div className="flex gap-2">
                      <input 
                        required
                        type="text" 
                        placeholder={isSuggesting ? "Wat zou je graag willen?" : "bijv. Extra 30 min Gamen"}
                        className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-100 focus:outline-none font-bold text-slate-800 transition-all"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                      />
                      <div className="relative group">
                        <input
                          type="text"
                          value={newEmoji}
                          onChange={(e) => {
                             const val = e.target.value;
                             if (val.length > 0) {
                                const segments = Array.from(val);
                                setNewEmoji(segments[segments.length - 1]);
                             }
                          }}
                          className="w-16 h-16 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-2xl cursor-pointer hover:border-indigo-300 text-center outline-none transition-all focus:ring-4 focus:ring-indigo-100"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">{isSuggesting ? 'Kosten Suggestie (Ouders passen dit aan)' : 'Kosten (XP)'}</label>
                    <input 
                      required
                      readOnly={isSuggesting}
                      type="number" 
                      className={`w-full p-5 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-100 focus:outline-none font-black text-amber-600 ${isSuggesting ? 'opacity-50' : ''}`}
                      value={newCost}
                      onChange={e => setNewCost(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Categorie</label>
                    <div className="flex flex-wrap gap-2">
                       {['Gamen', 'Eten', 'Plezier', 'Uitje'].map(cat => (
                         <button 
                          key={cat}
                          type="button"
                          onClick={() => setNewCategory(cat)}
                          className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${newCategory === cat ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:border-indigo-200'}`}
                         >
                           {cat}
                         </button>
                       ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Foto Toevoegen</label>
                    <div className="flex gap-2">
                       <button 
                         type="button"
                         onClick={() => setShowImageSource('camera')}
                         className={`flex-1 p-4 rounded-[1.5rem] border font-black text-[10px] uppercase tracking-widest transition-all ${showImageSource === 'camera' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-100'}`}
                       >
                          <Camera size={18} className="mx-auto mb-1" /> Open Camera / Galerij
                       </button>
                    </div>
                    {showImageSource === 'camera' && (
                       <div className="p-4 bg-indigo-50 rounded-2xl text-center border-2 border-dashed border-indigo-100 mt-2 relative">
                          <input 
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            id="reward-image-upload"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setImageUrl(reader.result as string);
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          {imageUrl && !imageUrl.startsWith('http') ? (
                            <div className="relative inline-block">
                              <img src={imageUrl} className="w-20 h-20 rounded-xl object-cover mx-auto mb-2 border-2 border-white shadow-sm" />
                              <button onClick={() => setImageUrl('')} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"><X size={12}/></button>
                            </div>
                          ) : (
                            <label htmlFor="reward-image-upload" className="cursor-pointer block">
                              <p className="text-[10px] font-black text-indigo-600 uppercase mb-2">Maak een foto of kies uit galerij</p>
                              <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase inline-block">Uploaden / Camera</div>
                            </label>
                          )}
                       </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 text-center block">Gebruikstype</label>
                    <div className="flex p-1 bg-slate-100 rounded-[1.8rem] max-w-sm mx-auto">
                        <button 
                          type="button"
                          onClick={() => setNewUsageType('always')}
                          className={`flex-1 py-3 text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest ${newUsageType === 'always' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                        >
                           Altijd
                        </button>
                        <button 
                          type="button"
                          onClick={() => setNewUsageType('once')}
                          className={`flex-1 py-3 text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest ${newUsageType === 'once' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                        >
                           Eénmalig
                        </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Beschrijving</label>
                    <textarea 
                      placeholder={isSuggesting ? "Waarom zou dit een goede beloning zijn?" : "Details over de prijs..."}
                      className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-100 focus:outline-none font-bold text-slate-800 min-h-[120px]"
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                   <button 
                    type="submit"
                    className="flex-1 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95"
                  >
                    {isSuggesting ? 'Suggestie Indien' : editingReward ? 'Sla Wijzigingen Op' : 'Prijs Toevoegen'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setIsSuggesting(false); setEditingReward(null); resetForm(); }}
                    className="px-10 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-slate-200"
                  >
                    Annuleren
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredRewards.map((reward) => {
          const IconComp = (reward.icon && ICON_MAP[reward.icon]) || Gift;
          const canAfford = (profile?.points || 0) >= reward.cost;

          return (
            <motion.div 
              layout
              key={reward.id}
              className={`group bg-white rounded-[3.5rem] border border-slate-50 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden transition-all hover:shadow-2xl hover:scale-[1.02] hover:border-indigo-100 relative ${reward.isSuggestion ? 'border-dashed border-2 border-amber-200' : ''}`}
            >
              {reward.isSuggestion && (
                <div className="absolute top-6 left-6 z-20 bg-amber-400 text-white px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg">
                  Suggestie door {reward.suggestedBy}
                </div>
              )}
              {profile?.role === 'child' && !reward.isSuggestion && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setAsTarget(reward.id); }}
                  className={`absolute top-6 left-6 z-20 p-3 rounded-2xl shadow-xl transition-all hover:scale-110 active:scale-90 ${profile.targetRewardId === reward.id ? 'bg-amber-400 text-white shadow-amber-200' : 'bg-white/90 backdrop-blur-sm text-slate-400 border border-white/50 hover:text-amber-400'}`}
                >
                  <Star size={20} fill={profile.targetRewardId === reward.id ? 'currentColor' : 'none'} strokeWidth={3} />
                </button>
              )}
              {reward.imageUrl ? (
                <div className="h-48 overflow-hidden relative">
                   <img src={reward.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={reward.title} />
                   <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg border border-white/50">
                      <span className="text-sm font-black text-indigo-600 tracking-tighter">{reward.cost} XP</span>
                   </div>
                </div>
              ) : (
                <div className="h-40 bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                   <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-indigo-600 shadow-sm relative group-hover:scale-110 transition-transform group-hover:rotate-6">
                      {reward.emoji ? (
                         <span className="text-4xl">{reward.emoji}</span>
                      ) : (
                         <IconComp size={32} strokeWidth={2.5} />
                      )}
                   </div>
                   <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg border border-white/50">
                      <span className="text-sm font-black text-indigo-600 tracking-tighter">{reward.cost} XP</span>
                   </div>
                </div>
              )}

               <div className="p-8 pb-10 flex-1 flex flex-col items-center text-center">
                <h3 className="text-xl font-black text-slate-900 tracking-tighter mb-2 group-hover:text-indigo-600 transition-colors">{reward.title}</h3>
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mb-4">Officiële Familie Prijs</p>
                
                <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8 flex-1 line-clamp-2">
                  {reward.description || 'Verzilver je hard verdiende punten voor deze geweldige familieprijs!'}
                </p>

                <div className="w-full">
                  {profile?.role === 'parent' ? (
                    <div className="flex gap-2">
                       <button 
                        onClick={() => reward.isSuggestion ? approveSuggestion(reward) : startEdit(reward)}
                        className={`flex-1 py-4 transition-colors flex items-center justify-center gap-2 rounded-2xl font-black text-xs uppercase tracking-widest ${reward.isSuggestion ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-50 text-slate-300 hover:text-indigo-600'}`}
                       >
                         {reward.isSuggestion ? <><CheckCircle size={18} /> {t('shop.approve')}</> : <><Plus size={18} className="rotate-45" /> {t('common.edit')}</>}
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteReward(reward.id);
                        }}
                        className="p-4 text-slate-300 hover:text-red-500 transition-colors flex items-center justify-center bg-slate-50 rounded-2xl font-black text-xs uppercase tracking-widest"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ) : reward.isSuggestion ? (
                    <div className="w-full py-4 text-amber-600 font-black text-xs uppercase tracking-widest bg-amber-50 rounded-2xl flex items-center justify-center gap-2">
                       <Clock size={16} /> Wacht op Ouder
                    </div>
                  ) : (
                    <button 
                      onClick={() => setClaimingReward(reward)}
                      disabled={!canAfford || reward.claimed}
                      className={`w-full py-5 rounded-[2rem] font-black text-xs uppercase tracking-[.2em] transition-all shadow-xl flex items-center justify-center gap-3 ${
                        reward.claimed 
                          ? 'bg-emerald-50 text-emerald-400 cursor-default'
                          : canAfford 
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 hover:scale-105 active:scale-95' 
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none grayscale'
                      }`}
                    >
                      {reward.claimed ? (
                        <>{t('shop.claim')}ed!</>
                      ) : canAfford ? (
                        <>{t('shop.claim')} <ChevronRight size={18} strokeWidth={3} /></>
                      ) : (
                        `${reward.cost - (profile?.points || 0)} ${t('common.xp')} needed`
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {rewards.length === 0 && !loading && (
         <div className="flex flex-col items-center justify-center text-center py-32 bg-white rounded-[4rem] border-4 border-dashed border-slate-100">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200">
               <ShoppingBag size={48} strokeWidth={1} />
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">{t('shop.empty_title')}</h3>
            <p className="text-slate-400 font-bold max-w-xs mx-auto mt-2">{t('shop.empty_desc')}</p>
         </div>
      )}

      <AnimatePresence>
        {claimingReward && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setClaimingReward(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[4rem] p-10 max-w-md w-full relative z-10 text-center shadow-2xl"
            >
              <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                <Gift size={48} />
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-4">{t('shop.confirm_claim')}</h3>
              <p className="text-slate-500 font-bold mb-10 leading-relaxed">
                {t('shop.confirm_claim_desc', { title: claimingReward.title, cost: claimingReward.cost })}
              </p>
              <div className="grid gap-4">
                <button 
                  onClick={() => buyReward(claimingReward)}
                  className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 transition-all"
                >
                  {t('shop.redeem')}
                </button>
                <button 
                  onClick={() => setClaimingReward(null)}
                  className="w-full py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


