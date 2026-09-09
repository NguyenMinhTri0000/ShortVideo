"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import api from "@/lib/api";
import {
  LayoutDashboard,
  Lightbulb,
  PlayCircle,
  Video,
  ShoppingBag,
  Settings,
  Terminal,
  ChevronLeft,
  ChevronRight,
  Share2,
  BarChart3,
  User,
  Users,
} from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      return saved === "true";
    } catch {
      return false;
    }
  });

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get("/auth/users");
        const list: UserProfile[] = res.data || [];
        setUsers(list);

        let saved = localStorage.getItem("active_user_id");
        if (!saved && list.length > 0) {
          saved = list[0].id;
          localStorage.setItem("active_user_id", saved);
        }
        if (saved) {
          setActiveUserId(saved);
        }
      } catch (err) {
        console.error("Failed to load users for sidebar switcher:", err);
      }
    };

    fetchUsers();
  }, []);

  const handleUserChange = (userId: string) => {
    setActiveUserId(userId);
    try {
      localStorage.setItem("active_user_id", userId);
      window.dispatchEvent(new Event("active_user_changed"));
    } catch {
      // localStorage error
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-collapsed", String(next));
      } catch {
        // localStorage not available
      }
      return next;
    });
  };

  const menuItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Sản phẩm (Affiliate)", href: "/products", icon: ShoppingBag },
    { name: "Ý tưởng (Ideas)", href: "/ideas", icon: Lightbulb },
    { name: "Hàng đợi (Jobs)", href: "/jobs", icon: PlayCircle },
    { name: "Thư viện Video", href: "/videos", icon: Video },
    { name: "Đăng Video (Publishing)", href: "/publishing", icon: Share2 },
    { name: "Phân tích (Analytics)", href: "/analytics", icon: BarChart3 },
    { name: "Cấu hình (Settings)", href: "/settings", icon: Settings },
  ];

  const currentUser = users.find((u) => u.id === activeUserId);

  return (
    <aside
      className={`border-r border-zinc-900 bg-zinc-950/80 backdrop-blur-md flex flex-col h-screen sticky top-0 transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div
        className={`p-4 border-b border-zinc-900 flex items-center h-16 ${
          isCollapsed ? "justify-center" : "gap-3 px-6"
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/10 relative group flex-shrink-0">
          <div className="absolute inset-0 rounded-lg bg-violet-600 blur-sm opacity-50 group-hover:opacity-75 transition-opacity" />
          <Terminal
            className="w-5 h-5 text-white relative z-10"
            aria-hidden="true"
          />
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <h1 className="font-bold text-sm bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 leading-none tracking-tight truncate">
              Turbo Video
            </h1>
            <span className="text-[9px] text-zinc-500 font-semibold tracking-wider uppercase">
              Engine SaaS v1.0
            </span>
          </div>
        )}
      </div>

      {/* Account Switcher Section */}
      <div className={`p-3 border-b border-zinc-900 bg-zinc-900/30 ${isCollapsed ? "px-2" : "px-4"}`}>
        {!isCollapsed ? (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Users className="w-3.5 h-3.5 text-violet-400" />
              <label htmlFor="user-account-select" className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Tài khoản đăng nhập
              </label>
            </div>
            <select
              id="user-account-select"
              value={activeUserId}
              onChange={(e) => handleUserChange(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:border-violet-500 cursor-pointer font-medium"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex justify-center" title={`Tài khoản hiện tại: ${currentUser?.name || "Tài khoản"}`}>
            <div className="w-8 h-8 rounded-full bg-violet-900/50 border border-violet-700/50 text-violet-300 flex items-center justify-center font-bold text-xs">
              {currentUser?.name ? currentUser.name.slice(-1) : <User className="w-4 h-4" />}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className={`flex-1 py-4 space-y-1 ${isCollapsed ? "px-2" : "px-4"}`}>
        {menuItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`flex items-center rounded-md transition-all duration-200 group relative ${
                isCollapsed
                  ? "justify-center w-10 h-10 mx-auto"
                  : "gap-3 px-4 py-2.5"
              } ${
                isActive
                  ? "bg-zinc-100 text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
              }`}
            >
              <item.icon
                className={`w-4 h-4 flex-shrink-0 ${
                  isActive
                    ? "text-zinc-950"
                    : "text-zinc-500 group-hover:text-zinc-300"
                }`}
                aria-hidden="true"
              />
              {!isCollapsed && <span className="text-xs">{item.name}</span>}
              {isActive && !isCollapsed && (
                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-zinc-950 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Toggle Button */}
      <div
        className={`p-3 border-t border-zinc-900 ${isCollapsed ? "px-2" : "px-4"}`}
      >
        <button
          onClick={toggleCollapse}
          className={`flex items-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40 rounded-md transition-all w-full py-2 ${
            isCollapsed ? "justify-center" : "px-4 gap-3"
          }`}
          title={isCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-semibold">Thu gọn menu</span>
            </>
          )}
        </button>
      </div>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-zinc-900 bg-zinc-950/20 text-center">
          <p className="text-[10px] text-zinc-600 font-medium">
            Powered by MoneyPrinterTurbo
          </p>
        </div>
      )}
    </aside>
  );
}
