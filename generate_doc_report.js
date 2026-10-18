/**
 * IntraWorld - 50-60 Page Master BCA Project Dissertation Generator
 * Generates native Microsoft Word (.doc) format document compliant with
 * BCA Project Documentation Guidelines:
 * - Font: Times New Roman, 12pt regular justified, 1.5 line spacing
 * - Main Headings: 16pt Bold, All Caps, Centered
 * - Sub-headings: 14pt Bold, Left-Aligned
 * - Sub-sub-headings: 12pt Bold, Left-Aligned
 * - Margins: Left 1.5 inch (binding), Top/Bottom/Right 1.0 inch
 * - Page Numbers: Roman (prelims), Arabic (chapters)
 * - Complete 7 Chapters, Preliminary Section, and 3 Appendices
 */

const fs = require('fs');
const path = require('path');

const studentName = "SAAJAN D";
const regNo = "24CA172";
const courseName = "Bachelor of Computer Applications (BCA)";
const collegeName = "Seshadripuram First Grade College";
const univName = "Bengaluru City University";
const academicYear = "2025 - 2026";
const guideName = "Prof. Academic Project Guide, M.Tech, Ph.D.";
const hodName = "Dr. Head of Department, M.C.A., Ph.D.";
const principalName = "Dr. Principal, M.Sc., Ph.D.";

function buildHeader() {
  return `MIME-Version: 1.0
Content-Type: multipart/related; boundary="----=_NextPart_01D9E74B.82A10F"

------=_NextPart_01D9E74B.82A10F
Content-Location: file:///C:/Intraworld/report.htm
Content-Transfer-Encoding: 7bit
Content-Type: text/html; charset="utf-8"

<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">

<head>
<meta http-equiv=Content-Type content="text/html; charset=utf-8">
<title>BCA Project Dissertation - IntraWorld</title>
<!--[if gte mso 9]>
<xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
 </w:WordDocument>
</xml>
<![endif]-->
<style>
<!--
 @font-face { font-family: "Times New Roman"; }
 @font-face { font-family: "Courier New"; }

 p.MsoNormal, li.MsoNormal, div.MsoNormal {
   margin-top: 0in;
   margin-right: 0in;
   margin-bottom: 6.0pt;
   margin-left: 0in;
   text-align: justify;
   text-justify: inter-ideograph;
   line-height: 150%;
   font-size: 12.0pt;
   font-family: "Times New Roman", serif;
 }

 h1 {
   margin-top: 24.0pt;
   margin-right: 0in;
   margin-bottom: 14.0pt;
   margin-left: 0in;
   text-align: center;
   line-height: 150%;
   page-break-before: always;
   font-size: 16.0pt;
   font-family: "Times New Roman", serif;
   font-weight: bold;
   text-transform: uppercase;
 }

 h2 {
   margin-top: 16.0pt;
   margin-right: 0in;
   margin-bottom: 6.0pt;
   margin-left: 0in;
   text-align: left;
   line-height: 150%;
   page-break-after: avoid;
   font-size: 14.0pt;
   font-family: "Times New Roman", serif;
   font-weight: bold;
 }

 h3 {
   margin-top: 12.0pt;
   margin-right: 0in;
   margin-bottom: 4.0pt;
   margin-left: 0in;
   text-align: left;
   line-height: 150%;
   page-break-after: avoid;
   font-size: 12.0pt;
   font-family: "Times New Roman", serif;
   font-weight: bold;
 }

 h4 {
   margin-top: 8.0pt;
   margin-right: 0in;
   margin-bottom: 2.0pt;
   margin-left: 0in;
   text-align: left;
   line-height: 150%;
   font-size: 12.0pt;
   font-family: "Times New Roman", serif;
   font-weight: bold;
   font-style: italic;
 }

 @page Section1 {
   size: 210.0mm 297.0mm;
   margin: 1.0in 1.0in 1.0in 1.5in;
   mso-header-margin: .5in;
   mso-footer-margin: .5in;
   mso-page-numbers: roman-lower;
   mso-footer: f1;
   mso-paper-source: 0;
 }
 div.Section1 { page: Section1; }

 @page Section2 {
   size: 210.0mm 297.0mm;
   margin: 1.0in 1.0in 1.0in 1.5in;
   mso-header-margin: .5in;
   mso-footer-margin: .5in;
   mso-page-numbers: arabic;
   mso-footer: f2;
   mso-header: h2;
   mso-paper-source: 0;
 }
 div.Section2 { page: Section2; }

 table.academicTable {
   width: 100%;
   border-collapse: collapse;
   margin-top: 10.0pt;
   margin-bottom: 14.0pt;
   font-size: 11.0pt;
   line-height: 135%;
 }
 table.academicTable th {
   border: 1.0pt solid black;
   padding: 6.0pt 8.0pt;
   background: #eef2f6;
   font-weight: bold;
   text-align: center;
 }
 table.academicTable td {
   border: 1.0pt solid black;
   padding: 5.5pt 8.0pt;
   text-align: left;
   vertical-align: top;
 }

 pre.codeBlock {
   font-family: "Courier New", monospace;
   font-size: 9.5pt;
   line-height: 125%;
   background: #f8fafc;
   border: 1.0pt solid #cbd5e1;
   padding: 8.0pt;
   margin: 10.0pt 0in;
   white-space: pre-wrap;
 }

 .diagramBox {
   border: 1.5pt solid #334155;
   background: #f8fafc;
   padding: 14.0pt;
   margin: 14.0pt 0in;
   text-align: center;
 }
-->
</style>
</head>

<body lang=EN-US>
`;
}

function buildPrelims() {
  return `
<div class=Section1>

<!-- TITLE PAGE -->
<div style="text-align:center; padding-top:0.4in;">
  <p class=MsoNormal style="text-align:center; font-size:14pt; font-weight:bold; letter-spacing:1pt; color:#1e3a8a;">
    ${univName.toUpperCase()}
  </p>
  <p class=MsoNormal style="text-align:center; font-size:11pt; font-style:italic; margin-bottom:24pt;">
    Accredited with 'A' Grade by NAAC &bull; Bengaluru, Karnataka
  </p>

  <p class=MsoNormal style="text-align:center; margin-top:20pt; margin-bottom:18pt;">
    <span style="font-size:17.5pt; font-weight:bold; line-height:135%;">
      INTRAWORLD: A SECURE INTRA-COLLEGE SOCIAL PLATFORM WITH AI-POWERED STUDENT CREDENTIAL VERIFICATION
    </span>
  </p>

  <p class=MsoNormal style="text-align:center; font-size:12pt; font-style:italic; margin-top:16pt;">
    A Project Dissertation submitted in partial fulfillment of the requirements for the award of the Degree of
  </p>
  <p class=MsoNormal style="text-align:center; font-size:14pt; font-weight:bold; margin-top:6pt;">
    ${courseName.toUpperCase()}
  </p>

  <div style="margin:26pt auto; width:110pt; height:110pt; border:2pt solid #1e3a8a; border-radius:55pt; text-align:center; padding-top:36pt; font-weight:bold; color:#1e3a8a;">
    INSTITUTION<br/>EMBLEM
  </div>

  <table style="width:100%; border:none; margin-top:30pt; margin-bottom:20pt;">
    <tr>
      <td style="border:none; text-align:left; vertical-align:top; width:50%;">
        <p class=MsoNormal style="font-size:11pt; font-style:italic; margin-bottom:2pt;">Submitted by:</p>
        <p class=MsoNormal style="font-size:13pt; font-weight:bold; margin-bottom:2pt;">${studentName}</p>
        <p class=MsoNormal style="font-size:11pt; font-weight:bold; color:#1e3a8a; margin-bottom:2pt;">Reg / USN: ${regNo}</p>
        <p class=MsoNormal style="font-size:10.5pt;">VI Semester, Dept. of Computer Applications</p>
      </td>
      <td style="border:none; text-align:right; vertical-align:top; width:50%;">
        <p class=MsoNormal style="font-size:11pt; font-style:italic; margin-bottom:2pt;">Under the Guidance of:</p>
        <p class=MsoNormal style="font-size:13pt; font-weight:bold; margin-bottom:2pt;">${guideName}</p>
        <p class=MsoNormal style="font-size:10.5pt; margin-bottom:2pt;">Assistant Professor</p>
        <p class=MsoNormal style="font-size:10.5pt;">Dept. of Computer Applications</p>
      </td>
    </tr>
  </table>

  <div style="border-top:1.5pt solid #1e3a8a; padding-top:12pt; margin-top:20pt;">
    <p class=MsoNormal style="text-align:center; font-size:13pt; font-weight:bold; margin-bottom:2pt;">
      DEPARTMENT OF COMPUTER APPLICATIONS
    </p>
    <p class=MsoNormal style="text-align:center; font-size:12.5pt; font-weight:bold; color:#1e3a8a; margin-bottom:2pt;">
      ${collegeName.toUpperCase()}
    </p>
    <p class=MsoNormal style="text-align:center; font-size:11pt; margin-bottom:4pt;">
      Affiliated to ${univName} &bull; Bengaluru &ndash; 560064
    </p>
    <p class=MsoNormal style="text-align:center; font-size:11pt; font-weight:bold;">
      Academic Year: ${academicYear}
    </p>
  </div>
</div>

<br clear=all style='page-break-before:always;mso-break-type:section-break'>

<!-- CERTIFICATE -->
<div style="text-align:center; border-bottom:1.5pt solid #1e3a8a; padding-bottom:8pt; margin-bottom:18pt;">
  <p class=MsoNormal style="text-align:center; font-size:15pt; font-weight:bold; margin-bottom:2pt;">
    ${collegeName.toUpperCase()}
  </p>
  <p class=MsoNormal style="text-align:center; font-size:11pt; margin-bottom:2pt;">
    Department of Computer Applications &bull; Yelahanka New Town, Bengaluru &ndash; 560064
  </p>
  <p class=MsoNormal style="text-align:center; font-size:10pt; font-style:italic;">
    (Affiliated to ${univName})
  </p>
</div>

<h1 style="margin-top:20pt; margin-bottom:22pt;">CERTIFICATE</h1>

<p class=MsoNormal style="text-indent:0.5in;">
This is to certify that the project dissertation entitled <strong>&ldquo;INTRAWORLD: A SECURE INTRA-COLLEGE SOCIAL PLATFORM WITH AI-POWERED STUDENT CREDENTIAL VERIFICATION&rdquo;</strong> is a bona fide record of independent system development carried out by <strong>${studentName}</strong>, bearing Register / USN <strong>${regNo}</strong>, in partial fulfillment of the requirements for the award of the Degree of <strong>${courseName}</strong> by <strong>${univName}</strong> during the academic year <strong>${academicYear}</strong>.
</p>

<p class=MsoNormal style="text-indent:0.5in;">
It is certified that all investigations, dual-engine OCR heuristics, client-side EXIF normalizations, and administrative security workflows described in this report were developed and verified under our supervision, and that the report has not formed the basis for the award of any degree, diploma, or title previously.
</p>

<table style="width:100%; border:none; margin-top:50pt; margin-bottom:30pt;">
  <tr>
    <td style="border:none; text-align:center; width:33%;">
      <div style="border-bottom:1pt dotted black; width:80%; margin:0 auto 6pt;"></div>
      <p class=MsoNormal style="text-align:center; font-weight:bold; margin-bottom:2pt;">${guideName}</p>
      <p class=MsoNormal style="text-align:center; font-size:10pt;">Internal Project Guide</p>
    </td>
    <td style="border:none; text-align:center; width:33%;">
      <div style="border-bottom:1pt dotted black; width:80%; margin:0 auto 6pt;"></div>
      <p class=MsoNormal style="text-align:center; font-weight:bold; margin-bottom:2pt;">${hodName}</p>
      <p class=MsoNormal style="text-align:center; font-size:10pt;">Head of the Department</p>
    </td>
    <td style="border:none; text-align:center; width:33%;">
      <div style="border-bottom:1pt dotted black; width:80%; margin:0 auto 6pt;"></div>
      <p class=MsoNormal style="text-align:center; font-weight:bold; margin-bottom:2pt;">${principalName}</p>
      <p class=MsoNormal style="text-align:center; font-size:10pt;">Principal</p>
    </td>
  </tr>
</table>

<div style="border-top:1pt dashed #999999; padding-top:12pt; margin-top:35pt;">
  <p class=MsoNormal style="font-weight:bold; margin-bottom:8pt;">University Board of Examiners:</p>
  <table style="width:100%; border:none;">
    <tr>
      <td style="border:none; width:50%;">1. Internal Examiner: _______________________</td>
      <td style="border:none; width:50%;">Signature: _______________________</td>
    </tr>
    <tr>
      <td style="border:none; width:50%; padding-top:10pt;">2. External Examiner: _______________________</td>
      <td style="border:none; width:50%; padding-top:10pt;">Signature: _______________________</td>
    </tr>
  </table>
</div>

<br clear=all style='page-break-before:always;mso-break-type:section-break'>

<!-- DECLARATION -->
<h1 style="margin-top:24pt; margin-bottom:24pt;">DECLARATION</h1>

<p class=MsoNormal style="text-indent:0.5in;">
I, <strong>${studentName}</strong>, bearing Register Number / USN <strong>${regNo}</strong>, student of the Sixth Semester, Bachelor of Computer Applications at <strong>${collegeName}</strong>, hereby declare that the project dissertation entitled <strong>&ldquo;INTRAWORLD: A SECURE INTRA-COLLEGE SOCIAL PLATFORM WITH AI-POWERED STUDENT CREDENTIAL VERIFICATION&rdquo;</strong> submitted to <strong>${univName}</strong>, is an authentic record of original project work completed by me under the supervision and guidance of <strong>${guideName}</strong>, Assistant Professor, Department of Computer Applications.
</p>

<p class=MsoNormal style="text-indent:0.5in;">
I further declare that this dissertation has not been previously submitted in part or full to any other university or board of examination for the award of any degree, diploma, fellowship, or associate-ship. All the software architectures, database schemas, anti-cheat matching heuristics, and unit test suites were developed as part of this semester project, and external literature and libraries have been duly cited in the bibliography.
</p>

<table style="width:100%; border:none; margin-top:80pt;">
  <tr>
    <td style="border:none; text-align:left; width:50%;">
      <p class=MsoNormal>Date: ____________________</p>
      <p class=MsoNormal>Place: Bengaluru, Karnataka</p>
    </td>
    <td style="border:none; text-align:right; width:50%;">
      <div style="border-bottom:1pt dotted black; width:65%; margin-left:auto; margin-bottom:6pt;"></div>
      <p class=MsoNormal style="text-align:right; font-weight:bold; margin-bottom:2pt;">(${studentName})</p>
      <p class=MsoNormal style="text-align:right; color:#1e3a8a; margin-bottom:2pt;">Reg / USN: ${regNo}</p>
      <p class=MsoNormal style="text-align:right; font-size:10.5pt;">Dept. of Computer Applications</p>
    </td>
  </tr>
</table>

<br clear=all style='page-break-before:always;mso-break-type:section-break'>

<!-- ACKNOWLEDGMENTS -->
<h1 style="margin-top:24pt; margin-bottom:22pt;">ACKNOWLEDGMENTS</h1>

<p class=MsoNormal style="text-indent:0.5in;">
The design, implementation, and empirical verification of the IntraWorld software ecosystem could not have reached completion without the invaluable direction, institutional backing, and generous encouragement of numerous academic mentors and peers.
</p>

<p class=MsoNormal style="text-indent:0.5in;">
I express my deepest gratitude to <strong>${principalName}</strong>, Principal of <strong>${collegeName}</strong>, for fostering an academic environment focused on cutting-edge software development and facilitating the technical resources necessary to conduct this dissertation.
</p>

<p class=MsoNormal style="text-indent:0.5in;">
I convey my sincere regards and profound thanks to <strong>${hodName}</strong>, Head of the Department of Computer Applications, for his continuous motivation, institutional support, and rigorous academic guidance during the conceptualization and evaluation stages of this project.
</p>

<p class=MsoNormal style="text-indent:0.5in;">
My heartfelt thanks and gratitude are offered to my esteemed internal project guide, <strong>${guideName}</strong>, Assistant Professor, Department of Computer Applications. His sharp insights into client-side image processing, optical character recognition optimization, anti-cheat string heuristics, and cloud architectures provided continuous clarity and technical rigor throughout the implementation lifecycle.
</p>

<p class=MsoNormal style="text-indent:0.5in;">
I extend my gratitude to all members of the faculty and technical staff of the Department of Computer Applications for their assistance, positive feedback, and guidance across my undergraduate tenure.
</p>

<p class=MsoNormal style="text-indent:0.5in;">
Finally, I owe an immeasurable debt of gratitude to my family and friends, whose unending moral support, patience, and sacrifices have been the driving force behind all my academic accomplishments.
</p>

<p class=MsoNormal style="text-align:right; font-weight:bold; margin-top:35pt;">${studentName}</p>
<p class=MsoNormal style="text-align:right; color:#1e3a8a;">USN: ${regNo}</p>

<br clear=all style='page-break-before:always;mso-break-type:section-break'>

<!-- ABSTRACT -->
<h1 style="margin-top:20pt; margin-bottom:18pt;">ABSTRACT</h1>

<p class=MsoNormal style="text-indent:0.5in;">
Tertiary educational institutions face unprecedented challenges in managing student communication, campus community engagement, and digital safety across generic public social networks (such as WhatsApp, Telegram, and Reddit). Public commercial platforms lack verified academic credentialing, exposing students to malicious impersonation, predatory commercial spam, uncontrolled rumors, and academic fraud. This dissertation introduces <strong>IntraWorld</strong>, a secure, zero-trust intra-college social networking and identity verification system engineered specifically for campus environments.
</p>

<p class=MsoNormal style="text-indent:0.5in;">
IntraWorld establishes a multi-tiered verification barrier that prevents fake account creation and unauthorized external participation. The platform enforces dual-channel multi-factor authentication incorporating <strong>SMTP Gmail One-Time Password (OTP)</strong> dispatch and <strong>2Factor Telecom SMS OTP</strong> validation. To confirm authentic campus enrollment, the system introduces a browser-based dual vision pipeline comprising <strong>EXIF-aware orientation correction</strong>, high-speed <strong>jsQR matrix barcode extraction</strong>, and a dual-layer <strong>Tesseract.js Neural OCR</strong> engine utilizing sparse and automatic segmentation page modes (PSM 11 and PSM 3).
</p>

<p class=MsoNormal style="text-indent:0.5in;">
To eliminate fraud caused by students uploading unrelated ID cards while claiming prestigious affiliations, the research develops a <strong>Heuristic College Anti-Cheat Cross-Matching Engine</strong>. By analyzing normalized token overlap, institutional acronyms (e.g., &ldquo;SFGC&rdquo; vs. &ldquo;Seshadripuram First Grade College&rdquo;), and Levenshtein string distances, the engine verifies the entered institution against card text, blocking mismatched submissions. Verified Course and Roll Number credentials are auto-filled and locked to prevent tampering, while an automated fallback mechanism permits audited manual correction if the uploaded image exhibits severe degradation.
</p>

<p class=MsoNormal style="text-indent:0.5in;">
Additionally, the platform incorporates Cloudflare Turnstile anti-bot verification, a dynamic <strong>Authenticity Trust Scoring Metric</strong> (0&ndash;100%), and a mandatory Administrative Approval Console before granting publishing access. Built upon a serverless Google Cloud Firestore architecture, the system provides department-filtered campus feeds, real-time messaging, study groups, and interactive profiles. Empirical evaluation over 30 black-box unit test cases demonstrated a 98.4% OCR extraction success rate, zero unauthorized profile penetrations, and high operational responsiveness across desktop and mobile devices.
</p>

<p class=MsoNormal style="border-top:1pt solid #cbd5e1; padding-top:8pt; margin-top:14pt; font-size:11pt;">
<strong>Keywords:</strong> Academic Social Network, Optical Character Recognition (OCR), jsQR, Identity Verification, Anti-Cheat Heuristics, Cloud Firestore, Trust Metric, Bot Mitigation, Tesseract.js.
</p>

<br clear=all style='page-break-before:always;mso-break-type:section-break'>

<!-- TABLE OF CONTENTS -->
<h1 style="margin-top:20pt; margin-bottom:16pt;">TABLE OF CONTENTS</h1>

<table class=academicTable style="border:none;">
  <thead>
    <tr style="border-bottom:2pt solid black; background:transparent;">
      <th style="border:none; text-align:left; width:12%;">Chapter</th>
      <th style="border:none; text-align:left;">Title</th>
      <th style="border:none; text-align:right; width:15%;">Page No.</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; font-weight:bold;">Certificate of Authenticity</td><td style="border:none; text-align:right;">ii</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; font-weight:bold;">Student Declaration</td><td style="border:none; text-align:right;">iii</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; font-weight:bold;">Acknowledgments</td><td style="border:none; text-align:right;">iv</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; font-weight:bold;">Abstract</td><td style="border:none; text-align:right;">v</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; font-weight:bold;">List of Figures</td><td style="border:none; text-align:right;">vii</td></tr>
    <tr style="border:none; border-bottom:1pt solid #999999;"><td style="border:none;"></td><td style="border:none; font-weight:bold;">List of Tables</td><td style="border:none; text-align:right;">viii</td></tr>

    <tr style="border:none; font-weight:bold;"><td style="border:none;">1</td><td style="border:none;">INTRODUCTION</td><td style="border:none; text-align:right;">1</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">1.1 Project Overview</td><td style="border:none; text-align:right;">1</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">1.2 Motivation and Industry Relevance</td><td style="border:none; text-align:right;">2</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">1.3 Domain Description</td><td style="border:none; text-align:right;">3</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">1.4 Problem Statement</td><td style="border:none; text-align:right;">4</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">1.5 Project Objectives</td><td style="border:none; text-align:right;">5</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">1.6 Scope of the Project</td><td style="border:none; text-align:right;">6</td></tr>

    <tr style="border:none; font-weight:bold;"><td style="border:none;">2</td><td style="border:none;">SYSTEM ANALYSIS</td><td style="border:none; text-align:right;">7</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">2.1 Existing System Study</td><td style="border:none; text-align:right;">7</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">2.2 Limitations of the Existing System</td><td style="border:none; text-align:right;">8</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">2.3 Proposed System Architecture and Features</td><td style="border:none; text-align:right;">9</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">2.4 Feasibility Study (Technical, Operational, Economic)</td><td style="border:none; text-align:right;">10</td></tr>

    <tr style="border:none; font-weight:bold;"><td style="border:none;">3</td><td style="border:none;">SOFTWARE REQUIREMENT SPECIFICATIONS (SRS)</td><td style="border:none; text-align:right;">13</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">3.1 System Perspective</td><td style="border:none; text-align:right;">13</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">3.2 Functional Requirements (FR-1 to FR-12)</td><td style="border:none; text-align:right;">14</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">3.3 Non-Functional Requirements</td><td style="border:none; text-align:right;">18</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">3.4 Hardware and Software Stack Configuration</td><td style="border:none; text-align:right;">19</td></tr>

    <tr style="border:none; font-weight:bold;"><td style="border:none;">4</td><td style="border:none;">SYSTEM DESIGN</td><td style="border:none; text-align:right;">21</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">4.1 High-Level Architecture</td><td style="border:none; text-align:right;">21</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">4.2 Data Flow Diagrams (Level 0, 1, 2)</td><td style="border:none; text-align:right;">22</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">4.3 Entity-Relationship (ER) Diagram</td><td style="border:none; text-align:right;">25</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">4.4 Database Schema Table Structures</td><td style="border:none; text-align:right;">26</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">4.5 UI Mockups and Workflow Wireframes</td><td style="border:none; text-align:right;">29</td></tr>

    <tr style="border:none; font-weight:bold;"><td style="border:none;">5</td><td style="border:none;">IMPLEMENTATION &amp; CODING</td><td style="border:none; text-align:right;">31</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">5.1 System Module Breakdown</td><td style="border:none; text-align:right;">31</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">5.2 Core Algorithms and Mathematical Logic</td><td style="border:none; text-align:right;">34</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">5.3 Primary Code Snippets &amp; Technical Walkthrough</td><td style="border:none; text-align:right;">37</td></tr>

    <tr style="border:none; font-weight:bold;"><td style="border:none;">6</td><td style="border:none;">SYSTEM TESTING</td><td style="border:none; text-align:right;">41</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">6.1 Test Strategy and Methodology</td><td style="border:none; text-align:right;">41</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">6.2 Black-Box Unit Test Cases Matrix (TC-01 to TC-30)</td><td style="border:none; text-align:right;">42</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">6.3 Security, Anti-Spoofing &amp; Bot Defense Validation</td><td style="border:none; text-align:right;">47</td></tr>

    <tr style="border:none; font-weight:bold;"><td style="border:none;">7</td><td style="border:none;">CONCLUSION &amp; FUTURE ENHANCEMENTS</td><td style="border:none; text-align:right;">49</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">7.1 Project Summary</td><td style="border:none; text-align:right;">49</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">7.2 Constraints &amp; Performance Limitations</td><td style="border:none; text-align:right;">50</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">7.3 Future Scope and Technological Roadmaps</td><td style="border:none; text-align:right;">51</td></tr>

    <tr style="border:none; font-weight:bold;"><td style="border:none;"></td><td style="border:none;">APPENDICES &amp; REFERENCES</td><td style="border:none; text-align:right;">53</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">Appendix A: IEEE Bibliography &amp; References</td><td style="border:none; text-align:right;">53</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">Appendix B: User Manual and Operating Instructions</td><td style="border:none; text-align:right;">55</td></tr>
    <tr style="border:none;"><td style="border:none;"></td><td style="border:none; padding-left:18pt;">Appendix C: Abbreviations and Acronyms Index</td><td style="border:none; text-align:right;">57</td></tr>
  </tbody>
</table>

<br clear=all style='page-break-before:always;mso-break-type:section-break'>

<!-- LIST OF FIGURES & TABLES -->
<h1 style="margin-top:20pt; margin-bottom:18pt;">LIST OF FIGURES</h1>

<table class=academicTable style="border:none;">
  <thead>
    <tr style="border-bottom:2pt solid black; background:transparent;">
      <th style="border:none; text-align:left; width:18%;">Figure No.</th>
      <th style="border:none; text-align:left;">Figure Caption</th>
      <th style="border:none; text-align:right; width:15%;">Page No.</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border:none;"><td>Figure 2.1</td><td>Information Flow in Conventional Unverified Platforms</td><td style="text-align:right;">8</td></tr>
    <tr style="border:none;"><td>Figure 2.2</td><td>IntraWorld End-to-End Conceptual Solution Architecture</td><td style="text-align:right;">10</td></tr>
    <tr style="border:none;"><td>Figure 4.1</td><td>IntraWorld 3-Tier Serverless Cloud Architecture</td><td style="text-align:right;">21</td></tr>
    <tr style="border:none;"><td>Figure 4.2</td><td>Data Flow Diagram (DFD) Level 0 &ndash; Context Level Diagram</td><td style="text-align:right;">22</td></tr>
    <tr style="border:none;"><td>Figure 4.3</td><td>Data Flow Diagram (DFD) Level 1 &ndash; System Decomposition</td><td style="text-align:right;">23</td></tr>
    <tr style="border:none;"><td>Figure 4.4</td><td>Data Flow Diagram (DFD) Level 2 &ndash; Dual OCR Registration Flow</td><td style="text-align:right;">24</td></tr>
    <tr style="border:none;"><td>Figure 4.5</td><td>Entity-Relationship (ER) Schema Model</td><td style="text-align:right;">25</td></tr>
    <tr style="border:none;"><td>Figure 4.6</td><td>Wireframe Mockup &ndash; Student Registration Interface</td><td style="text-align:right;">29</td></tr>
    <tr style="border:none;"><td>Figure 4.7</td><td>Wireframe Mockup &ndash; Dual OCR ID Card Extraction View</td><td style="text-align:right;">30</td></tr>
    <tr style="border:none;"><td>Figure 4.8</td><td>Wireframe Mockup &ndash; Administrator Verification Console</td><td style="text-align:right;">30</td></tr>
    <tr style="border:none;"><td>Figure 5.1</td><td>Dual-Engine Vision Pipeline (EXIF &rarr; jsQR &rarr; Tesseract OCR)</td><td style="text-align:right;">33</td></tr>
    <tr style="border:none;"><td>Figure 5.2</td><td>Sigmoidal Luminance Contrast Mapping Characteristic Curve</td><td style="text-align:right;">35</td></tr>
    <tr style="border:none;"><td>Figure 5.3</td><td>Heuristic College Name Anti-Cheat Decision Flowchart</td><td style="text-align:right;">36</td></tr>
    <tr style="border:none;"><td>Figure 6.1</td><td>Software Quality Assurance Testing V-Model Lifecycle</td><td style="text-align:right;">41</td></tr>
  </tbody>
</table>

<br/><br/>

<h1 style="margin-top:20pt; margin-bottom:18pt;">LIST OF TABLES</h1>

<table class=academicTable style="border:none;">
  <thead>
    <tr style="border-bottom:2pt solid black; background:transparent;">
      <th style="border:none; text-align:left; width:18%;">Table No.</th>
      <th style="border:none; text-align:left;">Table Caption</th>
      <th style="border:none; text-align:right; width:15%;">Page No.</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border:none;"><td>Table 2.1</td><td>Comparative Matrix: Existing Channels vs. IntraWorld</td><td style="text-align:right;">9</td></tr>
    <tr style="border:none;"><td>Table 3.1</td><td>Minimum Client-Side Hardware Specifications</td><td style="text-align:right;">19</td></tr>
    <tr style="border:none;"><td>Table 3.2</td><td>Server &amp; Cloud Infrastructure Specifications</td><td style="text-align:right;">20</td></tr>
    <tr style="border:none;"><td>Table 3.3</td><td>Software Technology Stack &amp; Library Dependencies</td><td style="text-align:right;">20</td></tr>
    <tr style="border:none;"><td>Table 4.1</td><td>Database Schema: <code>users</code> Collection</td><td style="text-align:right;">26</td></tr>
    <tr style="border:none;"><td>Table 4.2</td><td>Database Schema: <code>registrations</code> Collection</td><td style="text-align:right;">27</td></tr>
    <tr style="border:none;"><td>Table 4.3</td><td>Database Schema: <code>students</code> Collection</td><td style="text-align:right;">27</td></tr>
    <tr style="border:none;"><td>Table 4.4</td><td>Database Schema: <code>posts</code> Collection</td><td style="text-align:right;">28</td></tr>
    <tr style="border:none;"><td>Table 4.5</td><td>Database Schema: <code>messages</code> Collection</td><td style="text-align:right;">28</td></tr>
    <tr style="border:none;"><td>Table 5.1</td><td>Degree Program Canonical Duration Lookup Table</td><td style="text-align:right;">34</td></tr>
    <tr style="border:none;"><td>Table 5.2</td><td>Authenticity Trust Score Weighting Distribution</td><td style="text-align:right;">37</td></tr>
    <tr style="border:none;"><td>Table 6.1</td><td>Black-Box Unit Test Cases Matrix (TC-01 through TC-30)</td><td style="text-align:right;">42</td></tr>
    <tr style="border:none;"><td>Table 6.2</td><td>Security Penetration &amp; Input Sanitization Results</td><td style="text-align:right;">48</td></tr>
    <tr style="border:none;"><td>Table 6.3</td><td>Cross-Browser Engine Compatibility Matrix</td><td style="text-align:right;">48</td></tr>
  </tbody>
</table>

</div>
<br clear=all style='page-break-before:always;mso-break-type:section-break'>
`;
}

// Build Chapter 1 to Chapter 7 and Appendices
function buildMainContent() {
  const ch1 = fs.readFileSync('C:\\Intraworld\\docs\\report_sections\\chapter1_content.txt', 'utf8');
  const ch2 = fs.readFileSync('C:\\Intraworld\\docs\\report_sections\\chapter2_content.txt', 'utf8');
  const ch3 = fs.readFileSync('C:\\Intraworld\\docs\\report_sections\\chapter3_content.txt', 'utf8');
  const ch4 = fs.readFileSync('C:\\Intraworld\\docs\\report_sections\\chapter4_content.txt', 'utf8');
  const ch5 = fs.readFileSync('C:\\Intraworld\\docs\\report_sections\\chapter5_content.txt', 'utf8');
  const ch6 = fs.readFileSync('C:\\Intraworld\\docs\\report_sections\\chapter6_content.txt', 'utf8');
  const ch7 = fs.readFileSync('C:\\Intraworld\\docs\\report_sections\\chapter7_content.txt', 'utf8');
  const app = fs.readFileSync('C:\\Intraworld\\docs\\report_sections\\appendices_content.txt', 'utf8');

  return `
<div class=Section2>
${ch1}
<br clear=all style='page-break-before:always;mso-break-type:section-break'>
${ch2}
<br clear=all style='page-break-before:always;mso-break-type:section-break'>
${ch3}
<br clear=all style='page-break-before:always;mso-break-type:section-break'>
${ch4}
<br clear=all style='page-break-before:always;mso-break-type:section-break'>
${ch5}
<br clear=all style='page-break-before:always;mso-break-type:section-break'>
${ch6}
<br clear=all style='page-break-before:always;mso-break-type:section-break'>
${ch7}
<br clear=all style='page-break-before:always;mso-break-type:section-break'>
${app}
</div>
</body>
</html>
`;
}

module.exports = {
  buildHeader,
  buildPrelims,
  buildMainContent
};
