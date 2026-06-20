"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import SocketConnectionBoundary from "@/components/SocketConnectionBoundary";
import { useToast } from "@/components/providers/ToastProvider";

interface ChatMessage {
  playerId: string;
  username: string;
  avatar: string;
  message: string;
  timestamp: string;
}

interface Room {
  id: string;
  roomId: string;
  mode: string;
  status: string;
  player1: {
    username: string;
    avatar: string;
    eloRating: number;
  };
}

export default function LobbyPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const player = session?.player;
  const { showToast } = useToast();

  const [onlineCount, setOnlineCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchingMode, setSearchingMode] = useState("");
  
  // Custom Room creation details
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState("SYSTEM_CRASH");
  const [createDifficulty, setCreateDifficulty] = useState("MEDIUM");
  const [createIsPrivate, setCreateIsPrivate] = useState(false);
  
  // Host waiting states
  const [isWaitingForOpponent, setIsWaitingForOpponent] = useState(false);
  const [waitingRoomId, setWaitingRoomId] = useState("");
  const [waitingInviteCode, setWaitingInviteCode] = useState("");

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch rooms list from database
  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/rooms");
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (err) {
      console.error("Error fetching rooms:", err);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  useEffect(() => {
    if (!player) return;

    // Connect to Socket.io server
    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.emit("join:lobby", player.id);

    // Auto-join matchmaking queue if a mode is pre-selected in query params
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("mode");
      if (mode) {
        setIsSearching(true);
        setSearchingMode(mode);
        socket.emit("join:queue", {
          playerId: player.id,
          mode,
        });
      }
    }

    socket.on("lobby:players_update", (data: { count: number }) => {
      setOnlineCount(data.count);
    });

    socket.on("lobby:chat:message", (data: ChatMessage) => {
      setChatMessages((prev) => [...prev, data]);
    });

    socket.on("room:ready", (data: { battleId: string; roomId: string; redirectUrl: string }) => {
      setIsSearching(false);
      setIsWaitingForOpponent(false);
      router.push(`/battle/${data.roomId}`);
    });

    return () => {
      socket.disconnect();
    };
  }, [player, router]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !player || !socketRef.current) return;

    socketRef.current.emit("lobby:chat:message", {
      playerId: player.id,
      username: player.username,
      avatar: player.avatar,
      message: messageInput.trim(),
    });
    setMessageInput("");
  };

  const handleQuickMatch = (mode: string) => {
    if (!player || !socketRef.current) return;
    setIsSearching(true);
    setSearchingMode(mode);
    socketRef.current.emit("join:queue", {
      playerId: player.id,
      mode,
    });
    showToast("Matchmaking Started", `Searching for opponents in ${formatModeName(mode)} mode.`, "info");
  };

  const handleCancelSearch = () => {
    setIsSearching(false);
    showToast("Matchmaking Cancelled", "Removed from the matchmaking queue.", "info");
    // Refresh page or reconnect to clear queues
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
      socketRef.current.emit("join:lobby", player?.id);
    }
  };

  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!player || !socketRef.current) return;

    socketRef.current.emit(
      "create:room",
      {
        playerId: player.id,
        mode: createMode,
        difficulty: createDifficulty,
        isPrivate: createIsPrivate,
      },
      (res: { roomId: string; inviteCode: string }) => {
        setWaitingRoomId(res.roomId);
        setWaitingInviteCode(res.inviteCode);
        setIsWaitingForOpponent(true);
        setCreateModalOpen(false);
      }
    );
  };

  const handleJoinRoom = (roomId: string) => {
    if (!player || !socketRef.current) return;
    socketRef.current.emit("join:room", {
      playerId: player.id,
      roomId,
    });
  };

  const formatModeName = (mode: string) => {
    return mode.replace("_", " ");
  };

  return (
    <SocketConnectionBoundary>
      <div className="h-full w-full flex flex-col font-sans overflow-hidden relative">
        {/* Background glow decoration */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-olive/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-sand/5 blur-[100px] pointer-events-none" />

      {/* Main Grid */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Sidebar (Lobby Chat) */}
        <aside className="w-80 border-r border-khaki/10 bg-surface/30 flex flex-col h-full overflow-hidden">
          {/* Online count */}
          <div className="p-4 border-b border-khaki/10 flex items-center justify-between bg-surface2/30">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-sand animate-ping" />
              <span className="font-space font-bold uppercase text-xs tracking-wider text-sand">Live Lobby</span>
            </div>
            <span className="font-mono text-sm text-cream bg-bg border border-khaki/20 px-2 py-0.5 rounded">
              {onlineCount} Online
            </span>
          </div>

          {/* Chat feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className="flex space-x-3 text-sm">
                <img src={msg.avatar} alt={msg.username} className="w-8 h-8 rounded-lg border border-khaki/10 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-baseline space-x-2">
                    <span className="font-space font-semibold text-sand">{msg.username}</span>
                    <span className="font-mono text-[9px] text-khaki">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-cream/90 mt-0.5 font-sans break-words">{msg.message}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-khaki/10 bg-surface/50">
            <div className="flex space-x-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Broadcast to lobby..."
                className="flex-1 bg-bg border border-khaki/20 text-cream px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-sand"
              />
              <button
                type="submit"
                className="bg-cream text-bg px-4 py-2 rounded-lg font-space font-semibold text-xs uppercase hover:bg-sand transition cursor-pointer"
              >
                Send
              </button>
            </div>
          </form>
        </aside>

        {/* Right Dashboard Area */}
        <main className="flex-1 p-8 overflow-y-auto flex flex-col space-y-8 h-full">
          {/* Combats Section */}
          <section className="space-y-4">
            <h2 className="font-space text-lg font-bold uppercase tracking-wider text-sand">Matchmaking</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  mode: "SYSTEM_CRASH",
                  title: "System Crash",
                  desc: "Defend memory limits & debug overflows.",
                  color: "border-sand/30 hover:border-sand bg-gradient-to-br from-surface to-olive/5",
                },
                {
                  mode: "ARCH_WARS",
                  title: "Arch Wars",
                  desc: "Design optimal system topologies.",
                  color: "border-khaki/30 hover:border-khaki bg-gradient-to-br from-surface to-khaki/5",
                },
                {
                  mode: "LOAD_BREAKER",
                  title: "Load Breaker",
                  desc: "Optimize database queries under heavy load.",
                  color: "border-olive/30 hover:border-olive bg-gradient-to-br from-surface to-olive/10",
                },
              ].map((item) => (
                <div
                  key={item.mode}
                  className={`border rounded-xl p-6 flex flex-col justify-between transition-all duration-300 group ${item.color}`}
                >
                  <div>
                    <h3 className="font-space text-xl font-bold text-cream mb-2">{item.title}</h3>
                    <p className="text-xs text-khaki leading-relaxed">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => handleQuickMatch(item.mode)}
                    className="mt-6 w-full bg-cream text-bg py-2.5 rounded-lg font-space font-semibold text-xs uppercase tracking-wider transition group-hover:bg-sand cursor-pointer"
                  >
                    Quick Match
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Rooms browser section */}
          <section className="space-y-4 flex-1 flex flex-col">
            <div className="flex justify-between items-center">
              <h2 className="font-space text-lg font-bold uppercase tracking-wider text-sand">Public Rooms</h2>
              <div className="flex space-x-3">
                <button
                  onClick={fetchRooms}
                  className="border border-khaki/20 text-cream px-4 py-2 rounded-lg font-space font-semibold text-xs uppercase hover:bg-surface2 transition cursor-pointer"
                >
                  Refresh
                </button>
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="bg-cream text-bg px-4 py-2 rounded-lg font-space font-semibold text-xs uppercase hover:bg-sand transition cursor-pointer"
                >
                  Create Room
                </button>
              </div>
            </div>

            {rooms.length === 0 ? (
              <div className="flex-1 border border-khaki/10 bg-surface/20 rounded-xl p-10 text-center flex flex-col items-center justify-center text-khaki font-mono text-sm">
                <svg className="w-12 h-12 text-khaki/30 mb-4" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                NO OPEN ROOMS AVAILABLE. CREATE A ROOM TO HOST A BATTLE.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-surface border border-khaki/15 rounded-xl p-4 flex items-center justify-between hover:border-khaki/35 transition"
                  >
                    <div className="flex items-center space-x-4">
                      <img src={room.player1.avatar} alt={room.player1.username} className="w-10 h-10 rounded-lg border border-khaki/20" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-space font-semibold text-cream">{room.player1.username}</span>
                          <span className="font-mono text-[10px] text-khaki">(ELO: {room.player1.eloRating})</span>
                        </div>
                        <div className="flex space-x-2 mt-1">
                          <span className="bg-surface2 border border-khaki/15 text-[10px] px-2 py-0.5 rounded-full font-space font-bold uppercase tracking-wider text-sand">
                            {formatModeName(room.mode)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinRoom(room.roomId)}
                      className="bg-cream text-bg px-4 py-2 rounded-lg font-space font-semibold text-xs uppercase hover:bg-sand transition cursor-pointer"
                    >
                      Join Battle
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* MATCHMAKING QUEUE OVERLAY */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg/95 backdrop-blur-md flex flex-col justify-center items-center z-50 font-sans"
          >
            <div className="text-center space-y-6">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="w-24 h-24 rounded-full bg-olive/20 border-2 border-sand flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(203,189,147,0.25)]"
              >
                <svg className="w-10 h-10 text-sand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707" />
                </svg>
              </motion.div>
              <div className="space-y-2">
                <h3 className="font-space text-2xl font-bold tracking-wider text-cream uppercase">Searching for Opponent</h3>
                <p className="font-mono text-sm text-khaki"># Mode: {formatModeName(searchingMode)}</p>
              </div>
              <button
                onClick={handleCancelSearch}
                className="border border-sand/40 hover:border-sand hover:bg-surface/30 px-6 py-2.5 rounded-xl font-space font-semibold text-xs tracking-wider uppercase transition cursor-pointer"
              >
                Cancel Search
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HOST WAITING OVERLAY */}
      <AnimatePresence>
        {isWaitingForOpponent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg/95 backdrop-blur-md flex flex-col justify-center items-center z-50 font-sans"
          >
            <div className="text-center space-y-6 max-w-md px-6">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="w-24 h-24 rounded-full bg-olive/20 border-2 border-sand flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(203,189,147,0.25)]"
              >
                <svg className="w-10 h-10 text-sand animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </motion.div>
              <div className="space-y-2">
                <h3 className="font-space text-2xl font-bold tracking-wider text-cream uppercase">Waiting for Challenger</h3>
                <p className="font-mono text-sm text-khaki"># Battle room successfully established.</p>
              </div>

              <div className="bg-surface border border-khaki/20 rounded-xl p-4 text-left font-mono space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-khaki uppercase">Invite Code:</span>
                  <span className="text-cream text-lg font-bold">{waitingInviteCode}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-khaki uppercase">Room ID:</span>
                  <span className="text-sand text-[10px] truncate max-w-[200px]">{waitingRoomId}</span>
                </div>
              </div>

              <button
                onClick={() => setIsWaitingForOpponent(false)}
                className="border border-sand/40 hover:border-sand hover:bg-surface/30 px-6 py-2.5 rounded-xl font-space font-semibold text-xs tracking-wider uppercase transition cursor-pointer"
              >
                Return to Lobby
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CREATE ROOM MODAL */}
      <Dialog.Root open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-surface border border-khaki/20 p-8 rounded-2xl w-full max-w-md z-50 shadow-2xl overflow-hidden font-sans flex flex-col max-h-[90vh]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sand to-transparent opacity-50" />
            
            <Dialog.Title className="font-space text-2xl font-bold text-cream mb-6 flex-shrink-0">CREATE BATTLE ROOM</Dialog.Title>
            
            <form onSubmit={handleCreateRoomSubmit} className="flex-1 flex flex-col min-h-0">
              {/* Scrollable contents */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-6 min-h-0 pb-4">
                {/* Select Mode */}
                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider text-khaki font-mono">Battle Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["SYSTEM_CRASH", "ARCH_WARS", "LOAD_BREAKER"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setCreateMode(m)}
                        className={`py-2 text-[10px] font-space font-bold uppercase rounded-lg border tracking-wider transition ${
                          createMode === m
                            ? "bg-cream text-bg border-cream"
                            : "border-khaki/20 hover:border-khaki/50 text-cream"
                        }`}
                      >
                        {formatModeName(m)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Select Difficulty */}
                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider text-khaki font-mono">Difficulty</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["EASY", "MEDIUM", "HARD"].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setCreateDifficulty(d)}
                        className={`py-2 text-xs font-space font-bold uppercase rounded-lg border tracking-wider transition ${
                          createDifficulty === d
                            ? "bg-cream text-bg border-cream"
                            : "border-khaki/20 hover:border-khaki/50 text-cream"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggle Public/Private */}
                <div className="flex items-center justify-between border-t border-b border-khaki/10 py-4 font-mono text-xs">
                  <span className="text-khaki uppercase">Room Privacy</span>
                  <div className="flex items-center space-x-2">
                    <span className={!createIsPrivate ? "text-cream" : "text-khaki"}>PUBLIC</span>
                    <button
                      type="button"
                      onClick={() => setCreateIsPrivate(!createIsPrivate)}
                      className="relative w-10 h-6 bg-surface2 border border-khaki/20 rounded-full transition duration-300"
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-cream rounded-full transition transform ${
                          createIsPrivate ? "translate-x-4" : ""
                        }`}
                      />
                    </button>
                    <span className={createIsPrivate ? "text-cream" : "text-khaki"}>PRIVATE</span>
                  </div>
                </div>
              </div>

              {/* Actions - Fixed Footer */}
              <div className="flex space-x-4 pt-4 border-t border-khaki/10 mt-auto bg-surface flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="w-1/2 border border-khaki/20 hover:border-khaki/50 py-3 rounded-xl font-space font-semibold text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-cream text-bg py-3 rounded-xl font-space font-semibold text-xs uppercase tracking-wider hover:bg-sand transition cursor-pointer"
                >
                  Host Battle
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      </div>
    </SocketConnectionBoundary>
  );
}
