# DigiLocker KYC Registration - Testing Checklist

Step-by-step testing guide to verify the complete registration flow.

---

## Pre-Testing Setup

### Prerequisites Checklist

- [ ] Node.js 18+ installed (`node --version`)
- [ ] Firebase CLI installed (`firebase --version`)
- [ ] Firebase project created and configured
- [ ] Firestore database initialized
- [ ] Cloud Storage bucket created
- [ ] Cloud Functions enabled (Blaze plan)
- [ ] DigiLocker OAuth credentials obtained
- [ ] HTTPS domain configured
- [ ] SSL certificate valid

### Verify Deployment

```bash
# Check Firebase connection
firebase projects:list

# List deployed functions
firebase functions:list

# Check Firestore
firebase firestore:indexes --list

# View Cloud Storage
firebase storage:buckets
```

---

## Unit Testing

### 1. Firebase Configuration

**Test**: Load config without errors

```javascript
// In browser console
import { auth, db, storage, functions } from './firebase-config.js';
console.log('Auth:', !!auth);
console.log('DB:', !!db);
console.log('Storage:', !!storage);
console.log('Functions:', !!functions);
// Should print all as true
```

**Expected**: All four services initialized ✓

---

### 2. Anonymous Authentication

**Test**: Verify session creation

```javascript
import { signInAnonymously } from 'firebase/auth';

signInAnonymously(auth)
  .then(cred => {
    console.log('✓ Anonymous user:', cred.user.uid);
  })
  .catch(err => {
    console.error('❌ Anonymous auth failed:', err);
  });
```

**Expected**: 
- Prints user UID
- Firestore rule allows read/write to `kyc_sessions/{uid}`

---

### 3. KYC Session Initialization

**Test**: Create session document

```javascript
import { httpsCallable } from 'firebase/functions';

const initializeKycSessionFn = httpsCallable(functions, 'initializeKycSession');

initializeKycSessionFn()
  .then(result => {
    console.log('✓ Session created:', result.data.session_id);
  })
  .catch(err => {
    console.error('❌ Session creation failed:', err.message);
  });
```

**Expected**:
- Returns `session_id` matching current user UID
- Firestore shows new document in `kyc_sessions/{uid}`

---

### 4. Face Detection Models

**Test**: Load face-api.js models

```javascript
const MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights";

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
  faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
  faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
])
  .then(() => console.log('✓ All models loaded'))
  .catch(err => console.error('❌ Model load failed:', err));
```

**Expected**:
- Console shows "✓ All models loaded" after 30-60 seconds
- No network errors in Network tab

---

## Integration Testing

### Flow 1: DigiLocker OAuth

**Steps**:

1. Click "Connect DigiLocker Account" button
2. Monitor network requests in DevTools
3. Verify popup opens

**Network Checks**:

```
1. POST /digilockerAuthUrl
   Response: { "url": "https://...", "state": "..." }
   Status: 200
```

2. Popup makes `GET /digilocker-callback?code=...&state=...`
   Status: 200 (success page)

3. Firestore `kyc_sessions/{uid}` updated with:
   ```
   status: "digilocker_verified"
   aadhaar_hash: "..."
   verified_at: <timestamp>
   ```

**Expected**:
- ✓ Popup closes after 2-3 seconds
- ✓ Status shows "DigiLocker verified successfully!"
- ✓ Button text changes to "DigiLocker Verified"
- ✓ Button gets green background
- ✓ Camera section becomes clickable

**Failure Scenarios**:
- Popup blocked → Allow popups in browser settings
- 404 response → Function not deployed
- Timeout → Polling exceeded 3 minutes
- Access denied → DigiLocker credentials incorrect

---

### Flow 2: Live Camera Verification

**Setup**:

1. Ensure DigiLocker verification completed first
2. Allow camera access when prompted
3. Have bright lighting and clear view of your face

**Steps**:

1. Click "Start Live Verification"
2. Face should appear in video feed within 2 seconds
3. Camera shows "✓ Face detected" message
4. Keep face centered and blink naturally
5. After blink detected + 2 seconds, face descriptor captured
6. System compares with Aadhaar photo

**Expected Outputs**:

**Success Case** (face matches):
```
✓ Face detected
✓ Blink detected
[2 second capture]
✓ Face matches your Aadhaar photo!
[VERIFIED badge appears]
Button changes to "Live Verification Complete"
```

**Failure Case** (face doesn't match):
```
❌ Face mismatch (distance: 0.72, threshold: 0.6)
Try again in good lighting.
Button changes to "Retry Live Verification"
```

**Error Cases**:

| Error | Cause | Solution |
|-------|-------|----------|
| "No face detected" | Face not in frame | Adjust camera angle |
| "Multiple faces detected" | Someone else in shot | Face alone in frame |
| "Timeout" | Model loading took too long | Reload page |
| "Failed to compare" | No Aadhaar data | Complete DigiLocker first |
| "Camera error" | Permission denied | Check browser camera permissions |

---

### Flow 3: OTP Verification

**Steps**:

1. Enter phone number with country code (+91 XXXXX)
2. Click "Send OTP"
3. Check SMS for OTP code (real implementation)
4. Enter OTP in "Enter 6-digit OTP" field

**For Testing** (with Firebase Auth emulator):

```
Use test phone: +91 6505 555005
OTP code: 123456
```

**Expected**:
- Button shows "OTP Sent" after clicking
- SMS arrives within 30 seconds (production)
- OTP field accepts 6 digits
- Form submission validates OTP

---

### Flow 4: Form Submission

**Prerequisites**:
- ✓ DigiLocker verified
- ✓ Live camera verified
- ✓ OTP entered (optional)
- ✓ Profile photo uploaded
- ✓ All fields filled

**Steps**:

1. Fill all form fields:
   - Full name
   - Email
   - Mobile number
   - Favorite sport
   - Ambition
   - Profile photo
   - Qualification
   - Specialization
   - College name
   - Skills (comma-separated)
   - Professional interests

2. Click "Complete Registration" button

**Expected Backend Actions**:

1. `finalizeRegistration()` called
   - Checks DigiLocker status
   - Checks face match result
   - Returns approval

2. Email/password account created in Firebase Auth

3. Profile photo uploaded to Storage:
   - Path: `profile_photos/{uid}/{filename}`
   - File size < 5MB
   - Accessible via HTTPS URL

4. User profile saved to Firestore:
   - Path: `users/{uid}`
   - Contains all form data
   - Timestamps recorded

5. Redirect to dashboard/success page

**Expected**:
```
✓ Registration successful! Identity verified — your account is approved.
[Redirect to index.html or dashboard]
```

---

## Performance Testing

### Latency Measurement

**Measurement Points**:

| Operation | Target | Method |
|-----------|--------|--------|
| Model loading | 30-60s | Measure once on page load |
| Face detection | <500ms/frame | DevTools Performance tab |
| DigiLocker redirect | <2s | Network tab timing |
| Face matching API | <1s | CloudFunctions log |
| Total flow | <2 min | Timer from start to success |

**Test Command**:

```javascript
console.time('Total Registration Flow');
// ... complete flow ...
console.timeEnd('Total Registration Flow');
```

### Memory Usage

Open DevTools > Memory tab:

1. Take heap snapshot before registration
2. Complete registration flow
3. Take heap snapshot after
4. Check for memory leaks

**Expected**: Memory increases <50MB

---

## Security Testing

### 1. Firestore Security Rules

**Test: Try to access another user's data**

```javascript
// As User A, try to read User B's kyc_sessions
const userBSession = await getDoc(
  doc(db, 'kyc_sessions', 'user_b_uid')
);
// Should throw permission error
```

**Expected**: 
```
Error: Missing or insufficient permissions
```

### 2. Face Descriptor Protection

**Test: Verify descriptor is not accessible**

```javascript
// Try to fetch another user's face descriptor
const userData = await getDoc(
  doc(db, 'kyc_sessions', 'another_user_uid')
);
```

**Expected**: 
```
Error: Missing or insufficient permissions
```

### 3. State Token Validation

**Test: Use invalid state in callback**

```
GET /digilocker-callback?code=valid&state=invalid_state
```

**Expected**:
```
Error: No matching KYC session found for state
Status: 404
```

### 4. CSRF Protection

**Test: Ensure state token is random**

```javascript
// Generate two auth URLs and compare states
const url1 = await digilockerAuthUrlFn();
const url2 = await digilockerAuthUrlFn();

console.log(url1.data.state === url2.data.state); // Should be false
```

**Expected**: 
```
false (states are different)
```

---

## Browser Compatibility Testing

### Required Permissions

| Feature | Required | Chrome | Firefox | Safari | Edge |
|---------|----------|--------|---------|--------|------|
| Camera | Yes | ✓ | ✓ | ✓ | ✓ |
| Firestore | Yes | ✓ | ✓ | ✓ | ✓ |
| localStorage | Yes | ✓ | ✓ | ✓ | ✓ |
| Crypto API | Yes | ✓ | ✓ | ✓ | ✓ |

### Test Procedure

1. Test on latest versions of: Chrome, Firefox, Safari, Edge
2. Test on mobile browsers: Chrome Mobile, Safari iOS
3. Test on 4G/5G connections
4. Test with slow network (DevTools: Slow 3G)

**Critical Tests**:

- [ ] Camera access prompt appears
- [ ] Face detection works in dim lighting
- [ ] Form submission completes in <5 minutes
- [ ] No console errors on success path
- [ ] Mobile: Portrait and landscape work

---

## Stress Testing

### Load Test: Simultaneous Registrations

**Objective**: Verify system handles multiple users

```bash
# Simulate 5 concurrent registrations (requires test framework)
# Monitor:
# - Firestore read/write operations
# - Cloud Functions execution time
# - Storage upload bandwidth
```

**Acceptance Criteria**:
- All 5 complete successfully
- No timeouts
- No rate limit errors

### Database Quota Check

```bash
firebase firestore:describe-indexes --collection kyc_sessions
```

**Expected**: Queries complete in <1 second

---

## Cleanup Testing

### Test Session Expiry

1. Create KYC session at time T
2. Wait 7+ days (or mock with Firestore timestamp)
3. Trigger cleanup function:

```bash
firebase functions:call cleanupExpiredSessions
```

**Expected**: Old pending sessions deleted

---

## Regression Testing Checklist

After each deployment, verify:

- [ ] Authentication works (Anonymous, Phone, Email)
- [ ] Firestore operations succeed
- [ ] Cloud Storage uploads work
- [ ] Face-api models load
- [ ] Camera permission prompt appears
- [ ] Face detection runs smoothly
- [ ] No JavaScript errors in console
- [ ] DigiLocker popup opens/closes correctly
- [ ] Form validation works
- [ ] Redirect on success happens
- [ ] Error messages display properly
- [ ] Rate limiting active (test with multiple requests)
- [ ] Security rules enforced

---

## Known Issues & Workarounds

### Issue 1: Face Detection Slow on First Load

**Cause**: Models downloading from CDN (50-100MB total)

**Workaround**: 
- Preload models on page load (not just on click)
- Show loading spinner for 30-60 seconds
- Cache models locally (IndexedDB)

### Issue 2: Mobile Camera Orientation

**Cause**: Some devices rotate camera feed incorrectly

**Workaround**: 
- Use `CSS transform: rotate()` if needed
- Test on actual devices, not emulators
- Inform users to keep phone upright

### Issue 3: Face Matching Fails in Poor Lighting

**Cause**: Face descriptors poorly captured in dim light

**Workaround**:
- Request adequate lighting in instructions
- Adjust threshold (0.65 instead of 0.6)
- Allow multiple retries

### Issue 4: DigiLocker Timeout

**Cause**: User leaves popup open >3 minutes

**Workaround**:
- Show countdown timer in UI
- Extend polling to 5 minutes
- Allow manual "retry" button

---

## Testing Report Template

```markdown
# Testing Report

**Date**: ___________
**Tester**: ___________
**Browser/Device**: ___________

## Flow 1: DigiLocker OAuth
- [ ] Popup opens
- [ ] Redirect successful
- [ ] Firestore updates
- [ ] Timeout handling works
**Result**: PASS / FAIL

## Flow 2: Live Camera
- [ ] Camera access requested
- [ ] Face detected
- [ ] Blink detected
- [ ] Descriptor captured
**Result**: PASS / FAIL

## Flow 3: Form Submission
- [ ] All validations pass
- [ ] Account created
- [ ] Photo uploaded
- [ ] Redirect works
**Result**: PASS / FAIL

## Security
- [ ] Cannot access other user data
- [ ] State tokens are random
- [ ] Face descriptors protected
**Result**: PASS / FAIL

## Performance
- [ ] Models load in <60s
- [ ] Face detection smooth
- [ ] Total flow <2 min
**Result**: PASS / FAIL

## Issues Found
1. ___________
2. ___________

## Notes
___________
```

---

## Final Verification

Before going to production, complete this final checklist:

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Security tests passing
- [ ] Performance meets targets
- [ ] No console errors
- [ ] Mobile testing complete
- [ ] Error handling tested
- [ ] Rate limiting verified
- [ ] Firestore rules deployed
- [ ] Storage rules deployed
- [ ] Monitoring configured
- [ ] Documentation complete
- [ ] Team trained on system
- [ ] Backup/rollback plan ready

---

**Testing Completed By**: ___________  
**Date**: ___________  
**Approved By**: ___________  
**Approval Date**: ___________

---

**Last Updated**: August 2026
