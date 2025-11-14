export interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
  role?: 'user' | 'admin'
  createdAt?: Date
}

export interface Event {
  id: string
  title: string
  description: string
  start: Date
  end: Date
  imageUrl?: string
  location?: string
}

export interface NewsItem {
  id: string
  title: string
  content: string
  publishedAt: Date
  author: string
  imageUrl?: string
}
