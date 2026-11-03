/**
 * Portfolio contact form → Google Sheet + automatic reply
 *
 * Receives submissions from both portfolio sites:
 *   - VA & automation portfolio  (source = "va")
 *   - Web developer portfolio    (source = "dev")
 *
 * For each enquiry it:
 *   1. Adds a row to the "Leads" tab of the Google Sheet this script is attached to
 *   2. Sends the visitor an automatic reply (different wording per site)
 *   3. Emails you a notification (hit Reply to answer the visitor directly)
 *
 * Setup steps are in SETUP.md next to this file.
 */

const CONFIG = {
  OWNER_EMAIL: 'geraldjohnt@gmail.com',
  OWNER_NAME: 'Gerald John Tangpos',
  SHEET_NAME: 'Leads',
  VA_URL: 'https://geraldjohnt.github.io/va-portfolio/',
  DEV_URL: 'https://geraldjohnt.github.io/web-developer-portfolio/',
  UPWORK_URL: 'https://www.upwork.com/freelancers/~011ad574500f310d02',
  REPLY_WITHIN: '24 hours',
  // The same email address can only submit once every 10 minutes.
  RESUBMIT_COOLDOWN_SECONDS: 600,
};

const HEADERS = ['Date', 'Portfolio', 'Name', 'Email', 'Needs help with', 'Message', 'Status', 'Auto-reply sent'];

/* ------------------------------------------------------------------ */
/* Web app entry points                                                */
/* ------------------------------------------------------------------ */

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};

    // Spam trap: real visitors never see or fill the "website" field.
    if (p.website) return json_({ ok: true });

    const lead = {
      source: p.source === 'dev' ? 'dev' : 'va',
      name: clean_(p.name, 100),
      email: clean_(p.email, 200).toLowerCase(),
      service: clean_(p.service, 100) || 'Not specified',
      message: clean_(p.message, 5000),
    };

    if (!lead.name || !isEmail_(lead.email) || lead.message.length < 5) {
      return json_({ ok: false, error: 'Please enter your name, a valid email address and a short message.' });
    }

    // Stop accidental double-submits and simple floods from the same address.
    const cache = CacheService.getScriptCache();
    const cacheKey = 'sent_' + lead.email;
    if (cache.get(cacheKey)) {
      return json_({ ok: true, duplicate: true });
    }
    cache.put(cacheKey, '1', CONFIG.RESUBMIT_COOLDOWN_SECONDS);

    // Keep a couple of emails in reserve so you're always notified.
    const canReply = MailApp.getRemainingDailyQuota() >= 2;

    saveLead_(lead, canReply);
    if (canReply) sendAutoReply_(lead);
    notifyOwner_(lead, canReply);

    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Something went wrong on my side. Please email me directly instead.' });
  }
}

function doGet() {
  return ContentService.createTextOutput('Portfolio contact form is running.');
}

/* ------------------------------------------------------------------ */
/* Run this once from the editor (Run ▶ testSetup) to grant            */
/* permissions and check everything works. It sends both auto-replies  */
/* and a notification to your own inbox and adds two test rows.        */
/* ------------------------------------------------------------------ */

function testSetup() {
  ['va', 'dev'].forEach(function (source) {
    const lead = {
      source: source,
      name: 'Test Visitor',
      email: CONFIG.OWNER_EMAIL,
      service: source === 'va' ? 'Automation setup' : 'Website / WordPress',
      message: 'This is a test enquiry created by testSetup().',
    };
    saveLead_(lead, true);
    sendAutoReply_(lead);
    notifyOwner_(lead, true);
  });
  console.log('Done. Check the "' + CONFIG.SHEET_NAME + '" tab and your inbox (4 emails).');
}

/* ------------------------------------------------------------------ */
/* Sheet                                                               */
/* ------------------------------------------------------------------ */

function saveLead_(lead, autoReplySent) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    sheet.appendRow([
      new Date(),
      lead.source === 'dev' ? 'Web Developer' : 'Virtual Assistant',
      safeCell_(lead.name),
      safeCell_(lead.email),
      safeCell_(lead.service),
      safeCell_(lead.message),
      'New',
      autoReplySent ? 'Yes' : 'No (daily email limit reached)',
    ]);
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(6, 420);
  }
  return sheet;
}

/* ------------------------------------------------------------------ */
/* Emails                                                              */
/* ------------------------------------------------------------------ */

function sendAutoReply_(lead) {
  const first = lead.name.split(/\s+/)[0];
  const isDev = lead.source === 'dev';

  const subject = isDev
    ? 'Thanks for your project enquiry, ' + first + '!'
    : 'Thanks for reaching out, ' + first + '!';

  const intro = isDev
    ? 'Thanks for telling me about your project. I\'ve received your message and I\'ll reply personally within ' +
      CONFIG.REPLY_WITHIN + ', whatever your time zone.'
    : 'Thanks for getting in touch. I\'ve received your message and I\'ll reply personally within ' +
      CONFIG.REPLY_WITHIN + ', whatever your time zone.';

  const steps = isDev
    ? [
        'I review what you need built and your current setup.',
        'I reply with questions (if any), a suggested approach and a rough timeline.',
        'If it looks like a fit, we book a short call to agree on scope and price.',
      ]
    : [
        'I review the tasks you mentioned and the tools you use.',
        'I reply with a simple plan: what I can take over and what can be automated.',
        'If you\'d like, we start with a free trial task so you can see my work first.',
      ];

  const ps = isDev
    ? 'P.S. This instant reply comes from a small Google Apps Script automation I built. If your business needs ' +
      'everyday admin handled too, see my VA & automation portfolio: ' + CONFIG.VA_URL
    : 'P.S. This instant reply is one of my own automations, built with Google Apps Script. It\'s the same kind ' +
      'of thing I can set up for your business.';

  const plain = [
    'Hi ' + first + ',',
    '',
    intro,
    '',
    'What happens next:',
    steps.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n'),
    '',
    'Here\'s a copy of your message:',
    'Needs help with: ' + lead.service,
    lead.message,
    '',
    'If anything is urgent, just reply to this email.',
    '',
    'Best,',
    CONFIG.OWNER_NAME,
    isDev ? 'Full-Stack Developer' : 'Virtual Assistant & Automation Specialist',
    isDev ? CONFIG.DEV_URL : CONFIG.VA_URL,
    '',
    ps,
  ].join('\n');

  const accent = isDev ? '#0f9f6e' : '#C97B3D';
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2328;max-width:560px">' +
    '<p>Hi ' + esc_(first) + ',</p>' +
    '<p>' + esc_(intro) + '</p>' +
    '<p style="margin-bottom:6px"><strong>What happens next:</strong></p>' +
    '<ol style="margin-top:0;padding-left:20px">' +
    steps.map(function (s) { return '<li>' + esc_(s) + '</li>'; }).join('') +
    '</ol>' +
    '<div style="border-left:3px solid ' + accent + ';background:#f6f8fa;padding:12px 16px;margin:18px 0">' +
    '<div style="font-size:12px;color:#57606a;margin-bottom:6px">YOUR MESSAGE · ' + esc_(lead.service) + '</div>' +
    '<div style="white-space:pre-wrap">' + esc_(lead.message) + '</div>' +
    '</div>' +
    '<p>If anything is urgent, just reply to this email.</p>' +
    '<p>Best,<br><strong>' + esc_(CONFIG.OWNER_NAME) + '</strong><br>' +
    (isDev ? 'Full-Stack Developer' : 'Virtual Assistant &amp; Automation Specialist') + '<br>' +
    '<a href="' + (isDev ? CONFIG.DEV_URL : CONFIG.VA_URL) + '" style="color:' + accent + '">' +
    (isDev ? 'Developer portfolio' : 'VA &amp; automation portfolio') + '</a> · ' +
    '<a href="' + CONFIG.UPWORK_URL + '" style="color:' + accent + '">Upwork</a></p>' +
    '<p style="font-size:13px;color:#57606a">' + esc_(ps).replace(
      /(https:\/\/\S+)/, '<a href="$1" style="color:' + accent + '">$1</a>') + '</p>' +
    '</div>';

  MailApp.sendEmail({
    to: lead.email,
    subject: subject,
    body: plain,
    htmlBody: html,
    name: CONFIG.OWNER_NAME,
    replyTo: CONFIG.OWNER_EMAIL,
  });
}

function notifyOwner_(lead, autoReplySent) {
  const label = lead.source === 'dev' ? 'Web Developer' : 'Virtual Assistant';
  const body = [
    'New enquiry from your ' + label + ' portfolio.',
    '',
    'Name: ' + lead.name,
    'Email: ' + lead.email,
    'Needs help with: ' + lead.service,
    '',
    lead.message,
    '',
    autoReplySent
      ? 'An automatic reply was sent. Hit Reply to answer them directly.'
      : 'NOTE: the daily email limit was reached, so NO automatic reply was sent. Reply manually.',
    '',
    'All enquiries: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  ].join('\n');

  MailApp.sendEmail({
    to: CONFIG.OWNER_EMAIL,
    subject: '[' + label + ' lead] ' + lead.name + ' – ' + lead.service,
    body: body,
    replyTo: lead.email,
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(value, maxLength) {
  return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, maxLength);
}

function isEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

// Stop text like "=HYPERLINK(...)" from being treated as a formula in the Sheet.
function safeCell_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function esc_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
