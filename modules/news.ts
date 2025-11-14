import { db } from '../lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { NewsItem } from '../types/index';

const newsCollection = collection(db, 'news');

export async function getNewsList(): Promise<NewsItem[]> {
    const snapshot = await getDocs(newsCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsItem));
}

export async function getNewsById(id: string): Promise<NewsItem | null> {
    const docRef = doc(db, 'news', id);
    const snap = await getDoc(docRef);
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as NewsItem) : null;
}
