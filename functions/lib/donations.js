"use strict";
// functions/src/donations.ts
// Firebase Cloud Functions v2 — Node 20 compatible
// - Aggregates donations into campaigns on write
// - Auto-closes expired campaigns every 6 hours
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeExpiredCampaigns = exports.onDonationWrite = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const firestore_2 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
// --- Admin init (ADC on GCP, env locally if you use your firebaseAdmin.ts elsewhere) ---
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const FieldValue = admin.firestore.FieldValue;
// Use global region so we can use the 2-argument helpers:
(0, v2_1.setGlobalOptions)({
    region: "us-central1", // change to "europe-west2" if you prefer, but keep consistent everywhere
});
const MAX_LAST_DONORS = 15;
/**
 * onDonationWrite:
 *  - Updates campaign totals, donorsCount, and lastDonors on any donation write.
 *  Path: /donations/{donationId}
 */
exports.onDonationWrite = (0, firestore_2.onDocumentWritten)("donations/{donationId}", async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    const affected = after ?? before;
    if (!affected)
        return;
    const campaignId = affected.campaignId;
    if (!campaignId)
        return;
    const campaignRef = db.collection("campaigns").doc(campaignId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(campaignRef);
        if (!snap.exists)
            return;
        const campaign = snap.data() || {};
        let total = Number(campaign.totalDonated || 0);
        let count = Number(campaign.donorsCount || 0);
        let last = Array.isArray(campaign.lastDonors) ? campaign.lastDonors : [];
        const confirmedAmount = (x) => x && x.status === "confirmed" ? Number(x.amount || 0) : 0;
        // Amount delta when confirmation status changes or amount changes
        const delta = confirmedAmount(after) - confirmedAmount(before);
        if (delta !== 0)
            total += delta;
        // Donor count flips on confirmed <-> not-confirmed
        const wasConfirmed = before?.status === "confirmed";
        const isConfirmed = after?.status === "confirmed";
        if (!wasConfirmed && isConfirmed)
            count += 1;
        if (wasConfirmed && !isConfirmed)
            count = Math.max(0, count - 1);
        // Maintain lastDonors list (latest first, max 15)
        if (isConfirmed && after) {
            const entry = {
                name: after.isAnonymous ? "متبرّع مجهول" : (after.donorName || "متبرّع"),
                amount: Number(after.amount || 0),
                at: after.confirmedAt || after.createdAt || Date.now(),
            };
            last = [entry, ...last].slice(0, MAX_LAST_DONORS);
        }
        else if (wasConfirmed && !isConfirmed && before) {
            // Remove best-effort matching entry if a donation becomes unconfirmed
            const name = before.isAnonymous ? "متبرّع مجهول" : (before.donorName || "متبرّع");
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
});
/**
 * closeExpiredCampaigns:
 *  - Closes campaigns where status = "active" and endAt <= now.
 *  - Runs every 6 hours.
 */
exports.closeExpiredCampaigns = (0, scheduler_1.onSchedule)({ schedule: "every 6 hours", timeZone: "Europe/London" }, async () => {
    const now = Date.now();
    const qs = await db
        .collection("campaigns")
        .where("status", "==", "active")
        .where("endAt", "<=", now)
        .get();
    if (qs.empty)
        return;
    const batch = db.batch();
    qs.forEach((doc) => {
        batch.update(doc.ref, { status: "closed", updatedAt: now });
    });
    await batch.commit();
});
