"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { AnimatePresence, motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { useToast } from "@/components/providers/ToastProvider";

interface Friend {
  id: string;
  username: string;
  avatar: string;
  eloRating: number;
}

interface ChatMessage {
  playerId: string;
  username: string;
  avatar: string;
  message: string;
  timestamp: string;
}

interface PendingRequest {
  friendshipId: string;
  requester: {
    id: string;
    username: string;
    avatar: string;
    eloRating: number;
  };
  createdAt: string;
}

interface SearchResult {
  id: string;
  username: string;
  avatar: string;
  eloRating: number;
  relationship: string;
  friendshipId: string | null;
}

const getEloBadge = (rating: number) => {
  if (rating < 1100) return { name: "Iron", color: "text-[#a19e95] border-[#a19e95]/30 bg-[#a19e95]/10" };
  if (rating < 1300) return { name: "Bronze", color: "text-[#c27c38] border-[#c27c38]/30 bg-[#c27c38]/10" };
  if (rating < 1500) return { name: "Silver", color: "text-[#a5b2bc] border-[#a5b2bc]/30 bg-[#a5b2bc]/10" };
  if (rating < 1800) return { name: "Gold", color: "text-[#e5c158] border-[#e5c158]/30 bg-[#e5c158]/10" };
  if (rating < 2100) return { name: "Platinum", color: "text-[#4fc3f7] border-[#4fc3f7]/30 bg-[#4fc3f7]/10" };
  return { name: "Diamond", color: "text-[#e040fb] border-[#e040fb]/30 bg-[#e040fb]/10 shadow-[0_0_15px_rgba(224,64,251,0.25)] animate-pulse" };
};

export default function FriendsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const player = session?.player;
  const { showToast } = useToast();

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Lists & data states
  const [friends, setFriends] = useState<Friend[]>([]);
  const [onlinePlayerIds, setOnlinePlayerIds] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  // Selection & interaction states
  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [dms, setDms] = useState<Record<string, ChatMessage[]>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [messageInput, setMessageInput] = useState("");
  const [filterQuery, setFilterQuery] = useState("");

  // Search Modal states
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Mobile navigation helper
  const [mobileView, setMobileView] = useState<"sidebar" | "chat">("sidebar");

  // Keep references to active states for socket handlers
  const activeFriendRef = useRef<Friend | null>(null);
  useEffect(() => {
    activeFriendRef.current = activeFriend;
  }, [activeFriend]);

  // Fetch friends list
  const fetchFriends = async () => {
    try {
      const res = await fetch("/api/friends/list");
      if (res.ok) {
        const data = await res.json();
        setFriends(data);
      } else {
        const fallback = await fetch("/api/friends");
        if (fallback.ok) {
          const data = await fallback.json();
          setFriends(data);
        }
      }
    } catch (err) {
      console.error("Error fetching friends:", err);
    }
  };

  // Fetch pending requests
  const fetchPendingRequests = async () => {
    try {
      const res = await fetch("/api/friends/requests");
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data);
      }
    } catch (err) {
      console.error("Error fetching pending requests:", err);
    }
  };

  useEffect(() => {
    if (player) {
      fetchFriends();
      fetchPendingRequests();
      // Periodically refresh list states
      const interval = setInterval(() => {
        fetchFriends();
        fetchPendingRequests();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [player]);

  // Handle Socket.io synchronization
  useEffect(() => {
    if (!player) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    const socket = io(socketUrl);
    socketRef.current = socket;

    socket.emit("join:lobby", player.id);

    socket.on("lobby:players_update", (data: { count: number; onlinePlayerIds?: string[] }) => {
      if (data.onlinePlayerIds) {
        setOnlinePlayerIds(data.onlinePlayerIds);
      }
    });

    socket.on("dm:receive", (data: { fromId: string; username: string; avatar: string; message: string; timestamp: string }) => {
      const currentActive = activeFriendRef.current;

      setDms((prev) => {
        const key = data.fromId;
        const currentList = prev[key] || [];
        return {
          ...prev,
          [key]: [
            ...currentList,
            {
              playerId: data.fromId,
              username: data.username,
              avatar: data.avatar,
              message: data.message,
              timestamp: data.timestamp,
            },
          ],
        };
      });

      // Handle unread counts if not selected
      if (!currentActive || currentActive.id !== data.fromId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [data.fromId]: (prev[data.fromId] || 0) + 1,
        }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [player]);

  // Scroll to chat end when new messages arrive or when active friend changes
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [dms, activeFriend]);

  // Handle debounced search in add friend modal
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error("Error searching users:", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Friend requests actions
  const handleSendFriendRequest = async (receiverId: string) => {
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId }),
      });
      if (res.ok) {
        setSearchResults((prev) =>
          prev.map((item) =>
            item.id === receiverId ? { ...item, relationship: "SENT" } : item
          )
        );
        showToast("Request Sent", "Friend request transmitted.", "success");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      const res = await fetch("/api/friends/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId }),
      });
      if (res.ok) {
        showToast("Accepted", "Friend request accepted.", "success");
        fetchFriends();
        fetchPendingRequests();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    try {
      const res = await fetch("/api/friends/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId }),
      });
      if (res.ok) {
        showToast("Declined", "Friend request declined.", "info");
        fetchPendingRequests();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Chat message sending
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeFriend || !player || !socketRef.current) return;

    const messageText = messageInput.trim();
    socketRef.current.emit("dm:send", {
      toId: activeFriend.id,
      message: messageText,
    });

    const newMsg: ChatMessage = {
      playerId: player.id,
      username: player.username,
      avatar: player.avatar,
      message: messageText,
      timestamp: new Date().toISOString(),
    };

    setDms((prev) => {
      const key = activeFriend.id;
      const currentList = prev[key] || [];
      return {
        ...prev,
        [key]: [...currentList, newMsg],
      };
    });

    setMessageInput("");
  };

  // Select friend from sidebar
  const handleSelectFriend = (friend: Friend) => {
    setActiveFriend(friend);
    setUnreadCounts((prev) => ({
      ...prev,
      [friend.id]: 0,
    }));
    setMobileView("chat");
  };

  // Filters friends list
  const filteredFriends = friends.filter((f) =>
    f.username.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-57px)] md:h-[calc(100vh-73px)] w-full flex bg-bg text-cream font-sans overflow-hidden relative">
      {/* Sci-Fi Decorative Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(128,119,92,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(128,119,92,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Main Dual-pane Container */}
      <div className="flex-1 flex overflow-hidden w-full relative z-10">

        {/* LEFT SIDEBAR PANEL */}
        <aside className={`${mobileView === "chat" ? "hidden" : "flex"} md:flex w-full md:w-80 border-r border-khaki/10 bg-surface/30 flex-col h-full overflow-hidden flex-shrink-0`}>
          {/* Header search / action buttons */}
          <div className="p-4 border-b border-khaki/10 flex flex-col gap-3 bg-surface2/15 flex-shrink-0">
            <div className="flex justify-between items-center">
              <h2 className="font-space font-bold uppercase text-xs tracking-wider text-sand">Communications</h2>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setIsSearchOpen(true);
                }}
                className="bg-cream hover:bg-sand text-bg text-[10px] font-space font-bold uppercase px-2.5 py-1.5 rounded transition cursor-pointer"
              >
                Add Friend
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Search friend list..."
                className="w-full bg-bg/60 border border-khaki/20 text-cream px-3 py-2 pl-8 rounded-lg text-xs focus:outline-none focus:border-sand"
              />
              <svg className="w-3.5 h-3.5 text-khaki/50 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Friends List Container */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-khaki/5">
            {filteredFriends.length === 0 ? (
              <div className="py-12 text-center text-xs text-khaki italic">
                {friends.length === 0 ? "No friends yet" : "No matching friends"}
              </div>
            ) : (
              filteredFriends.map((friend) => {
                const isOnline = onlinePlayerIds.includes(friend.id);
                const friendBadge = getEloBadge(friend.eloRating);
                const lastMsgs = dms[friend.id] || [];
                const lastMsg = lastMsgs[lastMsgs.length - 1];
                const unread = unreadCounts[friend.id] || 0;
                const isSelected = activeFriend?.id === friend.id;

                return (
                  <div
                    key={friend.id}
                    onClick={() => handleSelectFriend(friend)}
                    className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition select-none border border-transparent ${isSelected
                        ? "bg-surface2/60 border-khaki/20 shadow-inner"
                        : "hover:bg-surface2/20 hover:border-khaki/10"
                      }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img src={friend.avatar} alt={friend.username} className="w-10 h-10 rounded-lg border border-khaki/15 object-cover" />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg ${isOnline ? "bg-sand animate-pulse" : "bg-zinc-600"
                          }`}
                      />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-space font-semibold text-cream text-xs truncate">@{friend.username}</span>
                        <span className={`text-[8px] font-mono border px-1 rounded uppercase ${friendBadge.color}`}>
                          {friendBadge.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-khaki">
                        <span className="truncate max-w-[120px] font-sans">
                          {lastMsg ? lastMsg.message : "No messages"}
                        </span>
                        {unread > 0 && (
                          <span className="bg-sand text-bg font-bold font-mono px-1.5 py-0.25 rounded-full text-[9px] min-w-4 text-center">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pending Friend Requests Section */}
          <div className="mt-auto border-t border-khaki/10 bg-surface2/10 flex-shrink-0 flex flex-col overflow-hidden max-h-48">
            <div className="p-3 bg-surface2/25 border-b border-khaki/10 text-[9px] font-mono uppercase tracking-wider text-khaki flex justify-between items-center">
              <span>Pending Requests</span>
              {pendingRequests.length > 0 && (
                <span className="bg-red-900/40 text-red-400 border border-red-500/20 text-[8px] px-1.5 py-0.25 rounded-full font-bold">
                  {pendingRequests.length}
                </span>
              )}
            </div>
            <div className="overflow-y-auto p-2 space-y-1.5">
              {pendingRequests.length === 0 ? (
                <div className="py-4 text-center text-[10px] text-khaki italic">
                  No pending requests
                </div>
              ) : (
                pendingRequests.map((req) => (
                  <div key={req.friendshipId} className="p-2 bg-bg/40 border border-khaki/5 rounded-lg flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <img src={req.requester.avatar} alt={req.requester.username} className="w-7 h-7 rounded border border-khaki/10 object-cover flex-shrink-0" />
                      <div className="text-[10px] truncate">
                        <span className="font-space font-bold text-cream block truncate">@{req.requester.username}</span>
                        <span className="font-mono text-[8px] text-khaki">ELO: {req.requester.eloRating}</span>
                      </div>
                    </div>
                    <div className="flex space-x-1 flex-shrink-0">
                      <button
                        onClick={() => handleAcceptRequest(req.friendshipId)}
                        className="bg-cream hover:bg-sand text-bg text-[9px] font-space font-bold uppercase px-2 py-1 rounded transition cursor-pointer"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(req.friendshipId)}
                        className="border border-khaki/20 hover:border-khaki/50 text-cream text-[9px] font-space font-semibold uppercase px-2 py-1 rounded transition cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL - ACTIVE CHAT AREA */}
        <main className={`${mobileView === "sidebar" ? "hidden" : "flex"} md:flex flex-1 flex-col h-full bg-bg/25 overflow-hidden`}>
          {activeFriend ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Active Chat Header */}
              <div className="p-4 border-b border-khaki/10 bg-surface/50 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setMobileView("sidebar")}
                    className="md:hidden p-1.5 mr-1 bg-surface2/60 border border-khaki/10 text-khaki hover:text-cream rounded-lg cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="relative">
                    <img src={activeFriend.avatar} alt={activeFriend.username} className="w-10 h-10 rounded-xl border border-khaki/20 object-cover" />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg ${onlinePlayerIds.includes(activeFriend.id) ? "bg-sand animate-pulse" : "bg-zinc-600"
                        }`}
                    />
                  </div>
                  <div>
                    <h3 className="font-space font-bold text-sm text-cream">@{activeFriend.username}</h3>
                    <p className="font-mono text-[9px] text-khaki mt-0.5">
                      {onlinePlayerIds.includes(activeFriend.id) ? "ACTIVE IN ARENA" : "OFFLINE"} · RATING: {activeFriend.eloRating} ELO
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => router.push(`/profile/${activeFriend.username}`)}
                  className="border border-khaki/20 hover:border-sand/40 hover:bg-surface2 text-cream font-space text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg tracking-wider transition cursor-pointer"
                >
                  View Profile
                </button>
              </div>

              {/* DM Chat Message Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg/40">
                {(dms[activeFriend.id] || []).length === 0 ? (
                  <div className="h-full flex flex-col justify-center items-center text-center text-khaki font-mono text-xs">
                    <svg className="w-8 h-8 text-khaki/20 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    NO MESSAGE HISTORY WITH @{activeFriend.username.toUpperCase()}.
                    <br />
                    SAY HELLO TO INITIATE CHAT COMMS.
                  </div>
                ) : (
                  (dms[activeFriend.id] || []).map((msg, index) => {
                    const isMe = msg.playerId === player?.id;
                    return (
                      <div
                        key={index}
                        className={`flex flex-col max-w-[70%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"
                          }`}
                      >
                        <div className="flex items-center space-x-1.5 mb-1">
                          {!isMe && (
                            <img src={msg.avatar} alt={msg.username} className="w-4 h-4 rounded border border-khaki/10 object-cover" />
                          )}
                          <span className="font-space font-bold text-[9px] text-khaki">
                            {isMe ? "YOU" : `@${msg.username}`}
                          </span>
                          <span className="font-mono text-[8px] text-khaki/40">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div
                          className={`p-3 rounded-xl text-xs font-sans break-words leading-relaxed border ${isMe
                              ? "bg-olive/35 border-sand/20 text-cream"
                              : "bg-surface border-khaki/15 text-cream/90"
                            }`}
                        >
                          {msg.message}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-khaki/10 bg-surface/40 flex-shrink-0">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={`Transmit message to @${activeFriend.username}...`}
                    className="flex-1 bg-bg border border-khaki/20 text-cream px-3.5 py-3 rounded-xl text-xs focus:outline-none focus:border-sand"
                  />
                  <button
                    type="submit"
                    className="bg-cream hover:bg-sand text-bg px-6 py-3 rounded-xl font-space font-bold text-xs uppercase tracking-wider transition cursor-pointer flex-shrink-0"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 text-khaki font-mono text-sm relative">
              <div className="absolute top-1/4 w-[300px] h-[300px] bg-olive/5 blur-[80px] rounded-full pointer-events-none" />
              <svg className="w-16 h-16 text-khaki/10 mb-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
              SELECT A CONVERSATION FROM THE SIDEBAR TO INITIATE COMMS.
            </div>
          )}
        </main>

      </div>

      {/* SEARCH / ADD FRIEND DIALOG POPUP */}
      <Dialog.Root open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
          <Dialog.Content className="fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-surface border border-khaki/20 rounded-2xl w-full max-w-md z-50 shadow-2xl overflow-hidden font-sans">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sand to-transparent opacity-60" />

            <div className="p-4 border-b border-khaki/10 flex items-center justify-between">
              <Dialog.Title className="font-space text-base font-bold text-cream uppercase">
                Find Recruits
              </Dialog.Title>
              <Dialog.Close className="text-khaki hover:text-cream cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Dialog.Close>
            </div>

            <div className="p-4 bg-bg/50">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search username..."
                className="w-full bg-bg border border-khaki/20 text-cream p-3 rounded-lg text-xs focus:outline-none focus:border-sand"
                autoFocus
              />
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-khaki/5">
              {searchQuery.trim() && searchResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-khaki italic">
                  No recruits matched search query
                </div>
              ) : (
                searchResults.map((result) => {
                  const resultBadge = getEloBadge(result.eloRating);
                  return (
                    <div
                      key={result.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-surface2/10 transition"
                    >
                      <div className="flex items-center space-x-3">
                        <img
                          src={result.avatar}
                          alt={result.username}
                          className="w-10 h-10 rounded-lg border border-khaki/20 object-cover cursor-pointer"
                          onClick={() => {
                            setIsSearchOpen(false);
                            router.push(`/profile/${result.username}`);
                          }}
                        />
                        <div>
                          <span
                            className="font-space font-bold text-cream hover:text-sand cursor-pointer block text-xs"
                            onClick={() => {
                              setIsSearchOpen(false);
                              router.push(`/profile/${result.username}`);
                            }}
                          >
                            @{result.username}
                          </span>
                          <span className={`text-[8px] font-mono border px-1 rounded uppercase mt-0.5 inline-block ${resultBadge.color}`}>
                            {resultBadge.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {result.relationship === "FRIENDS" ? (
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-sand px-2.5 py-1.5 border border-sand/20 bg-sand/5 rounded-lg">
                            Friends
                          </span>
                        ) : result.relationship === "SENT" ? (
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-khaki px-2.5 py-1.5 border border-khaki/20 bg-khaki/5 rounded-lg">
                            Pending
                          </span>
                        ) : result.relationship === "RECEIVED" ? (
                          <button
                            onClick={() => result.friendshipId && handleAcceptRequest(result.friendshipId)}
                            className="bg-cream hover:bg-sand text-bg text-[9px] font-space font-bold uppercase px-3 py-1.5 rounded-lg tracking-wider transition cursor-pointer"
                          >
                            Accept
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSendFriendRequest(result.id)}
                            className="bg-cream hover:bg-sand text-bg text-[9px] font-space font-bold uppercase px-3 py-1.5 rounded-lg tracking-wider transition cursor-pointer"
                          >
                            Add Friend
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
