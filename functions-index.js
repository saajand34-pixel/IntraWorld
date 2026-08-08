/**
 * Firebase Cloud Functions for DigiLocker KYC Registration
 * Deploy with: firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const https = require('https');

admin.initializeApp();
const db = admin.firestore();

// ====================================
// ENVIRONMENT VARIABLES
// ====================================
// Set these in Firebase Console > Project Settings > Cloud Functions
const DIGILOCKER_CLIENT_ID = process.env.DIGILOCKER_CLIENT_ID || 'your_client_id';
const DIGILOCKER_CLIENT_SECRET = process.env.DIGILOCKER_CLIENT_SECRET || 'your_client_secret';
const DIGILOCKER_REDIRECT_URI = 'https://your-domain.com/auth/digilocker-callback';
const DIGILOCKER_AUTH_URL = 'https://digilocker.meripehchaan.gov.in/oauth/authorize';
const DIGILOCKER_TOKEN_URL = 'https://digilocker.meripehchaan.gov.in/oauth/token';
const DIGILOCKER_DOCS_URL = 'https://digilocker.meripehchaan.gov.in/public-api/doclist';

// ====================================
// 1. GENERATE DIGILOCKER OAUTH URL
// ====================================
exports.digilockerAuthUrl = functions.https.onCall(async (data, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const uid = context.auth.uid;

  try {
    // Generate random state for CSRF protection
    const state = require('crypto').randomBytes(32).toString('hex');

    // Store state in Firestore for verification later
    await db.collection('kyc_sessions').doc(uid).update({
      oauth_state: state,
      status: 'pending',
      initiated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Build DigiLocker auth URL
    const authUrl = new URL(DIGILOCKER_AUTH_URL);
    authUrl.searchParams.append('client_id', DIGILOCKER_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', DIGILOCKER_REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('scope', 'openid profile email'); // Request profile scope for Aadhaar photo

    return {
      url: authUrl.toString(),
      state: state,
    };
  } catch (error) {
    console.error('DigiLocker auth URL generation failed:', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate auth URL', error.message);
  }
});

// ====================================
// 2. DIGILOCKER OAUTH CALLBACK (HTTP)
// ====================================
exports.digilockerCallback = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');

  const { code, state, error } = req.query;

  if (error) {
    console.error('DigiLocker returned error:', error);
    return res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h2>❌ Authentication Failed</h2>
          <p>Error: ${error}</p>
          <p>You can close this window and try again.</p>
        </body>
      </html>
    `);
  }

  if (!code || !state) {
    return res.status(400).send('Missing code or state parameter');
  }

  try {
    // Exchange auth code for access token
    const tokenResponse = await axios.post(DIGILOCKER_TOKEN_URL, {
      grant_type: 'authorization_code',
      code: code,
      client_id: DIGILOCKER_CLIENT_ID,
      client_secret: DIGILOCKER_CLIENT_SECRET,
      redirect_uri: DIGILOCKER_REDIRECT_URI,
    });

    const accessToken = tokenResponse.data.access_token;
    const idToken = tokenResponse.data.id_token;

    // Decode ID token to get user info (in production, verify the signature)
    const idTokenPayload = JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64').toString()
    );

    const aadhaarNumber = idTokenPayload.sub; // DigiLocker returns Aadhaar hash as 'sub'
    const email = idTokenPayload.email || null;
    const name = idTokenPayload.name || null;

    // Fetch documents from DigiLocker (Aadhaar photocopy)
    const docsResponse = await axios.get(DIGILOCKER_DOCS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Extract Aadhaar photo descriptor from DigiLocker documents
    // This is a placeholder — actual DigiLocker API returns document metadata
    const aadhaarPhotoDescriptor = null; // Fetch from actual DigiLocker API response

    // Find the user's KYC session (correlate by state token)
    const sessionsSnap = await db.collection('kyc_sessions')
      .where('oauth_state', '==', state)
      .limit(1)
      .get();

    if (sessionsSnap.empty) {
      console.error('No matching KYC session found for state:', state);
      return res.status(404).send('Session not found');
    }

    const uid = sessionsSnap.docs[0].id;

    // Store DigiLocker verification result
    await db.collection('kyc_sessions').doc(uid).update({
      status: 'digilocker_verified',
      aadhaar_hash: aadhaarNumber,
      aadhaar_photo_descriptor: aadhaarPhotoDescriptor,
      email_from_digilocker: email,
      name_from_digilocker: name,
      access_token: accessToken, // Store for later document fetches if needed
      verified_at: admin.firestore.FieldValue.serverTimestamp(),
      oauth_state: admin.firestore.FieldValue.delete(), // Clean up state token
    });

    // Return success page that closes the popup
    return res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h2>✓ Authentication Successful</h2>
          <p>Your identity has been verified with DigiLocker.</p>
          <p>You can close this window — verification will complete in the main form.</p>
          <script>
            // Signal to parent window that verification is complete
            if (window.opener) {
              window.opener.postMessage({ type: 'digilocker_complete' }, '*');
              setTimeout(() => window.close(), 2000);
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('DigiLocker callback error:', error);

    // Try to update the session with error status
    const sessionsSnap = await db.collection('kyc_sessions')
      .where('oauth_state', '==', state)
      .limit(1)
      .get();

    if (!sessionsSnap.empty) {
      const uid = sessionsSnap.docs[0].id;
      await db.collection('kyc_sessions').doc(uid).update({
        status: 'digilocker_failed',
        error_message: error.message,
        failed_at: admin.firestore.FieldValue.serverTimestamp(),
        oauth_state: admin.firestore.FieldValue.delete(),
      });
    }

    return res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h2>❌ Verification Failed</h2>
          <p>Error: ${error.message}</p>
          <p>Please close this window and try again.</p>
        </body>
      </html>
    `);
  }
});

// ====================================
// 3. FACE MATCHING (LIVENESS + FACE DESCRIPTOR)
// ====================================
/**
 * Compares the live face descriptor (from camera) with the Aadhaar photo descriptor
 * from DigiLocker. Returns isMatch = true/false + distance metric.
 *
 * Face descriptors are 128-dimensional vectors from face-api.js.
 * Euclidean distance < 0.6 typically means same person.
 */
exports.verifyFaceMatch = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const uid = context.auth.uid;
  const liveFaceDescriptor = data.descriptor; // 128-d array from browser

  if (!liveFaceDescriptor || !Array.isArray(liveFaceDescriptor)) {
    throw new functions.https.HttpsError('invalid-argument', 'Face descriptor required and must be an array');
  }

  try {
    // Fetch the KYC session with stored Aadhaar photo descriptor
    const sessionSnap = await db.collection('kyc_sessions').doc(uid).get();
    const session = sessionSnap.data();

    if (!session) {
      throw new functions.https.HttpsError('failed-precondition', 'KYC session not found');
    }

    if (session.status !== 'digilocker_verified') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Please complete DigiLocker verification before camera check'
      );
    }

    const storedDescriptor = session.aadhaar_photo_descriptor;
    if (!storedDescriptor) {
      throw new functions.https.HttpsError('internal', 'Aadhaar photo descriptor not available');
    }

    // Compute Euclidean distance
    const distance = computeEuclideanDistance(liveFaceDescriptor, storedDescriptor);

    // Threshold: distance < 0.6 = match (calibrate based on your testing)
    const FACE_MATCH_THRESHOLD = 0.6;
    const isMatch = distance < FACE_MATCH_THRESHOLD;

    // Record result in Firestore
    await db.collection('kyc_sessions').doc(uid).update({
      face_match_distance: distance,
      face_match_result: isMatch ? 'match' : 'no_match',
      face_verified_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      isMatch: isMatch,
      distance: distance,
      threshold: FACE_MATCH_THRESHOLD,
    };
  } catch (error) {
    console.error('Face match verification failed:', error);
    throw error instanceof functions.https.HttpsError
      ? error
      : new functions.https.HttpsError('internal', error.message);
  }
});

// Helper: Euclidean distance between two 128-d vectors
function computeEuclideanDistance(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    throw new Error('Arrays must have same length');
  }
  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    const diff = arr1[i] - arr2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// ====================================
// 4. FINALIZE REGISTRATION
// ====================================
/**
 * Called when user submits the form. Performs final server-side validation:
 * - Verifies DigiLocker status is "digilocker_verified"
 * - Verifies face match was successful
 * - Returns approval or rejection
 */
exports.finalizeRegistration = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const uid = context.auth.uid;

  try {
    const sessionSnap = await db.collection('kyc_sessions').doc(uid).get();
    const session = sessionSnap.data();

    if (!session) {
      throw new functions.https.HttpsError('failed-precondition', 'KYC session not found');
    }

    // Validation checks
    if (session.status !== 'digilocker_verified') {
      throw new functions.https.HttpsError('failed-precondition', 'DigiLocker verification incomplete');
    }

    if (session.face_match_result !== 'match') {
      throw new functions.https.HttpsError('failed-precondition', 'Face verification did not pass');
    }

    // All checks passed — mark as approved
    await db.collection('kyc_sessions').doc(uid).update({
      registration_approved: true,
      approval_timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      approved: true,
      message: 'Registration approved. Your account is ready to use.',
    };
  } catch (error) {
    console.error('Finalization error:', error);
    throw error instanceof functions.https.HttpsError
      ? error
      : new functions.https.HttpsError('internal', error.message);
  }
});

// ====================================
// 5. KYC SESSION CREATION (on first load)
// ====================================
exports.initializeKycSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const uid = context.auth.uid;

  try {
    // Create or update KYC session document
    await db.collection('kyc_sessions').doc(uid).set(
      {
        uid: uid,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        status: 'initiated',
      },
      { merge: true }
    );

    return { session_id: uid, status: 'initialized' };
  } catch (error) {
    console.error('KYC session initialization failed:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ====================================
// 6. CLEANUP OLD SESSIONS (scheduled)
// ====================================
exports.cleanupExpiredSessions = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const EXPIRY_DAYS = 7;
    const cutoffTime = new Date(Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    try {
      const snapshot = await db.collection('kyc_sessions')
        .where('created_at', '<', cutoffTime)
        .where('status', '==', 'pending')
        .get();

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Cleaned up ${snapshot.size} expired KYC sessions`);
      return null;
    } catch (error) {
      console.error('Cleanup error:', error);
      return null;
    }
  });
