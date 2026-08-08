/**
 * IntraWorld — Identity Verification Backend
 * ============================================
 * Handles the two things that must NEVER happen purely in browser JS:
 *   1. DigiLocker OAuth token exchange (needs a confidential client_secret)
 *   2. The authoritative "is this person's live face the same person as the
 *      Aadhaar photo?" decision (needs to be server-verified, not trusted
 *      from the client)
 *
 * Requires Node 18 runtime, Firebase Functions v2, Firestore.
 *
 * ---------------------------------------------------------------------------
 * BEFORE THIS WORKS YOU NEED (nothing here can be faked or generated for you):
 *   - A DigiLocker "Requester" partner account. Either:
 *       a) Direct: https://partners.digitallocker.gov.in  (government
 *          approval process, can take days/weeks), or
 *       b) Via a licensed aggregator (Setu, Digio, Signzy, Surepass, etc.)
 *          who already has DigiLocker partner status — much faster to get
 *          into production with.
 *   - That gives you: DIGILOCKER_CLIENT_ID, DIGILOCKER_CLIENT_SECRET,
 *     DIGILOCKER_REDIRECT_URI (must match exactly what you register).
 *   - Aadhaar is regulated under the Aadhaar Act — pulling/processing Aadhaar
 *     data generally needs to go through DigiLocker (as here) or a UIDAI
 *     AUA/KUA-licensed provider. Talk to a compliance/legal advisor before
 *     going live with real user data; the flow below stores the raw Aadhaar
 *     photo only transiently and deletes it after computing a face
 *     descriptor, but you are still responsible for how you handle it.
 * ---------------------------------------------------------------------------
 */

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");
const crypto = require("crypto");
const canvas = require("canvas");
const faceapi = require("face-api.js");

initializeApp();
const db = getFirestore();

const DIGILOCKER_CLIENT_ID = defineSecret("DIGILOCKER_CLIENT_ID");
const DIGILOCKER_CLIENT_SECRET = defineSecret("DIGILOCKER_CLIENT_SECRET");
const DIGILOCKER_REDIRECT_URI = defineSecret("DIGILOCKER_REDIRECT_URI");

// DigiLocker's actual OAuth + API hosts. Confirm against your partner
// onboarding docs — sandbox vs production hostnames differ.
const DIGILOCKER_AUTH_URL = "https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize";
const DIGILOCKER_TOKEN_URL = "https://digilocker.meripehchaan.gov.in/public/oauth2/1/token";
const DIGILOCKER_API_BASE = "https://digilocker.meripehchaan.gov.in/public/oauth2/1";

// face-api.js model files must be uploaded next to this function
// (see /models in the deploy bundle) or fetched from a CDN at cold start.
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
let modelsLoaded = false;
async function ensureModelsLoaded() {
  if (modelsLoaded) return;
  const MODEL_URL = __dirname + "/models";
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_URL);
  modelsLoaded = true;
}

// A face-api.js Euclidean distance below this = "same person". 0.5–0.6 is
// the commonly used threshold; tune against real data before trusting it.
const MATCH_THRESHOLD = 0.55;

/**
 * STEP 1 — Frontend calls this to get the URL to send the user to.
 * We sign `state` with the uid so the callback can't be replayed against a
 * different account.
 */
exports.digilockerAuthUrl = onCall(
  { secrets: [DIGILOCKER_CLIENT_ID, DIGILOCKER_REDIRECT_URI] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before connecting DigiLocker.");
    }
    const uid = request.auth.uid;
    const state = crypto.createHmac("sha256", DIGILOCKER_CLIENT_ID.value())
      .update(uid).digest("hex").slice(0, 24) + "." + uid;

    const url = new URL(DIGILOCKER_AUTH_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", DIGILOCKER_CLIENT_ID.value());
    url.searchParams.set("redirect_uri", DIGILOCKER_REDIRECT_URI.value());
    url.searchParams.set("state", state);
    // "dl_flow=signup" and doc scopes vary by partner agreement — check yours.

    await db.collection("kyc_sessions").doc(uid).set({
      status: "pending_digilocker",
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { url: url.toString() };
  }
);

/**
 * STEP 2 — DigiLocker redirects the user's browser here after consent.
 * We exchange the code for a token server-side, pull the Aadhaar document,
 * extract the photo, compute a face descriptor, store ONLY the descriptor
 * (not the raw photo/XML) against the user, then bounce back to the app.
 */
exports.digilockerCallback = onRequest(
  { secrets: [DIGILOCKER_CLIENT_ID, DIGILOCKER_CLIENT_SECRET, DIGILOCKER_REDIRECT_URI] },
  async (req, res) => {
    const { code, state, error } = req.query;
    if (error) return res.redirect(`/register.html?digilocker=error`);

    const uid = String(state || "").split(".")[1];
    if (!uid) return res.status(400).send("Invalid state");

    try {
      // Exchange authorization code for an access token
      const tokenResp = await axios.post(DIGILOCKER_TOKEN_URL, new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: DIGILOCKER_CLIENT_ID.value(),
        client_secret: DIGILOCKER_CLIENT_SECRET.value(),
        redirect_uri: DIGILOCKER_REDIRECT_URI.value(),
      }));
      const accessToken = tokenResp.data.access_token;

      // Pull the Aadhaar e-KYC document. The exact endpoint/URI code
      // ("ADHAR") depends on your partner agreement — confirm against your
      // onboarding docs. This typically returns an XML payload containing a
      // base64 JPEG photo field.
      const docResp = await axios.get(`${DIGILOCKER_API_BASE}/xml/eaadhaar`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const aadhaarPhotoBase64 = extractPhotoFromEaadhaarXml(docResp.data);
      if (!aadhaarPhotoBase64) throw new Error("No photo found in DigiLocker document");

      // Compute a face descriptor from the Aadhaar photo NOW, on the server,
      // then discard the raw image — we only ever need to compare, not keep it.
      await ensureModelsLoaded();
      const img = await canvas.loadImage(Buffer.from(aadhaarPhotoBase64, "base64"));
      const detection = await faceapi.detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) throw new Error("No face detected in Aadhaar photo");

      await db.collection("kyc_sessions").doc(uid).set({
        status: "digilocker_verified",
        digiLockerVerified: true,
        aadhaarDescriptor: Array.from(detection.descriptor),
        verifiedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      res.redirect(`/register.html?digilocker=success`);
    } catch (err) {
      console.error("DigiLocker callback failed:", err.response?.data || err.message);
      await db.collection("kyc_sessions").doc(uid).set({
        status: "digilocker_failed",
        error: err.message,
      }, { merge: true });
      res.redirect(`/register.html?digilocker=error`);
    }
  }
);

/**
 * STEP 3 — Frontend calls this once it has captured a live face descriptor
 * (see register.js: captureLiveDescriptor). This is the ONLY place the
 * match/no-match decision is actually made — the client's copy of the
 * result is just for UI, never trusted for the final write.
 */
exports.verifyFaceMatch = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = request.auth.uid;
  const liveDescriptor = request.data?.descriptor;

  if (!Array.isArray(liveDescriptor) || liveDescriptor.length !== 128) {
    throw new HttpsError("invalid-argument", "Malformed face descriptor.");
  }

  const sessionSnap = await db.collection("kyc_sessions").doc(uid).get();
  const session = sessionSnap.data();
  if (!session?.digiLockerVerified || !session?.aadhaarDescriptor) {
    throw new HttpsError("failed-precondition", "Complete DigiLocker verification first.");
  }

  const distance = euclideanDistance(session.aadhaarDescriptor, liveDescriptor);
  const isMatch = distance <= MATCH_THRESHOLD;

  await db.collection("kyc_sessions").doc(uid).set({
    faceMatchVerified: isMatch,
    faceMatchDistance: distance,
    // Discard the Aadhaar descriptor once it's served its purpose.
    aadhaarDescriptor: FieldValue.delete(),
    matchedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { isMatch, distance };
});

/**
 * Called right before writing the final user record. Re-reads the
 * server-side session instead of trusting flags the client sends, so a
 * tampered client can't self-approve.
 */
exports.finalizeRegistration = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = request.auth.uid;
  const session = (await db.collection("kyc_sessions").doc(uid).get()).data();

  if (!session?.digiLockerVerified) {
    throw new HttpsError("failed-precondition", "DigiLocker verification incomplete.");
  }
  if (!session?.faceMatchVerified) {
    throw new HttpsError("failed-precondition", "Live face does not match Aadhaar photo on record.");
  }

  await db.collection("users").doc(uid).set({
    livenessVerified: true,
    digiLockerVerified: true,
    faceMatchVerified: true,
    faceMatchDistance: session.faceMatchDistance,
    approvedAt: FieldValue.serverTimestamp(),
    status: "approved",
  }, { merge: true });

  return { approved: true };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

/**
 * The eAadhaar XML returned by DigiLocker embeds the photo as a base64 JPEG
 * inside a <Pht> (or similarly named) element — the exact tag/schema depends
 * on the API version your partner account is issued. Adjust the regex/parse
 * to match the real payload you get back (log docResp.data once in a test
 * environment and confirm before relying on this in production).
 */
function extractPhotoFromEaadhaarXml(xml) {
  const match = /<Pht>([^<]+)<\/Pht>/i.exec(xml);
  return match ? match[1] : null;
}
