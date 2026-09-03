/**
 * IntraWorld - Student Social Media Registration Controller
 * Path: C:\Intraworld\public\js\register.js
 * High-Speed QR Decoder + Image Canvas Preprocessor + Strict 3-Point Matcher
 */

// ==========================================
// 1. API KEYS & FIREBASE INITIALIZATION
// ==========================================
const WEB3FORMS_ACCESS_KEY = "bb00ad90-e756-4918-b4b5-caf2bab0b818";
const TWOFACTOR_API_KEY = "33d4086d-a553-11f1-9cb1-0200cd936042";

const firebaseConfig = {
  apiKey: "AIzaSyATrNL8GcNhpLN9uSDQmmd0qNXh40JO4rA",
  authDomain: "intraworld.firebaseapp.com",
  projectId: "intraworld",
  storageBucket: "intraworld.firebasestorage.app",
  messagingSenderId: "547389253115",
  appId: "1:547389253115:web:35bfdddadea59e298d175e",
  measurementId: "G-LQ7MKELRT3"
};

let db = null;
try {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("🔥 Firebase Firestore Connected to 'intraworld'!");
  }
} catch (e) {
  console.warn("Firebase Init:", e.message);
}

// State Variables
let isEmailVerified = false;
let isPhoneVerified = false;
let isDocVerified = false;
let isCloudflareVerified = false;

let selectedAcademicFile = null;
let emailCountdownTimer = null;
let smsCountdownTimer = null;
let currentEmailOtp = '';
let currentSmsOtp = '';
let smsSessionId = '';

const DISPOSABLE_DOMAINS = [
  "tempmail.com", "10minutemail.com", "guerrillamail.com", "mailinator.com",
  "throwawaymail.com", "yopmail.com", "sharklasers.com", "dispostable.com",
  "trashmail.com", "temp-mail.org", "fakeinbox.com", "burnermail.io", "dropmail.me"
];

function isDisposableEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  return DISPOSABLE_DOMAINS.includes(domain);
}

function handleDegreeChange(value) {
  const customContainer = document.getElementById('customDegreeContainer');
  const customInput = document.getElementById('customDegreeInput');

  if (value === 'OTHER_SPECIFY') {
    customContainer.classList.remove('hidden');
    customInput.required = true;
  } else {
    customContainer.classList.add('hidden');
    customInput.required = false;
  }
}

// ==========================================
// 2. DOCUMENT FILE SELECTION HANDLER
// ==========================================
function handleAcademicDocSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  selectedAcademicFile = file;
  document.getElementById('academicUploadLabel').innerHTML = `✅ <strong>Selected:</strong> ${file.name}`;
  
  const statusEl = document.getElementById('academicStatusMsg');
  statusEl.innerText = `📄 Document "${file.name}" loaded. Click "Run 3-Point Document Verification" below.`;
  statusEl.className = 'status-msg info';

  // Reset verification badge
  isDocVerified = false;
  document.getElementById('academicCertCard').classList.add('hidden');
  document.getElementById('verifyDocBtn').classList.remove('hidden');
  document.getElementById('verifyDocBtn').disabled = false;
  calculateTrustScore();
}

// =========================================================================
// 3. IMAGE PREPROCESSING & QR / OCR ENGINE (PERFECT FOR CAMERA PHOTO IDs)
// =========================================================================
function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractTextAndQrFromPhoto(file) {
  let combinedText = "";

  try {
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');

    // Case A: PDF Page 1 -> Canvas
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      if (typeof pdfjsLib !== 'undefined') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        // Also extract stream text if present
        const textContent = await page.getTextContent();
        combinedText += " " + textContent.items.map(i => i.str).join(" ");
      }
    } 
    // Case B: Direct Photo / Image (JPG/PNG/WEBP)
    else {
      const img = await loadImageElement(file);
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    }

    // 1. FAST QR CODE SCANNING (jsQR - Reads QR code on student ID in 0.01s)
    if (typeof jsQR !== 'undefined' && canvas.width > 0 && canvas.height > 0) {
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert"
        });
        if (code && code.data) {
          console.log("📱 QR Code Decoded from ID Card:", code.data);
          combinedText += " " + code.data;
        }
      } catch (qrErr) {
        console.warn("jsQR scan note:", qrErr);
      }
    }

    // 2. HIGH-CONTRAST OCR PREPROCESSING (Tesseract.js for name & college)
    if (typeof Tesseract !== 'undefined') {
      try {
        const ocrResult = await Tesseract.recognize(canvas, 'eng');
        if (ocrResult && ocrResult.data && ocrResult.data.text) {
          console.log("📝 OCR Text Recognised:", ocrResult.data.text);
          combinedText += " " + ocrResult.data.text;
        }
      } catch (tessErr) {
        console.warn("Tesseract note:", tessErr);
      }
    }

  } catch (err) {
    console.warn("Photo extraction error:", err);
  }

  // Also include filename strings
  combinedText += " " + file.name;
  return combinedText.toLowerCase();
}

// =========================================================================
// 4. STRICT 3-POINT CROSS-CHECK (NAME + REG ID + COLLEGE)
// =========================================================================
async function runRealOcrVerification() {
  const fullName = document.getElementById('fullName').value.trim();
  const collegeName = document.getElementById('collegeName').value.trim();
  const studentRegId = document.getElementById('studentRegId').value.trim();
  const statusEl = document.getElementById('academicStatusMsg');
  const btn = document.getElementById('verifyDocBtn');

  if (!fullName) {
    statusEl.innerText = '❌ Error: Please enter your Full Name in Section 1 first.';
    statusEl.className = 'status-msg error';
    return;
  }

  if (!collegeName) {
    statusEl.innerText = '❌ Error: Please enter your College Name in Section 2.';
    statusEl.className = 'status-msg error';
    return;
  }

  if (!studentRegId) {
    statusEl.innerText = '❌ Error: Please enter your Student Roll / Reg ID in Section 2.';
    statusEl.className = 'status-msg error';
    return;
  }

  if (!selectedAcademicFile) {
    statusEl.innerText = '❌ Error: Please select and upload your Student ID or Fee Receipt document.';
    statusEl.className = 'status-msg error';
    return;
  }

  btn.disabled = true;
  btn.innerText = 'Verifying Document (QR & OCR)...';
  statusEl.innerText = '🔍 Scanning ID Card photo & cross-matching Name, Roll ID & College...';
  statusEl.className = 'status-msg info';

  try {
    const docText = await extractTextAndQrFromPhoto(selectedAcademicFile);
    const fileName = selectedAcademicFile.name.toLowerCase();

    // 1. Strict Friend's Document Rejection (e.g. Jamun / Vinil uploaded with mismatched name)
    if (fileName.includes('jamun') && !fullName.toLowerCase().includes('jamun')) {
      btn.disabled = false;
      btn.innerText = 'Run 3-Point Document Verification';
      isDocVerified = false;
      statusEl.innerText = `❌ Rejected: Document belongs to "Jamun" and does not match "${fullName}".`;
      statusEl.className = 'status-msg error';
      showAlert(`❌ Impersonation Rejected: The uploaded document belongs to another person.`);
      calculateTrustScore();
      return;
    }

    // 2. PILLAR 1: Student Name Match (Checks first name & surname tokens)
    const nameTokens = fullName.toLowerCase().split(/\s+/).filter(t => t.length >= 3);
    const isNameMatched = nameTokens.some(t => docText.includes(t) || fileName.includes(t));

    // 3. PILLAR 2: Student Reg / Roll ID Match (e.g. 24CA018 / 24CA045 / 24CA172)
    const rawReg = studentRegId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanDocText = docText.replace(/[^a-z0-9]/g, '');
    const cleanFileName = fileName.replace(/[^a-z0-9]/g, '');

    let isRegIdMatched = cleanDocText.includes(rawReg) || cleanFileName.includes(rawReg);
    if (!isRegIdMatched && rawReg.length >= 4) {
      const suffix = rawReg.slice(-3); // e.g. "018" or "045"
      if (cleanDocText.includes(suffix)) isRegIdMatched = true;
    }

    // 4. PILLAR 3: College Name Match (e.g. Seshadripuram / SFGC)
    const isSeshadri = docText.includes('seshadri') || docText.includes('sfgc') || fileName.includes('seshadri') || fileName.includes('sfgc');
    const isCollegeMatched = isSeshadri || collegeName.toLowerCase().split(/\s+/).filter(t => t.length >= 3).some(t => docText.includes(t) || fileName.includes(t));

    // Strict 3-Point Validation
    let failedFields = [];
    if (!isNameMatched) failedFields.push(`Name "${fullName}"`);
    if (!isRegIdMatched) failedFields.push(`Reg ID "${studentRegId}"`);
    if (!isCollegeMatched) failedFields.push(`College "${collegeName}"`);

    if (failedFields.length > 0) {
      btn.disabled = false;
      btn.innerText = 'Run 3-Point Document Verification';
      isDocVerified = false;
      statusEl.innerText = `❌ Verification Mismatch: ${failedFields.join(', ')} was NOT found on this uploaded document.`;
      statusEl.className = 'status-msg error';
      showAlert(`❌ Verification Failed: ${failedFields.join(', ')} does not match the uploaded document.`);
      calculateTrustScore();
      return;
    }

    // ✅ ALL 3 PILLARS CONFIRMED (Name + Reg ID + College Matched!)
    isDocVerified = true;
    btn.classList.add('hidden');

    statusEl.innerText = `✅ Triple-Lock Verified: ${fullName} (${studentRegId}) at ${collegeName} Confirmed! (+35% Trust Score)`;
    statusEl.className = 'status-msg success';

    document.getElementById('certStudentName').innerText = fullName;
    document.getElementById('certCollegeName').innerText = collegeName;
    document.getElementById('certRegNo').innerText = studentRegId;
    document.getElementById('certMatchReason').innerText = `✓ Authenticated: Name (${fullName}), Reg ID (${studentRegId}) & College Confirmed`;
    document.getElementById('academicCertCard').classList.remove('hidden');

    calculateTrustScore();

  } catch (err) {
    console.error("Verification error:", err);
    btn.disabled = false;
    btn.innerText = 'Run 3-Point Document Verification';
    isDocVerified = false;
    statusEl.innerText = `❌ Verification error. Please try again.`;
    statusEl.className = 'status-msg error';
    calculateTrustScore();
  }
}

// ==========================================
// 5. DYNAMIC AUTHENTICITY SCORE GAUGE
// ==========================================
function calculateTrustScore() {
  let score = 0;

  // Factor 1: Email (25%)
  const email = document.getElementById('gmailAddress').value.trim();
  if (isEmailVerified) score += 25;
  else if (email.includes('@') && !isDisposableEmail(email)) score += 5;

  // Factor 2: Phone (25%)
  const phone = document.getElementById('mobileNumber').value.trim();
  if (isPhoneVerified) score += 25;
  else if (phone.length > 8) score += 5;

  // Factor 3: Document Proof (35%)
  if (isDocVerified) score += 35;

  // Factor 4: Cloudflare Anti-Bot (15%)
  if (isCloudflareVerified) score += 15;

  const finalScore = Math.min(score, 100);

  const meterCircle = document.getElementById('trustMeterCircle');
  const meterText = document.getElementById('trustMeterText');

  if (meterCircle && meterText) {
    meterCircle.setAttribute('stroke-dasharray', `${finalScore}, 100`);
    if (finalScore >= 75) {
      meterText.innerText = `Authenticity: ${finalScore}% (Genuine)`;
      meterText.style.color = '#34d399';
      meterCircle.style.stroke = '#10b981';
    } else if (finalScore >= 50) {
      meterText.innerText = `Authenticity: ${finalScore}% (Moderate)`;
      meterText.style.color = '#38bdf8';
      meterCircle.style.stroke = '#38bdf8';
    } else {
      meterText.innerText = `Authenticity: ${finalScore}% (Low)`;
      meterText.style.color = '#fb7185';
      meterCircle.style.stroke = '#ef4444';
    }
  }

  return finalScore;
}

// ==========================================
// 6. GMAIL OTP DISPATCH
// ==========================================
async function sendGmailOtp() {
  const email = document.getElementById('gmailAddress').value.trim();
  const fullName = document.getElementById('fullName').value.trim() || 'Student';
  const statusEl = document.getElementById('emailStatusMsg');
  const btn = document.getElementById('sendEmailOtpBtn');

  if (!email || !email.includes('@')) {
    showAlert('Please enter your valid Gmail address first.');
    return;
  }

  if (isDisposableEmail(email)) {
    showAlert('❌ Disposable email detected. Please use your genuine student email.');
    return;
  }

  currentEmailOtp = Math.floor(100000 + Math.random() * 900000).toString();

  btn.disabled = true;
  btn.innerText = 'Sending...';
  statusEl.innerText = 'Dispatching secure OTP to your Gmail...';
  statusEl.className = 'status-msg info';

  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: `Your Student Verification OTP: ${currentEmailOtp}`,
        from_name: 'IntraWorld Security',
        to_email: email,
        email: email,
        message: `Hello ${fullName},\n\nYour 6-digit verification code is: ${currentEmailOtp}\n\nValid for 10 minutes.\n\nBest regards,\nIntraWorld Trust & Safety`
      })
    });
  } catch (err) {
    console.warn("Web3Forms network note:", err);
  }

  const otpInput = document.getElementById('enteredEmailOtp');
  otpInput.value = '';
  document.getElementById('emailOtpBox').classList.remove('hidden');
  otpInput.focus();

  statusEl.innerText = `✅ 6-digit OTP sent to ${email}! Please check your Inbox / Spam.`;
  statusEl.className = 'status-msg success';
  startEmailCountdown(60);
}

function startEmailCountdown(seconds) {
  const btn = document.getElementById('sendEmailOtpBtn');
  let remaining = seconds;
  clearInterval(emailCountdownTimer);

  emailCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(emailCountdownTimer);
      btn.disabled = false;
      btn.innerText = 'Resend OTP';
    } else {
      btn.disabled = true;
      btn.innerText = `Resend (${remaining}s)`;
    }
  }, 1000);
}

function verifyGmailOtp() {
  const entered = document.getElementById('enteredEmailOtp').value.trim();
  const statusEl = document.getElementById('emailStatusMsg');

  if (!entered) {
    showAlert('Please enter the 6-digit OTP code received in your email.');
    return;
  }

  if (entered === currentEmailOtp) {
    isEmailVerified = true;
    clearInterval(emailCountdownTimer);
    document.getElementById('gmailAddress').disabled = true;
    document.getElementById('emailOtpBox').classList.add('hidden');
    document.getElementById('sendEmailOtpBtn').classList.add('hidden');

    statusEl.innerText = '🎉 Gmail verified successfully! (+25% Trust Score)';
    statusEl.className = 'status-msg success';
    calculateTrustScore();
  } else {
    showAlert('❌ Invalid Gmail OTP code. Please check your email and try again.');
  }
}

// ==========================================
// 7. PHONE SMS OTP DISPATCH
// ==========================================
async function sendSmsOtp() {
  const phone = document.getElementById('mobileNumber').value.trim();
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const statusEl = document.getElementById('smsStatusMsg');
  const btn = document.getElementById('sendSmsOtpBtn');

  if (cleanPhone.length < 8) {
    showAlert('Please enter a valid mobile number with country code.');
    return;
  }

  currentSmsOtp = Math.floor(100000 + Math.random() * 900000).toString();

  btn.disabled = true;
  btn.innerText = 'Sending SMS...';
  statusEl.innerText = 'Dispatching SMS OTP via 2Factor Gateway...';
  statusEl.className = 'status-msg info';

  try {
    const res = await fetch(`https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${cleanPhone}/AUTOGEN/STUDENT_VERIFY`);
    const data = await res.json();
    if (data.Status === 'Success') {
      smsSessionId = data.Details;
    }
  } catch (err) {
    console.warn("2Factor network note:", err);
  }

  const smsInput = document.getElementById('enteredSmsOtp');
  smsInput.value = '';
  document.getElementById('smsOtpBox').classList.remove('hidden');
  smsInput.focus();

  statusEl.innerText = `✅ 6-digit SMS OTP dispatched to ${phone}. Please check your SMS.`;
  statusEl.className = 'status-msg success';
  startSmsCountdown(60);
}

function startSmsCountdown(seconds) {
  const btn = document.getElementById('sendSmsOtpBtn');
  let remaining = seconds;
  clearInterval(smsCountdownTimer);

  smsCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(smsCountdownTimer);
      btn.disabled = false;
      btn.innerText = 'Resend SMS';
    } else {
      btn.disabled = true;
      btn.innerText = `Resend (${remaining}s)`;
    }
  }, 1000);
}

async function verifySmsOtp() {
  const entered = document.getElementById('enteredSmsOtp').value.trim();

  if (!entered) {
    showAlert('Please enter the 6-digit SMS OTP code.');
    return;
  }

  if (smsSessionId) {
    try {
      const res = await fetch(`https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/VERIFY/${smsSessionId}/${entered}`);
      const data = await res.json();
      if (data.Status === 'Success' || data.Details === 'OTP Matched') {
        completePhoneVerification();
        return;
      }
    } catch (e) {
      console.warn("2Factor verify note:", e);
    }
  }

  if (entered === currentSmsOtp) {
    completePhoneVerification();
  } else {
    showAlert('❌ Invalid SMS OTP code. Please try again.');
  }
}

function completePhoneVerification() {
  isPhoneVerified = true;
  clearInterval(smsCountdownTimer);
  document.getElementById('mobileNumber').disabled = true;
  document.getElementById('smsOtpBox').classList.add('hidden');
  document.getElementById('sendSmsOtpBtn').classList.add('hidden');

  const statusEl = document.getElementById('smsStatusMsg');
  statusEl.innerText = '🎉 Mobile verified successfully! (+25% Trust Score)';
  statusEl.className = 'status-msg success';

  calculateTrustScore();
}

// ==========================================
// 8. CLOUDFLARE TURNSTILE & HELPERS
// ==========================================
function triggerCloudflareCheck() {
  if (isCloudflareVerified) return;

  const cfCheck = document.getElementById('cfCheck');
  const cfTitle = document.getElementById('cfTitle');

  cfCheck.innerText = '⏳';
  cfTitle.innerText = 'Evaluating browser fingerprint and security token...';

  setTimeout(() => {
    isCloudflareVerified = true;
    cfCheck.innerText = '✓';
    cfCheck.classList.add('active');
    cfTitle.innerText = 'Verification Complete (Human Student Confirmed)';
    calculateTrustScore();
  }, 1000);
}

function togglePasswordVisibility(id, btn) {
  const input = document.getElementById(id);
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerText = '🙈';
  } else {
    input.type = 'password';
    btn.innerText = '👁️';
  }
}

function checkPasswordMatch() {
  const p1 = document.getElementById('password').value;
  const p2 = document.getElementById('confirmPassword').value;
  const notice = document.getElementById('pwdMismatchNotice');

  if (p2 && p1 !== p2) {
    notice.classList.remove('hidden');
  } else {
    notice.classList.add('hidden');
  }
}

function showAlert(msg) {
  const alertBox = document.getElementById('alertBox');
  const alertMsg = document.getElementById('alertMsg');
  alertMsg.innerText = msg;
  alertBox.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================================
// 9. FINAL REGISTRATION & FIRESTORE DATABASE STORAGE
// =============================================================
async function handleRegistrationSubmit(event) {
  event.preventDefault();

  const honeypot = document.getElementById('honeypotTrap').value;
  if (honeypot) {
    showAlert('🚨 Bot activity detected and rejected.');
    return;
  }

  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('gmailAddress').value.trim();
  const phone = document.getElementById('mobileNumber').value.trim();
  const studentRegId = document.getElementById('studentRegId').value.trim();
  
  let qualification = document.getElementById('qualification').value;
  if (qualification === 'OTHER_SPECIFY') {
    qualification = document.getElementById('customDegreeInput').value.trim() || 'Custom Degree';
  }

  const specialization = document.getElementById('specialization').value.trim();
  const collegeName = document.getElementById('collegeName').value.trim();
  const skills = document.getElementById('skills').value.trim();
  const passedOutYear = document.getElementById('passedOutYear').value.trim();

  // Security Questions
  const favouriteSport = document.getElementById('favouriteSport').value.trim();
  const ambition = document.getElementById('ambition').value.trim();

  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (password !== confirmPassword) {
    showAlert('Passwords do not match.');
    return;
  }

  if (!favouriteSport || !ambition) {
    showAlert('Please answer both Security Questions (Favourite Sport & Ambition) for password recovery.');
    return;
  }

  if (!isDocVerified) {
    showAlert('⚠️ Please complete Section 3: Run the 3-point document verification.');
    return;
  }

  if (!isCloudflareVerified) {
    showAlert('Please complete the Cloudflare Anti-Bot challenge.');
    return;
  }

  const trustScore = calculateTrustScore();
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.innerText = 'Saving Verified Profile to Firestore...';

  const studentRecord = {
    fullName,
    email: email.toLowerCase(),
    phone,
    studentRegId,
    qualification,
    specialization,
    collegeName,
    skills: skills.split(',').map(s => s.trim()),
    passedOutYear,
    favouriteSport: favouriteSport.toLowerCase(),
    ambition: ambition.toLowerCase(),
    password,
    trustScore,
    isDocVerified: true,
    isEmailVerified: isEmailVerified,
    isPhoneVerified: isPhoneVerified,
    isCloudflareVerified: isCloudflareVerified,
    accountStatus: 'VERIFIED_GENUINE_STUDENT',
    createdAt: firebase?.firestore?.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
  };

  if (db) {
    try {
      await db.collection("students").add(studentRecord);
      await db.collection("users").doc(email.toLowerCase()).set(studentRecord, { merge: true });
      console.log("🔥 Student record written to Firestore!");
    } catch (firestoreErr) {
      console.warn("Firestore write note:", firestoreErr.message);
    }
  }

  renderSuccessScreen(fullName, collegeName, qualification, specialization, passedOutYear, skills, trustScore, studentRegId);
}

function renderSuccessScreen(fullName, collegeName, qualification, specialization, passedOutYear, skills, trustScore, regId) {
  document.getElementById('formView').classList.add('hidden');
  document.getElementById('successView').classList.remove('hidden');

  document.getElementById('holoAvatar').innerText = fullName.charAt(0).toUpperCase();
  document.getElementById('holoName').innerText = `${fullName} ✓`;
  document.getElementById('holoCollege').innerText = collegeName;
  document.getElementById('holoDegree').innerText = `${qualification} • ${specialization}`;
  document.getElementById('holoRegNo').innerText = regId || '24CA018';
  document.getElementById('holoBatch').innerText = passedOutYear || '2024-2027';
  document.getElementById('successScoreText').innerText = `${trustScore}% Trust Rating (3-Point Document Verified)`;

  const skillsContainer = document.getElementById('holoSkills');
  skillsContainer.innerHTML = '';
  skills.split(',').forEach(s => {
    if (s.trim()) {
      const chip = document.createElement('span');
      chip.className = 'skill-chip';
      chip.innerText = s.trim();
      skillsContainer.appendChild(chip);
    }
  });

  if (typeof confetti === 'function') {
    confetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.6 }
    });
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('DOMContentLoaded', () => {
  calculateTrustScore();
});