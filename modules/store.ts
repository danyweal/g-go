import create from 'zustand';
import { NewsItem, Post } from '../types/index';

type State = {
    news: NewsItem[];
    posts: Post[];
    setNews: (news: NewsItem[]) => void;
    setPosts: (posts: Post[]) => void;
};

export const useStore = create<State>((set) => ({
    news: [],
    posts: [],
    setNews: (news) => set({ news }),
    setPosts: (posts) => set({ posts }),
}));
