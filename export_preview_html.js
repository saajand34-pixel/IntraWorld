const fs = require('fs');
const path = require('path');
const reportGen = require('./generate_doc_report.js');

const header = reportGen.buildHeader();
const prelims = reportGen.buildPrelims();
const mainContent = reportGen.buildMainContent();

const htmlStart = header.indexOf('<html');
let cleanHtml = header.substring(htmlStart) + prelims + mainContent + '</html>';

const printEnhancement = `
<style>
@media print {
  .no-print { display: none !important; }
  body { background: white !important; margin: 0 !important; padding: 0 !important; }
  .Section1, .Section2 { width: 100% !important; margin: 0 !important; }
}
@media screen {
  body { background: #cbd5e1 !important; padding: 24px 0 !important; }
  .Section1, .Section2 { 
    background: white !important; 
    max-width: 8.27in !important; 
    margin: 0 auto 30px auto !important; 
    padding: 1.0in 1.0in 1.0in 1.5in !important; 
    box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
    border-radius: 4px !important;
  }
  .floating-print-bar {
    position: fixed;
    top: 16px;
    right: 24px;
    z-index: 9999;
    display: flex;
    gap: 12px;
    background: #0f172a;
    padding: 10px 20px;
    border-radius: 30px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
  }
  .floating-print-bar button {
    background: #2563eb;
    color: white;
    border: none;
    padding: 8px 18px;
    border-radius: 20px;
    font-weight: bold;
    cursor: pointer;
    font-size: 13px;
    font-family: system-ui, sans-serif;
  }
  .floating-print-bar button:hover {
    background: #1d4ed8;
  }
}
</style>
<div class='floating-print-bar no-print'>
  <button onclick='window.print()'>&#x1F5A8;&#xFE0F; Print / Save as PDF (Ctrl + P)</button>
</div>
`;

cleanHtml = cleanHtml.replace('</head>', printEnhancement + '</head>');
const previewPath = path.join(__dirname, 'docs', 'report_preview.html');
fs.writeFileSync(previewPath, cleanHtml, 'utf8');
console.log('Preview file written to: ' + previewPath);
