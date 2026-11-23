import fs from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const root = new URL('../', import.meta.url);
const originalPath = new URL('docs/Firm Management System - Analytics and Functional Report.original.pdf', root);
const outputPath = new URL('Firm Management System - Analytics and Functional Report.pdf', root);
const original = await fs.readFile(originalPath);
const pdf = await PDFDocument.load(original);
const regular = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const green = rgb(0.075, 0.27, 0.22);
const muted = rgb(0.34, 0.41, 0.39);
const ink = rgb(0.12, 0.16, 0.15);
const line = rgb(0.82, 0.87, 0.85);
const sourcePage = pdf.getPage(1);
const { width, height } = sourcePage.getSize();
const margin = 54;
const bodyWidth = width - margin * 2;
const bodySize = 10.2;
const bodyLeading = 14.3;

function wrap(text, font, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function addReportPage(section, title, subtitle, pageNumber, totalPages) {
  const page = pdf.addPage([width, height]);
  let y = height - 55;
  page.drawText(`${section}.   ${title}`, { x: margin, y, size: 16, font: bold, color: green });
  y -= 22;
  page.drawText(subtitle, { x: margin, y, size: 10.5, font: bold, color: muted });
  y -= 15;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.7, color: line });
  y -= 23;

  const heading = (text) => {
    if (y < 115) return false;
    page.drawText(text, { x: margin, y, size: 11.2, font: bold, color: green });
    y -= 17;
    return true;
  };
  const paragraph = (text) => {
    const lines = wrap(text, regular, bodySize, bodyWidth);
    for (const value of lines) {
      page.drawText(value, { x: margin, y, size: bodySize, font: regular, color: ink });
      y -= bodyLeading;
    }
    y -= 8;
  };
  const bullet = (text) => {
    const lines = wrap(text, regular, bodySize, bodyWidth - 18);
    page.drawText('-', { x: margin + 2, y, size: bodySize, font: bold, color: green });
    lines.forEach((value, index) => {
      page.drawText(value, { x: margin + 17, y: y - index * bodyLeading, size: bodySize, font: regular, color: ink });
    });
    y -= lines.length * bodyLeading + 4;
  };
  const footer = () => {
    page.drawText(`Page ${pageNumber} of ${totalPages}`, {
      x: width - margin - regular.widthOfTextAtSize(`Page ${pageNumber} of ${totalPages}`, 8.5),
      y: 30,
      size: 8.5,
      font: regular,
      color: muted,
    });
  };
  return { page, heading, paragraph, bullet, footer };
}

const first = addReportPage('9', 'Official project overview', 'Purpose, project goals and objectives', 10, 12);
first.heading('Project purpose');
first.paragraph('The purpose of the Firm Management System is to provide a secure and organized digital platform for recording, monitoring and managing the movement of goods between companies. The system brings shipment information, delivery schedules, operational documents and performance measures into one account-private workspace.');
first.heading('Project goal');
first.paragraph('The main goal is to replace fragmented or manual shipment records with a reliable web-based system that improves visibility, consistency and accountability throughout the transport process.');
first.heading('Project objectives');
first.bullet('Provide a clear workflow for creating, updating, viewing, searching and archiving shipment records.');
first.bullet('Track sending and receiving companies, routes, vehicles, drivers, goods, dates and shipment status.');
first.bullet('Identify due, overdue and missing-ETA shipments so operational exceptions can be handled promptly.');
first.bullet('Protect each user account and its shipments and documents from unauthorized access.');
first.bullet('Provide delivery analytics and exportable information to support operational decisions.');
first.bullet('Maintain a modular and scalable codebase that can be extended as business requirements grow.');
first.footer();

const second = addReportPage('10', 'Technology and architecture', 'Frameworks, database and principal technical responsibilities', 11, 12);
second.heading('Angular 21');
second.paragraph('Angular provides the browser interface, routing, forms and reactive state. Route-level lazy loading and deferred components reduce initial work. The interface includes responsive navigation, loading and empty states, accessible focus behavior and account-aware API communication.');
second.heading('DevExtreme 26.1');
second.paragraph('DevExtreme supplies the data grid, charts, calendar, popups, select controls and buttons. The shipment register supports column resizing and reordering, filters, grouping and a column chooser. Charts present shipment status and delivery performance.');
second.heading('Laravel 12 and PHP');
second.paragraph('Laravel provides authentication, sessions, CSRF protection, validation, authorization policies and the REST-style API. Shipment services handle transactional status changes, reference generation, delivery timestamps and account revisions. Document services manage private file storage.');
second.heading('PostgreSQL');
second.paragraph('PostgreSQL stores users, shipments, status events, document metadata and record revisions. Account and schedule indexes support register, calendar and exception queries. Analytics are calculated from account-owned, non-archived delivery records.');
second.heading('System architecture');
second.paragraph('The Angular frontend sends authenticated requests to Laravel. Laravel validates the request, applies ownership rules and reads or writes PostgreSQL. Private document files are stored outside the public web directory and are streamed only after authorization.');
second.footer();

const third = addReportPage('11', 'Functional scope', 'Core user functions and expected project outcomes', 12, 12);
third.heading('Dashboard and shipment management');
third.paragraph('The dashboard summarizes active shipments, due arrivals, overdue records, delivery performance, status distribution and recent activity. Users can add, edit, search, filter, group, view and archive shipments. Shipment entry includes companies, route, vehicle, optional driver contact, goods, quantity, dates, status and internal notes.');
third.heading('References, details and scheduling');
third.paragraph('Laravel generates a shipment reference when none is supplied. Shipment details provide a progress stepper, companies and schedule, driver contact, goods, transit days, status history, linked documents and a printable summary. The arrival calendar opens shipments from their expected dates.');
third.heading('Documents and reporting');
third.paragraph('Users can upload, rename, replace, download and delete general or shipment-linked private documents. Export CSV downloads the active shipment register. Archived shipments are excluded from active lists, calendars, analytics and exports while their data and document associations remain stored.');
third.heading('Analytics');
third.paragraph('The system reports due today, overdue and missing-ETA exceptions, on-time delivery rate, promised ETA coverage, median transit days and 90th-percentile transit days. Measures use the original promised ETA and Africa/Nairobi business dates.');
third.heading('Security and ownership');
third.paragraph('Authenticated Laravel sessions, CSRF protection, rate limiting, password hashing, request validation and authorization policies protect the application. Shipments and documents remain private to the account that created them, and client-supplied ownership fields are rejected.');
third.heading('Expected outcomes');
third.bullet('Faster access to accurate shipment information and delivery status.');
third.bullet('Improved visibility of delays and upcoming arrivals.');
third.bullet('Consistent document handling and a traceable shipment history.');
third.bullet('Better operational reporting and a foundation for future expansion.');
third.paragraph('The present scope uses individual account ownership. Shared organization workspaces and team roles are outside the current project scope.');
third.footer();

await fs.writeFile(outputPath, await pdf.save());
console.log(`Updated report written with ${pdf.getPageCount()} pages.`);
