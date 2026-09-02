/**
 * IntraWorld - Vercel Serverless Backend Handler
 * Path: C:\Intraworld\api\server.js
 */
import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// API Keys
const WEB3FORMS_ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY || "bb00ad90-e756-4918-b4b5-caf2bab0b818";
const TWOFACTOR_API_KEY = process.env.TWOFACTOR_API_KEY || "33d4086d-a553-11f1-9cb1-0200cd936042";
const ID_ANALYZER_KEY = process.env.ID_ANALYZER_KEY || "idk_KsgEWHZV7A2dKjSYcPO2SlDLebdylyMt2Q1eBciS";

// 1. Send Email OTP
app.post('/api/send-email-otp', async (req, res) => {
  try {
    const { email, fullName } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: `Your Student Verification OTP: ${otp}`,
        from_name: 'IntraWorld Security',
        to_email: email,
        message: `Your verification code is: ${otp}`
      })
    });

    return res.json({ success: true, message: `OTP sent to ${email}`, otp });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// 2. Send SMS OTP
app.post('/api/send-sms-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const res2f = await fetch(`https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${cleanPhone}/AUTOGEN/STUDENT_VERIFY`);
    const data = await res2f.json();
    return res.json({ success: true, sessionId: data.Details });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// 3. ID Analyzer Deepfake Scan
app.post('/api/analyze-document', async (req, res) => {
  try {
    const { fileBase64 } = req.body;
    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');

    const idRes = await fetch('https://api2.idanalyzer.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: ID_ANALYZER_KEY,
        file_base64: cleanBase64,
        verify_document: true,
        verify_authenticity: true
      })
    });
    const data = await idRes.json();
    return res.json({ success: true, tierPoints: 100, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

export default app;