(function () {
  /* ── 1. 투명 네비 ── */
  const nav = document.getElementById('bs-nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('bs-nav-solid', window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── 2. 타이핑 애니메이션 ── */
  const typingEl = document.getElementById('bs-typing');
  if (typingEl) {
    const words = ['실전', '현장', '성장', '실행', '전략'];
    let wi = 0, ci = 0, deleting = false;
    const PAUSE = 1800, TYPE_SPEED = 110, DEL_SPEED = 65;
    function tick() {
      const word = words[wi];
      if (!deleting) {
        typingEl.textContent = word.slice(0, ++ci);
        if (ci === word.length) { deleting = true; setTimeout(tick, PAUSE); }
        else setTimeout(tick, TYPE_SPEED);
      } else {
        typingEl.textContent = word.slice(0, --ci);
        if (ci === 0) { deleting = false; wi = (wi + 1) % words.length; setTimeout(tick, TYPE_SPEED); }
        else setTimeout(tick, DEL_SPEED);
      }
    }
    setTimeout(tick, 1200);
  }

  /* ── 3. 스크롤 reveal ── */
  function setupReveal() {
    const reveals = document.querySelectorAll('.bs-reveal');
    if (!reveals.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('bs-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(el => {
      const rect = el.getBoundingClientRect();
      // 이미 뷰포트 안에 있으면 즉시 표시
      if (rect.top < window.innerHeight) {
        el.classList.add('bs-visible');
      } else {
        io.observe(el);
      }
    });

    // 안전망: 3초 후에도 안 보이면 강제로 표시
    setTimeout(() => {
      document.querySelectorAll('.bs-reveal:not(.bs-visible)')
        .forEach(el => el.classList.add('bs-visible'));
    }, 3000);
  }

  // 프레임워크 렌더링 완료 후 실행
  if (document.readyState === 'complete') {
    setTimeout(setupReveal, 300);
  } else {
    window.addEventListener('load', () => setTimeout(setupReveal, 300));
  }
})();
