/**
 * STUDIO MATRA — Payslip PDF Generation Service
 * Produces elegant, architectural-grade payslip documents using jsPDF.
 */

import { jsPDF } from 'jspdf';
import { Organization, PayrollItem } from '../types';
import { formatBDT, numberToWordsBDT } from '../utils/money';

export function generatePayslipPDF(item: PayrollItem, org: Organization): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const charcoal = [28, 33, 32];
  const primaryGold = [202, 160, 92]; // Studio Matra Brand Gold (#CAA05C)
  const warmBeige = [244, 241, 234];
  const stoneGrey = [100, 105, 102];
  const lightGrey = [230, 230, 228];

  // Header Background bar
  doc.setFillColor(primaryGold[0], primaryGold[1], primaryGold[2]);
  doc.rect(margin, margin, contentWidth, 2, 'F');

  // Brand Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.text('STUDIO MATRA', margin, margin + 10);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(stoneGrey[0], stoneGrey[1], stoneGrey[2]);
  doc.text('INTERIOR ARCHITECTURE & DESIGN', margin, margin + 15);
  doc.text(`${org.address} | Phone: ${org.phone}`, margin, margin + 19);

  // Document Title Pill on Top Right
  doc.setFillColor(warmBeige[0], warmBeige[1], warmBeige[2]);
  doc.roundedRect(pageWidth - margin - 52, margin + 5, 52, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryGold[0], primaryGold[1], primaryGold[2]);
  doc.text('SALARY PAYSLIP', pageWidth - margin - 47, margin + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(stoneGrey[0], stoneGrey[1], stoneGrey[2]);
  doc.text(`Ref: ${item.id.slice(0, 16).toUpperCase()}`, pageWidth - margin - 47, margin + 17);

  // Divider line
  let y = margin + 25;
  doc.setDrawColor(lightGrey[0], lightGrey[1], lightGrey[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // Employee Information Box
  y += 6;
  doc.setFillColor(250, 249, 245);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, 'F');
  doc.setDrawColor(lightGrey[0], lightGrey[1], lightGrey[2]);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, 'S');

  const col1 = margin + 4;
  const col2 = margin + 54;
  const col3 = margin + 104;
  const col4 = margin + 144;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(stoneGrey[0], stoneGrey[1], stoneGrey[2]);
  doc.text('EMPLOYEE NAME', col1, y + 6);
  doc.text('EMPLOYEE ID', col2, y + 6);
  doc.text('DEPARTMENT', col3, y + 6);
  doc.text('PAYMENT STATUS', col4, y + 6);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.text(item.employeeName, col1, y + 11);
  doc.text(item.employeeCode, col2, y + 11);
  doc.text(item.departmentName, col3, y + 11);

  doc.setTextColor(item.paymentStatus === 'paid' ? primaryGold[0] : 180, item.paymentStatus === 'paid' ? primaryGold[1] : 50, item.paymentStatus === 'paid' ? primaryGold[2] : 50);
  doc.text(item.paymentStatus === 'paid' ? 'PAID & VERIFIED' : 'PENDING PAYMENT', col4, y + 11);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(stoneGrey[0], stoneGrey[1], stoneGrey[2]);
  doc.text('DESIGNATION', col1, y + 19);
  doc.text('PAYMENT METHOD', col2, y + 19);
  doc.text('TRANSACTION REF', col3, y + 19);
  doc.text('PAYMENT DATE', col4, y + 19);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.text(item.designationTitle, col1, y + 24);
  doc.text(item.paymentMethod ? item.paymentMethod.replace('_', ' ').toUpperCase() : 'BANK TRANSFER', col2, y + 24);
  doc.text(item.paymentReference || 'N/A', col3, y + 24);
  doc.text(item.paymentDate || new Date().toISOString().split('T')[0], col4, y + 24);

  // Attendance Summary Strip
  y += 34;
  doc.setFillColor(warmBeige[0], warmBeige[1], warmBeige[2]);
  doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'F');

  const attCols = [
    { label: 'Work Days', val: item.workingDays },
    { label: 'Present', val: item.presentDays },
    { label: 'Paid Leave', val: item.paidLeaveDays },
    { label: 'Unpaid Leave', val: item.unpaidLeaveDays },
    { label: 'Late Days', val: item.lateDays },
    { label: 'Overtime (Hrs)', val: item.overtimeHours },
  ];

  const attStep = contentWidth / attCols.length;
  attCols.forEach((ac, idx) => {
    const cx = margin + idx * attStep + 4;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(stoneGrey[0], stoneGrey[1], stoneGrey[2]);
    doc.text(ac.label, cx, y + 5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
    doc.text(String(ac.val), cx, y + 10);
  });

  // Financial Table: Earnings vs Deductions
  y += 20;
  const halfWidth = (contentWidth - 6) / 2;

  // Earnings Header
  doc.setFillColor(primaryGold[0], primaryGold[1], primaryGold[2]);
  doc.rect(margin, y, halfWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('EARNINGS & ALLOWANCES', margin + 4, y + 5);
  doc.text('AMOUNT (BDT)', margin + halfWidth - 28, y + 5);

  // Deductions Header
  doc.setFillColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.rect(margin + halfWidth + 6, y, halfWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('DEDUCTIONS & RECOVERIES', margin + halfWidth + 10, y + 5);
  doc.text('AMOUNT (BDT)', margin + contentWidth - 28, y + 5);

  y += 7;
  const startFinancialY = y;

  // Earnings Rows
  const earnings = item.lineItems.filter((li) => li.category === 'earning');
  let ey = startFinancialY;
  earnings.forEach((e, idx) => {
    ey += 6.5;
    if (idx % 2 === 1) {
      doc.setFillColor(252, 252, 250);
      doc.rect(margin, ey - 5, halfWidth, 6.5, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
    doc.text(e.description.slice(0, 32), margin + 4, ey);
    doc.setFont('helvetica', 'bold');
    doc.text(formatBDT(e.amount, false), margin + halfWidth - 4, ey, { align: 'right' });
  });

  // Deductions Rows
  const deductions = item.lineItems.filter((li) => li.category === 'deduction');
  let dy = startFinancialY;
  if (deductions.length === 0) {
    dy += 6.5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(stoneGrey[0], stoneGrey[1], stoneGrey[2]);
    doc.text('No deductions applied for period', margin + halfWidth + 10, dy);
    doc.text('৳ 0', margin + contentWidth - 4, dy, { align: 'right' });
  } else {
    deductions.forEach((d, idx) => {
      dy += 6.5;
      if (idx % 2 === 1) {
        doc.setFillColor(252, 252, 250);
        doc.rect(margin + halfWidth + 6, dy - 5, halfWidth, 6.5, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
      doc.text(d.description.slice(0, 32), margin + halfWidth + 10, dy);
      doc.setFont('helvetica', 'bold');
      doc.text(formatBDT(d.amount, false), margin + contentWidth - 4, dy, { align: 'right' });
    });
  }

  y = Math.max(ey, dy) + 8;

  // Totals Sub-bars
  doc.setDrawColor(lightGrey[0], lightGrey[1], lightGrey[2]);
  doc.line(margin, y, margin + halfWidth, y);
  doc.line(margin + halfWidth + 6, y, margin + contentWidth, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.text('GROSS EARNINGS', margin + 4, y);
  doc.text(formatBDT(item.grossAmount), margin + halfWidth - 4, y, { align: 'right' });

  doc.text('TOTAL DEDUCTIONS', margin + halfWidth + 10, y);
  doc.text(formatBDT(item.totalDeductions), margin + contentWidth - 4, y, { align: 'right' });

  // Net Pay Highlight Box
  y += 10;
  doc.setFillColor(27, 67, 50);
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(216, 239, 226);
  doc.text('NET SALARY PAYABLE (BDT)', margin + 8, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(formatBDT(item.netAmount), margin + 8, y + 14);

  // In words
  y += 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(stoneGrey[0], stoneGrey[1], stoneGrey[2]);
  doc.text('AMOUNT IN WORDS:', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.text(numberToWordsBDT(item.netAmount), margin + 35, y);

  // Signatures & Legal Disclaimer
  y += 26;
  doc.setDrawColor(lightGrey[0], lightGrey[1], lightGrey[2]);
  doc.line(margin, y, margin + 50, y);
  doc.line(margin + contentWidth - 50, y, margin + contentWidth, y);

  doc.setFontSize(7.5);
  doc.setTextColor(stoneGrey[0], stoneGrey[1], stoneGrey[2]);
  doc.text('Prepared by Finance Lead', margin, y + 4);
  doc.text('Authorized Signatory / Partner', margin + contentWidth - 50, y + 4);

  // Confidentiality footer
  y += 18;
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(
    'CONFIDENTIAL NOTE: This payslip is an authoritative statement generated by Studio Matra HR & Payroll Management System. Any unauthorized alteration or reproduction is prohibited.',
    margin,
    y,
    { maxWidth: contentWidth }
  );

  return doc;
}
