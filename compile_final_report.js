const fs = require('fs');
const path = require('path');
const reportGen = require('./generate_doc_report.js');

console.log("=== IntraWorld Master BCA Project Report Compiler ===");

// 1. Retrieve sections from generator
let header = reportGen.buildHeader();
let prelims = reportGen.buildPrelims();
let mainContent = reportGen.buildMainContent();

// 2. Enhance CSS styles in header to include codeBox, code snippets, and Word headers/footers
const extraStyles = `
  .codeBox {
    font-family: "Courier New", monospace;
    font-size: 9.5pt;
    line-height: 125%;
    background: #f8fafc;
    border: 1.0pt solid #cbd5e1;
    padding: 8.0pt;
    margin: 10.0pt 0in;
    white-space: pre-wrap;
  }

  code {
    font-family: "Courier New", monospace;
    font-size: 10.5pt;
    color: #0f172a;
    background-color: #f1f5f9;
    padding: 1.0pt 3.0pt;
  }

  p.MsoFooter, li.MsoFooter, div.MsoFooter {
    margin: 0in;
    margin-bottom: .0001pt;
    text-align: center;
    font-size: 11.0pt;
    font-family: "Times New Roman", serif;
  }

  p.MsoHeader, li.MsoHeader, div.MsoHeader {
    margin: 0in;
    margin-bottom: .0001pt;
    text-align: right;
    font-size: 10.0pt;
    font-family: "Times New Roman", serif;
    font-style: italic;
    color: #64748b;
  }
`;

header = header.replace('-->\n</style>', `${extraStyles}\n-->\n</style>`);

// 3. Ensure proper footer definitions for Word
const footerSection1 = `
<div style='mso-element:footer' id=f1>
  <p class=MsoFooter style='text-align:center;'>
    <!--[if supportFields]><span style='mso-element:field-begin'></span>PAGE<span style='mso-element:field-separator'></span><![endif]-->
    <span style='mso-no-proof:yes'>i</span>
    <!--[if supportFields]><span style='mso-element:field-end'></span><![endif]-->
  </p>
</div>
`;

prelims = prelims.replace('</div>\n<br clear=all style=\'page-break-before:always;mso-break-type:section-break\'>', `${footerSection1}</div>\n<br clear=all style='page-break-before:always;mso-break-type:section-break'>`);

const headerFooterSection2 = `
<div style='mso-element:header' id=h2>
  <p class=MsoHeader style='text-align:right;'>
    IntraWorld: Secure Intra-College Platform
  </p>
</div>

<div style='mso-element:footer' id=f2>
  <p class=MsoFooter style='text-align:center;'>
    <!--[if supportFields]><span style='mso-element:field-begin'></span>PAGE<span style='mso-element:field-separator'></span><![endif]-->
    <span style='mso-no-proof:yes'>1</span>
    <!--[if supportFields]><span style='mso-element:field-end'></span><![endif]-->
  </p>
</div>
`;

mainContent = mainContent.replace('<div class=Section2>', `<div class=Section2>\n${headerFooterSection2}`);

// 4. Assemble final MIME document with closing boundary
const closingMime = `\n------=_NextPart_01D9E74B.82A10F--\n`;
const fullDocument = header + prelims + mainContent + closingMime;

// 5. Target output destinations
const targetFile1 = path.join(__dirname, 'BCA_Project_Report_IntraWorld.doc');
const targetFile2 = path.join(__dirname, 'docs', 'BCA_Project_Report_IntraWorld.doc');

fs.writeFileSync(targetFile1, fullDocument, 'utf8');
fs.writeFileSync(targetFile2, fullDocument, 'utf8');

// 6. Comprehensive statistics
const stats = fs.statSync(targetFile1);
const plainText = fullDocument.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const wordCount = plainText.split(' ').filter(w => w.length > 0).length;
const estimatedPages = Math.round(wordCount / 380); // Academic page density with 1.5 line spacing, tables, & diagrams

console.log("\n[SUCCESS] Document generation completed successfully!");
console.log(`Document Destination 1: ${targetFile1}`);
console.log(`Document Destination 2: ${targetFile2}`);
console.log(`File Size: ${(stats.size / 1024).toFixed(2)} KB (${stats.size} bytes)`);
console.log(`Word Count: ${wordCount.toLocaleString()} words`);
console.log(`Estimated Page Count: ~${estimatedPages} pages (Target: 50 - 60 pages)`);
console.log("======================================================");
