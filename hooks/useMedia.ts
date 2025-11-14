import { useState, useEffect } from 'react';
import { getMediaList } from '../modules/media';
import { MediaItem } from '../types/media';

export function useMedia() {
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMedia() {
            try {
                const list = await getMediaList();
                setMedia(list);
            } finally {
                setLoading(false);
            }
        }
        fetchMedia();
    }, []);

    return { media, loading };
}
