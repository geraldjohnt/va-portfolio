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
- **Testimonials:** replace the placeholder quotes in `#testimonials` with real client feedback.
- **Work samples:** each service card has three thumbnails in the HTML, and the full set lives in the
  `galleryData` object in the script. Keep the two in sync when adding or renaming screenshots.
- **Contact form:** `contact-form.js` posts to the Google Apps Script web app set in `data-endpoint` on `#contact-form`.
  The script and setup guide are in `apps-script/` (see `apps-script/SETUP.md`). With no endpoint set, the form opens a pre-filled email.
