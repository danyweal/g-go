export type Organizer = {
  name: string;
  role?: string;
  photoURL?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
};

export type MediaItem = {
  id: string;
  type: 'image' | 'video' | 'youtube';
  url: string;
  thumbUrl?: string;
  title?: string;
  isPrimary?: boolean;
};

export type Campaign = {
  id: string;              // = slug
  slug: string;
  status: 'draft' | 'active' | 'paused' | 'closed';
  title_ar: string;
  title_en?: string;
  bannerUrl?: string;
  goalAmount: number;
  currency: 'GBP' | 'USD' | 'EUR';
  why_ar: string;
  why_en?: string;
  spendingPlan_ar?: string;
  spendingPlan_en?: string;
  organizers: Organizer[];
  contact: {
    phone?: string;
    email?: string;
    whatsapp?: string;
    link?: string;
  };
  startAt: number;
  endAt?: number;
  media: MediaItem[];
  allowPublicDonorList: boolean;

  // Aggregated by Functions
  totalDonated: number;
  donorsCount: number;
  lastDonors: Array<{ name: string; amount: number; at: number }>;

  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export type Donation = {
  id: string;
  campaignId: string;
  donorName?: string;
  amount: number;
  currency: 'GBP' | 'USD' | 'EUR';
  message?: string;
  isAnonymous: boolean;
  status: 'pending' | 'confirmed' | 'refunded' | 'failed';
  method: 'offline' | 'stripe' | 'paypal' | 'bank';
  receiptURL?: string;
  txnRef?: string;
  createdAt: number;
  confirmedAt?: number;
  createdBy?: string;
};
