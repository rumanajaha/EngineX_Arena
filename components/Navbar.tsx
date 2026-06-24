// "use client";

// /* eslint-disable @next/next/no-img-element */

// import React, { useState, useEffect } from "react";
// import { usePathname, useRouter } from "next/navigation";
// import { useSession } from "next-auth/react";
// import * as Dialog from "@radix-ui/react-dialog";
// import Link from "next/link";

// const getEloBadge = (rating: number) => {
//   if (rating < 1100) return { name: "Iron", color: "text-[#a19e95] border-[#a19e95]/30 bg-[#a19e95]/10" };
//   if (rating < 1300) return { name: "Bronze", color: "text-[#c27c38] border-[#c27c38]/30 bg-[#c27c38]/10" };
//   if (rating < 1500) return { name: "Silver", color: "text-[#a5b2bc] border-[#a5b2bc]/30 bg-[#a5b2bc]/10" };
//   if (rating < 1800) return { name: "Gold", color: "text-[#e5c158] border-[#e5c158]/30 bg-[#e5c158]/10" };
//   if (rating < 2100) return { name: "Platinum", color: "text-[#4fc3f7] border-[#4fc3f7]/30 bg-[#4fc3f7]/10" };
//   return { name: "Diamond", color: "text-[#e040fb] border-[#e040fb]/30 bg-[#e040fb]/10 shadow-[0_0_15px_rgba(224,64,251,0.25)] animate-pulse" };
// };

// interface SearchResult {
//   id: string;
//   username: string;
//   avatar: string;
//   eloRating: number;
//   relationship: string;
//   friendshipId: string | null;
// }

// interface PendingRequest {
//   friendshipId: string;
//   requester: {
//     id: string;
//     username: string;
//     avatar: string;
//     eloRating: number;
//   };
//   createdAt: string;
// }

// export default function Navbar() {
//   const { data: session } = useSession();
//   const router = useRouter();
//   const pathname = usePathname();
//   const player = session?.player;

//   const sessionUsername = (session as { player?: { username?: string } | undefined })?.player?.username || (session?.user as { username?: string } | undefined)?.username || session?.user?.name || "";

//   // States
//   const [searchQuery, setSearchQuery] = useState("");
//   const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
//   const [isSearchOpen, setIsSearchOpen] = useState(false);
//   const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
//   const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
//   const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

//   // Debounced user search
//   useEffect(() => {
//     if (!searchQuery.trim()) {
//       setSearchResults([]);
//       return;
//     }
//     const delayDebounce = setTimeout(async () => {
//       try {
//         const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
//         if (res.ok) {
//           const data = await res.json();
//           setSearchResults(data);
//         }
//       } catch (err) {
//         console.error("Error searching users:", err);
//       }
//     }, 300);

//     return () => clearTimeout(delayDebounce);
//   }, [searchQuery]);

//   // Fetch pending friend requests
//   const fetchPendingRequests = async () => {
//     try {
//       const res = await fetch("/api/friends/requests");
//       if (res.ok) {
//         const data = await res.json();
//         setPendingRequests(data);
//       }
//     } catch (err) {
//       console.error("Error fetching pending requests:", err);
//     }
//   };

//   useEffect(() => {
//     if (player) {
//       fetchPendingRequests();
//       const interval = setInterval(fetchPendingRequests, 10000);
//       return () => clearInterval(interval);
//     }
//   }, [player]);

//   // Actions
//   const handleSendRequest = async (receiverId: string) => {
//     try {
//       const res = await fetch("/api/friends/request", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ receiverId }),
//       });
//       if (res.ok) {
//         setSearchResults((prev) =>
//           prev.map((item) =>
//             item.id === receiverId ? { ...item, relationship: "SENT" } : item
//           )
//         );
//       }
//     } catch (err) {
//       console.error("Error sending friend request:", err);
//     }
//   };

//   const handleAcceptRequest = async (friendshipId: string) => {
//     try {
//       const res = await fetch("/api/friends/accept", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ friendshipId }),
//       });
//       if (res.ok) {
//         fetchPendingRequests();
//         // Also refresh search query results if open
//         if (searchQuery.trim()) {
//           const searchRes = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
//           if (searchRes.ok) {
//             setSearchResults(await searchRes.json());
//           }
//         }
//       }
//     } catch (err) {
//       console.error("Error accepting friend request:", err);
//     }
//   };

//   const handleDeclineRequest = async (friendshipId: string) => {
//     try {
//       const res = await fetch("/api/friends/decline", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ friendshipId }),
//       });
//       if (res.ok) {
//         fetchPendingRequests();
//         if (searchQuery.trim()) {
//           const searchRes = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
//           if (searchRes.ok) {
//             setSearchResults(await searchRes.json());
//           }
//         }
//       }
//     } catch (err) {
//       console.error("Error declining friend request:", err);
//     }
//   };

//   // Close notifications on body click
//   useEffect(() => {
//     const handleClose = () => setIsNotificationsOpen(false);
//     document.addEventListener("click", handleClose);
//     return () => document.removeEventListener("click", handleClose);
//   }, []);

//   if (pathname === "/login" || !player) return null;

//   const badge = getEloBadge(player.eloRating);

//   const links = [
//     { label: "Hub", href: "/hub" },
//     { label: "Lobby", href: "/lobby" },
//     { label: "Leaderboard", href: "/leaderboard" },
//   ];

//   return (
//     <nav className="flex justify-between items-center px-4 md:px-8 py-3 md:py-4 border-b border-khaki/10 bg-surface/40 backdrop-blur-lg sticky top-0 z-50 flex-shrink-0 font-sans relative">
//       {/* Logo */}
//       <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push("/hub")}>
//         <div className="w-8 h-8 rounded bg-gradient-to-br from-sand to-olive flex items-center justify-center font-space font-black text-bg text-lg tracking-tighter">
//           E
//         </div>
//         <h1 className="font-space text-lg md:text-2xl font-bold tracking-tight uppercase">
//           EngineX<span className="hidden sm:inline text-sand font-light"> Arena</span>
//         </h1>
//       </div>

//       {/* Nav Links - Desktop */}
//       <div className="hidden md:flex items-center space-x-8">
//         {links.map((link) => {
//           const isActive = pathname === link.href;
//           return (
//             <button
//               key={link.href}
//               onClick={() => router.push(link.href)}
//               className={`font-space text-sm uppercase tracking-wider font-semibold transition-all relative ${
//                 isActive ? "text-sand border-b border-sand pb-1" : "text-cream/80 hover:text-sand"
//               }`}
//             >
//               {link.label}
//             </button>
//           );
//         })}
//       </div>

//       {/* Actions and Profile Details */}
//       <div className="flex items-center space-x-3 md:space-x-6 relative">

//         {/* Search Icon Button */}
//         <button
//           onClick={() => {
//             setSearchQuery("");
//             setSearchResults([]);
//             setIsSearchOpen(true);
//           }}
//           className="p-2 hover:bg-surface2/50 rounded-lg border border-khaki/15 hover:border-sand transition text-khaki hover:text-cream cursor-pointer"
//         >
//           <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
//           </svg>
//         </button>

//         {/* Notification Bell Icon Button & Dropdown */}
//         <div className="relative" onClick={(e) => e.stopPropagation()}>
//           <button
//             onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
//             className="p-2 hover:bg-surface2/50 rounded-lg border border-khaki/15 hover:border-sand transition text-khaki hover:text-cream relative cursor-pointer"
//           >
//             <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
//             </svg>

//             {pendingRequests.length > 0 && (
//               <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white shadow-md animate-pulse">
//                 {pendingRequests.length}
//               </span>
//             )}
//           </button>

//           {/* Bell Dropdown */}
//           {isNotificationsOpen && (
//             <div className="absolute right-0 mt-2 w-80 bg-surface border border-khaki/20 rounded-xl shadow-2xl z-30 font-sans overflow-hidden">
//               <div className="p-3 border-b border-khaki/10 bg-surface2/30 text-[10px] font-mono uppercase tracking-wider text-khaki">
//                 Pending Requests
//               </div>
//               <div className="max-h-60 overflow-y-auto divide-y divide-khaki/5">
//                 {pendingRequests.length === 0 ? (
//                   <div className="py-6 text-center text-xs text-khaki italic">
//                     No pending friend requests
//                   </div>
//                 ) : (
//                   pendingRequests.map((req) => (
//                     <div key={req.friendshipId} className="p-3 flex items-center justify-between gap-3 hover:bg-surface2/10 transition">
//                       <div className="flex items-center space-x-2">
//                         <img src={req.requester.avatar} alt={req.requester.username} className="w-8 h-8 rounded-lg border border-khaki/10 object-cover" />
//                         <div className="text-xs">
//                           <span className="font-space font-bold text-cream block">@{req.requester.username}</span>
//                           <span className="font-mono text-[9px] text-khaki">Rating: {req.requester.eloRating}</span>
//                         </div>
//                       </div>
//                       <div className="flex space-x-1.5 flex-shrink-0">
//                         <button
//                           onClick={() => handleAcceptRequest(req.friendshipId)}
//                           className="bg-cream hover:bg-sand text-bg text-[9px] font-space font-bold uppercase px-2 py-1.5 rounded transition cursor-pointer"
//                         >
//                           Accept
//                         </button>
//                         <button
//                           onClick={() => handleDeclineRequest(req.friendshipId)}
//                           className="border border-khaki/20 hover:border-khaki/50 text-cream text-[9px] font-space font-semibold uppercase px-2 py-1.5 rounded transition cursor-pointer"
//                         >
//                           Decline
//                         </button>
//                       </div>
//                     </div>
//                   ))
//                 )}
//               </div>
//             </div>
//           )}
//         </div>

//         {/* Profile Details */}
//         <Link href={`/profile/${sessionUsername}`} className="flex items-center space-x-2 md:space-x-4 hover:opacity-90 transition">
//           <div className="hidden md:block text-right">
//             <span className="font-space font-medium text-cream block hover:text-sand transition text-sm leading-tight text-right">
//               {player.username}
//             </span>
//             <div className="flex items-center space-x-1.5 justify-end mt-1">
//               <span className={`px-1.5 py-0.25 border text-[8px] font-mono font-bold rounded uppercase tracking-wider ${badge.color}`}>
//                 {badge.name}
//               </span>
//               <span className="font-mono text-[9px] text-khaki">{player.eloRating} ELO</span>
//             </div>
//           </div>
//           <img
//             src={player.avatar}
//             alt={player.username}
//             className="w-8 h-8 md:w-10 md:h-10 rounded-xl border border-khaki/20 hover:border-sand hover:scale-105 transition cursor-pointer object-cover flex-shrink-0"
//           />
//         </Link>

//         {/* Hamburger Menu Button */}
//         <button
//           onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
//           className="p-2 md:hidden hover:bg-surface2/50 rounded-lg border border-khaki/15 text-khaki hover:text-cream cursor-pointer flex items-center justify-center"
//         >
//           <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
//             {isMobileMenuOpen ? (
//               <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
//             ) : (
//               <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
//             )}
//           </svg>
//         </button>
//       </div>

//       {/* Mobile Links Dropdown */}
//       {isMobileMenuOpen && (
//         <div className="absolute top-full left-0 right-0 bg-bg/95 border-b border-khaki/10 backdrop-blur-lg flex flex-col p-4 space-y-3 md:hidden z-40">
//           {links.map((link) => {
//             const isActive = pathname === link.href;
//             return (
//               <button
//                 key={link.href}
//                 onClick={() => {
//                   router.push(link.href);
//                   setIsMobileMenuOpen(false);
//                 }}
//                 className={`font-space text-sm uppercase tracking-wider font-semibold py-2 text-left transition-all ${
//                   isActive ? "text-sand pl-2 border-l-2 border-sand" : "text-cream/80"
//                 }`}
//               >
//                 {link.label}
//               </button>
//             );
//           })}
//         </div>
//       )}

//       {/* USER SEARCH POPUP DIALOG */}
//       <Dialog.Root open={isSearchOpen} onOpenChange={setIsSearchOpen}>
//         <Dialog.Portal>
//           <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
//           <Dialog.Content className="fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-surface border border-khaki/20 rounded-2xl w-full max-w-md z-50 shadow-2xl relative flex flex-col overflow-hidden font-sans">
//             <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sand to-transparent opacity-60 z-10" />

//             {/* Header */}
//             <div className="p-4 border-b border-khaki/10 flex items-center justify-between">
//               <Dialog.Title className="font-space text-base font-bold text-cream uppercase">
//                 Search Players
//               </Dialog.Title>
//               <Dialog.Close className="text-khaki hover:text-cream cursor-pointer">
//                 <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
//                 </svg>
//               </Dialog.Close>
//             </div>

//             {/* Input search */}
//             <div className="p-4 bg-bg/50">
//               <input
//                 type="text"
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 placeholder="Enter player username..."
//                 className="w-full bg-bg border border-khaki/20 text-cream p-3 rounded-lg text-xs focus:outline-none focus:border-sand"
//                 autoFocus
//               />
//             </div>

//             {/* Search results list */}
//             <div className="max-h-72 overflow-y-auto divide-y divide-khaki/5">
//               {searchQuery.trim() && searchResults.length === 0 ? (
//                 <div className="py-8 text-center text-xs text-khaki italic">
//                   No players matched query
//                 </div>
//               ) : (
//                 searchResults.map((result) => {
//                   const resultBadge = getEloBadge(result.eloRating);
//                   return (
//                     <div key={result.id} className="p-3 flex items-center justify-between gap-3 hover:bg-surface2/10 transition">
//                       <div className="flex items-center space-x-3">
//                         <img
//                           src={result.avatar}
//                           alt={result.username}
//                           className="w-10 h-10 rounded-lg border border-khaki/20 object-cover cursor-pointer"
//                           onClick={() => {
//                             setIsSearchOpen(false);
//                             router.push(`/profile/${result.username}`);
//                           }}
//                         />
//                         <div>
//                           <span
//                             className="font-space font-bold text-cream hover:text-sand cursor-pointer block text-xs"
//                             onClick={() => {
//                               setIsSearchOpen(false);
//                               router.push(`/profile/${result.username}`);
//                             }}
//                           >
//                             @{result.username}
//                           </span>
//                           <span className={`text-[8px] font-mono border px-1 rounded uppercase mt-0.5 inline-block ${resultBadge.color}`}>
//                             {resultBadge.name}
//                           </span>
//                         </div>
//                       </div>

//                       <div className="flex-shrink-0">
//                         {result.relationship === "FRIENDS" ? (
//                           <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-sand px-2.5 py-1.5 border border-sand/20 bg-sand/5 rounded-lg">
//                             Friends
//                           </span>
//                         ) : result.relationship === "SENT" ? (
//                           <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-khaki px-2.5 py-1.5 border border-khaki/20 bg-khaki/5 rounded-lg">
//                             Pending
//                           </span>
//                         ) : result.relationship === "RECEIVED" ? (
//                           <button
//                             onClick={() => result.friendshipId && handleAcceptRequest(result.friendshipId)}
//                             className="bg-cream hover:bg-sand text-bg text-[9px] font-space font-bold uppercase px-3 py-1.5 rounded-lg tracking-wider transition cursor-pointer"
//                           >
//                             Accept
//                           </button>
//                         ) : (
//                           <button
//                             onClick={() => handleSendRequest(result.id)}
//                             className="bg-cream hover:bg-sand text-bg text-[9px] font-space font-bold uppercase px-3 py-1.5 rounded-lg tracking-wider transition cursor-pointer"
//                           >
//                             Add Friend
//                           </button>
//                         )}
//                       </div>
//                     </div>
//                   );
//                 })
//               )}
//             </div>
//           </Dialog.Content>
//         </Dialog.Portal>
//       </Dialog.Root>
//     </nav>
//   );
// }
"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";

const getEloBadge = (rating: number) => {
  if (rating < 1100) return { name: "Iron", color: "text-[#a19e95] border-[#a19e95]/30 bg-[#a19e95]/10" };
  if (rating < 1300) return { name: "Bronze", color: "text-[#c27c38] border-[#c27c38]/30 bg-[#c27c38]/10" };
  if (rating < 1500) return { name: "Silver", color: "text-[#a5b2bc] border-[#a5b2bc]/30 bg-[#a5b2bc]/10" };
  if (rating < 1800) return { name: "Gold", color: "text-[#e5c158] border-[#e5c158]/30 bg-[#e5c158]/10" };
  if (rating < 2100) return { name: "Platinum", color: "text-[#4fc3f7] border-[#4fc3f7]/30 bg-[#4fc3f7]/10" };
  return { name: "Diamond", color: "text-[#e040fb] border-[#e040fb]/30 bg-[#e040fb]/10 shadow-[0_0_15px_rgba(224,64,251,0.25)] animate-pulse" };
};

interface SearchResult {
  id: string;
  username: string;
  avatar: string;
  eloRating: number;
  relationship: string;
  friendshipId: string | null;
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

export default function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const player = session?.player;

  const sessionUsername =
    (session as { player?: { username?: string } | undefined })?.player?.username ||
    (session?.user as { username?: string } | undefined)?.username ||
    session?.user?.name ||
    "";

  // States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Debounced user search
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

  // Fetch pending friend requests
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
      fetchPendingRequests();
      const interval = setInterval(fetchPendingRequests, 10000);
      return () => clearInterval(interval);
    }
  }, [player]);

  // Close all dropdowns on outside click
  useEffect(() => {
    const handleClose = () => {
      setIsNotificationsOpen(false);
      setIsProfileOpen(false);
    };
    document.addEventListener("click", handleClose);
    return () => document.removeEventListener("click", handleClose);
  }, []);

  // Actions
  const handleSendRequest = async (receiverId: string) => {
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
      }
    } catch (err) {
      console.error("Error sending friend request:", err);
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
        fetchPendingRequests();
        if (searchQuery.trim()) {
          const searchRes = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
          if (searchRes.ok) setSearchResults(await searchRes.json());
        }
      }
    } catch (err) {
      console.error("Error accepting friend request:", err);
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
        fetchPendingRequests();
        if (searchQuery.trim()) {
          const searchRes = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
          if (searchRes.ok) setSearchResults(await searchRes.json());
        }
      }
    } catch (err) {
      console.error("Error declining friend request:", err);
    }
  };

  if (pathname === "/login" || !player) return null;

  const badge = getEloBadge(player.eloRating);

  const links = [
    { label: "Hub", href: "/hub" },
    { label: "Lobby", href: "/lobby" },
    { label: "Friends", href: "/friends" },
    { label: "Leaderboard", href: "/leaderboard" },
  ];

  return (
    <nav className="flex justify-between items-center px-4 md:px-8 py-3 md:py-4 border-b border-khaki/10 bg-surface/40 backdrop-blur-lg sticky top-0 z-50 flex-shrink-0 font-sans relative">
      {/* Logo */}
      <div
        className="flex items-center space-x-3 cursor-pointer"
        onClick={() => router.push("/hub")}
      >
        <div className="w-8 h-8 rounded bg-gradient-to-br from-sand to-olive flex items-center justify-center font-space font-black text-bg text-lg tracking-tighter">
          E
        </div>
        <h1 className="font-space text-lg md:text-2xl font-bold tracking-tight uppercase">
          EngineX<span className="hidden sm:inline text-sand font-light"> Arena</span>
        </h1>
      </div>

      {/* Nav Links - Desktop */}
      <div className="hidden md:flex items-center space-x-8">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className={`font-space text-sm uppercase tracking-wider font-semibold transition-all relative ${isActive
                ? "text-sand border-b border-sand pb-1"
                : "text-cream/80 hover:text-sand"
                }`}
            >
              {link.label}
            </button>
          );
        })}
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center space-x-3 md:space-x-4 relative">

        {/* Search Button */}
        <button
          onClick={() => {
            setSearchQuery("");
            setSearchResults([]);
            setIsSearchOpen(true);
          }}
          className="p-2 hover:bg-surface2/50 rounded-lg border border-khaki/15 hover:border-sand transition text-khaki hover:text-cream cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsNotificationsOpen(!isNotificationsOpen);
            }}
            className="p-2 hover:bg-surface2/50 rounded-lg border border-khaki/15 hover:border-sand transition text-khaki hover:text-cream relative cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white shadow-md animate-pulse">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isNotificationsOpen && (
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 bg-surface border border-khaki/20 rounded-xl shadow-2xl z-30 overflow-hidden"
              >
                <div className="p-3 border-b border-khaki/10 bg-surface2/30 text-[10px] font-mono uppercase tracking-wider text-khaki">
                  Pending Requests
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-khaki/5">
                  {pendingRequests.length === 0 ? (
                    <div className="py-6 text-center text-xs text-khaki italic">
                      No pending friend requests
                    </div>
                  ) : (
                    pendingRequests.map((req) => (
                      <div
                        key={req.friendshipId}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-surface2/10 transition"
                      >
                        <div className="flex items-center space-x-2">
                          <img
                            src={req.requester.avatar}
                            alt={req.requester.username}
                            className="w-8 h-8 rounded-lg border border-khaki/10 object-cover"
                          />
                          <div className="text-xs">
                            <span className="font-space font-bold text-cream block">
                              @{req.requester.username}
                            </span>
                            <span className="font-mono text-[9px] text-khaki">
                              Rating: {req.requester.eloRating}
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleAcceptRequest(req.friendshipId)}
                            className="bg-cream hover:bg-sand text-bg text-[9px] font-space font-bold uppercase px-2 py-1.5 rounded transition cursor-pointer"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleDeclineRequest(req.friendshipId)}
                            className="border border-khaki/20 hover:border-khaki/50 text-cream text-[9px] font-space font-semibold uppercase px-2 py-1.5 rounded transition cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile Dropdown */}
        <div className="relative flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setIsProfileOpen(false);
              router.push('/profile/' + sessionUsername);
            }}
            className="flex items-center space-x-2 md:space-x-3 hover:opacity-90 transition text-left"
          >
            <div className="hidden md:block text-right">
              <span className="font-space font-medium text-cream block hover:text-sand transition text-sm leading-tight text-right">
                {player.username}
              </span>
              <div className="flex items-center space-x-1.5 justify-end mt-1">
                <span className={`px-1.5 border text-[8px] font-mono font-bold rounded uppercase tracking-wider ${badge.color}`}>
                  {badge.name}
                </span>
                <span className="font-mono text-[9px] text-khaki">{player.eloRating} ELO</span>
              </div>
            </div>
            <img
              src={player.avatar}
              alt={player.username}
              className="w-8 h-8 md:w-10 md:h-10 rounded-xl border border-khaki/20 hover:border-sand hover:scale-105 transition cursor-pointer object-cover flex-shrink-0"
            />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsProfileOpen(!isProfileOpen);
            }}
            className="p-1.5 hover:bg-surface2/50 rounded-lg text-khaki hover:text-cream transition cursor-pointer self-stretch flex items-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-3 w-56 bg-surface border border-[#574A24]/40 rounded-xl shadow-2xl z-50 overflow-hidden"
              >
                {/* User info header */}
                <div className="p-3 border-b border-khaki/10 bg-surface2/40 flex items-center space-x-3">
                  <img
                    src={player.avatar}
                    alt={player.username}
                    className="w-9 h-9 rounded-lg border border-khaki/20 object-cover"
                  />
                  <div>
                    <p className="font-space font-bold text-cream text-xs">@{player.username}</p>
                    <p className="font-mono text-[9px] text-khaki">
                      {player.eloRating} ELO · {badge.name}
                    </p>
                  </div>
                </div>

                {/* Menu items */}
                <div className="p-1.5 flex flex-col gap-0.5">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push(`/profile/${sessionUsername}`);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-space text-cream hover:bg-surface2/50 hover:text-sand transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    View Profile
                  </button>

                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push("/settings");
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-space text-cream hover:bg-surface2/50 hover:text-sand transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </button>

                  <div className="border-t border-khaki/10 my-1" />

                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-space text-red-400 hover:bg-red-500/10 hover:text-red-300 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hamburger - Mobile */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 md:hidden hover:bg-surface2/50 rounded-lg border border-khaki/15 text-khaki hover:text-cream cursor-pointer flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Links Dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-bg/95 border-b border-khaki/10 backdrop-blur-lg flex flex-col p-4 space-y-3 md:hidden z-40">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <button
                key={link.href}
                onClick={() => {
                  router.push(link.href);
                  setIsMobileMenuOpen(false);
                }}
                className={`font-space text-sm uppercase tracking-wider font-semibold py-2 text-left transition-all ${isActive ? "text-sand pl-2 border-l-2 border-sand" : "text-cream/80"
                  }`}
              >
                {link.label}
              </button>
            );
          })}
          <div className="border-t border-khaki/10 pt-2">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="font-space text-sm uppercase tracking-wider font-semibold py-2 text-left text-red-400 w-full"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* USER SEARCH DIALOG */}
      <Dialog.Root open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-surface border border-khaki/20 rounded-2xl w-full max-w-md z-50 shadow-2xl overflow-hidden font-sans">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sand to-transparent opacity-60" />

            <div className="p-4 border-b border-khaki/10 flex items-center justify-between">
              <Dialog.Title className="font-space text-base font-bold text-cream uppercase">
                Search Players
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
                placeholder="Enter player username..."
                className="w-full bg-bg border border-khaki/20 text-cream p-3 rounded-lg text-xs focus:outline-none focus:border-sand"
                autoFocus
              />
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-khaki/5">
              {searchQuery.trim() && searchResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-khaki italic">
                  No players matched query
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
                            onClick={() => handleSendRequest(result.id)}
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
    </nav>
  );
}