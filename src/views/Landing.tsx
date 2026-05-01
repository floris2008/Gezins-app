/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAuth } from '../hooks/useAuth';
import { Sparkles, CheckCircle2, ShoppingBag, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export function Landing() {
  const { signInWithGoogle } = useAuth();

  const features = [
    {
      title: "Punten Verdienen",
      description: "Kinderen verdienen punten door hun dagelijkse taken en klusjes uit te voeren.",
      icon: Sparkles,
      color: "bg-amber-100 text-amber-600"
    },
    {
      title: "Taken Beheren",
      description: "Ouders maken taken aan en keuren ze goed. Simpel en overzichtelijk.",
      icon: CheckCircle2,
      color: "bg-emerald-100 text-emerald-600"
    },
    {
      title: "Beloningen Winkel",
      description: "Wissel gespaarde punten in voor leuke prijzen of extraatjes in de gezinsshop.",
      icon: ShoppingBag,
      color: "bg-indigo-100 text-indigo-600"
    },
    {
      title: "Gezinsveiligheid",
      description: "Beveiligd met Google Auth en strikte regels. Alleen jouw gezin heeft toegang.",
      icon: ShieldCheck,
      color: "bg-violet-100 text-violet-600"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Navbar Overlay */}
      <nav className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Sparkles className="text-white" size={20} />
          </div>
          <span className="text-xl font-black text-slate-800 tracking-tighter">FamilyChores</span>
        </div>
        <button 
          onClick={signInWithGoogle}
          className="px-6 py-2 bg-white text-slate-800 rounded-xl font-bold text-sm shadow-sm border border-slate-100 hover:shadow-md transition-all"
        >
          Inloggen
        </button>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 pt-32 pb-16 sm:pt-48 sm:pb-32">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-[0.2em] mb-8 shadow-sm border border-indigo-100">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
              </span>
              Modern Gezinsbeheer
            </div>
            
            <h1 className="text-6xl sm:text-8xl font-black text-slate-900 mb-8 tracking-tighter leading-[0.9]">
              Maak klusjes <br/> 
              <span className="bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent italic">weer leuk.</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-slate-500 mb-12 max-w-2xl mx-auto font-medium leading-relaxed">
              Het moderne platform voor gezinnen om taken te organiseren en kinderen te motiveren met een slim beloningssysteem.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={signInWithGoogle}
                className="inline-flex items-center justify-center gap-4 px-10 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-lg hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 active:scale-95 group"
              >
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                   <img src="https://www.google.com/favicon.ico" alt="Google" className="w-3.5 h-3.5" />
                </div>
                Starten met Google
              </button>
            </div>
          </motion.div>
        </div>

        {/* Floating circles background decorative */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-[10%] left-[10%] w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute top-[20%] right-[10%] w-96 h-96 bg-violet-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute top-[50%] left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="max-w-5xl mx-auto px-6 mb-24 grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-center">
            <div className="text-3xl font-black text-indigo-600 mb-1">5000+</div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Actieve Gezinnen</p>
         </div>
         <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-center">
            <div className="text-3xl font-black text-indigo-600 mb-1">1M+</div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Taken Voltooid</p>
         </div>
         <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-center">
            <div className="text-3xl font-black text-indigo-600 mb-1">4.9/5</div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gebruikersscore</p>
         </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-24 sm:py-32 bg-white rounded-t-[4rem] shadow-[0_-20px_50px_-10px_rgba(0,0,0,0.05)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
             <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Alles wat je nodig hebt.</h2>
             <p className="text-slate-500 font-medium tracking-tight">Ontworpen voor moderne ouders en hun kinderen.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {features.map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="group flex flex-col sm:flex-row items-center sm:items-start gap-8 p-10 rounded-[3rem] border border-slate-50 hover:bg-slate-50 hover:border-indigo-100 transition-all cursor-default"
              >
                <div className={`w-20 h-20 rounded-[2rem] shrink-0 flex items-center justify-center text-3xl shadow-sm ${feature.color} group-hover:scale-110 transition-transform`}>
                  <feature.icon size={32} />
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">{feature.title}</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 bg-slate-900 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-8 tracking-tight leading-tight">
            Klaar om de rust in huis <br className="hidden sm:block"/> terug te brengen?
          </h2>
          <button
            onClick={signInWithGoogle}
            className="px-12 py-5 bg-white text-slate-900 rounded-[2rem] font-black text-lg hover:shadow-2xl hover:shadow-white/20 transition-all active:scale-95"
          >
            Aan de slag — Het is gratis
          </button>
        </div>
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
           <Sparkles className="absolute top-10 left-10 text-white" size={100} />
           <ShoppingBag className="absolute bottom-10 right-10 text-white" size={80} />
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-16 bg-slate-900 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">F</div>
          <span className="text-white font-black tracking-tighter">FamilyChores</span>
        </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          © 2026 FamilyChores — Built with Love for Families.
        </p>
      </footer>
    </div>
  );
}
