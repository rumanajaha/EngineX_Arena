"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import * as Toast from "@radix-ui/react-toast";
import { motion, AnimatePresence } from "framer-motion";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: string;
  title: string;
  description: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (title: string, description: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((title: string, description: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, description, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <Toast.Provider swipeDirection="right" duration={5000}>
        {children}

        {/* Viewport at bottom right */}
        <Toast.Viewport className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-80 max-w-[100vw] outline-none" />

        <AnimatePresence>
          {toasts.map((t) => {
            let bgBorder = "bg-surface2/90 border-khaki/20 text-cream";
            if (t.type === "success") bgBorder = "bg-[#1b2a1c]/90 border-[#81c784]/30 text-[#81c784]";
            if (t.type === "error") bgBorder = "bg-[#2d1b1b]/90 border-[#e57373]/30 text-[#e57373]";

            return (
              <Toast.Root
                key={t.id}
                onOpenChange={(open) => {
                  if (!open) removeToast(t.id);
                }}
                asChild
              >
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  className={`border-2 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 font-sans relative overflow-hidden ${bgBorder}`}
                >
                  {/* Visual accent top line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sand/20 to-transparent" />
                  
                  <div className="flex justify-between items-start">
                    <Toast.Title className="font-space font-bold text-sm leading-tight">
                      {t.title}
                    </Toast.Title>
                    <Toast.Close className="text-khaki hover:text-cream text-xs font-bold leading-none cursor-pointer outline-none pl-2">
                      ✕
                    </Toast.Close>
                  </div>
                  <Toast.Description className="font-mono text-[10px] text-cream/85 leading-normal">
                    {t.description}
                  </Toast.Description>
                </motion.div>
              </Toast.Root>
            );
          })}
        </AnimatePresence>
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
