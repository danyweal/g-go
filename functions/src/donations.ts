// functions/src/donations.ts
// Firebase Cloud Functions v2 — Node 20 compatible
// - Aggregates donations into campaigns on write
// - Auto-closes expired campaigns every 6 hours

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";

import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

// --- Admin init (ADC on GCP, env locally if you use your firebaseAdmin.ts elsewhere) ---
initializeApp();
const db = getFirestore();
const FieldValue = admin.firestore.FieldValue;

// Use global region so we can use the 2-argument helpers:
setGlobalOptions({
  region: "us-central1", // change to "europe-west2" if you prefer, but keep consistent everywhere
});

const MAX_LAST_DONORS = 15;

type DonationDoc = {
  campaignId?: string;
  status?: "confirmed" | string;
  isAnonymous?: boolean;
  donorName?: string;
  amount?: number;
  confirmedAt?: number;
  createdAt?: number;
};

type CampaignDonor = { name: string; amount: number; at: number };
type CampaignDoc = {
  totalDonated?: number;
  donorsCount?: number;
  lastDonors?: CampaignDonor[];
};

/**
 * onDonationWrite:
 *  - Updates campaign totals, donorsCount, and lastDonors on any donation write.
 *  Path: /donations/{donationId}
 */
export const onDonationWrite = onDocumentWritten(
  "donations/{donationId}",
  async (event) => {
    const before = event.data?.before?.exists ? (event.data.before.data() as DonationDoc) : null;
    const after  = event.data?.after?.exists  ? (event.data.after.data()  as DonationDoc) : null;

    const affected = after ?? before;
    if (!affected) return;

    const campaignId = affected.campaignId;
    if (!campaignId) return;

    const campaignRef = db.collection("campaigns").doc(campaignId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(campaignRef);
      if (!snap.exists) return;

      const campaign = (snap.data() as CampaignDoc) || {};
      let total = Number(campaign.totalDonated || 0);
      let count = Number(campaign.donorsCount || 0);
      let last: CampaignDonor[] = Array.isArray(campaign.lastDonors) ? campaign.lastDonors : [];

      const confirmedAmount = (x: DonationDoc | null) =>
        x && x.status === "confirmed" ? Number(x.amount || 0) : 0;

      // Amount delta when confirmation status changes or amount changes
      const delta = confirmedAmount(after) - confirmedAmount(before);
      if (delta !== 0) total += delta;

      // Donor count flips on confirmed <-> not-confirmed
      const wasConfirmed = before?.status === "confirmed";
      const isConfirmed  = after?.status  === "confirmed";
      if (!wasConfirmed && isConfirmed) count += 1;
      if (wasConfirmed && !isConfirmed) count = Math.max(0, count - 1);

      // Maintain lastDonors list (latest first, max 15)
      if (isConfirmed && after) {
        const entry: CampaignDonor = {
          name: after.isAnonymous ? "متبرّع مجهول" : (after.donorName || "متبرّع"),
          amount: Number(after.amount || 0),
          at: after.confirmedAt || after.createdAt || Date.now(),
        };
        last = [entry, ...last].slice(0, MAX_LAST_DONORS);
      } else if (wasConfirmed && !isConfirmed && before) {
        // Remove best-effort matching entry if a donation becomes unconfirmed
        const name = before.isAnonymous ? "متبرّع مجهول" : (before.donorName || "متبرّع");
        const at   = before.confirmedAt || before.createdAt || 0;
        const amt  = Number(before.amount || 0);
        last = last.filter((d) => !(d.name === name && d.amount === amt && d.at === at));
      }

      tx.update(campaignRef, {
        totalDonated: total,
        donorsCount: count,
        lastDonors: last,
        updatedAt: Date.now(),
      });
    });
  }
);

/**
 * closeExpiredCampaigns:
 *  - Closes campaigns where status = "active" and endAt <= now.
 *  - Runs every 6 hours.
 */
export const closeExpiredCampaigns = onSchedule(
  { schedule: "every 6 hours", timeZone: "Europe/London" },
  async () => {
    const now = Date.now();
    const qs = await db
      .collection("campaigns")
      .where("status", "==", "active")
      .where("endAt", "<=", now)
      .get();

    if (qs.empty) return;

    const batch = db.batch();
    qs.forEach((doc) => {
      batch.update(doc.ref, { status: "closed", updatedAt: now });
    });
    await batch.commit();
  }
);
