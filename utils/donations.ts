export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');

export const formatCurrency = (n: number, currency: string = 'GBP') =>
  new Intl.NumberFormat('ar-GB', { style: 'currency', currency: currency as unknown }).format(n);

export const daysLeft = (endAt?: number | null) => {
  if (!endAt) return null;
  const diff = endAt - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};
