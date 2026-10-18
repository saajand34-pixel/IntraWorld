/**
 * IntraWorld BCA Project Documentation - Stylesheet Configuration
 * Implements strict institutional formatting compliant with university guidelines:
 * - Font: Times New Roman / Standard Academic Serif
 * - Main Headings: 16pt Bold, All Caps, Centered
 * - Sub-headings: 14pt Bold, Left-Aligned
 * - Sub-sub-headings: 12pt Bold, Left-Aligned
 * - Body Text: 12pt Regular, Justified, 1.5 line spacing
 * - Margins: Left 1.5" (binding), Top/Bottom/Right 1.0"
 * - Page Numbering: Roman (prelims) & Arabic (chapters), Bottom Center
 */

module.exports = {
  getStyles: function() {
    return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&family=JetBrains+Mono:wght@400;600&display=swap');

      :root {
        --font-academic: 'Tinos', 'Times New Roman', Times, serif;
        --font-mono: 'JetBrains Mono', 'Courier New', monospace;
        --primary-color: #0f172a;
        --accent-blue: #1e3a8a;
        --border-color: #cbd5e1;
        --bg-paper: #ffffff;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: var(--font-academic);
        font-size: 12pt;
        line-height: 1.5;
        color: #111827;
        background-color: #e2e8f0;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
      }

      /* Screen Toolbar */
      .no-print-toolbar {
        position: sticky;
        top: 0;
        z-index: 1000;
        background: #0f172a;
        color: #ffffff;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 4px 15px rgba(0,0,0,0.25);
        font-family: system-ui, -apple-system, sans-serif;
      }
      .toolbar-title {
        font-size: 15px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #38bdf8;
      }
      .toolbar-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .btn-action {
        background: #2563eb;
        color: #ffffff;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: background 0.2s;
      }
      .btn-action:hover { background: #1d4ed8; }
      .btn-secondary {
        background: #334155;
        color: #f1f5f9;
      }
      .btn-secondary:hover { background: #475569; }

      /* Report Document Container */
      .document-container {
        max-width: 8.5in;
        margin: 24px auto 60px;
        background: #ffffff;
        box-shadow: 0 10px 40px rgba(0,0,0,0.18);
      }

      /* Base Page Formatting */
      .page {
        width: 8.5in;
        min-height: 11in;
        padding: 1.0in 1.0in 1.0in 1.5in; /* Top, Right, Bottom, Left (1.5" Binding) */
        background: #ffffff;
        position: relative;
        page-break-after: always;
        break-after: page;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }

      /* Specific Prelim Page (Roman page numbers) */
      .page-prelim {
        page-break-after: always;
        break-after: page;
      }

      /* Chapter Opener Page (Always starts fresh page) */
      .chapter-page {
        page-break-before: always;
        break-before: page;
      }

      /* Page Number Display */
      .page-footer {
        margin-top: auto;
        padding-top: 14px;
        text-align: center;
        font-size: 11pt;
        color: #374151;
        font-family: var(--font-academic);
      }

      .running-header {
        border-bottom: 1px solid #cbd5e1;
        padding-bottom: 4px;
        margin-bottom: 24px;
        font-size: 9.5pt;
        text-transform: uppercase;
        color: #64748b;
        display: flex;
        justify-content: space-between;
      }

      /* Standard Headings (Strictly following Guidelines) */
      h1.chapter-title {
        font-size: 16pt;
        font-weight: 700;
        text-transform: uppercase;
        text-align: center;
        margin-top: 10px;
        margin-bottom: 24px;
        line-height: 1.4;
        color: #000000;
        letter-spacing: 0.04em;
      }

      h2.section-heading {
        font-size: 14pt;
        font-weight: 700;
        text-align: left;
        margin-top: 22px;
        margin-bottom: 12px;
        color: #111827;
        page-break-after: avoid;
        break-after: avoid;
      }

      h3.sub-section-heading {
        font-size: 12pt;
        font-weight: 700;
        text-align: left;
        margin-top: 16px;
        margin-bottom: 8px;
        color: #111827;
        page-break-after: avoid;
        break-after: avoid;
      }

      h4.sub-sub-heading {
        font-size: 12pt;
        font-weight: 700;
        font-style: italic;
        margin-top: 12px;
        margin-bottom: 6px;
        color: #1f2937;
        page-break-after: avoid;
      }

      p {
        font-size: 12pt;
        font-weight: 400;
        text-align: justify;
        line-height: 1.5;
        margin-bottom: 12px;
        color: #111827;
        text-indent: 0.35in;
      }

      p.no-indent {
        text-indent: 0 !important;
      }

      /* Lists */
      ul, ol {
        margin-left: 0.5in;
        margin-bottom: 14px;
        font-size: 12pt;
        line-height: 1.5;
      }
      li {
        margin-bottom: 6px;
        text-align: justify;
      }

      /* Tables strictly styled */
      .academic-table {
        width: 100%;
        border-collapse: collapse;
        margin: 18px 0;
        font-size: 10.5pt;
        line-height: 1.35;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .academic-table th, .academic-table td {
        border: 1px solid #475569;
        padding: 7px 10px;
        text-align: left;
        vertical-align: top;
      }
      .academic-table th {
        background-color: #f1f5f9;
        font-weight: 700;
        color: #0f172a;
        text-align: center;
      }
      .academic-table caption {
        caption-side: top;
        font-size: 11pt;
        font-weight: 700;
        margin-bottom: 6px;
        text-align: left;
        color: #0f172a;
      }
      .table-center td { text-align: center; }

      /* Technical Diagrams & Visual Boxes */
      .diagram-box {
        border: 1.5px solid #334155;
        background: #f8fafc;
        border-radius: 4px;
        padding: 14px;
        margin: 18px 0;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .diagram-caption {
        font-size: 10.5pt;
        font-weight: 700;
        text-align: center;
        margin-top: 8px;
        color: #1e293b;
      }

      /* Code Snippets */
      pre.code-block {
        font-family: var(--font-mono);
        font-size: 9.5pt;
        line-height: 1.35;
        background: #0f172a;
        color: #e2e8f0;
        padding: 12px 14px;
        border-radius: 4px;
        border-left: 4px solid #38bdf8;
        overflow-x: auto;
        margin: 14px 0;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      /* Mathematical formula display */
      .math-equation {
        display: block;
        text-align: center;
        font-family: 'Times New Roman', serif;
        font-style: italic;
        font-size: 12.5pt;
        margin: 12px 0;
        padding: 8px;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        page-break-inside: avoid;
      }

      /* Print Styles */
      @media print {
        @page {
          size: A4 portrait;
          margin-left: 1.5in;
          margin-top: 1.0in;
          margin-right: 1.0in;
          margin-bottom: 1.0in;
        }

        body {
          background: #ffffff !important;
          color: #000000 !important;
        }

        .no-print, .no-print-toolbar {
          display: none !important;
        }

        .document-container {
          box-shadow: none !important;
          margin: 0 !important;
          max-width: 100% !important;
          width: 100% !important;
        }

        .page {
          width: 100% !important;
          min-height: auto !important;
          padding: 0 !important;
          margin-bottom: 0 !important;
          page-break-after: always !important;
          break-after: page !important;
        }

        .chapter-page {
          page-break-before: always !important;
          break-before: page !important;
        }

        h1.chapter-title {
          margin-top: 0 !important;
          padding-top: 0.5in !important;
        }

        .diagram-box, .academic-table, pre.code-block {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    </style>
    `;
  }
};
