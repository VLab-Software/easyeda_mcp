<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useData } from 'vitepress'

const { frontmatter } = useData()

let cleanups = []
let gradientBg = null

// ── Gradient background blobs ────────────────────────────────────
function initGradient(hero) {
  hero.style.position = 'relative'
  hero.style.overflow = 'hidden'

  gradientBg = document.createElement('div')
  gradientBg.className = 'vp-hero-gradient-bg'

  for (let i = 0; i < 4; i++) {
    const blob = document.createElement('div')
    blob.className = `vp-hero-blob vp-hero-blob-${i}`
    gradientBg.appendChild(blob)
  }

  hero.insertBefore(gradientBg, hero.firstChild)
}

// ── Mouse parallax on blobs ───────────────────────────────────────
function initMouseParallax(hero) {
  let targetX = 0, targetY = 0
  let currentX = 0, currentY = 0
  let rafId = null

  function lerp(a, b, t) { return a + (b - a) * t }

  function animate() {
    currentX = lerp(currentX, targetX, 0.06)
    currentY = lerp(currentY, targetY, 0.06)

    hero.style.setProperty('--mx', `${currentX}`)
    hero.style.setProperty('--my', `${currentY}`)
    rafId = requestAnimationFrame(animate)
  }
  rafId = requestAnimationFrame(animate)

  function onMove(e) {
    const rect = hero.getBoundingClientRect()
    targetX = (e.clientX - rect.left) / rect.width - 0.5   // -0.5 → 0.5
    targetY = (e.clientY - rect.top)  / rect.height - 0.5
  }

  function onLeave() {
    targetX = 0
    targetY = 0
  }

  hero.addEventListener('mousemove', onMove)
  hero.addEventListener('mouseleave', onLeave)

  cleanups.push(() => {
    cancelAnimationFrame(rafId)
    hero.removeEventListener('mousemove', onMove)
    hero.removeEventListener('mouseleave', onLeave)
  })
}

// ── Scroll reveal for content sections ───────────────────────────
function initScrollReveal() {
  const selectors = [
    '.support-strip',
    '.intro-panel',
    '.quick-card',
    '.contact-note',
    '.subtle-note',
  ]

  const els = document.querySelectorAll(selectors.join(','))
  if (!els.length) return

  // Stagger cards inside quick-grid
  let cardDelay = 0
  els.forEach(el => {
    const delay = el.classList.contains('quick-card') ? `${cardDelay++ * 80}ms` : '0ms'
    el.style.cssText += `
      opacity: 0;
      transform: translateY(22px);
      transition: opacity 0.55s ease ${delay}, transform 0.55s ease ${delay};
    `
  })

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1'
        entry.target.style.transform = 'translateY(0)'
        observer.unobserve(entry.target)
      }
    })
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' })

  els.forEach(el => observer.observe(el))
  cleanups.push(() => observer.disconnect())
}

// ── Mount ─────────────────────────────────────────────────────────
onMounted(() => {
  if (frontmatter.value.layout !== 'home') return

  // Use two rAF ticks so VitePress finishes painting
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const hero = document.querySelector('.VPHomeHero')
    if (hero) {
      initGradient(hero)
      initMouseParallax(hero)
    }
    initScrollReveal()
  }))
})

onUnmounted(() => {
  cleanups.forEach(fn => fn())
  cleanups = []
  gradientBg?.remove()
})
</script>

<template><slot /></template>
