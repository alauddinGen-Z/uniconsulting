"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { ArrowRight, GraduationCap, Users, Upload, Brain, Target, Shield, Zap, Sparkles, ChevronDown, Check, Play, Pause, Monitor, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import ParticlesBackground from "@/components/shared/ParticlesBackground";

export default function Home() {
  const router = useRouter();
  const supabase = createClient();
  const containerRef = useRef<HTMLDivElement>(null);

  // Connect scroll for path animation
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const pathLength = useSpring(scrollYProgress, { stiffness: 400, damping: 90 });
  const yRange = useTransform(scrollYProgress, [0, 1], [0, 100]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (profile?.role === 'teacher') router.push('/teacher/dashboard');
        else router.push('/student/dashboard');
      }
    };
    checkUser();
  }, [router, supabase]);

  return (
    <div ref={containerRef} className="min-h-screen bg-white font-inter text-slate-900 selection:bg-orange-100 selection:text-orange-900 overflow-x-hidden">
      {/* Particles with zero z-index so they are behind but interactive */}
      <ParticlesBackground particleCount={40} particleColor="#fdba74" lineColor="#fed7aa" />

      {/* Floating Navbar */}
      <nav className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4">
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white/80 backdrop-blur-md border border-white/50 shadow-lg shadow-orange-500/5 rounded-full px-6 py-3 flex items-center gap-8"
        >
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="UNI" width={32} height={32} className="rounded-full" />
            <span className="font-bold tracking-tight">UNI<span className="text-orange-500">CONSULTING</span></span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="#journey" className="hover:text-orange-500 transition-colors">Journey</Link>
            <Link href="#ecosystem" className="hover:text-orange-500 transition-colors">Ecosystem</Link>
            <Link href="#features" className="hover:text-orange-500 transition-colors">Features</Link>
          </div>

          <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
            <Link href="/login" className="text-sm font-bold text-slate-900 hover:text-orange-600">Sign In</Link>
            <Link href="/login" className="bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-orange-500 transition-colors">Get Started</Link>
          </div>
        </motion.div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, type: "spring" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[800px] h-[800px] bg-gradient-to-r from-orange-100/50 via-pink-100/50 to-purple-100/50 rounded-full blur-3xl opacity-50"
        />

        <motion.h1
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="text-7xl md:text-9xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-700"
        >
          FUTURE<br />READY
        </motion.h1>

        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-xl md:text-2xl text-slate-500 max-w-2xl font-light leading-relaxed mb-12"
        >
          The intelligent platform bridging the gap between <strong className="text-orange-500 font-bold">student ambition</strong> and <strong className="text-pink-500 font-bold">university success</strong>.
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Link href="/login" className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold text-lg shadow-xl shadow-orange-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
            Start Application <ArrowRight className="w-5 h-5" />
          </Link>

        </motion.div>

        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-10 text-slate-300"
        >
          <ChevronDown className="w-8 h-8" />
        </motion.div>
      </section>

      {/* THE JOURNEY - Scroll Path Animation */}
      <section id="journey" className="relative py-40 overflow-hidden">
        <div className="absolute inset-0 bg-slate-50/50 -skew-y-3 transform origin-top-left -z-10" />

        {/* Animated Line Container */}
        <div className="absolute left-[20px] md:left-1/2 top-0 bottom-0 w-1 bg-slate-100 -translate-x-1/2">
          <motion.div
            style={{ height: useTransform(scrollYProgress, [0.1, 0.6], ["0%", "100%"]) }}
            className="w-full bg-gradient-to-b from-orange-500 via-pink-500 to-purple-500"
          />
        </div>

        <div className="max-w-6xl mx-auto px-4 relative">
          <div className="text-center mb-32">
            <span className="text-orange-500 font-bold tracking-widest uppercase text-xs mb-2 block">The Workflow</span>
            <h2 className="text-5xl font-black text-slate-900">Your Path to Success</h2>
          </div>

          {/* Steps */}
          {[
            { title: "Connect", desc: "Sync with your designated mentor immediately upon registration.", icon: Users, color: "text-orange-500", bg: "bg-orange-50" },
            { title: "Construct", desc: "Build your academic profile. AI extracts scores from your documents.", icon: Upload, color: "text-pink-500", bg: "bg-pink-50" },
            { title: "Refine", desc: "Use our AI engine to polish your personal statements and essays.", icon: Brain, color: "text-purple-500", bg: "bg-purple-50" },
            { title: "Match", desc: "Discover universities that align perfectly with your potential.", icon: Target, color: "text-cyan-500", bg: "bg-cyan-50" }
          ].map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className={`flex flex-col md:flex-row items-center gap-8 md:gap-20 mb-32 ${i % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}
            >
              {/* Content Side */}
              <div className={`flex-1 ${i % 2 === 0 ? 'md:text-right' : 'md:text-left'} text-center md:text-left`}>
                <h3 className="text-6xl font-black text-slate-200 mb-2">{`0${i + 1}`}</h3>
                <h4 className="text-3xl font-bold text-slate-900 mb-4">{step.title}</h4>
                <p className="text-lg text-slate-600 leading-relaxed max-w-md ml-auto mr-auto md:mx-0">{step.desc}</p>
              </div>

              {/* Center Node */}
              <div className="relative z-10 p-2 bg-white rounded-full border-4 border-white shadow-xl">
                <div className={`w-16 h-16 ${step.bg} rounded-full flex items-center justify-center ${step.color}`}>
                  <step.icon className="w-8 h-8" />
                </div>
              </div>

              {/* Empty Side for Balance */}
              <div className="flex-1 hidden md:block" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURE SPOTLIGHTS - Asymmetric Layout */}
      <section id="features" className="py-40 bg-slate-900 text-white overflow-hidden relative">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-600/20 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[100px] -translate-x-1/2 translate-y-1/2" />

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">

            {/* Sticky Title */}
            <div className="md:col-span-4 md:sticky md:top-40 mb-16 md:mb-0">
              <span className="text-orange-400 font-bold tracking-widest uppercase text-xs mb-4 block">Capabilities</span>
              <h2 className="text-5xl md:text-6xl font-black leading-none mb-6">Power<br /><span className="text-slate-500">Suite</span></h2>
              <p className="text-slate-400 text-lg leading-relaxed max-w-sm">
                Tools designed not just to manage, but to empower. Speed, intelligence, and clarity in one unified interface.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. Large Card */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="col-span-1 sm:col-span-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-[2rem] p-10 hover:bg-white/10 transition-colors group"
              >
                <Shield className="w-12 h-12 text-emerald-400 mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-2xl font-bold mb-3">Teacher Command Center</h3>
                <p className="text-slate-400">Approve accounts, track live progress, and access student data instantly with our signature Automation View.</p>
              </motion.div>

              {/* 2. Standard Card */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[2rem] p-8 hover:bg-white/10 transition-colors group"
              >
                <Upload className="w-10 h-10 text-orange-400 mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-2">Smart OCR</h3>
                <p className="text-slate-400 text-sm">Upload transcripts. We extract specific grades and GPAs instantly.</p>
              </motion.div>

              {/* 3. Standard Card */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[2rem] p-8 hover:bg-white/10 transition-colors group"
              >
                <Target className="w-10 h-10 text-purple-400 mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-2">Uni Matcher</h3>
                <p className="text-slate-400 text-sm">AI analysis of your full profile to predict admission probabilities.</p>
              </motion.div>

              {/* 4. Large Card */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="col-span-1 sm:col-span-2 bg-gradient-to-r from-orange-600/20 to-pink-600/20 backdrop-blur-sm border border-white/10 rounded-[2rem] p-10 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Brain className="w-12 h-12 text-white mb-6 group-hover:scale-110 transition-transform relative z-10" />
                <h3 className="text-2xl font-bold mb-3 relative z-10">AI Essay Architect</h3>
                <p className="text-white/70 relative z-10">Don't just write. Evolve your writing. Our AI analyzes structure, tone, and content to elevate your personal statement.</p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA - Minimalist */}
      <section className="py-40 bg-white flex items-center justify-center text-center px-4 relative">
        <ParticlesBackground particleCount={30} particleColor="#cbd5e1" />
        <div className="max-w-3xl relative z-10">
          <h2 className="text-6xl md:text-8xl font-black text-slate-900 mb-8 tracking-tighter">
            BEGIN<br />NOW
          </h2>
          <Link href="/login" className="inline-flex items-center gap-3 px-10 py-5 bg-slate-900 text-white rounded-full font-bold text-xl hover:bg-orange-500 hover:scale-105 transition-all shadow-xl">
            Let's Get Started <ArrowRight className="w-6 h-6" />
          </Link>
        </div>
      </section>

      {/* FOOTER - Clean */}
      <footer className="py-8 bg-white border-t border-slate-100 text-center">
        <p className="text-slate-400 text-sm font-medium">© {new Date().getFullYear()} UNI CONSULTING. SIMPLICITY IN AMBITION.</p>
      </footer>
    </div>
  );
}
