# Gerald John — General Virtual Assistant Portfolio

A single-page portfolio site for a General Virtual Assistant, built in plain HTML, CSS and JavaScript.

## Files
- `index.html` — the whole site: markup, styles (in `<style>`) and scripts (in `<script>`)
- `profile.jpg` — portrait used in the About section
- `VA_Portfolio_Screenshots/` — work samples shown in each service card's gallery/carousel
- `.github/workflows/static.yml` — deploys the site to GitHub Pages on every push to `main`

## Run it
Open `index.html` in a browser. No build step. The 3D background loads Three.js from cdnjs; if it can't
load (offline, blocked) or the visitor prefers reduced motion, the page still works without it.

## Customize
- **Contact links:** update the `mailto:` address and the `Book a call`, LinkedIn, Upwork and Instagram links in the `#contact` section.
- **Testimonials:** replace the placeholder quotes in `#testimonials` with real client feedback.
- **Work samples:** each service card has three thumbnails in the HTML, and the full set lives in the
  `galleryData` object in the script. Keep the two in sync when adding or renaming screenshots.
