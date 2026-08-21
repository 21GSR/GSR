import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  getDocs,
} from 'firebase/firestore';
import { db, getMessagingSafe } from './firebase';
import { AppNotification } from '../types';

export const requestWebNotificationPermission = async (): Promise<boolean> => {
  try {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notification');
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  } catch (err) {
    console.error('Error requesting notification permission:', err);
  }
  return false;
};

export const playChime = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    // Ignore audio context autoplay restrictions
  }
};

export const showDesktopNotification = (title: string, body: string) => {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
      });
      playChime();
    }
  } catch (err) {
    console.warn('Could not show desktop notification:', err);
  }
};

// Send notification to a specific user
export const sendNotificationToUser = async (
  recipientId: string,
  title: string,
  message: string,
  type: AppNotification['type'],
  linkId?: string
) => {
  try {
    const notifData: Omit<AppNotification, 'id'> = {
      recipient_id: recipientId,
      title,
      message,
      type,
      link_id: linkId,
      read: false,
      created_at: new Date().toISOString(),
    };
    await addDoc(collection(db, 'Notifications'), notifData);
  } catch (err) {
    console.error('Failed to send notification in Firestore:', err);
  }
};

// Notify all verified shopkers about a new quote request
export const broadcastNewRequestToShopkers = async (
  requestId: string,
  sqft: number,
  tier: string,
  location: string,
  estimatedPrice: number
) => {
  try {
    const usersRef = collection(db, 'Users');
    const q = query(
      usersRef,
      where('role', '==', 'shopker'),
      where('email_verified', '==', true),
      where('phone_verified', '==', true)
    );
    const snap = await getDocs(q);

    const title = '🔨 New Renovation Request Live!';
    const message = `New ${tier.toUpperCase()} request: ${sqft.toLocaleString()} sqft in ${location}. Est. ₹${estimatedPrice.toLocaleString('en-IN')}. Tap to bid!`;

    const promises = snap.docs.map((d) =>
      sendNotificationToUser(d.id, title, message, 'new_request', requestId)
    );
    await Promise.all(promises);
  } catch (err) {
    console.error('Failed broadcasting request to shopkers:', err);
  }
};

// Mark notification as read
export const markNotificationRead = async (notifId: string) => {
  try {
    await updateDoc(doc(db, 'Notifications', notifId), { read: true });
  } catch (err) {
    console.error('Failed to mark notification read:', err);
  }
};
