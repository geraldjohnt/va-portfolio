# Mira Voss — Portfolio

A one-page portfolio with a layered 3D parallax scroll, built in plain HTML/CSS/JS (no external animation library required).

## Files
- `index.html` — page structure (hero, about, work, skills, contact, footer)
- `style.css` — design system (dark theme, teal accents, Montserrat/Open Sans, responsive breakpoints)
- `script.js` — scroll-driven parallax engine, gallery rendering, contact form validation

## Run it
Just open `index.html` in a browser — no build step, no dependencies.

## Customize
- Edit the `projects` array at the top of `script.js` to swap in real project thumbnails/links.
- Adjust `data-speed` attributes in `index.html` to change how fast each layer moves.
- Wire up the commented `fetch()` call in `script.js`'s contact form handler to a real backend/email service.

## Why no ScrollMagic/LocomotiveScroll
The parallax is done with a single `scroll` listener + `requestAnimationFrame` reading each element's
`data-speed`, which keeps the site dependency-free and avoids library version/CDN issues. It's swappable
for LocomotiveScroll later if you want smoothed/inertia scrolling — the `data-speed` markup is compatible
with that migration.
