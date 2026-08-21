import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppNotification } from '../types';
import {
  Hammer,
  Home,
  ShieldCheck,
  Bell,
  LogOut,
  User,
  Check,
  Sparkles,
  ExternalLink,
  Volume2,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  requestWebNotificationPermission,
  markNotificationRead,
  showDesktopNotification,
} from '../lib/notifications';

export const Navbar: React.FC = () => {
  const { userProfile, logout } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [notifPermission, setNotifPermission] = useState<string>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  useEffect(() => {
    if (!userProfile?.id) return;

    const notifQuery = query(
      collection(db, 'Notifications'),
      where('recipient_id', '==', userProfile.id),
      orderBy('created_at', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      notifQuery,
      (snapshot) => {
        const notifList: AppNotification[] = [];
        snapshot.forEach((doc) => {
          notifList.push({ id: doc.id, ...doc.data() } as AppNotification);
        });

        // Check for newly added unread notifications to trigger alert
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as AppNotification;
            if (!data.read) {
              showDesktopNotification(data.title, data.message);
            }
          }
        });

        setNotifications(notifList);
      },
      (err) => {
        console.warn('Notification listener error:', err);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.id]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleRequestPermission = async () => {
    const granted = await requestWebNotificationPermission();
    if (granted) {
      setNotifPermission('granted');
    }
  };

  const handleMarkAllRead = async () => {
    for (const notif of notifications) {
      if (!notif.read) {
        await markNotificationRead(notif.id);
      }
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
            {userProfile?.role === 'shopker' ? (
              <Hammer className="w-5 h-5" />
            ) : (
              <Home className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 tracking-tight text-base sm:text-lg">
                SHOPKER<span className="text-sky-600">MARKET</span>
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-100 text-[10px] font-bold uppercase tracking-wider rounded-md">
                Live Reverse Bidding
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest leading-none">
              Interior Design & Renovation Network
            </p>
          </div>
        </div>

        {/* User profile, notifications, and actions */}
        {userProfile && (
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notification Permission Prompt if default */}
            {notifPermission === 'default' && (
              <button
                id="enable-notifications-btn"
                type="button"
                onClick={handleRequestPermission}
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors"
                title="Enable browser alerts for live job bids"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Enable Alerts</span>
              </button>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button
                id="notification-bell-btn"
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span
                    id="unread-notifications-badge"
                    className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow-xs animate-pulse font-mono"
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div
                  id="notifications-dropdown-menu"
                  className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs uppercase tracking-widest text-slate-400">System Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-sky-100 text-sky-800 rounded-md">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs text-sky-600 hover:text-sky-700 font-bold"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 py-1">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500">
                        No notifications yet. You'll receive live alerts here when requests and bids are posted.
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => markNotificationRead(notif.id)}
                          className={`py-2.5 px-2 rounded-lg text-xs cursor-pointer transition-colors ${
                            !notif.read ? 'bg-sky-50/70 font-medium' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-slate-900">{notif.title}</span>
                            <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                              {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">{notif.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Role & Verification Badge */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="hidden sm:flex flex-col items-end">
                <p className="text-xs font-semibold text-slate-700 leading-tight">
                  {userProfile.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                      userProfile.role === 'customer'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {userProfile.role === 'customer' ? 'Customer' : 'Shopker'}
                  </span>
                  {userProfile.email_verified && userProfile.phone_verified && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider">Verified</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Logout Button */}
              <button
                id="navbar-logout-btn"
                type="button"
                onClick={logout}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
