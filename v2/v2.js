/* Version 2 page behaviour: menu, counters, work-sample viewer. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('year').textContent = new Date().getFullYear();

  /* mobile menu */
  var nav = document.getElementById('nav');
  var toggle = nav.querySelector('.nav-toggle');
  var menu = document.getElementById('nav-menu');
  function setOpen(open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
  menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); toggle.focus(); } });
  document.addEventListener('click', function (e) { if (nav.classList.contains('open') && !nav.contains(e.target)) setOpen(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 860) setOpen(false); });

  /* counters roll up once their block is built */
  function count(el) {
    if (el.dataset.done) return; el.dataset.done = '1';
    var target = +el.dataset.count, from = +(el.dataset.from || 0), suf = el.dataset.suf || '';
    if (reduce) { el.textContent = target + suf; return; }
    var st = performance.now(), d = 1100;
    (function step(n) {
      var p = Math.min(1, (n - st) / d), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (target - from) * e) + suf;
      if (p < 1) requestAnimationFrame(step);
    })(st);
  }
  document.addEventListener('built', function (e) {
    var t = e.target;
    if (t.matches && t.matches('[data-count]')) count(t);
    if (t.querySelectorAll) t.querySelectorAll('[data-count]').forEach(count);
  });

  /* work samples viewer */
  var DIR = 'VA_Portfolio_Screenshots/';
  var data = {
    calendar: { title: 'Calendar & Email Management', items: [
      ['01-email-calendar/01-inbox-triage.png', 'Inbox triage with priority labels'],
      ['01-email-calendar/02-weekly-calendar.png', 'Colour-coded weekly calendar'],
      ['01-email-calendar/03-follow-up-tracker.png', 'Follow-up tracker — nothing slips'],
      ['01-email-calendar/04-meeting-scheduler.png', 'Multi-timezone meeting scheduling'],
      ['01-email-calendar/05-reply-template-followup.png', 'Templated reply with follow-up reminder']] },
    dataentry: { title: 'Data Entry & Research', items: [
      ['02-data-research/01-clean-lead-spreadsheet.png', 'Cleaned & standardized lead list'],
      ['02-data-research/02-before-after-cleanup.png', 'Data cleanup — before & after'],
      ['02-data-research/03-vendor-comparison.png', 'Vendor comparison & recommendation'],
      ['02-data-research/04-market-research.png', 'Market research summary'],
      ['02-data-research/05-contacts-database.png', 'Organized contacts database']] },
    support: { title: 'Customer Support', items: [
      ['03-customer-support/01-ticket-queue.png', 'Ticket queue with SLA tracking'],
      ['03-customer-support/02-on-brand-email-reply.png', 'On-brand email reply with macros'],
      ['03-customer-support/03-live-chat.png', 'Live chat support'],
      ['03-customer-support/04-social-dm-inbox.png', 'Unified social DM inbox'],
      ['03-customer-support/05-escalation-handling.png', 'Escalation handling & timeline']] },
    coordination: { title: 'Project Coordination', items: [
      ['04-project-coordination/01-kanban-board.png', 'Kanban task board'],
      ['04-project-coordination/02-timeline-gantt.png', 'Project timeline'],
      ['04-project-coordination/03-weekly-status-update.png', 'Weekly status update'],
      ['04-project-coordination/04-deadline-tracker.png', 'Deadline tracker with reminders'],
      ['04-project-coordination/05-team-workload-action-items.png', 'Team workload & meeting action items']] },
    documents: { title: 'Document & File Organization', items: [
      ['05-document-file-organization/01-cloud-folder-structure.png', 'Cloud folder structure'],
      ['05-document-file-organization/02-file-naming-system.png', 'File naming system'],
      ['05-document-file-organization/03-template-library.png', 'Template library'],
      ['05-document-file-organization/04-folder-cleanup-before-after.png', 'Shared drive cleanup — before & after'],
      ['05-document-file-organization/05-drive-audit-permissions.png', 'Monthly drive audit & permissions']] },
    social: { title: 'Social Media Support', items: [
      ['06-social-media/01-content-calendar.png', 'Monthly content calendar'],
      ['06-social-media/02-post-composer-caption.png', 'Post caption & preview'],
      ['06-social-media/03-scheduled-queue.png', 'Scheduled post queue'],
      ['06-social-media/04-community-engagement.png', 'Community engagement replies'],
      ['06-social-media/05-monthly-analytics.png', 'Monthly performance report']] }
  };
  var modal = document.getElementById('modal');
  var img = document.getElementById('modal-img');
  var cap = document.getElementById('modal-cap');
  var cnt = document.getElementById('modal-count');
  var title = document.getElementById('modal-title');
  var cur = null, idx = 0, opener = null, touchX = null;

  function show() {
    var it = cur.items[idx];
    img.src = DIR + it[0]; img.alt = it[1];
    cap.textContent = it[1];
    cnt.textContent = (idx + 1) + ' / ' + cur.items.length;
  }
  function open(key, from) {
    cur = data[key]; if (!cur) return;
    idx = 0; opener = from; title.textContent = cur.title; show();
    modal.hidden = false; document.body.style.overflow = 'hidden';
    document.getElementById('modal-close').focus();
    if (window.Robots) window.Robots.sound.chirp();
  }
  function close() {
    modal.hidden = true; document.body.style.overflow = '';
    if (opener) opener.focus();
  }
  function go(d) { idx = (idx + d + cur.items.length) % cur.items.length; show(); }
  document.querySelectorAll('.svc').forEach(function (b) { b.addEventListener('click', function () { open(b.dataset.service, b); }); });
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('m-prev').addEventListener('click', function () { go(-1); });
  document.getElementById('m-next').addEventListener('click', function () { go(1); });
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'Tab') {
      var f = modal.querySelectorAll('button'); var first = f[0], lastB = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastB.focus(); }
      else if (!e.shiftKey && document.activeElement === lastB) { e.preventDefault(); first.focus(); }
    }
  });
  img.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  img.addEventListener('touchend', function (e) {
    if (touchX == null) return; var dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  });
})();
