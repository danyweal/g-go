import { db } from '../lib/firebase';
import { collection, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { Post } from '../types/index';

const postsCollection = collection(db, 'posts');

export async function getPostsList(): Promise<Post[]> {
    const snapshot = await getDocs(postsCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
}

export async function getPostById(id: string): Promise<Post | null> {
    const docRef = doc(db, 'posts', id);
    const snap = await getDoc(docRef);
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Post) : null;
}

export async function createPost(data: Omit<Post, 'id'>): Promise<Post> {
    const docRef = await addDoc(postsCollection, { ...data, createdAt: new Date() });
    return { id: docRef.id, ...data } as Post;
}
