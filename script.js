// 1. Плавное скрытие шапки видео (твой старый код)
window.addEventListener('scroll', function() {
  const hero = document.querySelector('.hero-video-wrap');
  if (!hero) return;
  let scroll = window.scrollY || document.documentElement.scrollTop;
  let h = hero.offsetHeight;
  let shift = Math.min(h, scroll);
  hero.style.transform = `translateY(-${shift}px)`;
});

// 2. Анимация появления блоков при скролле
document.addEventListener('DOMContentLoaded', () => {
  // Выбираем карточки со слонами и все секции
  const elementsToAnimate = document.querySelectorAll('.card, section');

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      // Если элемент попал в зону видимости
      if (entry.isIntersecting) {
        entry.target.classList.add('visible'); // Добавляем класс
        observer.unobserve(entry.target);      // Отключаем слежение (анимируем 1 раз)
      }
    });
  }, {
    threshold: 0.1, // Сработает, когда показалось хотя бы 10% блока
    rootMargin: "0px 0px -40px 0px" // Срабатывает чуть выше нижней границы экрана
  });

  // Вешаем наблюдателя на каждый выбранный элемент
  elementsToAnimate.forEach(el => observer.observe(el));
});
