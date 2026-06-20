"use client";

import React from "react";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const handleGithubSignIn = () => {
    signIn("github", { callbackUrl: "/hub" });
  };

  return (
    <div className="relative h-full w-full bg-bg text-cream flex flex-col justify-center items-center overflow-y-auto py-12 font-sans">
      {/* Glow Effect / Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(87,74,36,0.15),transparent_60%)] pointer-events-none" />
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#CBBD93 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className="bg-surface border border-khaki/20 rounded-2xl p-8 md:p-10 shadow-2xl relative overflow-hidden backdrop-blur-md">
          {/* Top border glow decoration */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sand to-transparent opacity-50" />
          
          <div className="flex flex-col items-center text-center">
            {/* Logo Icon */}
            <motion.div
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
              className="w-16 h-16 rounded-xl bg-surface2 border border-khaki/30 flex items-center justify-center mb-6 shadow-inner"
            >
              <svg className="w-10 h-10 text-sand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
              </svg>
            </motion.div>

            {/* Logo Text */}
            <h1 className="font-space text-3xl font-bold tracking-tight text-cream mb-2">
              ENGINEX <span className="text-sand font-light">ARENA</span>
            </h1>

            {/* Tagline */}
            <p className="font-space text-sm tracking-[0.2em] text-khaki uppercase mb-8">
              Engineer. Battle. Dominate.
            </p>

            {/* Terminal Mock / Instructions */}
            <div className="w-full bg-bg/60 border border-khaki/10 rounded-lg p-4 mb-8 text-left font-mono text-xs text-sand/80">
              <div className="flex items-center space-x-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-olive animate-pulse" />
                <span className="text-[10px] text-khaki uppercase tracking-wider">Authentication Required</span>
              </div>
              <p className="text-khaki/70"># Establish terminal connection</p>
              <p className="text-cream mt-1">$ git auth login --provider github</p>
            </div>

            {/* Action Button */}
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGithubSignIn}
              className="w-full bg-cream text-bg font-space font-semibold py-3.5 px-6 rounded-xl hover:bg-sand transition-all duration-300 shadow-[0_0_20px_rgba(250,232,180,0.15)] hover:shadow-[0_0_30px_rgba(250,232,180,0.35)] flex items-center justify-center text-sm tracking-wider uppercase cursor-pointer"
            >
              {/* GitHub SVG */}
              <svg className="w-5 h-5 mr-3 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577v-2.234c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.82 1.102.82 2.222v3.293c0 .319.22.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Sign In with GitHub
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Decorative footer */}
      <div className="absolute bottom-6 font-mono text-[10px] text-khaki/40 tracking-[0.3em] uppercase">
        ALL SYSTEMS OPERATIONAL // READY FOR BATTLE
      </div>
    </div>
  );
}
