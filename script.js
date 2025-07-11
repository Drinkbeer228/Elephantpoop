document.addEventListener('DOMContentLoaded', () => {
  // Слайдер
  const images = ['images/1.jpg', 'images/2.jpg', 'images/3.jpg'];
  let idx = 0;
  const sliderImg = document.getElementById('slider');
  const nextBtn = document.getElementById('next');
  const prevBtn = document.getElementById('prev');
  let slideInterval;

  function showSlide(i) {
    idx = (i + images.length) % images.length;
    sliderImg.src = images[idx];
  }
  function nextSlide() { showSlide(idx + 1); }
  function prevSlide() { showSlide(idx - 1); }

  nextBtn.addEventListener('click', () => { nextSlide(); resetInterval(); });
  prevBtn.addEventListener('click', () => { prevSlide(); resetInterval(); });

  function resetInterval() {
    clearInterval(slideInterval);
    slideInterval = setInterval(nextSlide, 5000);
  }
  slideInterval = setInterval(nextSlide, 5000);
  document.querySelector('.slider').addEventListener('mouseenter', () => clearInterval(slideInterval));
  document.querySelector('.slider').addEventListener('mouseleave', resetInterval);

  // FAQ аккордеон
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
      q.classList.toggle('active');
      const ans = q.nextElementSibling;
      ans.style.display = ans.style.display === 'block' ? 'none' : 'block';
    });
  });

  // Форма заказа
  const form = document.getElementById('order-form');
  const totalPriceEl = document.getElementById('total-price');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const price = parseInt(form.size.value, 10);
    const weight = parseInt(form.size.selectedOptions[0].dataset.weight, 10);
    const qty = parseInt(form.quantity.value, 10);
    const phone = form.phone.value.trim();
    if (!phone) {
      alert('Пожалуйста, укажите телефон.');
      return;
    }
    const total = price * qty;
    totalPriceEl.textContent = `Итого: ${total} ₽. Мы свяжемся с вами по номеру ${phone}`;
  });

  // Плавный скролл
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});
