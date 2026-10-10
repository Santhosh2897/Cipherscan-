const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../artifacts/api-server/node_modules/playwright'));

async function generatePDF() {
  const htmlPath = path.resolve(__dirname, '../docs/reports/CIPHERSCAN_COMPLETE_MASTER_GUIDE.html');
  const outputPdfReports = path.resolve(__dirname, '../docs/reports/CIPHERSCAN_COMPLETE_MASTER_GUIDE.pdf');
  const outputPdfRoot = path.resolve(__dirname, '../CIPHERSCAN_COMPLETE_MASTER_GUIDE.pdf');

  console.log('Loading HTML file:', htmlPath);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Load the HTML file via file:// URL
  await page.goto('file://' + htmlPath.replace(/\\/g, '/'), {
    waitUntil: 'networkidle'
  });

  console.log('Generating PDF...');
  await page.pdf({
    path: outputPdfReports,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '18mm',
      bottom: '20mm',
      left: '16mm',
      right: '16mm'
    },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="font-family: 'Inter', -apple-system, sans-serif; font-size: 8pt; color: #64748b; width: 100%; display: flex; justify-content: space-between; padding: 0 16mm;">
        <span>CipherScan 2.0 • Complete Architectural Master Guide</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `
  });

  // Copy to root directory for easy access
  fs.copyFileSync(outputPdfReports, outputPdfRoot);

  console.log('PDF successfully generated at:');
  console.log('  1. ' + outputPdfReports);
  console.log('  2. ' + outputPdfRoot);

  await browser.close();
}

generatePDF().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
