const http = require('http');
const app = require('./server.js');

const server = app.listen(3001, async () => {
    console.log('Testing server running on port 3001...');

    async function sendVerifyRequest(payload) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(payload);
            const req = http.request({
                hostname: 'localhost',
                port: 3001,
                path: '/api/verify-document',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    try {
        console.log('\n--- 1. Testing Real Clear Document (Target: 100 pts) ---');
        const res1 = await sendVerifyRequest({
            documentBase64: 'data:image/jpeg;base64,' + Buffer.from('Official clear student ID').toString('base64').repeat(500),
            expectedName: 'Alex Morgan',
            expectedCollege: 'Stanford University',
            expectedYear: '2026',
            clientOcrText: 'STANFORD UNIVERSITY OFFICIAL STUDENT IDENTIFICATION CARD NAME: ALEX MORGAN YEAR: 2026',
            isBlurry: false
        });
        console.log('Status:', res1.status, '| Score:', res1.data.score, '| Tier:', res1.data.tier, '| Success:', res1.data.success);
        console.log('Breakdown:', JSON.stringify(res1.data.breakdown));

        console.log('\n--- 2. Testing Real Blurry Photo (Target: 67 pts) ---');
        const res2 = await sendVerifyRequest({
            documentBase64: 'data:image/jpeg;base64,' + Buffer.from('Blurry student ID photo').toString('base64').repeat(200),
            expectedName: 'Alex Morgan',
            expectedCollege: 'Stanford University',
            expectedYear: '2026',
            clientOcrText: 'STANFORD UNIVERSITY STUDENT CARD NAME: ALEX MORGAN YEAR: 2026',
            isBlurry: true
        });
        console.log('Status:', res2.status, '| Score:', res2.data.score, '| Tier:', res2.data.tier, '| Success:', res2.data.success);
        console.log('Breakdown:', JSON.stringify(res2.data.breakdown));

        console.log('\n--- 3. Testing Fake / Random Document (Target: 0 pts) ---');
        const res3 = await sendVerifyRequest({
            documentBase64: 'data:image/jpeg;base64,' + Buffer.from('Fake random gym card').toString('base64').repeat(500),
            expectedName: 'Alex Morgan',
            expectedCollege: 'Stanford University',
            expectedYear: '2026',
            clientOcrText: 'METRO ATHLETIC CLUB MEMBER: DAVID MILLER EXPIRES: 2018',
            isBlurry: false
        });
        console.log('Status:', res3.status, '| Score:', res3.data.score, '| Tier:', res3.data.tier, '| Success:', res3.data.success);
        console.log('Breakdown:', JSON.stringify(res3.data.breakdown));

    } catch (e) {
        console.error('Test error:', e);
    } finally {
        server.close();
        process.exit(0);
    }
});
