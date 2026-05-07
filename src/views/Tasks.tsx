/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, increment } from 'firebase/firestore';
import { Task, OperationType } from '../types';
import { 
  Plus, 
  CheckSquare, 
  Clock, 
  Trash2, 
  X, 
  Info, 
  CheckCircle,
  Image as ImageIcon,
  Camera,
  Star,
  Users as UsersIcon,
  Award,
  ChevronRight,
  Gamepad,
  Bed,
  Utensils,
  Book,
  Dog,
  Gamepad2,
  Tv,
  Smile,
  Sparkles,
  ShoppingBag,
  Wrench,
  Car,
  Wind
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TASK_ICONS } from '../constants';
import { TaskDetailModal } from '../components/TaskDetailModal';

const ICON_MAP: Record<string, any> = {
  'utensils': Utensils,
  'bed': Bed,
  'book': Book,
  'dog': Dog,
  'trash-2': Trash2,
  'broom': Wind,
  'gamepad-2': Gamepad2,
  'tv': Tv,
  'smile': Smile,
  'sparkles': Sparkles,
  'shopping-bag': ShoppingBag,
  'wrench': Wrench,
  'car': Car,
};

import { useTranslation } from '../i18n/LanguageContext';

export function Tasks() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [recyclingTask, setRecyclingTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');
  const [concurrencyError, setConcurrencyError] = useState<{ currentTask: Task, nextTask: Task } | null>(null);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newEmoji, setNewEmoji] = useState('🎮');
  const [newPoints, setNewPoints] = useState(25);
  const [newType, setNewType] = useState<'individual' | 'first_come'>('first_come');
  const [newDistributionType, setNewDistributionType] = useState<'first_to_finish' | 'everyone_must'>('first_to_finish');
  const [newRequiresProof, setNewRequiresProof] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('sparkles');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageSource, setShowImageSource] = useState<'upload' | 'camera' | null>(null);

  // Detail modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Proof submission state
  const [proofUrl, setProofUrl] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (!profile?.householdId) return;

    const q = query(collection(db, 'tasks'), where('householdId', '==', profile.householdId));
    const unsubByHousehold = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'tasks');
    });

    const qMembers = query(collection(db, 'users'), where('householdId', '==', profile.householdId));
    const unsubMembers = onSnapshot(qMembers, (snap) => {
       setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubByHousehold();
      unsubMembers();
    };
  }, [profile]);

  const [assignedTo, setAssignedTo] = useState<string>('');

  const addTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile?.householdId) return;
    
    try {
      const taskData = {
        title: newTitle,
        emoji: newEmoji,
        description: newDesc,
        points: Number(newPoints),
        type: newType,
        distributionType: newType === 'first_come' ? newDistributionType : null,
        assignedTo: newType === 'individual' ? assignedTo : null,
        requiresProof: newRequiresProof,
        householdId: profile.householdId,
        status: editingTask ? editingTask.status : 'active',
        icon: selectedIcon,
        imageUrl: imageUrl || null,
        updatedAt: serverTimestamp(),
        completedByList: editingTask ? (editingTask.completedByList || []) : []
      };

      if (editingTask?.id) {
        await updateDoc(doc(db, 'tasks', editingTask.id), taskData);
      } else {
        await addDoc(collection(db, 'tasks'), taskData);
      }
      
      setIsAdding(false);
      setEditingTask(null);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'tasks');
    }
  };

  const resetForm = () => {
    setNewTitle('');
    setNewEmoji('🎮');
    setNewPoints(25);
    setNewDesc('');
    setImageUrl('');
    setSelectedIcon('sparkles');
    setNewRequiresProof(false);
    setShowImageSource(null);
    setAssignedTo('');
  };

  const startEdit = (task: Task) => {
    setEditingTask(task);
    setNewTitle(task.title);
    setNewEmoji(task.emoji || '🎮');
    setNewPoints(task.points);
    setNewType(task.type);
    setNewDistributionType(task.distributionType || 'first_to_finish');
    setAssignedTo(task.assignedTo || '');
    setNewRequiresProof(task.requiresProof || false);
    setNewDesc(task.description || '');
    setImageUrl(task.imageUrl || '');
    setSelectedIcon(task.icon || 'sparkles');
    setIsAdding(true);
  };

  const submitTask = async (task: Task, proofUrl: string) => {
    if (profile?.role !== 'child') return;

    try {
      if (task.distributionType === 'everyone_must') {
        const alreadyDone = task.completedByList?.includes(profile.id);
        if (alreadyDone) return;
        
        await updateDoc(doc(db, 'tasks', task.id), {
          completedByList: [...(task.completedByList || []), profile.id],
          status: 'active', // Reset to active so others can see it
          claimedBy: null,  // Clear claim
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, 'tasks', task.id), {
          status: 'pending',
          completedBy: profile.id,
          claimedBy: null, // Clear claim
          proofUrl: proofUrl || null,
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
      setSubmittingTaskId(null);
      setProofUrl('');
      setIsCapturing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

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
        const otherParents = members.filter(m => m.role === 'parent' && m.id !== profile.id);
        const child = members.find(m => m.id === task.completedBy);
        for (const p of otherParents) {
          await addDoc(collection(db, 'notifications'), {
            userId: p.id,
            householdId: profile.householdId,
            message: `📢 Quest "${task.title}" van ${child?.displayName} is goedgekeurd door ${profile.displayName}.`,
            read: false,
            timestamp: serverTimestamp()
          });
        }
      }

      // 4. Show recycling choice modal
      setRecyclingTask(task);
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

  const deleteTask = async (id: string) => {
    if (profile?.role !== 'parent') return;
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tasks/${id}`);
    }
  };

  const startTask = async (task: Task) => {
    if (profile?.role !== 'child') return;
    
    // Check for concurrency
    const currentActive = tasks.find(t => t.status === 'in_progress' && t.claimedBy === profile.id);
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

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const tasksToDisplay = activeTab === 'all' 
    ? tasks.filter(t => {
        if (profile?.role === 'parent') return t.status !== 'completed';
        // Children see:
        // 1. Active tasks (not claimed by anyone)
        // 2. Tasks claimed by THEMSELVES (in_progress)
        // 3. Pending tasks (waiting for approval)
        return t.status === 'active' || 
               (t.status === 'in_progress' && t.claimedBy === profile?.id) || 
               (t.status === 'pending' && t.completedBy === profile?.id) ||
               (t.distributionType === 'everyone_must' && !t.completedByList?.includes(profile?.id || ''));
      })
    : tasks.filter(t => (t.status === 'in_progress' && t.claimedBy === profile?.id) || (t.status === 'pending' && t.completedBy === profile?.id));

  return (
    <div className="space-y-8">
      {/* Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex gap-2 p-1.5 bg-white rounded-2xl shadow-sm border border-slate-100">
          <button 
            onClick={() => setActiveTab('all')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-indigo-600 shadow-md shadow-indigo-100 text-white' : 'text-slate-400 hover:text-indigo-600'}`}
          >
            {t('quests.all')}
          </button>
          <button 
            onClick={() => setActiveTab('mine')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'mine' ? 'bg-indigo-600 shadow-md shadow-indigo-100 text-white' : 'text-slate-400 hover:text-indigo-600'}`}
          >
            {t('quests.mine')}
          </button>
        </div>
        {profile?.role === 'parent' && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 group"
          >
            <Plus size={20} strokeWidth={3} className="group-hover:rotate-90 transition-transform" /> 
            {t('quests.add_quest')}
          </button>
        )}
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
                  {editingTask ? t('quests.edit_quest') : t('quests.create_quest')}
                </h3>
                <button onClick={() => { setIsAdding(false); setEditingTask(null); resetForm(); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-all">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={addTask} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex justify-between items-center">
                      <span>Titel van de Taak</span>
                      <span className="text-indigo-600">Icoon: {newEmoji}</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-100 focus:outline-none font-bold text-slate-800 transition-all"
                        placeholder="bijv. De garage opruimen"
                      />
                      <div className="relative group">
                        <input
                          type="text"
                          value={newEmoji}
                          onChange={(e) => {
                             // Only take the last character/emoji
                             const val = e.target.value;
                             if (val.length > 0) {
                                // Try to get the last emoji-like sequence
                                const segments = Array.from(val);
                                setNewEmoji(segments[segments.length - 1]);
                             }
                          }}
                          className="w-16 h-16 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-2xl cursor-pointer hover:border-indigo-300 text-center outline-none transition-all focus:ring-4 focus:ring-indigo-100"
                          title="Typ of plak een emoji"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Beloning (XP)</label>
                    <div className="relative">
                      <input
                        required
                        type="number"
                        value={newPoints}
                        onChange={e => setNewPoints(Number(e.target.value))}
                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-100 focus:outline-none font-black text-indigo-600 pl-14 transition-all"
                      />
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-400 font-black">XP</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4 flex flex-col justify-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Foto Toevoegen</label>
                    <div className="flex gap-2">
                       <button 
                         type="button"
                         onClick={() => setShowImageSource('upload')}
                         className={`flex-1 p-4 rounded-[1.5rem] border font-black text-[10px] uppercase tracking-widest transition-all ${showImageSource === 'upload' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-100'}`}
                       >
                          <ImageIcon size={18} className="mx-auto mb-1" /> Galerij
                       </button>
                       <button 
                         type="button"
                         onClick={() => setShowImageSource('camera')}
                         className={`flex-1 p-4 rounded-[1.5rem] border font-black text-[10px] uppercase tracking-widest transition-all ${showImageSource === 'camera' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-100'}`}
                       >
                          <Camera size={18} className="mx-auto mb-1" /> Camera
                       </button>
                    </div>
                    {(showImageSource === 'upload' || showImageSource === 'camera') && (
                       <div className="p-4 bg-indigo-50 rounded-2xl text-center border-2 border-dashed border-indigo-100 mt-2 relative">
                          <input 
                            type="file"
                            accept="image/*"
                            capture={showImageSource === 'camera' ? 'environment' : undefined}
                            className="hidden"
                            id="quest-image-upload"
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
                              <button onClick={() => { setImageUrl(''); setShowImageSource(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"><X size={12}/></button>
                            </div>
                          ) : (
                            <label htmlFor="quest-image-upload" className="cursor-pointer block">
                              <p className="text-[10px] font-black text-indigo-600 uppercase mb-2">
                                {showImageSource === 'camera' ? 'Maak een foto' : 'Kies uit galerij'}
                              </p>
                              <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase inline-block">
                                {showImageSource === 'camera' ? 'Camera Openen' : 'Uploaden'}
                              </div>
                            </label>
                          )}
                       </div>
                    )}
                  </div>
                  <div className="space-y-4 flex flex-col justify-center">
                    <label className="flex items-center gap-3 cursor-pointer group">
                       <div className={`w-12 h-6 rounded-full transition-all relative ${newRequiresProof ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                          <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={newRequiresProof} 
                            onChange={(e) => setNewRequiresProof(e.target.checked)} 
                          />
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newRequiresProof ? 'left-7' : 'left-1'}`}></div>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Foto Bewijs Verplicht</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Alleen via camera op moment van voltooien</p>
                       </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Instructies</label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-100 focus:outline-none font-bold text-slate-800 min-h-[100px] transition-all"
                    placeholder="Details over de quest..."
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-50">
                   <div className="flex flex-col sm:flex-row gap-4 items-center">
                      <div className="w-full sm:w-auto flex-1 p-2 bg-slate-100 rounded-[2rem] flex">
                          <button 
                            type="button"
                            onClick={() => setNewType('first_come')}
                            className={`flex-1 py-4 px-6 text-[10px] font-black rounded-3xl transition-all uppercase tracking-widest ${newType === 'first_come' ? 'bg-white text-slate-800 shadow-md' : 'text-slate-400 hover:text-slate-500'}`}
                          >
                            Iedereen
                          </button>
                          <button 
                            type="button"
                            onClick={() => setNewType('individual')}
                            className={`flex-1 py-4 px-6 text-[10px] font-black rounded-3xl transition-all uppercase tracking-widest ${newType === 'individual' ? 'bg-white text-slate-800 shadow-md' : 'text-slate-400 hover:text-slate-500'}`}
                          >
                            Individueel
                          </button>
                      </div>
                      <button
                        type="submit"
                        className="w-full sm:w-auto px-12 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95"
                      >
                        {editingTask ? 'Opslaan' : 'Quest Plaatsen'}
                      </button>
                   </div>

                   {newType === 'first_come' && (
                     <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-1 px-1 bg-slate-100 rounded-[2rem] flex max-w-lg mx-auto"
                     >
                        <button 
                          type="button"
                          onClick={() => setNewDistributionType('first_to_finish')}
                          className={`flex-1 py-3 text-[9px] font-black rounded-3xl transition-all uppercase tracking-[0.15em] px-4 ${newDistributionType === 'first_to_finish' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                        >
                           Eerste krijgt de XP
                        </button>
                        <button 
                          type="button"
                          onClick={() => setNewDistributionType('everyone_must')}
                          className={`flex-1 py-3 text-[9px] font-black rounded-3xl transition-all uppercase tracking-[0.15em] px-4 ${newDistributionType === 'everyone_must' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                        >
                           Iedereen moet het doen
                        </button>
                      </motion.div>
                   )}

                   {newType === 'individual' && (
                     <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                     >
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Wijs toe aan:</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                           {members.filter(m => m.id !== profile?.id).map(m => (
                             <button 
                              key={m.id}
                              type="button"
                              onClick={() => setAssignedTo(assignedTo === m.id ? '' : m.id)}
                              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${assignedTo === m.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:border-indigo-200'}`}
                             >
                               {m.photoURL ? (
                                 <img src={m.photoURL} className="w-5 h-5 rounded-full object-cover" />
                               ) : (
                                 <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[8px]">{m.displayName.charAt(0)}</div>
                               )}
                               {m.displayName}
                             </button>
                           ))}
                        </div>
                     </motion.div>
                   )}
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tasksToDisplay.length === 0 && !loading && (
          <div className="col-span-full py-24 bg-white rounded-[4rem] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
             <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200">
                <CheckSquare size={48} strokeWidth={1} />
             </div>
             <h3 className="text-xl font-black text-slate-800 tracking-tight">Geen Quests</h3>
             <p className="text-slate-400 font-bold max-w-xs mx-auto mt-2">
               {activeTab === 'all' ? 'Er zijn momenteel geen quests beschikbaar.' : 'Je bent momenteel niet bezig met een quest.'}
             </p>
          </div>
        )}

        {tasksToDisplay.map((task) => {
          const IconComp = (task.icon && ICON_MAP[task.icon]) || Sparkles;
          const isEveryoneMust = task.distributionType === 'everyone_must';
          const alreadyDoneByMe = task.completedByList?.includes(profile?.id || '');
          const isInProgressByMe = task.status === 'in_progress' && task.claimedBy === profile?.id;
          const isPendingByMe = task.status === 'pending' && task.completedBy === profile?.id;

          return (
            <motion.div
              layout
              key={task.id}
              onClick={() => setSelectedTask(task)}
              className={`group bg-white rounded-[3rem] border border-slate-50 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden transition-all hover:shadow-2xl hover:scale-[1.02] hover:border-indigo-100 cursor-pointer ${alreadyDoneByMe || isPendingByMe ? 'opacity-70' : ''} ${isInProgressByMe ? 'ring-4 ring-indigo-100 border-indigo-200 shadow-indigo-100' : ''}`}
            >
              {task.imageUrl && (
                <div className="h-40 overflow-hidden relative">
                   <img src={task.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={task.title} referrerPolicy="no-referrer" />
                   <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent transition-opacity group-hover:opacity-40"></div>
                </div>
              )}
              
              <div className="p-8 pt-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div className={`w-14 h-14 rounded-3xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-6 ${task.type === 'first_come' ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-amber-400 text-white shadow-amber-100'}`}>
                    {task.emoji ? (
                      <span className="text-3xl">{task.emoji}</span>
                    ) : (
                      <IconComp size={28} strokeWidth={2.5} />
                    )}
                  </div>
                  <div className="bg-amber-100 px-4 py-2 rounded-2xl text-center shadow-inner">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-tighter leading-none mb-1">XP</p>
                    <p className="text-base font-black text-amber-700 leading-none">+{task.points}</p>
                  </div>
                </div>

                <h4 className="text-xl font-black text-slate-900 tracking-tighter mb-1 group-hover:text-indigo-600 transition-colors leading-tight">{task.title}</h4>
                <div className="flex flex-wrap gap-2 mb-4">
                   <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[9px] font-black rounded-full uppercase tracking-widest">
                      {task.type === 'individual' ? 'Individueel' : 'Gezins Quest'}
                   </span>
                   {task.distributionType === 'everyone_must' && (
                     <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-full uppercase tracking-widest">
                        Iedereen verplicht
                     </span>
                   )}
                   {task.requiresProof && (
                     <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[9px] font-black rounded-full uppercase tracking-widest flex items-center gap-1">
                        <Camera size={10} /> Foto Bewijs
                     </span>
                   )}
                </div>

                <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8 flex-1 line-clamp-3">
                  {task.description || 'Voltooi deze quest om XP te verdienen en help het gezin samen te groeien!'}
                </p>

                <div className="flex items-center justify-between pt-6 border-t border-slate-50 mt-auto">
                   {profile?.role === 'child' ? (
                     submittingTaskId === task.id ? (
                       <div className="flex flex-col gap-3 w-full">
                           {task.requiresProof ? (
                              <div className="space-y-4">
                                {isCapturing ? (
                                   <div className="p-10 bg-indigo-50 rounded-3xl border-4 border-dashed border-indigo-200 text-center relative overflow-hidden group">
                                      <div className="animate-pulse bg-white/30 absolute inset-0 group-hover:hidden"></div>
                                      <Camera className="mx-auto mb-4 text-indigo-400 group-hover:scale-110 transition-transform" size={48} />
                                      <p className="text-xs font-black text-indigo-600 uppercase tracking-widest relative z-10 mb-6">Maak een foto van je werk! 📸</p>
                                      
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        capture="environment"
                                        className="hidden" 
                                        id={`camera-input-${task.id}`}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                              setProofUrl(reader.result as string);
                                              setIsCapturing(false);
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                      />
                                      <label 
                                        htmlFor={`camera-input-${task.id}`}
                                        className="inline-block px-10 py-5 bg-indigo-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest relative z-10 cursor-pointer shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
                                      >
                                         Open Camera
                                      </label>
                                   </div>
                                 ) : proofUrl ? (
                                   <div className="aspect-video rounded-2xl overflow-hidden relative border-2 border-emerald-400">
                                      <img src={proofUrl} className="w-full h-full object-cover" alt="Proof" />
                                      <button 
                                        onClick={() => setProofUrl('')}
                                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
                                      >
                                         <X size={16} />
                                      </button>
                                   </div>
                                ) : (
                                   <button 
                                     onClick={() => setIsCapturing(true)}
                                     className="w-full p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center gap-2 hover:bg-slate-100 transition-colors"
                                   >
                                      <Camera className="text-slate-300" size={32} />
                                      <span className="text-[10px] font-black text-slate-400 uppercase">Start Camera</span>
                                   </button>
                                )}
                             </div>
                          ) : null}
                          
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setSubmittingTaskId(null);
                                setProofUrl('');
                                setIsCapturing(false);
                              }}
                              className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-xl font-black text-xs uppercase"
                            >
                              Annuleren
                            </button>
                            <button 
                              onClick={() => submitTask(task, proofUrl)}
                              disabled={task.requiresProof && !proofUrl}
                              className={`flex-1 py-4 rounded-xl font-black text-xs uppercase shadow-lg transition-all ${task.requiresProof && !proofUrl ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 text-white shadow-emerald-100 active:scale-95'}`}
                            >
                               {isEveryoneMust ? 'Gedaan!' : 'Eindigen!'}
                            </button>
                          </div>
                       </div>
                     ) : (
                       <button
                         onClick={() => {
                           if (alreadyDoneByMe) return;
                           setSubmittingTaskId(task.id);
                         }}
                         disabled={alreadyDoneByMe}
                         className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center gap-2 ${
                            alreadyDoneByMe 
                            ? 'bg-emerald-100 text-emerald-600 shadow-none cursor-default' 
                            : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
                         }`}
                       >
                         {alreadyDoneByMe ? (
                            <><CheckCircle size={16} strokeWidth={3} /> Reeds Voltooid</>
                         ) : (
                            <>Voltooien <ChevronRight size={16} strokeWidth={3} /></>
                         )}
                       </button>
                     )
                   ) : (
                     <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(task);
                          }}
                          className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all flex items-center gap-1"
                        >
                          <Plus size={20} className="rotate-45" />
                          <span className="text-[10px] font-black uppercase">Pas aan</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTask(task.id);
                          }}
                          className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                        >
                          <Trash2 size={24} />
                        </button>
                     </div>
                   )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {concurrencyError && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConcurrencyError(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white rounded-[4rem] p-10 max-w-md w-full relative z-10 text-center shadow-2xl">
              <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8">
                <AlertCircle size={48} className="text-amber-500" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-4">Oeps! Je bent al bezig...</h3>
              <p className="text-slate-500 font-bold mb-10 leading-relaxed">
                Je bent momenteel bezig met <b>"{concurrencyError.currentTask.title}"</b>. Je kunt maar met één quest tegelijk bezig zijn!
              </p>
              <div className="grid gap-4">
                <button onClick={() => { setSelectedTask(concurrencyError.currentTask); setConcurrencyError(null); }} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 transition-all">
                  Ga verder met huidige quest
                </button>
                <button onClick={() => cancelTask(concurrencyError.currentTask.id)} className="w-full py-5 bg-red-50 text-red-500 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-red-100 transition-all">
                  Stop met huidige quest
                </button>
                <button onClick={() => setConcurrencyError(null)} className="w-full py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all">
                  Kies een andere keer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                XP is uitgedeeld. Wat wilt u met de quest <b>"{recyclingTask.title}"</b> doen?
              </p>
              <div className="grid gap-4">
                <button 
                  onClick={() => handleRecycle(recyclingTask.id, 'keep')}
                  className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 transition-all"
                >
                  Opnieuw Plaatsen
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

      <AnimatePresence>
        {selectedTask && (
          <TaskDetailModal 
            task={selectedTask}
            onClose={() => {
              setSelectedTask(null);
              setSubmittingTaskId(null);
            }}
            profile={profile}
            members={members}
            onStartEdit={(task) => {
              setSelectedTask(null);
              startEdit(task);
            }}
            onDelete={(id) => {
              setSelectedTask(null);
              deleteTask(id);
            }}
            onApprove={handleApprove}
            onReject={async (task) => {
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
                  console.error(err);
                }
            }}
            onComplete={(task, proofUrl) => {
              submitTask(task, proofUrl);
            }}
            onStart={startTask}
          />
        )}
      </AnimatePresence>

      {/* Review Section for Parents */}
      {profile?.role === 'parent' && pendingTasks.length > 0 && (
        <section className="space-y-6 pt-12 border-t border-slate-200">
           <h2 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
             <Clock className="text-amber-500" size={28} strokeWidth={3} /> Goedkeuring Vereist
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingTasks.map(task => (
                 <div 
                   key={task.id} 
                   onClick={() => setSelectedTask(task)}
                   className="bg-white p-6 rounded-3xl border border-amber-100 flex flex-col gap-4 shadow-sm hover:border-indigo-200 cursor-pointer transition-all hover:scale-[1.01]"
                 >
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 italic font-black">
                           {task.title.charAt(0)}
                        </div>
                        <div>
                           <h4 className="font-black text-slate-900 leading-tight">{task.title}</h4>
                           <p className="text-[10px] font-black text-slate-400 uppercase">Wacht op goedkeuring</p>
                        </div>
                     </div>
                     <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black">+{task.points} XP</span>
                   </div>
                       <div className="flex flex-col gap-3">
                          {task.proofUrl && (
                            <div className="text-indigo-600 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 bg-indigo-50 p-3 rounded-2xl border border-indigo-100">
                               <ImageIcon size={14} /> Heeft Bewijs
                            </div>
                          )}
                          <button 
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100"
                          >
                             Bekijk & Keur Goed
                          </button>
                       </div>
                 </div>
              ))}
           </div>
        </section>
      )}
    </div>
  );
}

const AlertCircle = ({ size, className }: { size: number, className: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

