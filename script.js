(() => {
  const el = document.getElementById('typed');
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lines = ['Python, TypeScript, Go and C#', 'Talos, Flux and ZFS', 'C64 SID music', 'Full-stack and DevOps engineer · homelab builder'];
  let l = 0, i = 0, del = false;
  el.textContent = '';
  (function tick() {
    const s = lines[l];
    i += del ? -1 : 1;
    el.textContent = s.slice(0, i);
    let wait = del ? 25 : 55;
    if (!del && i === s.length) {
      // Stop on the last line so nothing keeps moving on the page.
      if (l === lines.length - 1) { el.parentElement.classList.add('done'); return; }
      del = true; wait = 1800;
    } else if (del && i === 0) { del = false; l += 1; wait = 350; }
    setTimeout(tick, wait);
  })();
})();
