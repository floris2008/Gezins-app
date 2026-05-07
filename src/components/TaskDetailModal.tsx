import { useState } from 'react';
import { X, Camera, Wrench, Trash2, Star, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Task, UserProfile } from '../types';

interface TaskDetailModalProps {
  task: Task | null;
  onClose: () => void;
  profile: UserProfile | null;
  members: UserProfile[];
  onStartEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  onComplete?: (task: Task, proofUrl: string) => void;
  onApprove?: (task: Task) => void;
  onReject?: (task: Task) => void;
  onStart?: (task: Task) => void;
  initialSubmitting?: boolean;
}

import { useTranslation } from '../i18n/LanguageContext';

export function TaskDetailModal({ task, onClose, profile, members, onStartEdit, onDelete, onComplete, onApprove, onReject, onStart, initialSubmitting = false }: TaskDetailModalProps) {
  const [submitting, setSubmitting] = useState(initialSubmitting);
  const { t } = useTranslation();
  const [proofUrl, setProofUrl] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [confirmingApproval, setConfirmingApproval] = useState(false);

  if (!task) return null;

  const isParent = profile?.role === 'parent';
  const isChild = profile?.role === 'child';
  const alreadyDoneByMe = task.completedByList?.includes(profile?.id || '');
  const isPending = task.status === 'pending' && task.completedBy === profile?.id;
  const isInProgress = task.status === 'in_progress' && task.claimedBy === profile?.id;

  const handleComplete = () => {
    if (onComplete) {
      onComplete(task, proofUrl);
      onClose();
    }
  };

  const handleStart = () => {
    if (onStart) {
      onStart(task);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[3.5rem] w-full max-w-2xl overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh]"
      >
        <div className="overflow-y-auto p-8 sm:p-12 no-scrollbar">
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all z-20"
          >
            <X size={24} />
          </button>

          <div className="flex flex-col gap-8">
            {task.imageUrl && (
              <div className="w-full aspect-video rounded-[2.5rem] overflow-hidden shadow-xl mb-4">
                <img src={task.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}

            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex gap-4 items-center flex-1">
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center text-3xl sm:text-4xl shadow-xl shrink-0 ${task.type === 'first_come' ? 'bg-indigo-600 text-white' : 'bg-amber-400 text-white'}`}>
                    {task.emoji || '✨'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter leading-tight break-words">{task.title}</h3>
                    <div className="flex gap-2 mt-1 sm:mt-2">
                       <span className="px-3 py-0.5 sm:py-1 bg-slate-100 text-slate-500 text-[8px] sm:text-[10px] font-black rounded-full uppercase tracking-widest">
                          {task.type === 'individual' ? 'Individueel' : 'Gezins Quest'}
                       </span>
                       {task.requiresProof && (
                         <span className="px-3 py-0.5 sm:py-1 bg-amber-50 text-amber-600 text-[8px] sm:text-[10px] font-black rounded-full uppercase tracking-widest flex items-center gap-1">
                            <Camera size={10} /> Foto Bewijs
                         </span>
                       )}
                    </div>
                  </div>
                </div>
                <div className="bg-amber-100 px-4 sm:px-6 py-2 sm:py-3 rounded-2xl sm:rounded-3xl text-center shadow-inner self-end sm:self-start shrink-0">
                  <p className="text-[10px] sm:text-[12px] font-black text-amber-700 uppercase tracking-widest leading-none mb-1">XP</p>
                  <p className="text-xl sm:text-2xl font-black text-amber-700 leading-none">+{task.points}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Instructies</p>
                <p className="text-slate-700 font-bold leading-relaxed text-lg">
                  {task.description || 'Geen extra instructies opgegeven.'}
                </p>
              </div>

              {task.type === 'individual' && task.assignedTo && (
                 <div className="flex items-center gap-3 p-6 bg-amber-50 rounded-3xl border border-amber-100">
                    <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-700">
                       <Star size={20} />
                    </div>
                    <p className="text-sm font-black text-amber-800 uppercase tracking-widest">
                       Toegewezen aan: {members.find(m => m.id === task.assignedTo)?.displayName || 'Onbekend'}
                    </p>
                 </div>
              )}

                  <div className="pt-8 border-t border-slate-100">
                     {isChild ? (
                        submitting || isInProgress ? (
                          <div className="space-y-6">
                             {task.requiresProof ? (
                                <div className="space-y-4">
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">{t('quests.proof_required')}</p>
                                   {isCapturing ? (
                                      <div className="p-12 bg-indigo-50 rounded-[3rem] border-4 border-dashed border-indigo-200 text-center relative overflow-hidden">
                                         <input 
                                            type="file" 
                                            accept="image/*" 
                                            capture="environment"
                                            className="hidden" 
                                            id="modal-camera-input"
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
                                         <label htmlFor="modal-camera-input" className="cursor-pointer">
                                            <Camera className="mx-auto mb-4 text-indigo-400" size={56} />
                                            <p className="text-sm font-black text-indigo-600 uppercase tracking-widest">{t('quests.open_camera')}</p>
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1 opacity-80">Alleen foto via Camera toegestaan</p>
                                         </label>
                                      </div>
                                   ) : proofUrl ? (
                                      <div className="aspect-video rounded-[3rem] overflow-hidden relative shadow-2xl">
                                         <img src={proofUrl} className="w-full h-full object-cover" />
                                         <button 
                                            onClick={() => setProofUrl('')}
                                            className="absolute top-4 right-4 bg-white text-red-500 p-3 rounded-2xl shadow-xl"
                                         >
                                            <X size={20} />
                                         </button>
                                      </div>
                                   ) : (
                                      <button 
                                         onClick={() => setIsCapturing(true)}
                                         className="w-full p-12 bg-slate-50 border-4 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center gap-4 hover:bg-slate-100 transition-all hover:border-indigo-300"
                                      >
                                         <Camera className="text-slate-300" size={48} />
                                         <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('quests.start_photo')}</span>
                                      </button>
                                   )}
                                </div>
                             ) : (
                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                                   <p className="text-slate-500 font-bold mb-4">Klaar om de {t('common.xp')} te claimen?</p>
                                </div>
                             )}

                             <div className="flex gap-4">
                                <button 
                                   onClick={() => { setSubmitting(false); setProofUrl(''); setIsCapturing(false); }}
                                   className="flex-1 py-6 bg-slate-100 text-slate-500 rounded-[2.5rem] font-black text-sm uppercase tracking-widest hover:bg-slate-200"
                                >
                                   {t('common.cancel')}
                                </button>
                                <button 
                                   onClick={handleComplete}
                                   disabled={task.requiresProof && !proofUrl}
                                   className="flex-1 py-6 bg-emerald-500 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-100 disabled:opacity-50"
                                >
                                   {t('quests.complete')}
                                </button>
                             </div>
                          </div>
                        ) : isPending ? (
                          <div className="p-10 bg-amber-50 rounded-[3.5rem] border border-amber-100 text-center">
                             <CheckCircle2 size={48} className="mx-auto mb-4 text-amber-500" />
                             <h4 className="text-xl font-black text-amber-900 mb-2">{t('quests.pending')}</h4>
                             <p className="text-sm font-bold text-amber-700">{t('quests.pending_desc')}</p>
                             <button onClick={onClose} className="mt-8 w-full py-4 bg-amber-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest">Begrepen</button>
                          </div>
                        ) : (
                          <button 
                             onClick={handleStart}
                             disabled={alreadyDoneByMe}
                             className={`w-full py-6 rounded-[2.5rem] font-black text-lg uppercase tracking-widest shadow-2xl transition-all ${
                                alreadyDoneByMe 
                                ? 'bg-emerald-100 text-emerald-600 shadow-none' 
                                : 'bg-indigo-600 text-white shadow-indigo-100 hover:scale-[1.02] active:scale-95'
                             }`}
                          >
                             {alreadyDoneByMe ? 'Al Voltooid!' : t('quests.start')}
                          </button>
                        )
                     ) : isParent && (
                    <div className="flex flex-col gap-4 w-full">
                       {task.status === 'pending' && (
                          <div className="w-full">
                             {confirmingApproval ? (
                                <motion.div 
                                   initial={{ opacity: 0, scale: 0.9 }}
                                   animate={{ opacity: 1, scale: 1 }}
                                   className="bg-emerald-50 p-6 sm:p-8 rounded-[2.5rem] border border-emerald-100 text-center space-y-4 sm:space-y-6"
                                >
                                   <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                                      <CheckCircle2 size={24} />
                                   </div>
                                   <div className="space-y-1 sm:space-y-2">
                                      <h4 className="text-lg sm:text-xl font-black text-emerald-900 leading-tight">Quest Goedkeuren?</h4>
                                      <p className="text-xs sm:text-sm font-bold text-emerald-700 leading-relaxed px-4">
                                         Weet je zeker dat je <b>"{task.title}"</b> wilt goedkeuren?
                                      </p>
                                   </div>
                                   <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                      <button 
                                         onClick={() => setConfirmingApproval(false)}
                                         className="flex-1 py-4 bg-white text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest border border-emerald-100 order-2 sm:order-1"
                                      >
                                         Annuleren
                                      </button>
                                      <button 
                                         onClick={() => onApprove?.(task)}
                                         className="flex-1 sm:flex-2 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 order-1 sm:order-2"
                                      >
                                         Ja, Goedkeuren
                                      </button>
                                   </div>
                                </motion.div>
                             ) : (
                                <div className="flex gap-4 w-full mb-4">
                                   <button 
                                      onClick={() => setConfirmingApproval(true)}
                                      className="flex-1 py-6 bg-emerald-500 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                                   >
                                      <CheckCircle2 size={20} /> Goedkeuren
                                   </button>
                                   <button 
                                      onClick={() => onReject?.(task)}
                                      className="flex-1 py-6 bg-amber-500 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-amber-100 hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
                                   >
                                      <X size={20} /> Afwijzen
                                   </button>
                                </div>
                             )}
                          </div>
                       )}
                       {!confirmingApproval && (
                          <div className="flex gap-4 w-full">
                             <button 
                                onClick={() => onStartEdit?.(task)}
                                className="flex-1 py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-indigo-700 transition-all"
                             >
                                <Wrench size={20} /> {task.status === 'pending' ? 'Bewerken' : 'Pas Aan'}
                             </button>
                             <button 
                                onClick={() => onDelete?.(task.id)}
                                className="px-10 py-6 bg-red-50 text-red-500 rounded-[2.5rem] font-black text-sm uppercase tracking-widest hover:bg-red-100 transition-all"
                             >
                                <Trash2 size={24} />
                             </button>
                          </div>
                       )}
                    </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
