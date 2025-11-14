import { db, storage } from '../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MediaItem } from '../types/media';

const mediaCollection = collection(db, 'media');

export async function getMediaList(): Promise<MediaItem[]> {
    const snapshot = await getDocs(mediaCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MediaItem));
}

export async function uploadMedia(file: File): Promise<MediaItem> {
    const storageRef = ref(storage, `media/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    const docRef = await addDoc(mediaCollection, { url, name: file.name, createdAt: new Date() });
    return { id: docRef.id, url, name: file.name } as MediaItem;
}

export async function deleteMedia(id: string): Promise<void> {
    const docRef = doc(db, 'media', id);
    await deleteDoc(docRef);
}
