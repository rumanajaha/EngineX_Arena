"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface IntroOverlayProps {
  onComplete: () => void;
}

function IntroOverlay({ onComplete }: IntroOverlayProps) {
  const [showLogo, setShowLogo] = useState(false);
  const [showSweep, setShowSweep] = useState(false);
  const [typedTitle, setTypedTitle] = useState("");
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const [showSkip, setShowSkip] = useState(false);

  const titleText = "ENGINEX ARENA";

  useEffect(() => {
    // 0.3s - Single "E" appears with rapid flicker
    const logoTimer = setTimeout(() => setShowLogo(true), 300);

    // 0.5s - SKIP button appears
    const skipTimer = setTimeout(() => setShowSkip(true), 500);

    // 0.8s - Scanline sweep
    const sweepTimer = setTimeout(() => setShowSweep(true), 800);

    // 1.2s - Title types out
    const titleStartTimer = setTimeout(() => {
      let index = 0;
      const interval = setInterval(() => {
        setTypedTitle((prev) => prev + titleText[index]);
        index++;
        if (index >= titleText.length) {
          clearInterval(interval);
        }
      }, 70); // Slightly faster than 80ms to align timing nicely
      return () => clearInterval(interval);
    }, 1200);

    // 2.0s - Subtitle fades in
    const subtitleTimer = setTimeout(() => setShowSubtitle(true), 2000);

    // 2.5s - White flash
    const flashStartTimer = setTimeout(() => {
      setFlashOpacity(1);
      // Fade out flash by 2.7s
      const flashEndTimer = setTimeout(() => {
        setFlashOpacity(0);
      }, 200);
      return () => clearTimeout(flashEndTimer);
    }, 2500);

    // 3.0s - Completed, exit intro
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(skipTimer);
      clearTimeout(sweepTimer);
      clearTimeout(titleStartTimer);
      clearTimeout(subtitleTimer);
      clearTimeout(flashStartTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="fixed inset-0 bg-[#0D0D0A] flex flex-col justify-center items-center z-[9999] overflow-hidden select-none font-sans"
    >
      {/* Glitch CRT grid lines styling */}
      <style>{`
        .intro-crt-lines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.3) 50%);
          background-size: 100% 3px;
          z-index: 100;
          opacity: 0.25;
        }
      `}</style>
      <div className="intro-crt-lines" />

      {/* Skip Button */}
      {showSkip && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onComplete}
          className="absolute top-6 right-8 border border-olive hover:border-sand text-khaki hover:text-cream px-4 py-1.5 rounded font-mono text-[9px] tracking-widest uppercase cursor-pointer z-[10000] transition-colors"
        >
          Skip
        </motion.button>
      )}

      {/* Horizontal sweep scanline element */}
      {showSweep && (
        <motion.div
          initial={{ top: "-10%" }}
          animate={{ top: "110%" }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute left-0 w-full h-[6px] bg-sand/30 shadow-[0_0_15px_#FAE8B4] pointer-events-none z-50"
        />
      )}

      {/* Main Center Panel */}
      <div className="text-center space-y-6 max-w-lg z-20">
        {/* Glow Logo E mark */}
        <div className="h-20 flex items-center justify-center">
          {showLogo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0, 1, 0, 1] }}
              transition={{ duration: 0.3, ease: "linear" }}
              className="w-14 h-14 rounded-lg bg-gradient-to-br from-sand to-olive flex items-center justify-center border border-cream/20 shadow-[0_0_20px_rgba(250,232,180,0.15)] font-space font-black text-bg text-2xl tracking-tighter"
            >
              E
            </motion.div>
          )}
        </div>

        {/* Typed Title */}
        <div className="h-10 flex items-center justify-center">
          <h2 className="font-space text-3xl font-extrabold tracking-[0.25em] text-[#CBBD93] uppercase">
            {typedTitle}
            {typedTitle.length > 0 && typedTitle.length < titleText.length && (
              <span className="animate-ping">|</span>
            )}
          </h2>
        </div>

        {/* Subtitle */}
        <div className="h-6 flex items-center justify-center">
          {showSubtitle && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="font-mono text-[10px] tracking-[0.3em] text-[#80775C] uppercase font-bold"
            >
              Engineer. Battle. Dominate.
            </motion.p>
          )}
        </div>
      </div>

      {/* Full screen white flash */}
      <div
        className="fixed inset-0 bg-white pointer-events-none z-[10001] transition-opacity duration-150"
        style={{ opacity: flashOpacity }}
      />
    </motion.div>
  );
}

export default function IntroAnimation({ children }: { children: React.ReactNode }) {
  const [showIntro, setShowIntro] = useState<boolean | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("enginex_intro_seen");
    if (seen === "true") {
      setShowIntro(false);
    } else {
      setShowIntro(true);
      setIsAnimating(true);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem("enginex_intro_seen", "true");
    setShowIntro(false);
    setIsAnimating(false);
  };

  // Return empty black screen during mount verification
  if (showIntro === null) {
    return <div className="fixed inset-0 bg-[#0D0D0A] z-[9999]" />;
  }

  if (!showIntro) {
    return <>{children}</>;
  }

  return (
    <>
      <AnimatePresence>
        {isAnimating && (
          <IntroOverlay key="intro-overlay" onComplete={handleComplete} />
        )}
      </AnimatePresence>
      <div className={isAnimating ? "hidden" : "contents"}>
        {children}
      </div>
    </>
  );
}
