// components/UploadMediaForm.tsx
'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  collection,
  addDoc,
  serverTimestamp as firestoreTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { storage, db, ensureAnonymousAuth } from '../lib/firebase';
import Button from './Button';
import type { User } from 'firebase/auth';

interface UploadMediaFormProps {
  onUploaded?: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function UploadMediaForm({ onUploaded }: UploadMediaFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // ensure anonymous auth once
  useEffect(() => {
    ensureAnonymousAuth((u) => setUser(u), (err) => setError('Authentication failed. Please enable Anonymous sign-in in Firebase Auth.'));
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError('File is too large. Max size is 50MB.');
      setFile(null);
      return;
    }
    if (!/^image\/|^video\//.test(f.type)) {
      setError('Only images or videos are allowed.');
      setFile(null);
      return;
    }
    setFile(f);
  };

  const resetForm = () => {
    setCaption('');
    setFile(null);
    setProgress(0);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    if (!user) {
      setError('Authentication in progress. Please wait a moment.');
      return;
    }

    setUploading(true);
    try {
      const type = file.type.startsWith('video') ? 'video' : 'image';
      const path = `media/${user.uid}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (snapshot.totalBytes > 0) {
              const percent = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
              setProgress(percent);
            }
          },
          (err) => reject(err),
          () => resolve()
        );
      });

      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, 'media'), {
        type,
        storagePath: path,
        url,
        caption: caption.trim(),
        uploaderId: user.uid,
        createdAt: firestoreTimestamp(),
        likesCount: 0,
        reactionCounts: {},
        commentCount: 0,
      } as DocumentData);

      resetForm();
      onUploaded?.();
    } catch (err: unknown) {
      console.error('Upload failed:', err);
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const renderPreview = () => {
    if (!file) return null;
    if (file.type.startsWith('image/')) {
      return (
        <div className="mt-2">
          <div className="text-xs font-medium mb-1">Preview:</div>
          {/* preview uses blob URL, so disable img-element lint */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={URL.createObjectURL(file)}
            alt="Preview"
            className="max-h-40 rounded-md object-contain"
          />
        </div>
      );
    }
    if (file.type.startsWith('video/')) {
      return (
        <div className="mt-2">
          <div className="text-xs font-medium mb-1">Preview:</div>
          <video
            src={URL.createObjectURL(file)}
            controls
            className="max-h-40 rounded-md"
            muted
          />
        </div>
      );
    }
    return null;
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow-card p-6 grid gap-4"
      aria-label="Upload media form"
    >
      <div>
        <label htmlFor="caption" className="block font-medium mb-1">
          Caption (optional)
        </label>
        <input
          id="caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Describe media"
          className="w-full border border-gray-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-palestine-green"
          disabled={uploading}
        />
      </div>

      <div>
        <label htmlFor="file" className="block font-medium mb-1">
          File <span className="text-sm text-muted">(image or video, max 50MB)</span>
        </label>
        <input
          id="file"
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          disabled={uploading}
          aria-required="true"
          className="w-full"
        />
        {renderPreview()}
      </div>

      {error && (
        <div className="text-sm text-red-600" role="alert">
          {error}
        </div>
      )}

      {uploading && (
        <div className="w-full bg-neutral-200 rounded-full overflow-hidden h-2">
          <div
            className="h-full bg-palestine-green transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {uploading && (
        <div className="text-xs text-right text-palestine-muted">
          Uploading: {progress}%
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-palestine-muted">
          {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'No file selected.'}
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setCaption('');
              setFile(null);
              setError(null);
            }}
            disabled={uploading}
          >
            Clear
          </Button>
          <Button variant="primary" type="submit" disabled={!file || uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </div>
    </form>
  );
}
