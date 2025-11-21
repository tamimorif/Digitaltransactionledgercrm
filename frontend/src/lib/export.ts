import { formatCurrency } from './format';
import { format } from 'date-fns';

export interface ExportTransaction {
    pickupCode: string;
    transactionType: string;
    senderName: string;
    senderPhone: string;
    recipientName: string;
    recipientPhone?: string;
    amount: number;
    currency: string;
    receiverCurrency?: string;
    exchangeRate?: number;
    receiverAmount?: number;
    fees: number;
    status: string;
    createdAt: string;
    notes?: string;
}

export function exportToCSV(transactions: ExportTransaction[], filename: string = 'transactions') {
    const headers = [
        'Transaction Code',
        'Type',
        'Date',
        'Sender Name',
        'Sender Phone',
        'Recipient Name',
        'Recipient Phone',
        'Amount',
        'Currency',
        'Receiver Amount',
        'Receiver Currency',
        'Exchange Rate',
        'Fees',
        'Status',
        'Notes',
    ];

    const rows = transactions.map(t => [
        t.pickupCode,
        t.transactionType,
        format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm:ss'),
        t.senderName,
        t.senderPhone,
        t.recipientName,
        t.recipientPhone || '',
        t.amount.toString(),
        t.currency,
        t.receiverAmount?.toString() || '',
        t.receiverCurrency || '',
        t.exchangeRate?.toString() || '',
        t.fees.toString(),
        t.status,
        t.notes || '',
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function exportToExcel(transactions: ExportTransaction[], filename: string = 'transactions') {
    // For a simple Excel export, we can create an HTML table and save as .xls
    // For proper .xlsx, you would need a library like xlsx or exceljs

    const headers = [
        'Transaction Code',
        'Type',
        'Date',
        'Sender Name',
        'Sender Phone',
        'Recipient Name',
        'Recipient Phone',
        'Amount',
        'Currency',
        'Receiver Amount',
        'Receiver Currency',
        'Exchange Rate',
        'Fees',
        'Status',
        'Notes',
    ];

    let tableHTML = '<table border="1"><thead><tr>';
    headers.forEach(header => {
        tableHTML += `<th>${header}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';

    transactions.forEach(t => {
        tableHTML += '<tr>';
        tableHTML += `<td>${t.pickupCode}</td>`;
        tableHTML += `<td>${t.transactionType}</td>`;
        tableHTML += `<td>${format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm:ss')}</td>`;
        tableHTML += `<td>${t.senderName}</td>`;
        tableHTML += `<td>${t.senderPhone}</td>`;
        tableHTML += `<td>${t.recipientName}</td>`;
        tableHTML += `<td>${t.recipientPhone || ''}</td>`;
        tableHTML += `<td>${t.amount}</td>`;
        tableHTML += `<td>${t.currency}</td>`;
        tableHTML += `<td>${t.receiverAmount || ''}</td>`;
        tableHTML += `<td>${t.receiverCurrency || ''}</td>`;
        tableHTML += `<td>${t.exchangeRate || ''}</td>`;
        tableHTML += `<td>${t.fees}</td>`;
        tableHTML += `<td>${t.status}</td>`;
        tableHTML += `<td>${t.notes || ''}</td>`;
        tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';

    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xls`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function exportToPDF(transactions: ExportTransaction[], filename: string = 'transactions') {
    // For PDF export, you would typically use a library like jsPDF or pdfmake
    // This is a simple HTML-to-print approach

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Transactions Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { text-align: center; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                th { background-color: #4CAF50; color: white; }
                tr:nth-child(even) { background-color: #f2f2f2; }
                .header { text-align: center; margin-bottom: 20px; }
                .date { text-align: center; color: #666; margin-bottom: 30px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Transactions Report</h1>
                <p class="date">Generated on ${format(new Date(), 'MMMM dd, yyyy HH:mm')}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Sender</th>
                        <th>Recipient</th>
                        <th>Amount</th>
                        <th>Fees</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;

    transactions.forEach(t => {
        html += `
            <tr>
                <td>${t.pickupCode}</td>
                <td>${t.transactionType}</td>
                <td>${format(new Date(t.createdAt), 'MM/dd/yyyy')}</td>
                <td>${t.senderName}</td>
                <td>${t.recipientName}</td>
                <td>${formatCurrency(t.amount)} ${t.currency}</td>
                <td>${formatCurrency(t.fees)} ${t.currency}</td>
                <td>${t.status}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}
