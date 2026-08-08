# Setting up real DigiLocker + Face-Match Verification

This replaces the old fake `setTimeout`/`Math.random()` verification with a
real flow:

```
User → "Connect DigiLocker" → DigiLocker consent screen (government site)
     → backend exchanges auth code for token → backend pulls Aadhaar e-KYC
     → backend computes a face descriptor from the Aadhaar photo (discards
       the raw photo) → stored server-side against the user

User → live camera → face-api.js detects a real blink (anti-photo-spoofing)
     → captures one clean frame → computes a face descriptor client-side
     → sends ONLY the 128-number descriptor to the backend

Backend compares the two descriptors → this is the one and only place
"match" / "no match" is decided → registration form re-checks this
server-side result before writing the final "approved" user record
```

## 1. Get DigiLocker partner access (nothing else can substitute for this)

You have two paths:

- **Direct partner registration** — register as a Requester at
  `https://partners.digitallocker.gov.in`. This is a government approval
  process; expect it to take real time and paperwork.
- **Via a licensed aggregator** — Setu, Digio, Signzy, Surepass and similar
  companies already hold DigiLocker partner status and expose a simpler
  REST/OAuth API on top of it. Usually much faster to integrate and worth it
  unless you specifically need to be the direct partner of record.

Either way you'll end up with:
- `DIGILOCKER_CLIENT_ID`
- `DIGILOCKER_CLIENT_SECRET`
- an approved `DIGILOCKER_REDIRECT_URI` (must exactly match what you
  register — e.g. `https://<your-region>-<project-id>.cloudfunctions.net/digilockerCallback`)

`functions/index.js` has `// TODO`-style comments where the exact API host
and the Aadhaar document XML field name need to be confirmed against
whichever partner docs you end up with — the auth/token URLs and the
`<Pht>` field name in there are the commonly documented ones for the direct
government API, but aggregators often wrap this differently.

## 2. Deploy the Cloud Functions

```bash
cd functions
npm install
firebase functions:secrets:set DIGILOCKER_CLIENT_ID
firebase functions:secrets:set DIGILOCKER_CLIENT_SECRET
firebase functions:secrets:set DIGILOCKER_REDIRECT_URI
firebase deploy --only functions
```

You also need the face-api.js model weight files sitting in
`functions/models/` for the server-side descriptor extraction
(`ssdMobilenetv1`, `faceLandmark68Net`, `faceRecognitionNet`) — download them
from the face-api.js weights repo and commit them alongside `index.js`.

## 3. Add a `functions` export to `firebase-config.js`

`register.js` imports `functions` from `./firebase-config.js`. Add this to
your existing config file (you didn't upload it, so it isn't included here):

```js
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
// ... your existing initializeApp() etc.
export const functions = getFunctions(app);
```

## 4. Lock down Firestore rules

`kyc_sessions/{uid}` holds sensitive intermediate state (a face descriptor
is biometric data). Users should be able to **read** their own session (so
the frontend can poll status) but never **write** to it directly — only the
Cloud Functions (via the Admin SDK, which bypasses rules) should write:

```
match /kyc_sessions/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if false;
}
```

## 5. Compliance note

Aadhaar data is regulated under India's Aadhaar Act, 2016. Pulling it via
DigiLocker (as opposed to UIDAI's own Aadhaar APIs) generally sits outside
the AUA/KUA licensing regime, but you're still handling government ID and
biometric-adjacent data (a face descriptor is derived biometric data). Before
taking this to real users:
- Have a lawyer confirm your obligations under the Aadhaar Act, DPDP Act
  2023, and DigiLocker's own partner terms.
- Keep the "store descriptor, discard raw photo, delete descriptor after
  matching" pattern already in `functions/index.js` — don't retain raw
  Aadhaar photos or documents longer than necessary.
- Log access to `kyc_sessions` and restrict who on your team can read it.

## What's already handled for you

- Real blink-based liveness (`register.js` → `eyeAspectRatio` /
  `detectBlink`) instead of the old random 70%-chance simulation.
- Real face descriptor comparison (Euclidean distance, threshold 0.55 —
  tune this against test data) instead of skin-tone pixel counting.
- The match decision is made and re-verified **server-side**
  (`verifyFaceMatch`, `finalizeRegistration`) so a user can't just flip
  `window.isLivenessVerified = true` in devtools and register anyway.
