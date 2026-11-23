import fs from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const pdf = await PDFDocument.create();
const regular = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const black = rgb(0, 0, 0);
const gray = rgb(0.82, 0.82, 0.82);
const width = 595.28;
const height = 841.89;
const margin = 55;
const contentWidth = width - margin * 2;
const pages = [];

function wrap(text, font = regular, size = 10.2, maxWidth = contentWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function addPage(title, subtitle = '') {
  const page = pdf.addPage([width, height]);
  pages.push(page);
  let y = height - margin;
  page.drawText(title, { x: margin, y, size: 18, font: bold, color: black });
  y -= 21;
  if (subtitle) {
    page.drawText(subtitle, { x: margin, y, size: 10, font: regular, color: black });
    y -= 15;
  }
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.8, color: black });
  y -= 23;

  const api = {
    heading(text) {
      page.drawText(text, { x: margin, y, size: 11.5, font: bold, color: black });
      y -= 17;
    },
    paragraph(text, gap = 9) {
      for (const line of wrap(text)) {
        page.drawText(line, { x: margin, y, size: 10.2, font: regular, color: black });
        y -= 14.4;
      }
      y -= gap;
    },
    bullet(text) {
      const lines = wrap(text, regular, 10.2, contentWidth - 18);
      page.drawText('-', { x: margin + 2, y, size: 10.2, font: regular, color: black });
      lines.forEach((line, index) => {
        page.drawText(line, { x: margin + 17, y: y - index * 14.4, size: 10.2, font: regular, color: black });
      });
      y -= lines.length * 14.4 + 4;
    },
    row(label, text) {
      const labelWidth = 125;
      page.drawText(label, { x: margin, y, size: 9.8, font: bold, color: black });
      const lines = wrap(text, regular, 9.8, contentWidth - labelWidth);
      lines.forEach((line, index) => {
        page.drawText(line, { x: margin + labelWidth, y: y - index * 13.5, size: 9.8, font: regular, color: black });
      });
      y -= Math.max(1, lines.length) * 13.5 + 6;
    },
    rule() {
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: gray });
      y -= 13;
    },
  };
  return api;
}

const cover = pdf.addPage([width, height]);
pages.push(cover);
cover.drawText('FIRM MANAGEMENT SYSTEM', { x: margin, y: 610, size: 25, font: bold, color: black });
cover.drawText('Project Documentation', { x: margin, y: 572, size: 19, font: regular, color: black });
cover.drawLine({ start: { x: margin, y: 548 }, end: { x: width - margin, y: 548 }, thickness: 1, color: black });
cover.drawText('Shipment Management Test Project', { x: margin, y: 516, size: 11, font: regular, color: black });
cover.drawText('Technology: Angular, DevExtreme, Laravel and PostgreSQL', { x: margin, y: 430, size: 10, font: regular, color: black });
cover.drawText('Document version: 1.0', { x: margin, y: 407, size: 10, font: regular, color: black });
cover.drawText('Date: 23 November 2026', { x: margin, y: 384, size: 10, font: regular, color: black });

const overview = addPage('1. Project Overview', 'Background, purpose, objectives and scope');
overview.heading('1.1 Background');
overview.paragraph('The Firm Management System was developed as a test project to demonstrate a complete CRUD application using a modern frontend, backend API and relational database. The selected business case is shipment management because firms regularly send and receive goods between companies and need clear records of those movements.');
overview.heading('1.2 Problem statement');
overview.paragraph('Manual or scattered shipment records make it difficult to find current information, identify delayed deliveries, keep supporting documents together and review delivery performance.');
overview.heading('1.3 Project purpose');
overview.paragraph('The purpose of the project is to provide a simple, secure and organized web application for recording and monitoring goods transported between sending and receiving companies.');
overview.heading('1.4 Main goal');
overview.paragraph('The main goal is to demonstrate how Angular, Laravel and PostgreSQL can work together in a practical full-stack system that is structured, testable and easy to extend.');
overview.heading('1.5 Objectives');
overview.bullet('Create, view, update, search and archive shipment records.');
overview.bullet('Track companies, routes, vehicles, drivers, goods, dates and shipment status.');
overview.bullet('Display due, overdue and missing-ETA shipment exceptions.');
overview.bullet('Store general and shipment-specific documents securely.');
overview.bullet('Present basic delivery analytics and exportable shipment information.');
overview.bullet('Keep each account separate through backend ownership checks.');
overview.heading('1.6 Scope');
overview.paragraph('The project covers individual user accounts, shipment management, arrival planning, delivery analytics and private documents. It is a test project and does not include organization teams, payment processing, GPS tracking, email or SMS notifications.');

const technology = addPage('2. Technology and System Structure', 'Tools used and how the application is organized');
technology.heading('2.1 Technology stack');
technology.row('Angular 21', 'Frontend components, routing, forms, reactive state and user interaction.');
technology.row('TypeScript', 'Typed frontend logic and API data models.');
technology.row('DevExtreme 26.1', 'Data grid, charts, arrival calendar, popups, select controls and buttons.');
technology.row('Laravel 12', 'Backend routes, controllers, validation, authentication, authorization and business services.');
technology.row('PHP', 'Backend runtime used by Laravel.');
technology.row('PostgreSQL', 'Storage for users, shipments, status history, document metadata and revision records.');
technology.row('Vitest / PHPUnit', 'Automated frontend and backend testing.');
technology.rule();
technology.heading('2.2 System structure');
technology.paragraph('The Angular frontend sends requests to the Laravel API. Laravel checks the user session, validates the request and verifies record ownership. Shipment and document modules perform the business operation, and PostgreSQL stores the resulting data. Uploaded files are kept in private storage outside the public web directory.');
technology.heading('2.3 Code organization');
technology.bullet('Angular routes load Dashboard, Shipments, Shipment Details and Documents.');
technology.bullet('Separate components manage the shipment editor, arrival calendar and analytics.');
technology.bullet('Laravel controllers handle HTTP requests while shipment and document modules contain business logic.');
technology.bullet('Form Request classes validate input and policies enforce account ownership.');

const functions = addPage('3. System Functions', 'Implemented functions available to a user');
functions.heading('3.1 Authentication');
functions.paragraph('A user can register, sign in and sign out. Protected data requires a valid Laravel session. Each shipment and document belongs to the account that created it.');
functions.heading('3.2 Dashboard');
functions.paragraph('The dashboard displays total shipments, arrivals due today, overdue shipments, on-time delivery performance, shipment status distribution and recent shipment activity.');
functions.heading('3.3 Shipment register');
functions.paragraph('Users can add, search, filter, group, view, edit and archive shipments. The DevExtreme grid supports column resizing and reordering, a column chooser, header filters and a filter row. Server pagination returns up to 50 records at a time.');
functions.heading('3.4 Shipment information');
functions.paragraph('A shipment records sending and receiving companies, origin, destination, vehicle, optional driver contact, departure and expected arrival dates, reference, goods, quantity, internal notes and status. Laravel generates a reference when one is not entered.');
functions.heading('3.5 Status and details');
functions.paragraph('Statuses are Scheduled, In transit and Delivered. Shipment details show the progress stage, schedule, transit days, status history, goods, driver contact, notes and documents. A shipment summary can be printed.');
functions.heading('3.6 Calendar, export and archive');
functions.paragraph('The arrival calendar displays expected delivery dates. Export CSV downloads active shipment data. Archive removes a shipment from active views without permanently deleting its stored data or linked documents.');

const documents = addPage('4. Documents, Analytics and Interface', 'Supporting records, measurements and user experience');
documents.heading('4.1 Document management');
documents.paragraph('Users can upload, rename, replace, download, paginate and delete private documents. A document can be general to the account or linked to one shipment. Supported formats are PDF, PNG, JPEG, TXT and CSV up to 10 MB.');
documents.heading('4.2 Delivery exceptions');
documents.row('Due today', 'An undelivered shipment expected on the current Nairobi date.');
documents.row('Overdue', 'An undelivered shipment whose expected arrival date has passed.');
documents.row('Missing ETA', 'An undelivered shipment without an expected arrival date.');
documents.heading('4.3 Delivery analytics');
documents.row('On-time rate', 'Deliveries completed on or before the original promised arrival date.');
documents.row('ETA coverage', 'Delivered shipments that contain a promised arrival date.');
documents.row('Median transit', 'The middle calendar-day duration from departure to delivery.');
documents.row('90th percentile', 'The duration at or below which approximately 90 percent of eligible deliveries fall.');
documents.paragraph('Analytics use Africa/Nairobi dates and exclude archived shipments. Missing or invalid date pairs are shown as excluded records rather than being counted as zero.');
documents.heading('4.4 Interface');
documents.paragraph('The application uses a responsive sidebar, consistent buttons, loading states, empty states, validation feedback and retry actions. On smaller screens the sidebar becomes a navigation drawer.');

const security = addPage('5. Security and Testing', 'Controls used in the test project and verification performed');
security.heading('5.1 Security controls');
security.bullet('Laravel sessions protect authenticated API routes.');
security.bullet('CSRF tokens protect requests that change data.');
security.bullet('Passwords are hashed and are not stored in browser storage.');
security.bullet('Login and registration are rate limited.');
security.bullet('Policies and account-scoped queries prevent access to another user account.');
security.bullet('Client requests cannot choose their user ID or document storage path.');
security.bullet('Uploaded file type, extension and maximum size are validated.');
security.bullet('Documents are authorized before download and stored outside the public folder.');
security.heading('5.2 Frontend testing');
security.paragraph('Angular tests cover authentication services, API handling, shipment workflows, details and documents. The production build checks templates, TypeScript and component compilation.');
security.heading('5.3 Backend testing');
security.paragraph('Laravel tests cover registration, login, logout, CSRF, rate limiting, ownership, shipment validation, search, calendar behavior, status updates, analytics and private document operations.');
security.heading('5.4 Current verification');
security.paragraph('The latest frontend suite passed 16 tests. The latest backend suite passed 16 tests with 182 assertions. PostgreSQL migrations include the fields used by the current interface.');

const usage = addPage('6. Running the Project and Conclusion', 'Local startup, common checks and project summary');
usage.heading('6.1 Requirements');
usage.bullet('Node.js and npm for the Angular frontend.');
usage.bullet('XAMPP PHP and Composer for the Laravel backend.');
usage.bullet('PostgreSQL for application data.');
usage.heading('6.2 Start the application');
usage.row('Backend', 'Run powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\backend.ps1 serve');
usage.row('Frontend', 'Run npm.cmd start from the project root.');
usage.row('Open', 'Visit http://localhost:4200 in the browser.');
usage.heading('6.3 Useful checks');
usage.row('Frontend tests', 'npm.cmd test -- --watch=false');
usage.row('Frontend build', 'npm.cmd run build');
usage.row('Backend tests', 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\backend.ps1 test');
usage.heading('6.4 Conclusion');
usage.paragraph('The project demonstrates a working full-stack CRUD system built around a realistic shipment-management use case. It combines a responsive Angular interface, Laravel business logic, PostgreSQL persistence, private documents, delivery analytics and automated tests. The modular structure makes the test project suitable for demonstrating core software-development practices without presenting it as a complete enterprise platform.');
usage.heading('6.5 Documentation reference');
usage.paragraph('The repository README contains detailed setup, database, API, testing and troubleshooting instructions. This document provides the project-level overview and implemented functional summary.');

pages.forEach((page, index) => {
  if (index === 0) return;
  const value = `Page ${index + 1} of ${pages.length}`;
  page.drawText(value, {
    x: width - margin - regular.widthOfTextAtSize(value, 8),
    y: 26,
    size: 8,
    font: regular,
    color: black,
  });
});

pdf.setTitle('Firm Management System - Project Documentation');
pdf.setSubject('Test project overview, technology, functions, security and testing');
pdf.setAuthor('Firm Management System Project');
pdf.setCreationDate(new Date('2026-11-23T00:00:00+03:00'));

const output = new URL('../Firm Management System - Official Project Documentation.pdf', import.meta.url);
await fs.writeFile(output, await pdf.save());
console.log(`Generated ${pages.length}-page project document.`);
