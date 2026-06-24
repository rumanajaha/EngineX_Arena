"use client";

import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";

export default function SocketConnectionBoundary({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

  useEffect(() => {
    // Establish connection monitoring socket client to verify port 3001 state
    const socket = io(socketUrl, {
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [socketUrl]);

  return (
    <div className="relative min-h-screen">
      {children}

      <AnimatePresence>
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg/95 backdrop-blur-md flex flex-col justify-center items-center z-50 font-sans"
          >
            <div className="text-center space-y-6 max-w-sm px-6">
              <motion.div
                animate={{ scale: [1, 1.15, 1], rotate: [0, 180, 360] }}
                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                className="w-16 h-16 rounded-full border-2 border-dashed border-[#e57373] flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(229,115,115,0.25)]"
              >
                <svg className="w-8 h-8 text-[#e57373]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M21 3L3 21M6.343 17.657a9 9 0 010-12.728m0 0l2.829 2.829m-2.829-2.829L3 3" />
                </svg>
              </motion.div>
              <div className="space-y-2">
                <h3 className="font-space text-lg font-bold tracking-wider text-cream uppercase">Connection Lost</h3>
                <p className="font-mono text-[10px] text-khaki leading-relaxed">
                  Lost connection to EngineX Arena socket gateways. Reconnecting to {socketUrl}...
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
