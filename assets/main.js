const menuButton = document.querySelector('[data-menu]');
const nav = document.querySelector('.site-nav');

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  nav?.classList.toggle('is-open', !open);
  document.body.classList.toggle('menu-open', !open);
});

nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menuButton?.setAttribute('aria-expanded', 'false');
  nav.classList.remove('is-open');
  document.body.classList.remove('menu-open');
}));

const header = document.querySelector('[data-header]');
let previousY = 0;
window.addEventListener('scroll', () => {
  const currentY = window.scrollY;
  header?.classList.toggle('is-compact', currentY > 40);
  header?.classList.toggle('is-hidden', currentY > previousY && currentY > 500 && !document.body.classList.contains('menu-open'));
  previousY = currentY;
}, { passive: true });

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px' });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
}
