/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError } from '../lib/firebase';
import { doc, setDoc, query, collection, where, getDocs, serverTimestamp, getDoc } from 'firebase/firestore';
import { UserRole, OperationType } from '../types';
import { Home, Users, ArrowRight, CheckCircle2, Sparkles, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NotificationService } from '../services/NotificationService';

export function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState<'role' | 'join_or_create' | 'creating' | 'joining'>('role');
  const [role, setRole] = useState<UserRole>('child');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let code = params.get('invite');
    
    if (!code) {
      code = localStorage.getItem('pendingInvite');
    }

    if (code) {
      setInviteCode(code.toUpperCase());
      setStep('joining');
      setRole('child'); // Default role for invitees
      localStorage.removeItem('pendingInvite');
    }
  }, []);

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateHousehold = async () => {
    if (!user || !householdName) return;
    setIsSubmitting(true);
    setError('');

    try {
      const householdId = `hh_${Date.now()}`;
      const code = generateInviteCode();
      
      // 1. Create household
      await setDoc(doc(db, 'households', householdId), {
        name: householdName,
        inviteCode: code,
        adminId: user.uid,
        createdAt: serverTimestamp()
      });

      // 2. Create user profile
      await setDoc(doc(db, 'users', user.uid), {
        displayName: user.displayName || 'Ouder',
        photoURL: user.photoURL || '',
        email: user.email,
        role: 'parent',
        points: 0,
        householdId: householdId
      });

      // Request permissions
      await NotificationService.requestPermission();

      await refreshProfile();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'households/users');
      setError('Fout bij het aanmaken van huishouden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinHousehold = async () => {
    if (!user || !inviteCode) return;
    setIsSubmitting(true);
    setError('');

    try {
      // 1. Try checking if it's a direct Household ID first
      const householdRef = doc(db, 'households', inviteCode);
      const householdSnap = await getDoc(householdRef);
      let householdId = '';

      if (householdSnap.exists()) {
        householdId = householdSnap.id;
      } else {
        // 2. If not found, try checking if it's an invite code
        const q = query(collection(db, 'households'), where('inviteCode', '==', inviteCode.toUpperCase()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          householdId = querySnapshot.docs[0].id;
        }
      }

      if (!householdId) {
        setError('Huishouden niet gevonden. Controleer de ID of code.');
        setIsSubmitting(false);
        return;
      }

      // 1. Create or update user profile
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        displayName: user.displayName || (role === 'parent' ? 'Ouder' : 'Kind'),
        photoURL: user.photoURL || '',
        email: user.email,
        role: role, 
        points: 0,
        householdId: householdId,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Request permissions
      await NotificationService.requestPermission();

      // Clear pending invite
      localStorage.removeItem('pendingInvite');

      // Force profile refresh
      await refreshProfile();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
      setError('Fout bij het joinen van huishouden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-violet-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 p-10 border border-slate-100 relative z-10 transition-all">
        <div className="flex justify-center mb-8">
           <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-indigo-200">
             <Home className="text-white" size={32} />
           </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 'role' && (
            <motion.div
              key="role"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Kies je rol.</h2>
                <p className="text-slate-500 font-medium tracking-tight">Ben je een ouder of een kind?</p>
              </div>
              
              <div className="space-y-4">
                <button
                  onClick={() => { setRole('parent'); setStep('join_or_create'); }}
                  className="w-full p-6 border-2 border-slate-50 hover:border-indigo-600 hover:bg-slate-50 rounded-[2rem] transition-all flex items-center gap-5 group text-left relative overflow-hidden"
                >
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                    <Users size={28} />
                  </div>
                  <div className="flex-1">
                    <span className="block font-black text-lg text-slate-800">Ik ben een ouder</span>
                    <span className="text-sm text-slate-500 font-medium">Beheer taken en beloningen voor je gezin.</span>
                  </div>
                  <ArrowRight size={20} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </button>

                <button
                  onClick={() => { setRole('child'); setStep('joining'); }}
                  className="w-full p-6 border-2 border-slate-50 hover:border-emerald-600 hover:bg-slate-50 rounded-[2rem] transition-all flex items-center gap-5 group text-left relative overflow-hidden"
                >
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                    <Sparkles size={28} />
                  </div>
                  <div className="flex-1">
                    <span className="block font-black text-lg text-slate-800">Ik ben een kind</span>
                    <span className="text-sm text-slate-500 font-medium">Voer taken uit en verdien punten!</span>
                  </div>
                  <ArrowRight size={20} className="text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'join_or_create' && (
            <motion.div
              key="join_or_create"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Klaar om te starten?</h2>
                <p className="text-slate-500 font-medium">Maak een nieuw gezin aan of sluit je aan bij een bestaand gezin.</p>
              </div>
              <div className="space-y-4">
                <button
                  onClick={() => setStep('creating')}
                  className="w-full p-6 bg-indigo-600 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 group"
                >
                  Nieuw Gezin Aanmaken
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => setStep('joining')}
                  className="w-full p-6 bg-slate-50 text-slate-600 rounded-[2rem] font-black hover:bg-slate-100 transition-all"
                >
                  Koppelen aan Huishouden ID
                </button>
                <div className="text-center pt-4">
                   <button
                    onClick={() => setStep('role')}
                    className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600"
                  >
                    Terug naar rollen
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'creating' && (
            <motion.div
              key="creating"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Naam van je gezin</h2>
                <p className="text-slate-500 font-medium">Hoe heet jullie gezin?</p>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Bijv. Familie de Vries</label>
                  <input
                    type="text"
                    placeholder="Gezinsnaam"
                    value={householdName}
                    onChange={(e) => setHouseholdName(e.target.value)}
                    className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[2rem] focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all font-bold text-slate-800"
                  />
                </div>
                <button
                  disabled={!householdName || isSubmitting}
                  onClick={handleCreateHousehold}
                  className="w-full p-6 bg-indigo-600 text-white rounded-[2rem] font-black text-lg disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  {isSubmitting ? 'Bezig met maken...' : 'Huishouden Aanmaken'}
                  {!isSubmitting && <CheckCircle2 size={24} />}
                </button>
                <div className="text-center">
                  <button
                    onClick={() => setStep('join_or_create')}
                    className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600"
                  >
                    Vorige stap
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'joining' && (
            <motion.div
              key="joining"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Koppel aan gezin.</h2>
                <p className="text-slate-500 font-medium">Voer de Huishouden ID of Uitnodigingscode in.</p>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 text-center block">ID of Code</label>
                  <input
                    type="text"
                    placeholder="ID / CODE"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 focus:outline-none transition-all text-center text-3xl font-black tracking-[0.1em] text-indigo-900"
                  />
                </div>
                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-xs text-center font-bold uppercase tracking-tight">
                    {error}
                  </motion.p>
                )}
                <button
                  disabled={!inviteCode || isSubmitting}
                  onClick={handleJoinHousehold}
                  className="w-full p-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-lg disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  {isSubmitting ? 'Bezig met checken...' : 'Koppelen'}
                  {!isSubmitting && <CheckCircle2 size={24} />}
                </button>
                <div className="text-center">
                  <button
                    onClick={() => setStep(role === 'parent' ? 'join_or_create' : 'role')}
                    className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600"
                  >
                    Terug
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="mt-12 flex items-center gap-3 opacity-30 grayscale">
         <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">F</div>
         <span className="text-slate-900 font-black tracking-tighter">FamilyChores</span>
      </div>
    </div>
  );
}
