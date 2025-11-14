export type MembershipPlan = 'none' | 'once' | 'monthly';

export type JoinApplication = {
  fullName: string;
  email: string;
  phone?: string;
  message?: string;
  membershipPlan: MembershipPlan; // 'monthly' triggers subscription
  consentToContact?: boolean;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: FirebaseFirestore.Timestamp | null;
  updatedAt?: FirebaseFirestore.Timestamp | null;

  // Stripe linkage (filled later if monthly)
  stripeCustomerId?: string;
  stripeCheckoutSessionId?: string;
  stripeSubscriptionId?: string;
};

export type Member = {
  applicationId: string;
  fullName: string;
  email: string;
  phone?: string;
  membershipPlan: MembershipPlan; // 'monthly' or 'once'
  status: 'active' | 'inactive' | 'past_due' | 'canceled';
  createdAt?: FirebaseFirestore.Timestamp | null;
  updatedAt?: FirebaseFirestore.Timestamp | null;

  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  lastPaymentAt?: FirebaseFirestore.Timestamp | null;
  currentPeriodEnd?: FirebaseFirestore.Timestamp | null;
};

export type PaymentRecord = {
  applicationId?: string;
  memberId?: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  stripeInvoiceId?: string;
  stripePaymentIntentId?: string;
  amount: number; // in cents
  currency: string;
  status: 'paid' | 'failed' | 'void' | 'refunded' | 'requires_payment_method';
  createdAt: FirebaseFirestore.Timestamp;
  periodStart?: FirebaseFirestore.Timestamp | null;
  periodEnd?: FirebaseFirestore.Timestamp | null;
};
