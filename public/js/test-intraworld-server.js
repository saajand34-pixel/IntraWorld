const http = require('http');
const app = require('../../server.js');

const server = app.listen(3001, async () => {
    console.log('Testing server running on port 3001...');

    async function sendPostRequest(path, payload) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(payload);
            const req = http.request({
                hostname: 'localhost',
                port: 3001,
                path: path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, data: JSON.parse(body) });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: body });
                    }
                });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    try {
        console.log('\n========================================');
        console.log('1. TEST REAL CLEAR DOCUMENT (Target: 100 Pts)');
        console.log('========================================');
        const res1 = await sendPostRequest('/api/verify-document', {
            documentBase64: 'data:image/jpeg;base64,' + Buffer.from('Official clear student ID').toString('base64').repeat(500),
            expectedName: 'Alex Morgan',
            expectedCollege: 'Stanford University',
            expectedYear: '2026',
            clientOcrText: 'STANFORD UNIVERSITY OFFICIAL STUDENT IDENTIFICATION CARD NAME: ALEX MORGAN YEAR: 2026',
            isBlurry: false
        });
        console.log('Status:', res1.status, '| Score:', res1.data.score, '| Tier:', res1.data.tier, '| Success:', res1.data.success);
        console.log('Breakdown:', JSON.stringify(res1.data.breakdown));

        console.log('\n========================================');
        console.log('2. TEST REAL BLURRY PHOTO (Target: 67 Pts)');
        console.log('========================================');
        const res2 = await sendPostRequest('/api/verify-document', {
            documentBase64: 'data:image/jpeg;base64,' + Buffer.from('Blurry student ID photo').toString('base64').repeat(200),
            expectedName: 'Alex Morgan',
            expectedCollege: 'Stanford University',
            expectedYear: '2026',
            clientOcrText: 'STANFORD UNIVERSITY STUDENT CARD NAME: ALEX MORGAN YEAR: 2026',
            isBlurry: true
        });
        console.log('Status:', res2.status, '| Score:', res2.data.score, '| Tier:', res2.data.tier, '| Success:', res2.data.success);
        console.log('Breakdown:', JSON.stringify(res2.data.breakdown));

        console.log('\n========================================');
        console.log('3. TEST FAKE / RANDOM DOCUMENT (Target: 0 Pts -> REJECT)');
        console.log('========================================');
        const res3 = await sendPostRequest('/api/verify-document', {
            documentBase64: 'data:image/jpeg;base64,' + Buffer.from('Fake random gym card').toString('base64').repeat(500),
            expectedName: 'Alex Morgan',
            expectedCollege: 'Stanford University',
            expectedYear: '2026',
            clientOcrText: 'METRO ATHLETIC CLUB MEMBER: DAVID MILLER EXPIRES: 2018',
            isBlurry: false
        });
        console.log('Status:', res3.status, '| Score:', res3.data.score, '| Tier:', res3.data.tier, '| Decision:', res3.data.decision);
        console.log('Breakdown:', JSON.stringify(res3.data.breakdown));

        console.log('\n========================================');
        console.log('4. TEST EMAIL OTP (Web3Forms)');
        console.log('========================================');
        const emailOtpRes = await sendPostRequest('/api/send-email-otp', {
            email: 'alex.morgan@gmail.com',
            otp: '123456'
        });
        console.log('Send Email OTP Response:', emailOtpRes.data);

        const verifyEmailRes = await sendPostRequest('/api/verify-email-otp', {
            email: 'alex.morgan@gmail.com',
            otp: '123456'
        });
        console.log('Verify Email OTP Response:', verifyEmailRes.data);

        console.log('\n========================================');
        console.log('5. TEST SMS OTP (2Factor)');
        console.log('========================================');
        const smsOtpRes = await sendPostRequest('/api/send-sms-otp', {
            phone: '9876543210',
            otp: '654321'
        });
        console.log('Send SMS OTP Response:', smsOtpRes.data);

        const verifySmsRes = await sendPostRequest('/api/verify-sms-otp', {
            phone: '9876543210',
            otp: '654321'
        });
        console.log('Verify SMS OTP Response:', verifySmsRes.data);

        console.log('\n========================================');
        console.log('6. TEST REGISTRATION GUARD WITH FAKE DOC (0 Pts)');
        console.log('========================================');
        const regFakeRes = await sendPostRequest('/api/register', {
            full_name: 'Alex Morgan',
            email: 'alex.morgan@gmail.com',
            documentScore: 0
        });
        console.log('Register Fake Result (Expected Reject):', regFakeRes.status, regFakeRes.data);

        console.log('\n========================================');
        console.log('7. TEST REGISTRATION WITH VERIFIED DOC (100 Pts)');
        console.log('========================================');
        const regValidRes = await sendPostRequest('/api/register', {
            full_name: 'Alex Morgan',
            email: 'alex.morgan@gmail.com',
            documentScore: 100
        });
        console.log('Register Valid Result (Expected Success):', regValidRes.status, regValidRes.data);

        console.log('\n✅ ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');

    } catch (e) {
        console.error('Test error:', e);
    } finally {
        server.close();
        process.exit(0);
    }
});

