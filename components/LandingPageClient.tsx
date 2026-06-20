"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useInView } from "framer-motion";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

function CountUp({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!isInView) return;
    const start = 0;
    const end = value;
    if (start === end) {
      setCount(end);
      return;
    }
    const duration = 2000; // 2 seconds
    const startTime = performance.now();
    let animationFrameId: number;

    const updateCount = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.floor(easeProgress * (end - start) + start);
      setCount(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCount);
      } else {
        setCount(end);
      }
    };

    animationFrameId = requestAnimationFrame(updateCount);
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [value, isInView]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

export default function LandingPageClient() {
  const router = useRouter();
  const [init, setInit] = useState(false);
  const [stats, setStats] = useState({
    engineersOnline: 247,
    battlesFought: 1842,
    challengesAvailable: 45,
  });
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });

    fetch("/api/stats")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Failed to fetch stats");
      })
      .then((data) => {
        setStats({
          engineersOnline: data.engineersOnline ?? 247,
          battlesFought: data.battlesFought ?? 1842,
          challengesAvailable: data.challengesAvailable ?? 45,
        });
      })
      .catch((err) => {
        console.warn("Using fallback landing stats:", err);
      });
  }, []);

  const handleScrollToFeatures = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById("features");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="bg-bg text-cream min-h-screen font-sans selection:bg-sand selection:text-bg">
      <style>{`
        @keyframes logoGlow {
          0%, 100% {
            filter: drop-shadow(0 0 10px rgba(250, 232, 180, 0.25));
            transform: scale(1);
          }
          50% {
            filter: drop-shadow(0 0 25px rgba(250, 232, 180, 0.65));
            transform: scale(1.04);
          }
        }
        .logo-glow {
          animation: logoGlow 4s ease-in-out infinite;
        }
        @keyframes arrowBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(10px); }
        }
        .arrow-bounce {
          animation: arrowBounce 2s infinite ease-in-out;
        }
        /* Custom horizontal lines styling for scanlines */
        .scanlines {
          position: fixed;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            rgba(18, 16, 16, 0) 50%,
            rgba(0, 0, 0, 0.25) 50%
          ), linear-gradient(
            90deg,
            rgba(255, 0, 0, 0.03),
            rgba(0, 255, 0, 0.01),
            rgba(0, 0, 255, 0.03)
          );
          background-size: 100% 4px, 3px 100%;
          z-index: 10;
          opacity: 0.4;
        }
      `}</style>

      {/* Screen CRT scanlines overlay for premium retro-futuristic arcade vibe */}
      <div className="scanlines" />

      {/* SECTION 1 — HERO */}
      <section className="relative h-screen flex flex-col justify-between items-center px-6 overflow-hidden bg-[#0D0D0A]">
        {/* Particle Backdrop */}
        {init && (
          <Particles
            id="hero-particles"
            className="absolute inset-0 z-0 pointer-events-none"
            options={{
              background: {
                color: {
                  value: "transparent",
                },
              },
              fpsLimit: 60,
              particles: {
                color: {
                  value: "#CBBD93",
                },
                links: {
                  color: "#80775C",
                  distance: 140,
                  enable: true,
                  opacity: 0.25,
                  width: 1,
                },
                move: {
                  direction: "none",
                  enable: true,
                  outModes: {
                    default: "bounce",
                  },
                  random: false,
                  speed: 0.8,
                  straight: false,
                },
                number: {
                  density: {
                    enable: true,
                    width: 800,
                    height: 800,
                  },
                  value: 65,
                },
                opacity: {
                  value: 0.4,
                },
                shape: {
                  type: "circle",
                },
                size: {
                  value: { min: 1, max: 2.5 },
                },
              },
              detectRetina: true,
            }}
          />
        )}

        {/* Empty Spacer */}
        <div />

        {/* Center Content */}
        <div className="z-10 text-center max-w-3xl space-y-8">
          {/* Logo Mark */}
          <div className="flex justify-center">
            <div className="logo-glow w-16 h-16 rounded-xl bg-gradient-to-br from-sand to-olive flex items-center justify-center border border-cream/25 shadow-[0_0_20px_rgba(250,232,180,0.15)] font-space font-black text-bg text-3xl tracking-tighter cursor-default">
              E
            </div>
          </div>

          {/* Titles */}
          <div className="space-y-2">
            <h1 className="font-space text-6xl md:text-8xl font-extrabold tracking-[0.2em] text-[#CBBD93] uppercase select-none">
              ENGINEX
            </h1>
            <h2 className="font-space text-2xl md:text-3xl font-bold tracking-[0.4em] text-[#574A24] uppercase select-none">
              ARENA
            </h2>
          </div>

          {/* Tagline */}
          <p className="font-mono text-sm md:text-base tracking-[0.25em] text-[#80775C] uppercase font-semibold">
            Engineer. Battle. Dominate.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
            <button
              onClick={() => router.push("/login")}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#CBBD93] hover:bg-cream text-[#0D0D0A] font-space font-bold uppercase text-xs tracking-wider rounded-lg shadow-xl shadow-sand/5 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
            >
              Enter Arena
            </button>
            <a
              href="#features"
              onClick={handleScrollToFeatures}
              className="w-full sm:w-auto px-8 py-3.5 border border-[#574A24] hover:border-sand text-[#CBBD93] hover:text-cream font-space font-bold uppercase text-xs tracking-wider rounded-lg transition-all duration-300 bg-transparent cursor-pointer"
            >
              See How It Works
            </a>
          </div>
        </div>

        {/* Bouncing Scroll indicator */}
        <div className="arrow-bounce pb-8 z-10 flex flex-col items-center">
          <a href="#stats" onClick={(e) => {
            e.preventDefault();
            document.getElementById("stats")?.scrollIntoView({ behavior: "smooth" });
          }} className="text-khaki hover:text-sand transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>
        </div>
      </section>

      {/* SECTION 2 — LIVE STATS BAR */}
      <section id="stats" className="w-full bg-[#1A1A14] border-y border-khaki/10 py-8 relative z-20">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 items-center justify-items-center">
          {/* Stat 1 */}
          <div className="text-center w-full md:border-r border-khaki/15 py-2">
            <p className="font-space text-3xl md:text-4xl font-extrabold text-[#CBBD93] tracking-wide">
              <CountUp value={stats.engineersOnline} />
            </p>
            <p className="font-mono text-[10px] text-khaki uppercase tracking-widest mt-1">Engineers Online</p>
          </div>

          {/* Stat 2 */}
          <div className="text-center w-full md:border-r border-khaki/15 py-2">
            <p className="font-space text-3xl md:text-4xl font-extrabold text-[#CBBD93] tracking-wide">
              <CountUp value={stats.battlesFought} />
            </p>
            <p className="font-mono text-[10px] text-khaki uppercase tracking-widest mt-1">Battles Fought</p>
          </div>

          {/* Stat 3 */}
          <div className="text-center w-full py-2">
            <p className="font-space text-3xl md:text-4xl font-extrabold text-[#CBBD93] tracking-wide">
              <CountUp value={stats.challengesAvailable} />
            </p>
            <p className="font-mono text-[10px] text-khaki uppercase tracking-widest mt-1">Challenges Available</p>
          </div>
        </div>
      </section>

      {/* SECTION 3 — BATTLE MODES */}
      <section id="features" className="py-24 max-w-6xl mx-auto px-6 relative z-20">
        <div className="text-center mb-16 space-y-2">
          <p className="font-mono text-[10px] text-khaki uppercase tracking-[0.3em] font-semibold">Game Modes</p>
          <h2 className="font-space text-3xl md:text-4xl font-extrabold text-cream tracking-wider uppercase">
            THREE WAYS TO PROVE YOURSELF
          </h2>
          <div className="w-16 h-[2px] bg-sand mx-auto mt-4" />
        </div>

        {/* Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              mode: "SYSTEM_CRASH",
              name: "System Crash",
              desc: "Resolve buffer overflows and execution faults under Monaco code terminal environments.",
              howItWorks: "Analyze raw code output logs. Locate indexing errors, variable overflows, and uninitialized buffers. Write standard JS/TS modifications and push your fix before your opponent to claim maximum ELO points.",
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ),
            },
            {
              mode: "ARCH_WARS",
              name: "Arch Wars",
              desc: "Arrange network nodes, queues, and caches on an interactive logic flow canvas blueprint.",
              howItWorks: "Construct systems models using specific nodes (Servers, Queues, Databases, Caches, Load Balancers). Link them with dash arrows and submit a text logic design document reviewed by automated system evaluation weights.",
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              ),
            },
            {
              mode: "LOAD_BREAKER",
              name: "Load Breaker",
              desc: "Debug and optimize slow DB routines, maximizing throughput variables under extreme traffic.",
              howItWorks: "Examine execution patterns in standard loops and queries. Optimize nested calls, prevent N+1 queries, adjust buffer thresholds, and reduce response latency to satisfy strict benchmark tests under simulated stress.",
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ),
            },
          ].map((card, index) => (
            <motion.div
              key={card.mode}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: index * 0.15, ease: "easeOut" }}
              onMouseEnter={() => setHoveredCard(card.mode)}
              onMouseLeave={() => setHoveredCard(null)}
              className="bg-[#1A1A14] border border-khaki/10 hover:border-sand/35 rounded-xl p-6 flex flex-col justify-between transition-all duration-300 relative group cursor-default overflow-hidden"
            >
              {/* Subtle background glow */}
              <div className="absolute inset-0 bg-gradient-to-t from-sand/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="space-y-4 relative z-10">
                {/* Icon Container */}
                <div className="p-3 bg-bg border border-khaki/15 text-[#CBBD93] w-fit rounded-lg shadow-inner group-hover:scale-110 transition-transform duration-300">
                  {card.icon}
                </div>
                <div>
                  <h3 className="font-space text-lg font-bold text-cream group-hover:text-sand transition-colors duration-300">
                    {card.name}
                  </h3>
                  <p className="font-sans text-xs text-khaki mt-2 leading-relaxed h-10">
                    {card.desc}
                  </p>
                </div>

                {/* Expandable detail Container */}
                <motion.div
                  initial={false}
                  animate={{
                    height: hoveredCard === card.mode ? "auto" : 0,
                    opacity: hoveredCard === card.mode ? 1 : 0,
                  }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-khaki/10 mt-3 pt-3">
                    <p className="font-mono text-[9px] text-[#CBBD93]/80 uppercase tracking-widest mb-1.5 font-bold">How it works</p>
                    <p className="font-sans text-[11px] text-khaki leading-relaxed">
                      {card.howItWorks}
                    </p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* SECTION 4 — HOW IT WORKS */}
      <section className="py-24 bg-[#1A1A14]/30 border-y border-khaki/10 relative z-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20 space-y-2">
            <p className="font-mono text-[10px] text-khaki uppercase tracking-[0.3em] font-semibold">Workflow</p>
            <h2 className="font-space text-3xl md:text-4xl font-extrabold text-cream tracking-wider uppercase">
              ENTER. BATTLE. RANK.
            </h2>
            <div className="w-16 h-[2px] bg-sand mx-auto mt-4" />
          </div>

          <div className="relative">
            {/* Connecting line (desktop only) */}
            <div className="absolute top-[38px] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-sand/10 via-sand/30 to-sand/10 hidden md:block z-0" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
              {/* Step 1 */}
              <div className="text-center flex flex-col items-center group">
                <div className="w-16 h-16 rounded-full bg-bg border-2 border-[#574A24] group-hover:border-sand flex items-center justify-center font-space text-xl font-bold text-sand relative transition-colors duration-300 shadow-lg">
                  01
                  {/* Subtle top-right icon badge */}
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#574A24] rounded-full border border-khaki/20 flex items-center justify-center text-[10px] text-cream">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                </div>
                <h4 className="font-space text-base font-bold text-cream mt-6 group-hover:text-sand transition-colors">
                  Sign in with GitHub
                </h4>
                <p className="font-sans text-xs text-khaki mt-2 max-w-xs leading-relaxed">
                  Connect instantly. Sync your identity, populate your profile avatar, and set your baseline ELO.
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center flex flex-col items-center group">
                <div className="w-16 h-16 rounded-full bg-bg border-2 border-[#574A24] group-hover:border-sand flex items-center justify-center font-space text-xl font-bold text-sand relative transition-colors duration-300 shadow-lg">
                  02
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#574A24] rounded-full border border-khaki/20 flex items-center justify-center text-[10px] text-cream">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                    </svg>
                  </div>
                </div>
                <h4 className="font-space text-base font-bold text-cream mt-6 group-hover:text-sand transition-colors">
                  Choose Your Battle
                </h4>
                <p className="font-sans text-xs text-khaki mt-2 max-w-xs leading-relaxed">
                  Enter queue rooms, challenge online friends to duels, or tackle solo tasks to train code patterns.
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center flex flex-col items-center group">
                <div className="w-16 h-16 rounded-full bg-bg border-2 border-[#574A24] group-hover:border-sand flex items-center justify-center font-space text-xl font-bold text-sand relative transition-colors duration-300 shadow-lg">
                  03
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#574A24] rounded-full border border-khaki/20 flex items-center justify-center text-[10px] text-cream">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-6.75a1.125 1.125 0 00-1.125 1.125v3.375m9 0h-9m9-1.125a2.625 2.625 0 000-5.25h-.625m-6.75 5.25a2.625 2.625 0 010-5.25h.625m-3 1.5v-3.75m3 0v3.75m0-3.75a1.125 1.125 0 011.125-1.125h1.5a1.125 1.125 0 011.125 1.125v3.75m-3.75-3.75H9m3-2.25H9.75" />
                    </svg>
                  </div>
                </div>
                <h4 className="font-space text-base font-bold text-cream mt-6 group-hover:text-sand transition-colors">
                  Climb the Ranks
                </h4>
                <p className="font-sans text-xs text-khaki mt-2 max-w-xs leading-relaxed">
                  Earn rating points, rise through competitive tiers (Iron to Diamond), unlock badges, and rule the arena.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 — CTA */}
      <section className="py-24 max-w-4xl mx-auto px-6 text-center relative z-20">
        <div className="bg-[#1A1A14] border border-khaki/15 rounded-2xl p-12 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-sand/5 via-transparent to-transparent pointer-events-none" />
          <h2 className="font-space text-4xl font-extrabold text-cream tracking-wider uppercase select-none">
            READY TO BATTLE?
          </h2>
          <p className="text-sm text-khaki font-mono max-w-md mx-auto leading-relaxed">
            Join engineers already competing on the arena. Deploy blueprints, patch bugs, and optimize execution flow.
          </p>
          <div className="pt-4">
            <button
              onClick={() => router.push("/login")}
              className="px-10 py-4 bg-[#CBBD93] hover:bg-cream text-bg font-space font-bold uppercase text-xs tracking-wider rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
            >
              Enter Arena
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 6 — FOOTER */}
      <footer className="w-full bg-[#0D0D0A] border-t border-khaki/10 py-12 px-8 relative z-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Left info */}
          <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-sand to-olive flex items-center justify-center font-space font-black text-bg text-sm tracking-tighter cursor-default">
              E
            </div>
            <div>
              <p className="font-space text-xs font-bold text-cream uppercase tracking-wide">
                EngineX Arena
              </p>
              <p className="font-mono text-[9px] text-khaki mt-0.5">
                Built for engineers who take no shortcuts
              </p>
            </div>
          </div>

          {/* Right Links & Copyright */}
          <div className="flex flex-col items-center md:items-end gap-2 text-right">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#CBBD93] hover:text-cream flex items-center gap-1.5 transition-colors font-mono"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" clipRule="evenodd" />
              </svg>
              GitHub Project
            </a>
            <p className="font-mono text-[9px] text-khaki">
              &copy; {new Date().getFullYear()} EngineX. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
