// Firebase Functions v2 (TypeScript) — Node 20
// Uses global options (region) so we can use the 2-argument v2 helpers.

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";

import { setGlobalOptions } from "firebase-functions/v2";
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

// --- Admin init ---
initializeApp();
const db = getFirestore();
const FieldValue = admin.firestore.FieldValue;

// --- Global options (so we can use 2-arg helpers everywhere) ---
setGlobalOptions({
  region: "us-central1", // change to "europe-west2" if you prefer
  // memory: "256MiB", timeoutSeconds: 60, // optional tuning
});

// ============================================================================
// A) MEDIA: Likes & Comments Counters
// ============================================================================

/** Likes counter: +1 on create, -1 on delete. Path: /media/{mediaId}/likes/{userId} */
export const onLikeWrite = onDocumentWritten(
  "media/{mediaId}/likes/{userId}",
  async (event) => {
    const mediaId = event.params.mediaId as string;

    const beforeExists = !!event.data?.before?.exists;
    const afterExists = !!event.data?.after?.exists;

    // Only count create/delete; ignore updates
    if (beforeExists === afterExists) return;

    const delta = !beforeExists && afterExists ? 1 : -1;
    await db.doc(`media/${mediaId}`).update({ likesCount: FieldValue.increment(delta) });
  }
);

/** Comment counter (approved only). Path: /media/{mediaId}/comments/{commentId} */
export const onCommentCreate = onDocumentCreated(
  "media/{mediaId}/comments/{commentId}",
  async (event) => {
    const mediaId = event.params.mediaId as string;
    const data = event.data?.data() as { approved?: boolean } | undefined;
    if (data?.approved === true) {
      await db.doc(`media/${mediaId}`).update({
        commentCount: FieldValue.increment(1),
      });
    }
  }
);

export const onCommentDelete = onDocumentDeleted(
  "media/{mediaId}/comments/{commentId}",
  async (event) => {
    const mediaId = event.params.mediaId as string;
    const data = event.data?.data() as { approved?: boolean } | undefined;
    if (data?.approved === true) {
      await db.doc(`media/${mediaId}`).update({
        commentCount: FieldValue.increment(-1),
      });
    }
  }
);

export const onCommentUpdate = onDocumentUpdated(
  "media/{mediaId}/comments/{commentId}",
  async (event) => {
    const mediaId = event.params.mediaId as string;
    const before = event.data?.before?.data() as { approved?: boolean } | undefined;
    const after = event.data?.after?.data() as { approved?: boolean } | undefined;
    if (!before || !after) return;

    if (before.approved !== after.approved) {
      const delta = after.approved === true ? 1 : -1;
      await db.doc(`media/${mediaId}`).update({
        commentCount: FieldValue.increment(delta),
      });
    }
  }
);

// ============================================================================
// B) DONATIONS: Aggregation & Auto-close
// ============================================================================

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

const MAX_LAST_DONORS = 15;

export const onDonationWrite = onDocumentWritten(
  "donations/{donationId}",
  async (event) => {
    const before = event.data?.before?.exists ? (event.data.before.data() as DonationDoc) : null;
    const after = event.data?.after?.exists ? (event.data.after.data() as DonationDoc) : null;

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
      let last: CampaignDonor[] = Array.isArray(campaign.lastDonors) ? campaign.lastDonors! : [];

      const confirmedAmount = (x: DonationDoc | null) =>
        x && x.status === "confirmed" ? Number(x.amount || 0) : 0;

      // change in confirmed amount
      const deltaAmt = confirmedAmount(after) - confirmedAmount(before);
      if (deltaAmt !== 0) total += deltaAmt;

      // donorsCount flips
      const wasConfirmed = before?.status === "confirmed";
      const isConfirmed = after?.status === "confirmed";
      if (!wasConfirmed && isConfirmed) count += 1;
      if (wasConfirmed && !isConfirmed) count = Math.max(0, count - 1);

      // lastDonors updates
      if (isConfirmed && after) {
        const name = after.isAnonymous ? "متبرّع مجهول" : after.donorName || "متبرّع";
        const entry: CampaignDonor = {
          name,
          amount: Number(after.amount || 0),
          at: after.confirmedAt || after.createdAt || Date.now(),
        };
        last = [entry, ...last].slice(0, MAX_LAST_DONORS);
      } else if (wasConfirmed && !isConfirmed && before) {
        const name = before.isAnonymous ? "متبرّع مجهول" : before.donorName || "متبرّع";
        const at = before.confirmedAt || before.createdAt || 0;
        const amt = Number(before.amount || 0);
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

/** Close campaigns where status=active and endAt <= now (every 6 hours). */
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
