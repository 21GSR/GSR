import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';
import firebaseConfigJson from '../../firebase-applet-config.json';

export const firebaseConfig = {
  projectId: firebaseConfigJson.projectId,
  appId: firebaseConfigJson.appId,
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  measurementId: firebaseConfigJson.measurementId,
  firestoreDatabaseId: firebaseConfigJson.firestoreDatabaseId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
// Set persistence explicitly to browserLocalPersistence
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('Failed to enable browserLocalPersistence on Firebase Auth:', err);
});

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const getMessagingSafe = async () => {
  try {
    const supported = await isSupported();
    if (supported && 'Notification' in window && 'serviceWorker' in navigator) {
      return getMessaging(app);
    }
  } catch (err) {
    console.warn('FCM not supported in this client environment:', err);
  }
  return null;
};

export default app;
