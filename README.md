# Gerald John — Virtual Assistant & Automation Specialist Portfolio

A single-page portfolio site for a Virtual Assistant & Automation Specialist, built in plain HTML, CSS and JavaScript.

## Files
- `index.html` — the whole site: markup, styles (in `<style>`) and scripts (in `<script>`)
- `profile.jpg` — portrait used in the About section
- `VA_Portfolio_Screenshots/` — work samples shown in each service card's gallery/carousel
- `.github/workflows/static.yml` — deploys the site to GitHub Pages on every push to `main`

## Run it
Open `index.html` in a browser. No build step. The 3D background loads Three.js from cdnjs; if it can't
load (offline, blocked) or the visitor prefers reduced motion, the page still works without it.

## Customize
- **Contact links:** email, "Book a call" (opens a pre-filled email), LinkedIn and Upwork live in the `#contact` section.
- **Developer portfolio links:** the hero switch, nav, `#development` section and footer link to https://geraldjohnt.github.io/web-developer-portfolio/.
- **Automations:** the example workflows are the `.auto-card` blocks in the `#automations` section.
- **Testimonials:** client quotes in `#testimonials` are shown without client names, attributed by industry only.
- **Work samples:** each service card has three thumbnails in the HTML, and the full set lives in the
  `galleryData` object in the script. Keep the two in sync when adding or renaming screenshots.
- **Contact form:** `contact-form.js` posts to the Google Apps Script web app set in `data-endpoint` on `#contact-form`.
  The script and setup guide are in `apps-script/` (see `apps-script/SETUP.md`). With no endpoint set, the form opens a pre-filled email.
- **CV:** `cv/Gerald-John-Tangpos-VA-CV.pdf` and `.docx`, exported from the CV doc.

## Version 2 (preview)
`version2.html` is a redesign that sits next to the live `index.html` without replacing it. Open it at
https://geraldjohnt.github.io/va-portfolio/version2.html once deployed.
- The page starts completely blank (no faded text or outlines). A crew of small robots (30 on desktop, 18 on phones) builds it piece by piece:
  one robot traces each card or panel frame, one robot writes each line of text, and crews tow some hero panels in
  from the screen edges. Nothing renders until its robot has arrived, and the reveal moves at that robot's pace.
- Robots wait in a charging dock (a spire in the right margin on wide screens, a bay or a slim rail at the bottom on
  smaller ones). Only docked robots take new jobs; a robot that finishes flies back and recharges first.
- A back-to-top button appears once the visitor reaches the bottom part of the page.
- Files: `v2/v2.css` (styles), `v2/robots.js` (robot crew, dock, build tasks and synthesized sounds), `v2/v2.js` (menu,
  counters, work-sample viewer) and `v2/gerald-cutout.webp` (portrait on a transparent background).
- Hero timing comes from `data-t` (start, ms) and `data-d` (duration, ms) on each `[data-build]` element. `data-dir`
  sets the build direction (`x`, `y` or `up`), `data-mode` sets a tow-in (`pull-left`, `pull-right`, `pull-bottom`)
  and `data-crew` sets how many robots work on it.
- Sound is synthesized with the Web Audio API (no audio files). Browsers only allow it after the first click, tap or
  key press, and visitors can switch it off with the nav button.
- Visitors with reduced motion turned on, and browsers without JavaScript, get the finished page with no robots.
