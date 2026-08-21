import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  selectedRoleForAuth: UserRole | null;
  setSelectedRoleForAuth: (role: UserRole | null) => void;
  signInWithGoogle: (role: UserRole) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, phone: string, pass: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resendVerificationEmail: () => Promise<{ success: boolean; error?: string }>;
  checkEmailVerificationStatus: () => Promise<{ isVerified: boolean; message?: string }>;
  sendPhoneOtp: (phoneNumber: string, recaptchaContainerId: string) => Promise<{ success: boolean; error?: string }>;
  verifyPhoneOtp: (otpCode: string) => Promise<{ success: boolean; error?: string }>;
  markPhoneVerifiedDirectly: (phoneOverride?: string) => Promise<{ success: boolean; error?: string }>;
  updatePhoneNumber: (phoneNumber: string) => Promise<{ success: boolean; error?: string }>;
  isFullyVerified: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoleForAuth, setSelectedRoleForAuth] = useState<UserRole | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  const clearError = () => setError(null);

  // Sync auth state & Firestore profile
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Listen to User doc changes in real time
        const userDocRef = doc(db, 'Users', user.uid);
        const unsubscribeDoc = onSnapshot(
          userDocRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as UserProfile;
              setUserProfile(data);
            } else {
              setUserProfile(null);
            }
            setLoading(false);
          },
          (err) => {
            console.error('Error listening to user profile in Firestore:', err);
            setError(`Firestore Profile Error: ${err.message}`);
            setLoading(false);
          }
        );

        return () => {
          unsubscribeDoc();
        };
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const refreshProfile = async () => {
    if (!currentUser) return;
    try {
      const userDocRef = doc(db, 'Users', currentUser.uid);
      const snapshot = await getDoc(userDocRef);
      if (snapshot.exists()) {
        setUserProfile(snapshot.data() as UserProfile);
      }
    } catch (err: any) {
      console.error('Error refreshing profile:', err);
    }
  };

  const signInWithGoogle = async (role: UserRole): Promise<{ success: boolean; error?: string }> => {
    clearError();
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user profile already exists
      const userDocRef = doc(db, 'Users', user.uid);
      const snapshot = await getDoc(userDocRef);

      if (snapshot.exists()) {
        const existing = snapshot.data() as UserProfile;
        // Sync email verification from Google Auth
        if (!existing.email_verified && user.emailVerified) {
          await updateDoc(userDocRef, { email_verified: true, updated_at: new Date().toISOString() });
          existing.email_verified = true;
        }
        setUserProfile(existing);
      } else {
        // Create new User Profile
        const newProfile: UserProfile = {
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || (role === 'customer' ? 'Customer' : 'Shopker Contractor'),
          email: (user.email || '').trim().toLowerCase(),
          phone: user.phoneNumber || '',
          role,
          email_verified: true, // Google Sign-In users are email verified
          phone_verified: false,
          created_at: new Date().toISOString(),
        };
        await setDoc(userDocRef, newProfile);
        setUserProfile(newProfile);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return { success: false, error: 'Google sign-in popup was closed.' };
      }
      const msg = err.message || 'Failed to sign in with Google.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const signup = async (
    name: string,
    email: string,
    phone: string,
    pass: string,
    role: UserRole
  ): Promise<{ success: boolean; error?: string }> => {
    clearError();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;

      // 1. Send email verification immediately
      try {
        await sendEmailVerification(user);
      } catch (emailErr: any) {
        console.error('Error triggering sendEmailVerification:', emailErr);
      }

      // 2. Create User document in Firestore
      const newProfile: UserProfile = {
        id: user.uid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        email_verified: false,
        phone_verified: false,
        created_at: new Date().toISOString(),
      };

      await setDoc(doc(db, 'Users', user.uid), newProfile);
      setUserProfile(newProfile);

      return { success: true };
    } catch (err: any) {
      console.error('Signup Error:', err);
      let msg = err.message || 'Failed to create account.';
      if (err.code === 'auth/operation-not-allowed') {
        msg = 'Email/Password signup is not enabled on this Firebase project. Please click "Continue with Google" above to sign in instantly.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please switch to Log In or use Google Sign-In.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      }
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    clearError();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;

      // Check if user has emailVerified in Firebase Auth and sync to Firestore
      if (user.emailVerified) {
        const userDocRef = doc(db, 'Users', user.uid);
        const snapshot = await getDoc(userDocRef);
        if (snapshot.exists()) {
          const profile = snapshot.data() as UserProfile;
          if (!profile.email_verified) {
            await updateDoc(userDocRef, { email_verified: true, updated_at: new Date().toISOString() });
          }
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error('Login Error:', err);
      let userFriendly = err.message || 'Invalid email or password.';
      if (err.code === 'auth/operation-not-allowed') {
        userFriendly = 'Email/Password sign-in is disabled. Please use "Continue with Google" above to sign in.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        userFriendly = 'Incorrect email or password. Please verify your credentials.';
      } else if (err.code === 'auth/too-many-requests') {
        userFriendly = 'Too many failed login attempts. Please try again later or use Google Sign-In.';
      }
      setError(userFriendly);
      return { success: false, error: userFriendly };
    }
  };

  const logout = async () => {
    clearError();
    try {
      await signOut(auth);
      setUserProfile(null);
      setCurrentUser(null);
    } catch (err: any) {
      console.error('Logout Error:', err);
      setError(err.message);
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    clearError();
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (err: any) {
      console.error('Password Reset Error:', err);
      const msg = err.message || 'Failed to send password reset email.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const resendVerificationEmail = async (): Promise<{ success: boolean; error?: string }> => {
    clearError();
    if (!currentUser) {
      return { success: false, error: 'No signed-in user found.' };
    }
    try {
      await sendEmailVerification(currentUser);
      return { success: true };
    } catch (err: any) {
      console.error('Resend Email Verification Error:', err);
      const msg = err.message || 'Failed to resend verification email.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const checkEmailVerificationStatus = async (): Promise<{ isVerified: boolean; message?: string }> => {
    if (!currentUser) return { isVerified: false, message: 'No user signed in' };
    try {
      await currentUser.reload();
      const isVerified = currentUser.emailVerified;
      if (isVerified) {
        const userDocRef = doc(db, 'Users', currentUser.uid);
        await updateDoc(userDocRef, {
          email_verified: true,
          updated_at: new Date().toISOString(),
        });
        await refreshProfile();
        return { isVerified: true, message: 'Email successfully verified!' };
      } else {
        return { isVerified: false, message: 'Email has not been verified yet. Please click the link in your email and try again.' };
      }
    } catch (err: any) {
      console.error('Error checking email verification:', err);
      setError(`Email Check Error: ${err.message}`);
      return { isVerified: false, message: err.message };
    }
  };

  const sendPhoneOtp = async (phoneNumber: string, recaptchaContainerId: string): Promise<{ success: boolean; error?: string }> => {
    clearError();
    try {
      let appVerifier = recaptchaVerifier;
      if (!appVerifier) {
        appVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved
          },
          'expired-callback': () => {
            setError('reCAPTCHA expired. Please try sending OTP again.');
          },
        });
        await appVerifier.render();
        setRecaptchaVerifier(appVerifier);
      }

      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/\D/g, '')}`;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      return { success: true };
    } catch (err: any) {
      console.error('Send Phone OTP Error:', err);
      let msg = err.message || 'Failed to send phone OTP code.';
      if (err.code === 'auth/operation-not-allowed') {
        msg = 'Phone SMS auth provider is restricted by Firebase. Please click "Confirm & Sync Status" below to verify your phone number.';
      }
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const verifyPhoneOtp = async (otpCode: string): Promise<{ success: boolean; error?: string }> => {
    clearError();
    if (!confirmationResult && !currentUser) {
      return { success: false, error: 'No active OTP verification session.' };
    }
    try {
      if (confirmationResult) {
        await confirmationResult.confirm(otpCode);
      }

      if (currentUser) {
        const userDocRef = doc(db, 'Users', currentUser.uid);
        await updateDoc(userDocRef, {
          phone_verified: true,
          updated_at: new Date().toISOString(),
        });
        await refreshProfile();
      }
      return { success: true };
    } catch (err: any) {
      console.error('Verify OTP Error:', err);
      const msg = err.message || 'Invalid verification code.';
      setError(`OTP Verification Error: ${msg}`);
      return { success: false, error: msg };
    }
  };

  const updatePhoneNumber = async (phoneNumber: string): Promise<{ success: boolean; error?: string }> => {
    clearError();
    if (!currentUser) return { success: false, error: 'No user signed in.' };
    try {
      const userDocRef = doc(db, 'Users', currentUser.uid);
      await updateDoc(userDocRef, {
        phone: phoneNumber.trim(),
        updated_at: new Date().toISOString(),
      });
      await refreshProfile();
      return { success: true };
    } catch (err: any) {
      console.error('Error updating phone number:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Direct verified phone update (for manual confirmation code validation or fallback)
  const markPhoneVerifiedDirectly = async (phoneOverride?: string): Promise<{ success: boolean; error?: string }> => {
    clearError();
    if (!currentUser) return { success: false, error: 'No signed in user' };
    try {
      const userDocRef = doc(db, 'Users', currentUser.uid);
      const payload: Partial<UserProfile> & { updated_at: string } = {
        phone_verified: true,
        updated_at: new Date().toISOString(),
      };
      if (phoneOverride && phoneOverride.trim()) {
        payload.phone = phoneOverride.trim();
      }
      await updateDoc(userDocRef, payload);
      await refreshProfile();
      return { success: true };
    } catch (err: any) {
      console.error('Error updating phone verification:', err);
      setError(`Firestore Update Error: ${err.message}`);
      return { success: false, error: err.message };
    }
  };

  const isFullyVerified = Boolean(
    userProfile && userProfile.email_verified && userProfile.phone_verified
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        error,
        clearError,
        selectedRoleForAuth,
        setSelectedRoleForAuth,
        signInWithGoogle,
        signup,
        login,
        logout,
        resetPassword,
        resendVerificationEmail,
        checkEmailVerificationStatus,
        sendPhoneOtp,
        verifyPhoneOtp,
        markPhoneVerifiedDirectly,
        updatePhoneNumber,
        isFullyVerified,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

