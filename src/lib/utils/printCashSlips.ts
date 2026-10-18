import { PayrollFacultyRow } from '@/types/payroll';

export function printCashSlipsWindow(
  selectedRows: PayrollFacultyRow[],
  activeCycleLabel: string,
  batchReferenceId: string,
  currency: 'USD' | 'IQD' = 'USD',
  exchangeRate: number = 150000
) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Please allow pop-ups to print cash disbursal receipts.');
    return;
  }

  const printDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const slipsHtml = selectedRows
    .map((row) => {
      const iqdAmount = row.calculatedGross * (exchangeRate / 100);
      const formattedIqd = `IQD ${iqdAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      const formattedUsd = `$${row.calculatedGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
      const formattedRate = exchangeRate.toLocaleString('en-US');

      const rateIqd = row.approvedRate * (exchangeRate / 100);
      const rateStr =
        currency === 'IQD'
          ? `(IQD ${rateIqd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/hr)`
          : `($${row.approvedRate.toFixed(2)}/hr)`;

      const amountHtml =
        currency === 'USD'
          ? `
            <div class="amount-box">
              <div class="amount-row">
                <span class="amount-label">TOTAL PAYMENT AMOUNT</span>
                <div class="amount-values">
                  <span class="amount-usd">${formattedUsd}</span>
                  <span class="amount-iqd">(${formattedIqd})</span>
                </div>
              </div>
              <div class="rate-note">* Rate: ${formattedRate} IQD / $100</div>
            </div>
          `
          : `
            <div class="amount-box">
              <div class="amount-row">
                <span class="amount-label">TOTAL PAYMENT AMOUNT</span>
                <div class="amount-values">
                  <span class="amount-iqd-only">${formattedIqd}</span>
                </div>
              </div>
            </div>
          `;

      return `
      <div class="postcard envelope-print-container">
        <div class="card-inner">
          <div class="header">
            <div class="header-left">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDoDDRqJXEliwiAbQj3HE8fZbuJHyNLm4oXuQQ5QO7nQeR8qOdesMMJqIyGvqtkCY9Rjzbsq1raOKhc9i3B1hmX-CKY9ZP_pb0ev_safjontFAUkVZbtIPdFcN0LFfGLhBh695WC0f-958s-4dkfKqnb-dqpdihEqMy9cF7CHQFDpWItxiA4tI327j1Yut7rDKyJsZsz6UFPox71r5RXf4cWZ-uwLT2qmPnLstL1KjH8AKbnjNDjRdJpgmI0MtJb09N4w"
                alt="TIU Logo"
                class="tiu-logo"
              />
              <div class="header-titles">
                <div class="university-title">Tishk International University - Sulaimani</div>
                <h1 class="main-title">TIUS Extra Hours Payment</h1>
                <div class="sub-title">Official Cash Disbursal Record</div>
              </div>
            </div>
            <div class="header-right">
              <div class="staff-name">${row.name}</div>
              <div class="staff-dept">${row.departmentName || 'Computer Engineering'}</div>
            </div>
          </div>

          <div class="body">
            <div class="meta-strip">
              <div class="meta-item">
                <span class="meta-label">Contract Type &amp; Rate:</span>
                <span class="meta-value">${row.contractType} ${rateStr}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Total Extra Hours:</span>
                <span class="meta-value font-bold">${row.billedHours.toFixed(1)} hrs</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Date of Print:</span>
                <span class="meta-value">${printDate}</span>
              </div>
            </div>

            ${amountHtml}
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>TIUS Cash Disbursal Envelopes - ${batchReferenceId}</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          body {
            background-color: #f1f5f9;
            padding: 20px;
          }
          .postcard {
            width: 22cm;
            height: 11cm;
            margin: 0 auto 20px auto;
            background: white;
            border: 2px dashed #94a3b8;
            border-radius: 12px;
            padding: 14px 20px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            box-sizing: border-box;
          }
          .card-inner {
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header {
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 8px;
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .header-right {
            text-align: right;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            max-width: 50%;
          }
          .staff-name {
            font-size: 20px;
            font-weight: 800;
            color: #111827;
            letter-spacing: -0.3px;
            line-height: 1.15;
          }
          .staff-dept {
            font-size: 14px;
            font-weight: 600;
            color: #4b5563;
            line-height: 1.25;
            margin-top: 2px;
          }
          .tiu-logo {
            width: 40px;
            height: 40px;
            object-fit: contain;
          }
          .university-title {
            font-size: 9.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #78350f;
          }
          .main-title {
            font-size: 17px;
            font-weight: 800;
            color: #540225;
            margin-top: 1px;
          }
          .sub-title {
            font-size: 10.5px;
            color: #64748b;
            font-weight: 600;
          }
          .body {
            padding: 4px 0;
            margin-top: 24px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .meta-strip {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            background: #f8fafc;
            padding: 6px 12px;
            border-radius: 8px;
            border: 1px solid #f1f5f9;
          }
          .meta-item {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .meta-label {
            color: #64748b;
            font-weight: 600;
          }
          .meta-value {
            color: #0f172a;
            font-weight: 700;
          }
          .font-bold {
            font-weight: 700;
          }
          .amount-box {
            margin-top: 2px;
            background-color: #fef3c7;
            border: 1.5px solid #fde68a;
            border-radius: 8px;
            padding: 6px 14px;
          }
          .amount-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .amount-label {
            font-size: 10px;
            font-weight: 800;
            color: #78350f;
            letter-spacing: 0.5px;
          }
          .amount-values {
            display: flex;
            align-items: baseline;
            gap: 8px;
          }
          .amount-usd {
            font-size: 16px;
            font-weight: 900;
            color: #540225;
          }
          .amount-iqd {
            font-size: 12px;
            font-weight: 700;
            color: #78350f;
          }
          .amount-iqd-only {
            font-size: 18px;
            font-weight: 900;
            color: #540225;
          }
          .rate-note {
            font-size: 9.5px;
            color: #78350f;
            font-weight: 600;
            text-align: right;
            margin-top: 2px;
          }
          @media print {
            @page {
              size: 22cm 11cm landscape;
              margin: 0;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
            }
            html {
              background: none !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 22cm !important;
              height: 11cm !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            /* Prevent the slip from breaking across pages */
            .envelope-print-container,
            .postcard {
              width: 22cm !important;
              height: 11cm !important;
              max-width: 22cm !important;
              max-height: 11cm !important;
              margin: 0 !important;
              padding: 0.5cm !important;
              box-shadow: none !important;
              border: 1.5px solid #000 !important;
              border-radius: 0 !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
              break-after: page !important;
              break-inside: avoid !important;
              overflow: hidden !important;
              box-sizing: border-box !important;
            }
          }
        </style>
      </head>
      <body>
        ${slipsHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
