import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { Bell, X, CheckSquare, Trophy, Star, Clock, Trash2 } from 'lucide-react';
import { AppNotification } from '../types';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface NotificationPanelProps {
  notifications: AppNotification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export function NotificationPanel({ notifications, onClose, onMarkRead, onDelete, onClearAll }: NotificationPanelProps) {
  return (
    <div className="fixed inset-0 z-[500] flex items-start justify-end sm:p-6 p-4 pointer-events-none">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto"
      />
      <motion.div 
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 100, opacity: 0 }}
        className="w-full max-w-sm bg-white rounded-[3rem] shadow-2xl relative z-10 flex flex-col max-h-[80vh] overflow-hidden pointer-events-auto mt-20 sm:mt-0"
      >
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                <Bell size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Meldingen</h3>
              {notifications.length > 0 && (
                <button 
                  onClick={onClearAll}
                  className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors"
                >
                  Alles wissen
                </button>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-10">
          <AnimatePresence mode="popLayout text-center">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <motion.div 
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, x: -100 }}
                  drag="x"
                  dragConstraints={{ left: -100, right: 100 }}
                  onDragEnd={(_, info) => {
                    if (Math.abs(info.offset.x) > 100) {
                      onDelete(notif.id);
                    }
                  }}
                  className="relative group touch-pan-y"
                >
                  {/* Swipe Actions Background */}
                  <div className="absolute inset-0 flex items-center justify-between px-6 bg-red-500 rounded-[2rem] text-white opacity-0 group-active:opacity-100 transition-opacity">
                    <Trash2 size={24} />
                    <Trash2 size={24} />
                  </div>

                  <div 
                    onClick={() => onMarkRead(notif.id)}
                    className={`p-5 rounded-[2rem] border transition-all cursor-pointer relative bg-white ${notif.read ? 'border-slate-50 opacity-60' : 'bg-white border-indigo-100 shadow-sm'}`}
                  >
                    {!notif.read && (
                      <div className="absolute top-6 right-6 w-2 h-2 bg-indigo-600 rounded-full" />
                    )}
                    <div className="flex gap-4">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${notif.message.includes('XP') ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                          {notif.message.includes('XP') ? <Trophy size={18} /> : 
                           notif.message.includes('beloning') ? <Star size={18} /> : <Clock size={18} />}
                       </div>
                       <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-800 leading-snug">{notif.message}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {notif.timestamp ? format(notif.timestamp.toMillis(), 'd MMM, HH:mm', { locale: nl }) : 'Zojuist'}
                          </p>
                       </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 text-center space-y-4"
              >
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                      <Bell size={32} />
                  </div>
                  <p className="text-slate-400 font-bold italic">Geen nieuwe meldingen</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
