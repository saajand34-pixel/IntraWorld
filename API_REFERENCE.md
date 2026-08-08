# DigiLocker KYC - Cloud Functions API Reference

Complete API documentation for all Firebase Cloud Functions.

---

## Functions Overview

| Function | Type | Purpose | Auth |
|----------|------|---------|------|
| `digilockerAuthUrl` | Callable | Generate OAuth URL | Required |
| `digilockerCallback` | HTTP | Handle OAuth redirect | None |
| `verifyFaceMatch` | Callable | Compare face descriptors | Required |
| `finalizeRegistration` | Callable | Validate and approve | Required |
| `initializeKycSession` | Callable | Create KYC session | Required |
| `cleanupExpiredSessions` | Scheduled | Clean old sessions | None |

---

## 1. `digilockerAuthUrl` (Callable)

Generates the DigiLocker OAuth authorization URL.

### Request

```javascript
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase-config";

const digilockerAuthUrlFn = httpsCallable(functions, "digilockerAuthUrl");
const { data } = await digilockerAuthUrlFn();
```

### Response

```javascript
{
  "url": "https://digilocker.meripehchaan.gov.in/oauth/authorize?...",
  "state": "random_state_token_32_chars"
}
```

### Error Codes

| Code | Message | Cause |
|------|---------|-------|
| `unauthenticated` | User must be authenticated | No auth token provided |
| `internal` | Failed to generate auth URL | Server error |

### Flow

```mermaid
User clicks "Connect DigiLocker"
    ↓
digilockerAuthUrl() called
    ↓
Generate random state token
    ↓
Store state in Firestore
    ↓
Return signed URL to user
    ↓
Frontend opens popup with URL
```

---

## 2. `digilockerCallback` (HTTP)

Handles the OAuth callback after user authenticates with DigiLocker.

### Endpoint

```
GET /oauth/digilocker-callback?code=...&state=...
```

### Parameters

| Param | Type | Description |
|-------|------|-------------|
| `code` | string | OAuth authorization code from DigiLocker |
| `state` | string | State token (must match what was stored) |
| `error` | string | Error code if user denied consent |

### Success Response (200)

HTML page showing success message, with JavaScript to close popup.

### Backend Actions

1. Verify state token matches stored value
2. Exchange code for access token
3. Decode ID token to get Aadhaar hash and name
4. Fetch Aadhaar photo descriptor from DigiLocker API
5. Store in Firestore under `kyc_sessions/{uid}`:

```javascript
{
  status: "digilocker_verified",
  aadhaar_hash: "hash_of_aadhaar",
  aadhaar_photo_descriptor: [128 floats],
  email_from_digilocker: "user@example.com",
  name_from_digilocker: "John Doe",
  verified_at: Timestamp,
}
```

### Error Responses

#### User Denied Consent
```
HTML: "❌ Authentication Failed - Error: access_denied"
```

#### Callback URL Mismatch
```
HTTP 400: Missing code or state parameter
```

#### Server Error
```javascript
{
  status: "digilocker_failed",
  error_message: "Failed to fetch Aadhaar data",
  failed_at: Timestamp,
}
```

### Security Notes

- CSRF protection via state token verification
- SSL/TLS required for callback URL
- Client secret must never be exposed in frontend
- Access token stored server-side only

---

## 3. `verifyFaceMatch` (Callable)

Compares live face descriptor with Aadhaar photo descriptor.

### Request

```javascript
const verifyFaceMatchFn = httpsCallable(functions, "verifyFaceMatch");
const { data } = await verifyFaceMatchFn({
  descriptor: [128 floats array from face-api.js]
});
```

### Input

```javascript
{
  "descriptor": [
    -0.123, 0.456, -0.789, ..., // 128 dimensions total
  ]
}
```

### Response (Success)

```javascript
{
  "isMatch": true,
  "distance": 0.45,
  "threshold": 0.6
}
```

### Response (No Match)

```javascript
{
  "isMatch": false,
  "distance": 0.72,
  "threshold": 0.6
}
```

### Error Codes

| Code | Message | Cause |
|------|---------|-------|
| `unauthenticated` | User must be authenticated | No auth token |
| `invalid-argument` | Face descriptor required | Missing or invalid descriptor |
| `failed-precondition` | DigiLocker verification incomplete | Must verify DigiLocker first |
| `internal` | Aadhaar photo descriptor not available | Server error |

### Algorithm

```javascript
distance = sqrt(
  sum((descriptor1[i] - descriptor2[i])^2)
  for i in 0..127
)

isMatch = distance < 0.6
```

### Threshold Tuning

- **0.5**: Very strict (fewer false matches, more rejections)
- **0.6**: Default (good balance)
- **0.7**: Lenient (fewer rejections, more false matches)

### Backend Actions

1. Fetch KYC session with stored Aadhaar descriptor
2. Verify DigiLocker status is "verified"
3. Compute Euclidean distance
4. Update Firestore with result:

```javascript
{
  face_match_distance: 0.45,
  face_match_result: "match",
  face_verified_at: Timestamp,
}
```

---

## 4. `finalizeRegistration` (Callable)

Performs final server-side validation before account creation.

### Request

```javascript
const finalizeRegistrationFn = httpsCallable(functions, "finalizeRegistration");
const { data } = await finalizeRegistrationFn();
```

### Response (Approved)

```javascript
{
  "approved": true,
  "message": "Registration approved. Your account is ready to use."
}
```

### Error Codes

| Code | Message | Cause |
|------|---------|-------|
| `unauthenticated` | User must be authenticated | No auth token |
| `failed-precondition` | DigiLocker incomplete | DigiLocker not verified |
| `failed-precondition` | Face verification failed | Face match didn't pass |

### Validations Performed

- ✓ KYC session exists
- ✓ DigiLocker status is "verified"
- ✓ Face match result is "match"
- ✓ No concurrent registrations with same identity

### Backend Actions

1. Check Firestore `kyc_sessions/{uid}`
2. Verify all three stages passed
3. Mark session as `registration_approved: true`
4. Return approval

### Frontend Responsibility

After approval, frontend must:
1. Create email/password user account
2. Confirm OTP if used
3. Upload profile photo
4. Save user profile to Firestore `users/{uid}`

---

## 5. `initializeKycSession` (Callable)

Creates KYC session document when user starts registration.

### Request

```javascript
const initializeKycSessionFn = httpsCallable(functions, "initializeKycSession");
const { data } = await initializeKycSessionFn();
```

### Response

```javascript
{
  "session_id": "user_uid",
  "status": "initialized"
}
```

### Firestore Document Created

```javascript
// kyc_sessions/{uid}
{
  uid: "user_uid",
  created_at: Timestamp,
  status: "initiated",
}
```

### Usage

Called automatically when registration form loads (in enhanced register.js).

---

## 6. `cleanupExpiredSessions` (Scheduled)

Runs every 24 hours to delete old incomplete KYC sessions.

### Trigger

- **Schedule**: Every 24 hours
- **Region**: asia-south1

### Logic

Delete sessions where:
- `created_at` > 7 days ago
- `status` = "pending" (never completed)

### Example Cleanup

```javascript
// Deletes sessions created before Aug 1, 2026
// That never progressed beyond "pending"
```

---

## Firestore Data Structure

### Collection: `kyc_sessions`

```javascript
// Document: {uid}
{
  uid: string,
  created_at: Timestamp,
  status: "initiated" | "pending" | "digilocker_verified" | "digilocker_failed",
  
  // DigiLocker OAuth
  oauth_state: string,
  initiated_at: Timestamp,
  
  // DigiLocker Result
  aadhaar_hash: string,
  aadhaar_photo_descriptor: [128 floats],
  email_from_digilocker: string,
  name_from_digilocker: string,
  access_token: string,
  verified_at: Timestamp,
  error_message: string,
  failed_at: Timestamp,
  
  // Face Verification
  face_match_distance: float,
  face_match_result: "match" | "no_match",
  face_verified_at: Timestamp,
  
  // Registration Finalization
  registration_approved: boolean,
  approval_timestamp: Timestamp,
}
```

### Collection: `users`

```javascript
// Document: {uid}
{
  fullName: string,
  email: string,
  mobileNumber: string,
  profilePhotoUrl: string,
  qualification: string,
  specialization: string,
  collegeUniversity: string,
  skills: [string],
  professionalInterests: string,
  
  // Verification Flags
  livenessVerified: boolean,
  digiLockerVerified: boolean,
  faceMatchVerified: boolean,
  mfaVerified: boolean,
  
  createdAt: string,
  registrationCompleted: boolean,
  status: "approved" | "pending" | "rejected",
}
```

---

## Error Handling Guide

### Frontend Error Handler

```javascript
try {
  const { data } = await digilockerAuthUrlFn();
} catch (error) {
  console.error('Code:', error.code);
  console.error('Message:', error.message);
  
  // Map to user-friendly messages
  const messages = {
    'unauthenticated': 'Please sign in to continue',
    'failed-precondition': 'Complete DigiLocker verification first',
    'invalid-argument': 'Invalid data provided',
    'internal': 'Server error - please try again',
  };
  
  alert(messages[error.code] || error.message);
}
```

### Common Error Scenarios

**Scenario 1: User closes popup without authenticating**
```
→ Polling continues for 3 minutes
→ Status check returns status !== "verified"
→ Timeout error shown
→ User can retry
```

**Scenario 2: Face descriptor fails to send**
```
→ User can click "Retry Live Verification"
→ New descriptor is captured and sent
→ No data is lost
```

**Scenario 3: Form submitted without all verifications**
```
→ Frontend validation fails first
→ Backend validation as safety check
→ Both must pass for account creation
```

---

## Rate Limiting

Current rate limits (recommended):

| Endpoint | Limit | Window |
|----------|-------|--------|
| `digilockerAuthUrl` | 5 | 15 min |
| `verifyFaceMatch` | 10 | 15 min |
| `finalizeRegistration` | 3 | 15 min |

To implement:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req, res) => req.user.uid,
});

exports.digilockerAuthUrl = functions.https.onCall(limiter, async (data, context) => {
  // ...
});
```

---

## Performance Notes

### Typical Latencies

| Operation | Time |
|-----------|------|
| Auth URL generation | 200-500 ms |
| OAuth token exchange | 1-2 seconds |
| Face detection (client) | 3-5 seconds |
| Face matching | 500 ms - 1 sec |
| Total flow | 30-60 seconds |

### Optimization Tips

1. **Preload face-api models** on page load
2. **Cache DigiLocker docs** temporarily
3. **Batch Firestore writes** in finalizeRegistration
4. **Monitor Cloud Functions quota**

---

## Testing with curl

### Test digilockerAuthUrl

```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  https://region-project.cloudfunctions.net/digilockerAuthUrl
```

### Test verifyFaceMatch

```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"descriptor": [0.1, 0.2, ...]}' \
  https://region-project.cloudfunctions.net/verifyFaceMatch
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Aug 2026 | Initial release |

---

**Last Updated**: August 2026  
**API Version**: 1.0.0
