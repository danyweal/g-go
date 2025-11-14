import { auth } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, UserCredential } from 'firebase/auth';

export async function register(email: string, password: string): Promise<UserCredential> {
    return createUserWithEmailAndPassword(auth, email, password);
}

export async function login(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(auth, email, password);
}

export async function logout(): Promise<void> {
    return signOut(auth);
}
