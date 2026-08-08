# DigiLocker KYC Registration System - Setup Guide

Complete step-by-step guide to implement the DigiLocker OAuth + Face Verification registration system.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Firebase Setup](#firebase-setup)
3. [DigiLocker Configuration](#digilocker-configuration)
4. [Cloud Functions Deployment](#cloud-functions-deployment)
5. [Frontend Integration](#frontend-integration)
6. [Testing](#testing)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js** 18+ installed
- **Firebase CLI** installed: `npm install -g firebase-tools`
- **Firebase Account** with an active project
- **DigiLocker OAuth Credentials** (Client ID & Secret)
- **Domain/Host** for callback URL (production)

### Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

---

## Firebase Setup

### 1. Create Firebase Project (or use existing)

Go to [Firebase Console](https://console.firebase.google.com/):
- Click "Create Project" or select existing project
- Enable Google Cloud APIs (automatic)

### 2. Enable Authentication Methods

In Firebase Console > Authentication > Sign-in method:
- ✅ Enable **Anonymous** (for unauthenticated session)
- ✅ Enable **Phone** (for OTP verification)
- ✅ Enable **Email/Password** (for final account creation)

### 3. Enable Firestore Database

In Firebase Console > Firestore Database:
- Click "Create Database"
- Choose production mode (we'll set security rules)
- Select default region (recommended: asia-south1 for India)

### 4. Enable Cloud Storage

In Firebase Console > Storage:
- Click "Get Started"
- Accept default bucket location

### 5. Enable Cloud Functions

In Firebase Console > Functions:
- Upgrade to Blaze plan (required for HTTP functions and external API calls)
- Set region to match your Firestore region

### 6. Create `.env.local` for Development

Create `firebase/.env` with your config:

```env
DIGILOCKER_CLIENT_ID=your_client_id
DIGILOCKER_CLIENT_SECRET=your_client_secret
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_REGION=asia-south1
```

---

## DigiLocker Configuration

### 1. Register Your Application

Visit [DigiLocker Developer Portal](https://www.digilocker.gov.in/):

1. Create developer account (if not already)
2. Register new application:
   - **App Name**: Your Application Name
   - **Description**: KYC Registration System
   - **Callback URL**: `https://your-domain.com/auth/digilocker-callback`
   - **Scope**: openid, profile, email

3. You'll receive:
   - **Client ID**
   - **Client Secret**

### 2. Update Cloud Functions Environment Variables

In Firebase Console > Cloud Functions > Runtime Settings:

1. Click on a function
2. Set environment variables:

```
DIGILOCKER_CLIENT_ID = your_client_id
DIGILOCKER_CLIENT_SECRET = your_client_secret
```

Or via CLI:

```bash
firebase functions:config:set digilocker.client_id="YOUR_ID"
firebase functions:config:set digilocker.client_secret="YOUR_SECRET"
```

### 3. Set Callback URL in Firebase

The callback function must be publicly accessible:

```
https://your-region-your-project.cloudfunctions.net/digilockerCallback
```

Set this as your redirect URI in DigiLocker portal.

---

## Cloud Functions Deployment

### 1. Initialize Firebase Project (if new)

```bash
cd your-project-root
firebase init functions
# Select your project
# Choose JavaScript
# Install dependencies
```

### 2. Copy Functions Code

Replace `functions/index.js` with the provided `functions-index.js`:

```bash
cp functions-index.js functions/index.js
```

### 3. Install Dependencies

```bash
cd functions
npm install firebase-functions firebase-admin axios
cd ..
```

### 4. Deploy Cloud Functions

```bash
firebase deploy --only functions
```

Monitor deployment:

```bash
firebase functions:log
```

### 5. Verify Deployment

```bash
firebase functions:describe digilockerAuthUrl
firebase functions:describe digilockerCallback
firebase functions:describe verifyFaceMatch
firebase functions:describe finalizeRegistration
```

---

## Frontend Integration

### 1. Update Firebase Config

Edit `firebase-config.js` with your credentials:

```javascript
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-messaging-id",
    appId: "your-app-id",
};
```

### 2. Replace Registration JavaScript

Use the provided `register-enhanced.js` instead of basic registration:

```html
<!-- In register.html -->
<script type="module" src="./register-enhanced.js"></script>
```

### 3. Add Required Libraries to HTML Head

```html
<!-- Font Awesome for icons -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<!-- Face Detection Library -->
<script async src="https://cdn.jsdelivr.net/npm/face-api.js"></script>

<!-- Cloudflare Turnstile (for CAPTCHA - optional) -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

### 4. Create `.htaccess` for CORS (if using Apache)

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    
    # Allow CORS for Firebase functions
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    Header set Access-Control-Allow-Headers "Content-Type, Authorization"
</IfModule>
```

---

## Testing

### 1. Local Testing with Emulator

```bash
firebase emulators:start
```

This starts:
- Authentication Emulator (port 9099)
- Firestore Emulator (port 8080)
- Storage Emulator (port 9199)
- Functions Emulator (port 5001)

### 2. Test Registration Flow Manually

1. **OTP Test**: 
   - Enter phone: +91 6505 555005
   - OTP: 123456 (default test code)

2. **DigiLocker Test**:
   - Click "Connect DigiLocker Account"
   - Mock UI will appear (in emulator)
   - Verify polling works

3. **Camera Test**:
   - Allow camera access
   - Face should be detected within 2 seconds
   - Simulate blink (close eyes briefly)
   - Face descriptor should be captured

### 3. Test Completion

- All verifications should show ✓ green checkmarks
- Submit form should succeed

---

## Security Considerations

### 1. Firestore Security Rules

**IMPORTANT**: Set these security rules in Firestore Console:

```firestore-rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // User profiles - owner only
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // KYC sessions - owner only (sensitive data)
    match /kyc_sessions/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Default: deny all
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Deploy with:

```bash
firebase deploy --only firestore:rules
```

### 2. Cloud Storage Security Rules

```storage
service firebase.storage {
  match /b/{bucket}/o {
    
    // Profile photos
    match /profile_photos/{userId}/{allPaths=**} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId && 
                      request.resource.size < 5 * 1024 * 1024 && // 5MB max
                      request.resource.contentType.matches('image/.*');
    }
    
    // Default: deny all
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### 3. Protect API Keys

**Never expose your Firebase config in version control:**

```bash
# .gitignore
firebase-config.js  # If it contains sensitive data
.env
.env.local
functions/.env
```

### 4. HTTPS Only

Ensure your domain uses HTTPS:
- SSL certificate (Let's Encrypt free option available)
- DigiLocker requires HTTPS callback URLs
- Browser requires HTTPS for camera access

### 5. Rate Limiting

Add rate limiting to Cloud Functions to prevent abuse:

```javascript
// Add to functions-index.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many verification attempts, please try again later',
});

app.use('/digilockerAuthUrl', limiter);
```

---

## Troubleshooting

### Issue: "Popup blocked" error

**Solution**: 
- Ensure site is served over HTTPS
- Check browser popup blocker settings
- Test on different browsers

### Issue: Face detection not working

**Possible causes**:
1. **Camera permission denied**
   - Grant camera access in browser settings
   - Test camera with `https://webcamtests.com`

2. **face-api.js models not loaded**
   - Check browser console for network errors
   - Verify CDN is accessible
   - Models may take 30-60 seconds to download initially

3. **Poor lighting**
   - Ensure adequate lighting on user's face
   - Avoid backlighting
   - Test with different faces

**Solution**:
```javascript
// Add debug logging
loadFaceModels().then(() => {
  console.log("✓ Models loaded successfully");
}).catch(err => {
  console.error("❌ Model load failed:", err);
  // Show user-friendly error
});
```

### Issue: DigiLocker callback returns 404

**Possible causes**:
1. Cloud Function `digilockerCallback` not deployed
2. Wrong callback URL configured in DigiLocker portal
3. Function region doesn't match

**Solution**:
```bash
# Verify function is deployed
firebase functions:describe digilockerCallback

# Check logs
firebase functions:log

# Redeploy
firebase deploy --only functions:digilockerCallback
```

### Issue: Face matching always fails

**Possible causes**:
1. Aadhaar photo descriptor not captured from DigiLocker
2. Threshold too strict (0.6 default)
3. Different lighting conditions between camera and Aadhaar

**Solution**:
```javascript
// Adjust threshold in functions-index.js (line ~250)
const FACE_MATCH_THRESHOLD = 0.65; // Increase slightly if too strict

// Add debug logging
console.log('Distance:', distance, 'Threshold:', FACE_MATCH_THRESHOLD);
```

### Issue: "Permission denied" on Firestore write

**Solution**: 
1. Verify security rules are deployed
2. Check user is authenticated (should be anonymous initially)
3. Ensure `kyc_sessions/{uid}` document exists before update

```javascript
// In functions, create document if missing:
await db.collection('kyc_sessions').doc(uid).set({
  uid: uid,
  created_at: admin.firestore.FieldValue.serverTimestamp(),
}, { merge: true });
```

---

## Monitoring & Analytics

### Enable Cloud Logging

```bash
firebase functions:log --limit 50
```

### Monitor Deployment

```bash
firebase deploy --only functions --debug
```

### Check Quota Usage

Firebase Console > Cloud Functions > Quota metrics

---

## Production Checklist

- [ ] Firebase project configured (Firestore, Storage, Auth)
- [ ] Cloud Functions deployed and tested
- [ ] DigiLocker credentials obtained and configured
- [ ] Firestore and Storage security rules deployed
- [ ] HTTPS enabled on your domain
- [ ] Callback URL registered in DigiLocker portal
- [ ] Rate limiting configured
- [ ] Error logging and monitoring set up
- [ ] User feedback messages added
- [ ] Performance testing completed
- [ ] Privacy policy updated (mention DigiLocker)
- [ ] Terms of service updated (mention face verification)

---

## Support & Resources

- **Firebase Docs**: https://firebase.google.com/docs
- **DigiLocker Docs**: https://www.digilocker.gov.in/
- **face-api.js Docs**: https://github.com/justadudewhohacks/face-api.js
- **Firebase Functions Best Practices**: https://firebase.google.com/docs/functions/tips-and-tricks

---

## License

This implementation is provided as-is for educational and commercial use. Ensure compliance with DigiLocker ToS and Indian identity verification regulations.

---

**Last Updated**: August 2026  
**Version**: 1.0.0
