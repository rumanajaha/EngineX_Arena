"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Global Segment Error Boundary:", error);
  }, [error]);

  return (
    <div className="relative h-full w-full bg-bg text-cream flex flex-col justify-center items-center overflow-y-auto py-12 font-sans px-6">
      {/* Decorative Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(87,74,36,0.06),transparent_60%)] pointer-events-none" />
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#CBBD93 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />
      
      <div className="bg-surface border border-khaki/20 rounded-2xl p-8 md:p-10 shadow-2xl relative overflow-hidden backdrop-blur-md text-center max-w-md w-full z-10">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
        
        {/* Error Icon */}
        <div className="w-16 h-16 rounded-xl bg-red-950/20 border border-red-500/30 flex items-center justify-center mb-6 mx-auto text-red-400">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className="font-space text-2xl font-bold tracking-tight text-cream mb-2 uppercase">
          SYSTEM ERROR
        </h1>
        
        <p className="font-mono text-[9px] text-khaki uppercase tracking-[0.1em] mb-4 bg-bg/60 py-1.5 px-3 rounded border border-khaki/10 w-fit mx-auto truncate max-w-full">
          Digest: {error.digest || "Runtime Exception"}
        </p>

        <p className="text-sm text-cream/80 leading-relaxed mb-4">
          A runtime execution fault was detected.
        </p>

        <div className="bg-bg/40 border border-khaki/10 rounded-lg p-3 text-left font-mono text-[10px] text-red-400 mb-8 max-h-24 overflow-y-auto break-all scrollbar-thin">
          {error.message || "Unknown error details."}
        </div>

        <div className="flex flex-col space-y-3">
          <button
            onClick={() => reset()}
            className="w-full bg-cream hover:bg-sand text-bg font-space font-semibold py-3 px-6 rounded-xl transition duration-200 uppercase text-xs tracking-wider cursor-pointer"
          >
            Try Again
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full border border-khaki/20 hover:border-khaki/40 text-cream py-3 px-6 rounded-xl transition duration-200 uppercase text-xs tracking-wider cursor-pointer"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
