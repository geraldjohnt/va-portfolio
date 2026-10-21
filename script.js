/* =========================================================
   Mira Voss Portfolio — script.js
   No external animation library: the parallax effect below is
   built with a single scroll listener that reads each element's
   `data-speed` attribute and offsets it with a CSS transform.
   Lower speed = moves less = reads as "further away".
   ========================================================= */

document.getElementById('year').textContent = new Date().getFullYear();

/* ---------------------------------------------------------
   1. CSS parallax engine (ambient gradient layers + skill/about cards)
   Each [data-speed] element's offset is based on its own position
   relative to the viewport center, not raw page scrollY — that
   keeps the motion visible and bounded to whenever the element is
   actually on screen, instead of drifting hundreds of pixels off
   by the time you've scrolled past a long page.
   --------------------------------------------------------- */
(function parallaxEngine() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // respect user preference: skip motion entirely

  const targets = Array.from(document.querySelectorAll('[data-speed]'));

  const depthLayers = [
    { el: document.querySelector('.layer-a'), speed: 0.05 },
    { el: document.querySelector('.layer-c'), speed: 0.02 },
  ];

  let ticking = false;

  function update() {
    const viewportCenter = window.innerHeight / 2;

    targets.forEach((el) => {
      const speed = parseFloat(el.dataset.speed) || 0.15;
      const rect = el.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;
      const distanceFromCenter = viewportCenter - elCenter; // positive when below center
      el.style.transform = `translate3d(0, ${distanceFromCenter * speed}px, 0)`;
    });

    const scrollY = window.scrollY;
    depthLayers.forEach(({ el, speed }) => {
      if (!el) return;
      el.style.transform = `translate3d(0, ${scrollY * speed}px, 0)`;
    });

    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();

/* ---------------------------------------------------------
   1a. Sticky header — solid backdrop once the page has scrolled
   --------------------------------------------------------- */
(function stickyHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  function update() {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
})();

/* ---------------------------------------------------------
   1b. Three.js scene — the smooth 3D scroll transition.
   A field of teal wireframe forms recedes into the distance;
   the camera dollies forward through it as the page scrolls.
   Camera position is *lerped* toward its scroll-derived target
   every frame rather than snapped to it, which is what gives
   the transition its smooth, slightly trailing feel.
   --------------------------------------------------------- */
(function webglScene() {
  const canvas = document.getElementById('webgl-bg');
  if (!canvas || typeof THREE === 'undefined') return; // fail gracefully if THREE didn't load

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (err) {
    canvas.style.display = 'none'; // no WebGL support — CSS depth-field still carries the page
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x121212, 0.028);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 0, 6);

  // Ambient + a single soft teal point light so the wireframes catch a highlight
  scene.add(new THREE.AmbientLight(0x808080, 0.6));
  const light = new THREE.PointLight(0x00b3b3, 1.4, 120);
  light.position.set(0, 10, 10);
  scene.add(light);

  // Build a tunnel of wireframe forms scattered along Z, spiraling slightly
  // outward, so moving the camera forward reads as travelling through depth.
  const forms = [];
  const FORM_COUNT = 46;
  const TUNNEL_LENGTH = 340;
  const tealMat = new THREE.MeshBasicMaterial({ color: 0x00b3b3, wireframe: true, transparent: true, opacity: 0.35 });
  const dimMat = new THREE.MeshBasicMaterial({ color: 0x008080, wireframe: true, transparent: true, opacity: 0.18 });

  for (let i = 0; i < FORM_COUNT; i++) {
    const geometry =
      i % 3 === 0
        ? new THREE.IcosahedronGeometry(1 + Math.random() * 1.4, 0)
        : i % 3 === 1
        ? new THREE.OctahedronGeometry(0.9 + Math.random() * 1.2, 0)
        : new THREE.TorusGeometry(1 + Math.random(), 0.28, 6, 10);

    const mesh = new THREE.Mesh(geometry, i % 2 === 0 ? tealMat : dimMat);

    const angle = (i / FORM_COUNT) * Math.PI * 8;
    const radius = 3 + (i / FORM_COUNT) * 6;
    mesh.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.6,
      -((i / FORM_COUNT) * TUNNEL_LENGTH)
    );
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    mesh.userData.spin = 0.05 + Math.random() * 0.15;

    scene.add(mesh);
    forms.push(mesh);
  }

  // --- Scroll -> camera target mapping ---
  let cameraTargetZ = camera.position.z;
  let cameraCurrentZ = camera.position.z;
  let targetRotY = 0;
  let currentRotY = 0;

  function docScrollableHeight() {
    return Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  }

  function onScroll() {
    const progress = window.scrollY / docScrollableHeight(); // 0 -> 1 across the whole page
    cameraTargetZ = 6 - progress * (TUNNEL_LENGTH - 20); // dolly from the tunnel mouth toward its end
    targetRotY = progress * 0.6; // gentle yaw for a cinematic drift, not a spin
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  onScroll();

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Lerp toward the scroll targets — this damping is what makes the
    // transition feel smooth rather than tied 1:1 to scroll input.
    cameraCurrentZ += (cameraTargetZ - cameraCurrentZ) * 0.06;
    currentRotY += (targetRotY - currentRotY) * 0.06;
    camera.position.z = cameraCurrentZ;
    camera.rotation.y = currentRotY;

    forms.forEach((mesh) => {
      mesh.rotation.x += mesh.userData.spin * delta;
      mesh.rotation.y += mesh.userData.spin * delta * 0.6;
    });

    renderer.render(scene, camera);
  }

  if (reduceMotion) {
    // Respect reduced-motion: render one static frame, no continuous loop.
    renderer.render(scene, camera);
  } else {
    animate();
  }
})();

/* ---------------------------------------------------------
   2. Mobile nav toggle
   --------------------------------------------------------- */
(function mobileNav() {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navMobile');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

/* ---------------------------------------------------------
   3. Project gallery — data-driven
   Each project object needs: thumbnail (any CSS gradient / image
   URL works), name, description. Swap the `thumbnail` values for
   real image paths when you have final assets.
   --------------------------------------------------------- */
const projects = [
  {
    name: 'Strata',
    description: 'A scroll-driven case-study site where each project unfolds as a receding stack of translucent planes.',
    thumbnail: 'linear-gradient(135deg, #008080, #00303080)',
  },
  {
    name: 'Faultline',
    description: 'An interactive geology explainer using layered SVG terrain that shifts perspective as you scroll.',
    thumbnail: 'linear-gradient(135deg, #1f1f1f, #008080)',
  },
  {
    name: 'Aperture',
    description: 'A photography studio site with a parallax lightbox — images rack focus as they enter the viewport.',
    thumbnail: 'linear-gradient(135deg, #004d4d, #00b3b3)',
  },
  {
    name: 'Wayfinder',
    description: 'An isometric product tour for a logistics dashboard, built entirely from CSS 3D transforms.',
    thumbnail: 'linear-gradient(135deg, #262626, #005f5f)',
  },
  {
    name: 'Undertow',
    description: 'A single-page agency site where the hero scene is a slow-drifting ocean-depth gradient field.',
    thumbnail: 'linear-gradient(135deg, #008080, #121212)',
  },
  {
    name: 'Glasshouse',
    description: 'A minimal architecture portfolio using stacked glass-panel cards with subtle depth on hover.',
    thumbnail: 'linear-gradient(135deg, #1a1a1a, #00807040)',
  },
];

function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  const frag = document.createDocumentFragment();

  projects.forEach((project, i) => {
    const card = document.createElement('article');
    card.className = 'project-card reveal';
    card.dataset.revealIndex = i % 3; // stagger by column, not the whole list

    const thumb = document.createElement('div');
    thumb.className = 'project-card__thumb';
    thumb.style.background = project.thumbnail;
    thumb.setAttribute('role', 'img');
    thumb.setAttribute('aria-label', `${project.name} thumbnail`);

    const body = document.createElement('div');
    body.className = 'project-card__body';

    const title = document.createElement('h3');
    title.textContent = project.name;

    const desc = document.createElement('p');
    desc.textContent = project.description;

    body.appendChild(title);
    body.appendChild(desc);
    card.appendChild(thumb);
    card.appendChild(body);
    frag.appendChild(card);
  });

  grid.appendChild(frag);
}

renderGallery();

/* ---------------------------------------------------------
   3b. Scroll reveal — fades + rises each .reveal element into
   place the first time it enters the viewport. Runs after
   renderGallery() so the dynamically-built project cards are
   already in the DOM and get observed too. This is the
   "elements showing up as you scroll" effect.
   --------------------------------------------------------- */
(function initScrollReveal() {
  const items = Array.from(document.querySelectorAll('.reveal'));
  if (!items.length) return;

  items.forEach((el) => {
    const index = el.dataset.revealIndex || 0;
    el.style.setProperty('--reveal-index', index);
  });

  if (!('IntersectionObserver' in window)) {
    // Progressive enhancement fallback: just show everything.
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
  );

  items.forEach((el) => observer.observe(el));
})();

/* ---------------------------------------------------------
   4. Contact form — basic client-side validation
   No AJAX endpoint exists yet, so on a valid submission we just
   show a confirmation message and reset the form. Wire the fetch()
   call (commented below) up to your own backend/email service.
   --------------------------------------------------------- */
(function contactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const status = document.getElementById('formStatus');

  const validators = {
    name: (value) => value.trim().length > 0 || 'Please enter your name.',
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || 'Please enter a valid email address.',
    message: (value) => value.trim().length > 0 || 'Please enter a message.',
  };

  function setFieldError(fieldName, message) {
    const field = form.querySelector(`[name="${fieldName}"]`);
    const errorEl = form.querySelector(`[data-error-for="${fieldName}"]`);
    const wrapper = field.closest('.field');

    if (message) {
      wrapper.classList.add('has-error');
      errorEl.textContent = message;
    } else {
      wrapper.classList.remove('has-error');
      errorEl.textContent = '';
    }
  }

  function validateForm() {
    let isValid = true;
    Object.entries(validators).forEach(([fieldName, validate]) => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      const result = validate(field.value);
      if (result !== true) {
        setFieldError(fieldName, result);
        isValid = false;
      } else {
        setFieldError(fieldName, null);
      }
    });
    return isValid;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    status.textContent = '';

    if (!validateForm()) {
      status.style.color = '#e08a8a';
      status.textContent = 'Please fix the highlighted fields.';
      return;
    }

    // --- Real submission would go here, e.g.: ---
    // fetch('/api/contact', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(Object.fromEntries(new FormData(form))),
    // })
    //   .then((res) => { if (!res.ok) throw new Error('Request failed'); })
    //   .catch(() => { status.textContent = 'Something went wrong. Please try again.'; });

    status.style.color = 'var(--teal-bright)';
    status.textContent = `Thanks — I'll get back to you soon.`;
    form.reset();
  });

  // Clear an individual field's error as the user types
  form.querySelectorAll('input, textarea').forEach((field) => {
    field.addEventListener('input', () => setFieldError(field.name, null));
  });
})();