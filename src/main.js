import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

const forceMotion = new URLSearchParams(window.location.search).get('motion') === '1';
const prefersReducedMotion =
  !forceMotion && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

if (forceMotion) {
  document.documentElement.classList.add('force-motion');
}
if (!prefersReducedMotion) {
  document.documentElement.classList.add('has-motion');
}

/* ==========================================================================
   SHARED HELPERS — NAV INDICATOR & TREEWALKER QUOTE SPLITTER
   ========================================================================== */

function positionNavIndicator(activeLink) {
  const nav = document.querySelector('[data-nav]');
  const indicator = document.querySelector('[data-nav-indicator]');
  if (!nav || !indicator || !activeLink) return;

  const navRect = nav.getBoundingClientRect();
  const linkRect = activeLink.getBoundingClientRect();
  if (navRect.width === 0 || linkRect.width === 0) return;

  const offsetLeft = linkRect.left - navRect.left;
  indicator.style.width = `${linkRect.width}px`;
  indicator.style.transform = `translate3d(${offsetLeft}px, 0, 0)`;
}

function setActiveNav(sectionId) {
  const links = document.querySelectorAll('[data-nav-link]');
  let activeEl = null;
  links.forEach((link) => {
    const isMatch = link.dataset.navLink === sectionId;
    link.classList.toggle('is-active', isMatch);
    if (isMatch) activeEl = link;
  });
  if (activeEl) {
    positionNavIndicator(activeEl);
  }
}

/**
 * Splits quote text into word wrappers (.quote-word) and character spans (.quote-char)
 * while preserving whitespace text nodes so lines wrap naturally at word boundaries.
 */
function splitQuoteIntoChars(quoteEl) {
  if (!quoteEl) return [];

  const walker = document.createTreeWalker(quoteEl, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let current;
  while ((current = walker.nextNode())) {
    if (current.nodeValue && current.nodeValue.trim().length > 0) {
      textNodes.push(current);
    }
  }

  const charSpans = [];
  textNodes.forEach((node) => {
    const tokens = node.nodeValue.split(/(\s+)/);
    const frag = document.createDocumentFragment();
    tokens.forEach((token) => {
      if (!token) return;
      if (/^\s+$/.test(token)) {
        frag.appendChild(document.createTextNode(token));
      } else {
        const wordSpan = document.createElement('span');
        wordSpan.className = 'quote-word';
        for (const ch of Array.from(token)) {
          const charSpan = document.createElement('span');
          charSpan.className = 'quote-char';
          charSpan.textContent = ch;
          wordSpan.appendChild(charSpan);
          charSpans.push(charSpan);
        }
        frag.appendChild(wordSpan);
      }
    });
    node.parentNode.replaceChild(frag, node);
  });

  return charSpans;
}

/* ==========================================================================
   MOBILE MENU & TOUCH ACTIVITY FALLBACK (WORKS IN BOTH MOTION & REDUCED MODES)
   ========================================================================== */

function setupNavigationAndMenu(lenis) {
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const menuClose = document.querySelector('[data-menu-close]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  const mobileLinks = document.querySelectorAll('[data-mobile-link]');
  const mobileWords = document.querySelectorAll('.mobile-menu__word');
  const scrollLinks = document.querySelectorAll('[data-scroll-to]');
  const backToTopBtn = document.querySelector('[data-back-to-top]');

  function scrollToTarget(selector) {
    const target = selector === '#hero' ? 0 : document.querySelector(selector);
    if (target === null) return;
    if (lenis) {
      lenis.scrollTo(target, {
        offset: selector === '#hero' ? 0 : -56,
        duration: 1.5,
        easing: (t) => 1 - Math.pow(1 - t, 4),
      });
    } else if (typeof target === 'number') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      const y = target.getBoundingClientRect().top + window.scrollY - 56;
      window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
    }
  }

  const backgroundShells = [
    document.querySelector('[data-header]'),
    document.getElementById('main-content'),
    document.getElementById('kontak'),
  ].filter(Boolean);

  function setBackgroundInert(isInert) {
    backgroundShells.forEach((el) => {
      el.inert = isInert;
    });
  }

  function openMobileMenu() {
    if (!mobileMenu || !menuToggle) return;
    mobileMenu.hidden = false;
    menuToggle.setAttribute('aria-expanded', 'true');
    setBackgroundInert(true);
    if (lenis) lenis.stop();
    document.body.style.overflow = 'hidden';

    if (!prefersReducedMotion && mobileWords.length) {
      gsap.fromTo(
        mobileWords,
        { yPercent: 155 },
        {
          yPercent: 0,
          duration: 0.78,
          stagger: 0.06,
          ease: 'expo.out',
          overwrite: true,
        }
      );
    }
    if (menuClose) menuClose.focus();
  }

  function closeMobileMenu(restoreFocus = true) {
    if (!mobileMenu || mobileMenu.hidden) return;
    mobileMenu.hidden = true;
    setBackgroundInert(false);
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
      if (restoreFocus) menuToggle.focus();
    }
    document.body.style.overflow = '';
    if (lenis) lenis.start();
  }

  menuToggle?.addEventListener('click', openMobileMenu);
  menuClose?.addEventListener('click', () => closeMobileMenu(true));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu && !mobileMenu.hidden) {
      closeMobileMenu(true);
    }
  });

  mobileLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSel = link.dataset.mobileLink;
      closeMobileMenu(false);
      if (targetSel) scrollToTarget(targetSel);
    });
  });

  scrollLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetSel = link.dataset.scrollTo;
      if (!targetSel) return;
      e.preventDefault();
      scrollToTarget(targetSel);
    });
  });

  backToTopBtn?.addEventListener('click', () => {
    if (lenis) {
      lenis.scrollTo(0, {
        duration: 2.2,
        easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  });

  // Coarse pointer / reduced-motion / keyboard Enter & Space toggle on Activity rows
  const activityRows = document.querySelectorAll('[data-activity-row]');
  function toggleActivityTap(row) {
    const wasTapped = row.classList.contains('is-tapped');
    activityRows.forEach((r) => {
      r.classList.remove('is-tapped');
      r.setAttribute('aria-expanded', 'false');
    });
    if (!wasTapped) {
      row.classList.add('is-tapped');
      row.setAttribute('aria-expanded', 'true');
    }
  }

  activityRows.forEach((row) => {
    row.addEventListener('click', () => {
      if (hasFinePointer && !prefersReducedMotion) return;
      toggleActivityTap(row);
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (hasFinePointer && !prefersReducedMotion) {
          const isExpanded = row.getAttribute('aria-expanded') === 'true';
          activityRows.forEach((r) => r.setAttribute('aria-expanded', 'false'));
          row.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
        } else {
          toggleActivityTap(row);
        }
      }
    });
  });
}

/* ==========================================================================
   REDUCED-MOTION INITIALIZATION (NO LENIS, NO PRELOADER, NO SCRUB/PIN)
   ========================================================================== */

function initReducedMotionMode() {
  setupNavigationAndMenu(null);

  const header = document.querySelector('[data-header]');
  const hero = document.querySelector('[data-hero]');
  const darkSections = document.querySelectorAll('[data-dark-section]');
  const sectionIds = ['profil', 'aktivitas', 'quote', 'galeri', 'kontak'];

  function syncNativeScrollState() {
    if (header && hero) {
      header.classList.toggle('is-visible', window.scrollY > hero.offsetHeight * 0.72);
    }

    let onDarkHeader = false;
    darkSections.forEach((sec) => {
      const r = sec.getBoundingClientRect();
      if (r.top <= 64 && r.bottom >= 64) onDarkHeader = true;
    });
    header?.classList.toggle('is-dark', onDarkHeader);

    const probeY = window.innerHeight * 0.45;
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.top <= probeY && r.bottom >= probeY) {
        setActiveNav(id);
        break;
      }
    }
  }

  syncNativeScrollState();
  positionNavIndicator(document.querySelector('.site-nav__link.is-active'));

  window.addEventListener('scroll', syncNativeScrollState, { passive: true });
  window.addEventListener('resize', () => {
    positionNavIndicator(document.querySelector('.site-nav__link.is-active'));
    syncNativeScrollState();
  });

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      positionNavIndicator(document.querySelector('.site-nav__link.is-active'));
    });
  }
}

/* ==========================================================================
   FULL CINEMATIC MOTION SYSTEM (LENIS + GSAP 3 + SCROLLTRIGGER + SPLITTEXT)
   ========================================================================== */

function initMotionSystem() {
  /* ------------------------------------------------------------------------
     1. LENIS SMOOTH SCROLL (SINGLE SCROLL ENGINE)
     ------------------------------------------------------------------------ */
  const lenis = new Lenis({
    lerp: 0.09,
    smoothWheel: true,
    syncTouch: false,
  });

  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  // Lock scroll during preloader sequence
  lenis.stop();

  setupNavigationAndMenu(lenis);

  /* ------------------------------------------------------------------------
     2. HERO INITIAL POISE & SECTION 0 PRELOADER + 6-COL STAIRCASE WIPE
     ------------------------------------------------------------------------ */
  const preloader = document.querySelector('[data-preloader]');
  const preloaderBox = document.querySelector('[data-preloader-box]');
  const preloaderChars = document.querySelectorAll('.preloader__char');
  const preloaderBar = document.querySelector('[data-preloader-bar]');
  const preloaderCount = document.querySelector('[data-preloader-count]');
  const preloaderCols = document.querySelectorAll('.preloader__col');

  const heroSection = document.querySelector('[data-hero]');
  const heroFrame = document.querySelector('[data-hero-frame]');
  const heroBorder = document.querySelector('[data-hero-border]');
  const heroFigure = document.querySelector('[data-hero-figure]');
  const heroCutout = document.querySelector('[data-hero-cutout]');
  const heroCharsBack = document.querySelectorAll('[data-hero-char]');
  const heroCharsFront = document.querySelectorAll('[data-hero-char-front]');
  const heroWordmarkBack = document.querySelector('[data-hero-wordmark-back]');
  const heroWordmarkFront = document.querySelector('[data-hero-wordmark-front]');
  const heroKatakana = document.querySelector('[data-hero-katakana]');
  const heroCorners = document.querySelectorAll('[data-hero-corner]');
  const heroBarcodeBars = document.querySelectorAll('[data-hero-barcode] span');
  const heroScript = document.querySelector('[data-hero-script]');

  // Pre-promote Hero & Preloader layers on GPU (using opacity instead of visibility:hidden
  // so glyph tiles & decoded PNG bitmap stay resident in VRAM behind the dark curtain)
  gsap.set(preloaderCols, { y: 0, yPercent: 0, force3D: true });
  if (heroBorder) {
    gsap.set(heroBorder, {
      scaleX: 1.036,
      scaleY: 1.048,
      opacity: 0,
      transformOrigin: 'center center',
      force3D: true,
    });
  }
  gsap.set(heroFigure, {
    opacity: 0,
    scale: 1.06,
    transformOrigin: 'bottom center',
    force3D: true,
  });
  gsap.set([heroCharsBack, heroCharsFront], { yPercent: 126, force3D: true });
  gsap.set([heroKatakana, ...heroCorners], { opacity: 0, y: 12, force3D: true });
  gsap.set(heroBarcodeBars, { scaleY: 0, transformOrigin: 'top center', force3D: true });
  gsap.set(heroScript, { clipPath: 'inset(-20% 105% -25% -10%)' });

  function buildHeroEntrance(tl, startAt = 0) {
    // 1) Ghost cutout materializes on the exposed --paper stage
    tl.to(
      heroFigure,
      {
        opacity: 0.35,
        scale: 1.035,
        duration: 0.54,
        ease: 'power2.out',
      },
      startAt
    );

    // 2) 3-layer wordmark rises through mask in exact z1/z3 registration
    tl.to(
      heroCharsBack,
      {
        yPercent: 0,
        duration: 1.08,
        stagger: 0.075,
        ease: 'expo.out',
      },
      startAt + 0.08
    );
    tl.to(
      heroCharsFront,
      {
        yPercent: 0,
        duration: 1.08,
        stagger: 0.075,
        ease: 'expo.out',
      },
      startAt + 0.08
    );

    // 3) Cutout solidifies to 100% while 1px magazine border settles from full-bleed
    tl.to(
      heroFigure,
      {
        opacity: 1,
        scale: 1,
        duration: 0.96,
        ease: 'power3.out',
      },
      startAt + 0.48
    );

    if (heroBorder) {
      tl.to(
        heroBorder,
        {
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          duration: 0.98,
          ease: 'expo.out',
          onComplete: () => {
            lenis.start();
          },
        },
        startAt + 0.48
      );
    } else {
      tl.call(() => lenis.start(), [], startAt + 0.9);
    }

    // 4) Katakana, 4 editorial corners, and hanging barcode rules
    tl.to(
      [heroKatakana, ...heroCorners],
      {
        opacity: 1,
        y: 0,
        duration: 0.84,
        stagger: 0.045,
        ease: 'expo.out',
      },
      startAt + 0.68
    );
    tl.to(
      heroBarcodeBars,
      {
        scaleY: 1,
        duration: 0.78,
        stagger: 0.042,
        ease: 'expo.out',
      },
      startAt + 0.72
    );

    // 5) Handwritten "Algorithm" script wipe (bleed inset prevents swash/descender clipping, then clears clip-path)
    tl.to(
      heroScript,
      {
        clipPath: 'inset(-20% -10% -25% -10%)',
        duration: 1.15,
        ease: 'power2.inOut',
        clearProps: 'clipPath',
      },
      startAt + 0.84
    );

    return tl;
  }

  function runPreloader() {
    if (!preloader) {
      const directTl = gsap.timeline();
      buildHeroEntrance(directTl, 0);
      return;
    }

    // Masked Katakana character entrance
    gsap.fromTo(
      preloaderChars,
      { yPercent: 115 },
      {
        yPercent: 0,
        duration: 0.82,
        stagger: 0.095,
        ease: 'expo.out',
        delay: 0.08,
        force3D: true,
      }
    );

    const setBarScale = preloaderBar ? gsap.quickSetter(preloaderBar, 'scaleX') : null;
    let lastRenderedInt = -1;

    const renderProgress = (val) => {
      const clamped = Math.min(100, Math.max(0, val));
      const rounded = Math.round(clamped);
      if (preloaderCount && rounded !== lastRenderedInt) {
        lastRenderedInt = rounded;
        preloaderCount.textContent = String(rounded).padStart(3, '0');
      }
      setBarScale?.(clamped / 100);
    };

    const waitFrames = (count = 2) =>
      new Promise((resolve) => {
        const next = (left) =>
          left <= 0 ? resolve() : requestAnimationFrame(() => next(left - 1));
        next(count);
      });

    // Pre-decode fonts + hero PNG + run ScrollTrigger layout ONCE behind the closed curtain
    // so zero layout/decode work ever competes with 90 -> 100 -> wipe -> hero
    const fontsReady = document.fonts?.ready
      ? document.fonts.ready.catch(() => {})
      : Promise.resolve();

    const heroBitmapReady = (async () => {
      if (!heroCutout) return;
      if (!heroCutout.complete) {
        await new Promise((resolve) => {
          heroCutout.addEventListener('load', resolve, { once: true });
          heroCutout.addEventListener('error', resolve, { once: true });
        });
      }
      if (typeof heroCutout.decode === 'function') {
        await heroCutout.decode().catch(() => {});
      }
    })();

    let assetsReady = false;
    Promise.race([
      Promise.all([fontsReady, heroBitmapReady]).then(async () => {
        positionNavIndicator(document.querySelector('.site-nav__link.is-active'));
        ScrollTrigger.refresh();
        await waitFrames(2);
      }),
      new Promise((resolve) => setTimeout(resolve, 3200)),
    ]).then(() => {
      assetsReady = true;
    });

    function launchExitAndHero() {
      const masterTl = gsap.timeline();

      // 1) Immediate crisp dissolve of Katakana + progress line (zero power2.in stall)
      if (preloaderBox) {
        masterTl.to(
          preloaderBox,
          {
            opacity: 0,
            y: -12,
            duration: 0.34,
            ease: 'power2.out',
            force3D: true,
          },
          0.02
        );
      }

      // 2) 6 dark curtain columns lift in a staircase, directly exposing the live Hero underneath
      masterTl.to(
        preloaderCols,
        {
          y: 0,
          yPercent: -101,
          duration: 0.76,
          stagger: 0.058,
          ease: 'power3.inOut',
          force3D: true,
          onComplete: () => {
            preloader.style.display = 'none';
            preloader.setAttribute('hidden', '');
          },
        },
        0.16
      );

      // 3) Overlap Hero entrance mid-wipe right as left columns expose --paper (zero blank gap)
      buildHeroEntrance(masterTl, 0.34);
    }

    // Continuous C¹-smooth velocity ticker: never freezes or jerks at 94%
    let currentVal = 0;
    let currentSpeed = 14;
    let completed = false;
    const startTime = performance.now();

    const tickCounter = (_, deltaMs) => {
      if (completed) return;
      const dt = Math.min(0.05, Math.max(0.001, (deltaMs || 16.67) / 1000));
      const elapsed = (performance.now() - startTime) / 1000;

      // Smooth 0.30s ease-in, then poised 54%/s editorial momentum (~1.92s 0 -> 100)
      const ramp = Math.min(1, elapsed / 0.3);
      const steadySpeed = 16 + 38 * (ramp * ramp * (3 - 2 * ramp));
      let targetSpeed = steadySpeed;

      if (!assetsReady && currentVal > 80) {
        // Only if slow network is still loading assets: glide asymptotically without freezing
        const headroom = Math.max(1.2, 98.2 - currentVal);
        targetSpeed = Math.min(steadySpeed, headroom * 1.85);
      } else if (assetsReady && currentVal > 80) {
        targetSpeed = steadySpeed;
      }

      currentSpeed += (targetSpeed - currentSpeed) * Math.min(1, dt * 12);
      currentVal = Math.min(100, currentVal + currentSpeed * dt);
      renderProgress(currentVal);

      if (currentVal >= 100 && assetsReady) {
        completed = true;
        gsap.ticker.remove(tickCounter);
        renderProgress(100);
        launchExitAndHero();
      }
    };

    gsap.ticker.add(tickCounter);
  }

  /* ------------------------------------------------------------------------
     3. HERO SCROLL EXIT SCRUB & DESKTOP POINTER PARALLAX
     ------------------------------------------------------------------------ */
  if (heroSection && heroFrame) {
    gsap.fromTo(
      heroFrame,
      { rotation: 0, scale: 1, opacity: 1 },
      {
        rotation: -2,
        scale: 0.94,
        opacity: 0.32,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: {
          trigger: heroSection,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      }
    );
  }

  if (hasFinePointer && heroSection && heroCutout && heroWordmarkBack && heroWordmarkFront) {
    const cutX = gsap.quickTo(heroCutout, 'x', { duration: 0.75, ease: 'power3.out' });
    const cutY = gsap.quickTo(heroCutout, 'y', { duration: 0.75, ease: 'power3.out' });
    const backX = gsap.quickTo(heroWordmarkBack, 'x', { duration: 0.85, ease: 'power3.out' });
    const backY = gsap.quickTo(heroWordmarkBack, 'y', { duration: 0.85, ease: 'power3.out' });
    const frontX = gsap.quickTo(heroWordmarkFront, 'x', { duration: 0.85, ease: 'power3.out' });
    const frontY = gsap.quickTo(heroWordmarkFront, 'y', { duration: 0.85, ease: 'power3.out' });

    heroSection.addEventListener('pointermove', (e) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      cutX(nx * 10);
      cutY(ny * 6);
      backX(nx * -4);
      backY(ny * -2.5);
      frontX(nx * -4);
      frontY(ny * -2.5);
    });

    heroSection.addEventListener('pointerleave', () => {
      cutX(0);
      cutY(0);
      backX(0);
      backY(0);
      frontX(0);
      frontY(0);
    });
  }

  /* ------------------------------------------------------------------------
     4. SECTION 2 — TILTED MARQUEE (INFINITE LOOP + VELOCITY & DIRECTION)
     ------------------------------------------------------------------------ */
  const marqueeTrack = document.querySelector('[data-marquee-track]');
  if (marqueeTrack) {
    const marqueeTween = gsap.to(marqueeTrack, {
      xPercent: -50,
      duration: 28,
      ease: 'none',
      repeat: -1,
    });
    // Advance playhead 400 cycles so reverse timeScale wraps seamlessly forever
    marqueeTween.totalTime(28 * 400);

    let currentDir = 1;
    let settleCall = null;

    lenis.on('scroll', ({ velocity, direction }) => {
      if (direction === 1 || direction === -1) {
        currentDir = direction;
      }
      const speedBoost = Math.min(3.2, Math.abs(velocity) * 0.065);
      gsap.to(marqueeTween, {
        timeScale: currentDir * (1 + speedBoost),
        duration: 0.25,
        ease: 'power2.out',
        overwrite: true,
      });

      if (settleCall) settleCall.kill();
      settleCall = gsap.delayedCall(0.14, () => {
        gsap.to(marqueeTween, {
          timeScale: currentDir,
          duration: 0.8,
          ease: 'power3.out',
          overwrite: true,
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     5. GENERAL EDITORIAL REVEALS (MASKED LINES, SPLITTEXT WORDS, 1PX RULES, IMAGES)
     ------------------------------------------------------------------------ */

  // 5a. Masked display lines (grouped per heading / container; yPercent: 205 clears calligraphic bleed padding)
  const headingGroups = document.querySelectorAll(
    '.profil__heading, .aktivitas__heading, .galeri__heading, .kontak__heading'
  );
  headingGroups.forEach((heading) => {
    const lines = heading.querySelectorAll('[data-mask-line]');
    if (!lines.length) return;
    gsap.set(lines, { yPercent: 205 });
    ScrollTrigger.create({
      trigger: heading,
      start: 'top 86%',
      once: true,
      onEnter: () => {
        gsap.to(lines, {
          yPercent: 0,
          duration: 1.05,
          stagger: 0.08,
          ease: 'expo.out',
        });
      },
    });
  });

  // Activity row titles
  document.querySelectorAll('.aktivitas__name [data-mask-line]').forEach((line) => {
    gsap.set(line, { yPercent: 205 });
    ScrollTrigger.create({
      trigger: line.closest('.aktivitas__row') || line,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.to(line, {
          yPercent: 0,
          duration: 0.98,
          ease: 'expo.out',
        });
      },
    });
  });

  // Vertical Katakana spine & auxiliary reveal items
  document.querySelectorAll('[data-reveal-item]').forEach((item) => {
    gsap.set(item, { autoAlpha: 0, y: 18 });
    ScrollTrigger.create({
      trigger: item,
      start: 'top 86%',
      once: true,
      onEnter: () => {
        gsap.to(item, {
          autoAlpha: 1,
          y: 0,
          duration: 1.0,
          ease: 'expo.out',
        });
      },
    });
  });

  // 5b. Masked paragraph word reveals via GSAP SplitText (tag: 'span' + aria: 'none' keeps valid <p> DOM & WAI-ARIA)
  document.querySelectorAll('[data-mask-words]').forEach((paragraph) => {
    const split = SplitText.create(paragraph, {
      type: 'words',
      mask: 'words',
      tag: 'span',
      aria: 'none',
      wordsClass: 'split-word',
    });
    gsap.set(split.words, { yPercent: 120 });
    ScrollTrigger.create({
      trigger: paragraph,
      start: 'top 87%',
      once: true,
      onEnter: () => {
        gsap.to(split.words, {
          yPercent: 0,
          duration: 0.95,
          stagger: 0.016,
          ease: 'expo.out',
        });
      },
    });
  });

  // 5c. 1px Hairline rules (eyebrows + activity dividers + staggered 2x2 profile specs)
  const specsGrid = document.querySelector('[data-specs]');
  if (specsGrid) {
    const specLines = specsGrid.querySelectorAll('[data-line]');
    const specVals = specsGrid.querySelectorAll('[data-spec-val]');
    gsap.set(specLines, { scaleX: 0, transformOrigin: 'left center' });
    gsap.set(specVals, { autoAlpha: 0, y: 14 });

    ScrollTrigger.create({
      trigger: specsGrid,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to(specLines, {
          scaleX: 1,
          duration: 1.0,
          stagger: 0.09,
          ease: 'power4.out',
        });
        gsap.to(specVals, {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.09,
          delay: 0.12,
          ease: 'expo.out',
        });
      },
    });
  }

  document.querySelectorAll('[data-line]').forEach((line) => {
    if (specsGrid && specsGrid.contains(line)) return;
    gsap.set(line, { scaleX: 0, transformOrigin: 'left center' });
    ScrollTrigger.create({
      trigger: line,
      start: 'top 90%',
      once: true,
      onEnter: () => {
        gsap.to(line, {
          scaleX: 1,
          duration: 1.0,
          ease: 'power4.out',
        });
      },
    });
  });

  // 5d. Profile Portrait Clip-Path Wipe + Scrubbed Vertical Parallax + Quote Callout
  const profileFigure = document.querySelector('[data-image-reveal]');
  const profileImg = document.querySelector('[data-parallax-img]');
  if (profileFigure) {
    gsap.set(profileFigure, { clipPath: 'inset(100% 0 0 0)' });
    if (profileImg) gsap.set(profileImg, { scale: 1.15 });

    ScrollTrigger.create({
      trigger: profileFigure,
      start: 'top 84%',
      once: true,
      onEnter: () => {
        gsap.to(profileFigure, {
          clipPath: 'inset(0% 0 0 0)',
          duration: 1.2,
          ease: 'power4.inOut',
        });
        if (profileImg) {
          gsap.to(profileImg, {
            scale: 1,
            duration: 1.35,
            ease: 'expo.out',
          });
        }
      },
    });
  }

  if (profileFigure && profileImg) {
    gsap.fromTo(
      profileImg,
      { yPercent: -6 },
      {
        yPercent: 6,
        ease: 'none',
        scrollTrigger: {
          trigger: profileFigure,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      }
    );
  }

  const profileQuote = document.querySelector('[data-reveal-quote]');
  if (profileQuote) {
    const rule = profileQuote.querySelector('.profil__quote-rule');
    const body = profileQuote.querySelector('.profil__quote-body');
    if (rule) gsap.set(rule, { scaleY: 0, transformOrigin: 'top center' });
    if (body) gsap.set(body, { autoAlpha: 0, y: 14 });

    ScrollTrigger.create({
      trigger: profileQuote,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        if (rule) gsap.to(rule, { scaleY: 1, duration: 0.95, ease: 'power4.out' });
        if (body) gsap.to(body, { autoAlpha: 1, y: 0, duration: 0.95, delay: 0.12, ease: 'expo.out' });
      },
    });
  }

  /* ------------------------------------------------------------------------
     6. SECTION 4 — 02 AKTIVITAS FLOATING POINTER PREVIEW (DESKTOP)
     ------------------------------------------------------------------------ */
  const activityList = document.querySelector('[data-activity-list]');
  const activityRows = document.querySelectorAll('[data-activity-row]');
  const activityFloat = document.querySelector('[data-activity-float]');
  const activityFloatInner = document.querySelector('[data-activity-float-inner]');
  const floatImgs = document.querySelectorAll('[data-float-img]');

  if (hasFinePointer && activityList && activityFloat && activityFloatInner) {
    gsap.set(activityFloat, { xPercent: -50, yPercent: -50, scale: 0.6, autoAlpha: 0 });

    const floatX = gsap.quickTo(activityFloat, 'x', { duration: 0.5, ease: 'power3.out' });
    const floatY = gsap.quickTo(activityFloat, 'y', { duration: 0.5, ease: 'power3.out' });
    const floatRot = gsap.quickTo(activityFloatInner, 'rotation', {
      duration: 0.45,
      ease: 'power3.out',
    });

    let lastClientX = null;
    let tiltResetCall = null;

    activityList.addEventListener('pointerenter', (e) => {
      lastClientX = e.clientX;
      gsap.set(activityFloat, { x: e.clientX + 26, y: e.clientY - 10 });
      activityList.classList.add('has-hover');
      gsap.to(activityFloat, {
        autoAlpha: 1,
        scale: 1,
        duration: 0.42,
        ease: 'expo.out',
        overwrite: 'auto',
      });
    });

    activityList.addEventListener('pointermove', (e) => {
      floatX(e.clientX + 26);
      floatY(e.clientY - 10);

      if (lastClientX !== null) {
        const dx = e.clientX - lastClientX;
        const tilt = Math.max(-4, Math.min(4, dx * 0.22));
        floatRot(tilt);
      }
      lastClientX = e.clientX;

      if (tiltResetCall) tiltResetCall.kill();
      tiltResetCall = gsap.delayedCall(0.1, () => floatRot(0));
    });

    activityList.addEventListener('pointerleave', () => {
      activityList.classList.remove('has-hover');
      activityRows.forEach((r) => r.classList.remove('is-hovered'));
      floatRot(0);
      gsap.to(activityFloat, {
        autoAlpha: 0,
        scale: 0.6,
        duration: 0.35,
        ease: 'power3.inOut',
        overwrite: 'auto',
      });
    });

    activityRows.forEach((row) => {
      const activateRow = () => {
        const idx = row.dataset.activityRow;
        activityRows.forEach((r) => {
          const active = r === row;
          r.classList.toggle('is-hovered', active);
          r.setAttribute('aria-expanded', active ? 'true' : 'false');
        });
        floatImgs.forEach((img) => {
          img.classList.toggle('is-active', img.dataset.floatImg === idx);
        });
      };

      row.addEventListener('pointerenter', activateRow);

      row.addEventListener('focusin', () => {
        activateRow();
        activityList.classList.add('has-hover');
        const r = row.getBoundingClientRect();
        gsap.set(activityFloat, { x: r.left + r.width * 0.56, y: r.top + r.height * 0.5 });
        gsap.to(activityFloat, {
          autoAlpha: 1,
          scale: 1,
          duration: 0.4,
          ease: 'expo.out',
          overwrite: 'auto',
        });
      });

      row.addEventListener('focusout', () => {
        row.classList.remove('is-hovered');
        row.setAttribute('aria-expanded', 'false');
        if (!activityList.matches(':hover') && !activityList.contains(document.activeElement)) {
          activityList.classList.remove('has-hover');
          gsap.to(activityFloat, {
            autoAlpha: 0,
            scale: 0.6,
            duration: 0.32,
            ease: 'power3.inOut',
            overwrite: 'auto',
          });
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     7. SECTION 5 — 03 QUOTE SCROLL-SCRUBBED CHARACTER REVEAL & HANDWRITING SIGN
     ------------------------------------------------------------------------ */
  const quoteSection = document.getElementById('quote');
  const quoteText = document.querySelector('[data-scrub-quote]');
  const quoteSign = document.querySelector('.quote-section__sign');

  if (quoteSection && quoteText) {
    const chars = splitQuoteIntoChars(quoteText);
    if (chars.length) {
      gsap.set(chars, { opacity: 0.14 });

      const quoteTl = gsap.timeline({
        scrollTrigger: {
          trigger: quoteSection,
          start: 'top 62%',
          end: 'top -10%',
          scrub: 0.65,
        },
      });

      quoteTl.to(chars, {
        opacity: 1,
        duration: 0.16,
        stagger: 0.04,
        ease: 'none',
      });
    }

    if (quoteSign) {
      gsap.set(quoteSign, { '--sign-wipe': '0%' });
      gsap.to(quoteSign, {
        '--sign-wipe': '110%',
        duration: 1.05,
        ease: 'power2.inOut',
        scrollTrigger: {
          trigger: quoteSection,
          start: 'top 30%',
          toggleActions: 'play none none reverse',
        },
      });
    }
  }

  /* ------------------------------------------------------------------------
     8. SECTION 6 — 04 GALERI PINNED HORIZONTAL SCROLL (DESKTOP / TABLET)
     ------------------------------------------------------------------------ */
  const gallerySection = document.querySelector('[data-gallery-section]');
  const galleryViewport = document.querySelector('[data-gallery-viewport]');
  const galleryTrack = document.querySelector('[data-gallery-track]');
  const galleryImgs = document.querySelectorAll('[data-gallery-img]');

  const mm = gsap.matchMedia();
  if (gallerySection && galleryViewport && galleryTrack) {
    mm.add('(min-width: 768px)', () => {
      const getScrollDistance = () => {
        const styles = getComputedStyle(galleryViewport);
        const padX =
          (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
        const visibleInner = galleryViewport.clientWidth - padX;
        return Math.max(0, galleryTrack.scrollWidth - visibleInner);
      };

      const horizTween = gsap.to(galleryTrack, {
        x: () => -getScrollDistance(),
        ease: 'none',
        scrollTrigger: {
          trigger: gallerySection,
          pin: true,
          scrub: 1,
          start: 'top top',
          end: () => `+=${getScrollDistance()}`,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      galleryImgs.forEach((img) => {
        const card = img.closest('.galeri-card');
        if (!card) return;
        gsap.fromTo(
          img,
          { xPercent: -5 },
          {
            xPercent: 5,
            ease: 'none',
            scrollTrigger: {
              trigger: card,
              containerAnimation: horizTween,
              start: 'left right',
              end: 'right left',
              scrub: true,
            },
          }
        );
      });
    });
  }

  /* ------------------------------------------------------------------------
     9. SECTION 7 — 05 KONTAK GIANT FOOTER WORDMARK REVEAL
     ------------------------------------------------------------------------ */
  const kontakSection = document.getElementById('kontak');
  const footerChars = document.querySelectorAll('[data-footer-char]');
  if (kontakSection && footerChars.length) {
    gsap.set(footerChars, { yPercent: 126 });
    ScrollTrigger.create({
      trigger: kontakSection,
      start: 'top 65%',
      once: true,
      onEnter: () => {
        gsap.to(footerChars, {
          yPercent: 0,
          duration: 1.05,
          stagger: 0.055,
          ease: 'expo.out',
        });
      },
    });
  }

  /* ------------------------------------------------------------------------
     10. STICKY HEADER VISIBILITY, ACTIVE UNDERLINE & DARK SURFACE SYNC
         (Registered AFTER pinned #galeri so post-pin positions are exact)
     ------------------------------------------------------------------------ */
  const header = document.querySelector('[data-header]');
  if (header) {
    ScrollTrigger.create({
      trigger: '#profil',
      start: 'top 82%',
      onEnter: () => header.classList.add('is-visible'),
      onLeaveBack: () => header.classList.remove('is-visible'),
    });

    const sectionIds = ['profil', 'aktivitas', 'quote', 'galeri', 'kontak'];
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      ScrollTrigger.create({
        trigger: el,
        start: 'top 46%',
        end: 'bottom 46%',
        onEnter: () => setActiveNav(id),
        onEnterBack: () => setActiveNav(id),
      });
    });

    const darkSections = document.querySelectorAll('[data-dark-section]');
    let activeDarkHeaderCount = 0;
    let activeDarkBodyCount = 0;

    darkSections.forEach((sec) => {
      ScrollTrigger.create({
        trigger: sec,
        start: 'top 64px',
        end: 'bottom 64px',
        onEnter: () => {
          activeDarkHeaderCount += 1;
          header.classList.add('is-dark');
        },
        onEnterBack: () => {
          activeDarkHeaderCount += 1;
          header.classList.add('is-dark');
        },
        onLeave: () => {
          activeDarkHeaderCount = Math.max(0, activeDarkHeaderCount - 1);
          if (activeDarkHeaderCount === 0) header.classList.remove('is-dark');
        },
        onLeaveBack: () => {
          activeDarkHeaderCount = Math.max(0, activeDarkHeaderCount - 1);
          if (activeDarkHeaderCount === 0) header.classList.remove('is-dark');
        },
      });

      ScrollTrigger.create({
        trigger: sec,
        start: 'top 55%',
        end: 'bottom 45%',
        onEnter: () => {
          activeDarkBodyCount += 1;
          document.body.classList.add('is-dark-surface');
        },
        onEnterBack: () => {
          activeDarkBodyCount += 1;
          document.body.classList.add('is-dark-surface');
        },
        onLeave: () => {
          activeDarkBodyCount = Math.max(0, activeDarkBodyCount - 1);
          if (activeDarkBodyCount === 0) document.body.classList.remove('is-dark-surface');
        },
        onLeaveBack: () => {
          activeDarkBodyCount = Math.max(0, activeDarkBodyCount - 1);
          if (activeDarkBodyCount === 0) document.body.classList.remove('is-dark-surface');
        },
      });
    });
  }

  /* ------------------------------------------------------------------------
     11. CUSTOM BLEND-DIFFERENCE CURSOR (DESKTOP POINTER: FINE ONLY)
     ------------------------------------------------------------------------ */
  const cursor = document.querySelector('[data-cursor]');
  const cursorRing = document.querySelector('[data-cursor-ring]');

  if (hasFinePointer && cursor) {
    gsap.set(cursor, { xPercent: -50, yPercent: -50, autoAlpha: 0 });
    if (cursorRing) gsap.set(cursorRing, { xPercent: -50, yPercent: -50, scale: 0.5, autoAlpha: 0 });

    const curX = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3.out' });
    const curY = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3.out' });
    const ringX = cursorRing
      ? gsap.quickTo(cursorRing, 'x', { duration: 0.35, ease: 'power3.out' })
      : null;
    const ringY = cursorRing
      ? gsap.quickTo(cursorRing, 'y', { duration: 0.35, ease: 'power3.out' })
      : null;

    let cursorRevealed = false;
    window.addEventListener('pointermove', (e) => {
      if (!cursorRevealed) {
        cursorRevealed = true;
        gsap.set(cursor, { x: e.clientX, y: e.clientY, autoAlpha: 1 });
        if (cursorRing) gsap.set(cursorRing, { x: e.clientX, y: e.clientY });
      }
      curX(e.clientX);
      curY(e.clientY);
      ringX?.(e.clientX);
      ringY?.(e.clientY);
    });

    const interactiveTargets = document.querySelectorAll(
      'a, button, [role="button"], [data-cursor-label]'
    );
    interactiveTargets.forEach((target) => {
      target.addEventListener('pointerenter', () => {
        const isActivityRow = target.hasAttribute('data-activity-row');
        const size = isActivityRow ? 64 : 48;

        cursor.classList.add('is-expanded');
        if (cursorRing) {
          gsap.to(cursorRing, {
            autoAlpha: isActivityRow ? 0 : 0.85,
            scale: isActivityRow ? 0.5 : 1,
            duration: 0.35,
            ease: 'expo.out',
            overwrite: 'auto',
          });
        }

        gsap.to(cursor, {
          width: size,
          height: size,
          duration: 0.38,
          ease: 'expo.out',
          overwrite: 'auto',
        });
      });

      target.addEventListener('pointerleave', () => {
        cursor.classList.remove('is-expanded');
        if (cursorRing) {
          gsap.to(cursorRing, {
            autoAlpha: 0,
            scale: 0.5,
            duration: 0.28,
            ease: 'power3.out',
            overwrite: 'auto',
          });
        }
        gsap.to(cursor, {
          width: 8,
          height: 8,
          duration: 0.32,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     12. TRIGGER SORT, RESIZE SYNC & PRELOADER LAUNCH
     ------------------------------------------------------------------------ */
  ScrollTrigger.sort();
  positionNavIndicator(document.querySelector('.site-nav__link.is-active'));

  window.addEventListener('resize', () => {
    positionNavIndicator(document.querySelector('.site-nav__link.is-active'));
  });

  // Launch preloader AFTER all SplitText & ScrollTriggers are registered
  // so font-ready ScrollTrigger.refresh() warms everything once behind the curtain
  runPreloader();
}

if (prefersReducedMotion) {
  initReducedMotionMode();
} else {
  initMotionSystem();
}
