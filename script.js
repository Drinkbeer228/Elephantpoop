<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Плодородный Слон — органическое удобрение</title>
    <meta name="description" content="Плодородный Слон – натуральное удобрение из слоновьего навоза. Купить в Сочи — самовывоз.">
    <meta name="keywords" content="слоновий навоз, органическое удобрение, удобрение в Сочи">
    <link rel="icon" href="favicon.ico">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <h1>Плодородный Слон</h1>
        <p>Навоз от настоящих слонов. Без посредников. Без химии.</p>
        <nav>
            <ul>
                <li><a href="#about">О нас</a></li>
                <li><a href="#gallery">Галерея</a></li>
                <li><a href="#order">Заказать</a></li>
                <li><a href="#faq">FAQ</a></li>
                <li><a href="#contact">Контакты</a></li>
            </ul>
        </nav>
    </header>
    <main class="container">
      <section id="about">
          <h2>Как всё происходит</h2>
          <p>Слоновий навоз собирается ночью дежурным кипером, хранится в чёрных пластиковых мешках и передаётся вам напрямую. Мы не занимаемся доставкой — самовывоз или договор с курьером на вашей стороне.</p>
      </section>
      <section id="gallery">
          <h2>Галерея</h2>
          <div class="slider">
            <button id="prev">&#10094;</button>
            <img id="slider" src="images/1.jpg" alt="Фото слона" width="100%">
            <button id="next">&#10095;</button>
          </div>
      </section>
      <section id="order">
          <h2>Заказать слоновий навоз</h2>
          <form id="order-form">
            <label>Выберите объём мешка:
              <select id="size">
                <option value="300" data-weight="10">10 кг — 300 ₽</option>
                <option value="700" data-weight="25">25 кг — 700 ₽</option>
              </select>
            </label>
            <label>Количество мешков:
              <input type="number" id="quantity" value="1" min="1">
            </label>
            <label>Ваш телефон:
              <input type="tel" id="phone" placeholder="+7 (___) ___-__-__" required>
            </label>
            <button type="submit">Рассчитать стоимость</button>
          </form>
          <p id="total-price"></p>
      </section>
      <section id="faq">
          <h2>Вопросы и ответы</h2>
          <div class="faq-item">
            <button class="faq-question">Как долго можно хранить навоз?</button>
            <div class="faq-answer">Хранить в сухом помещении можно до 6 месяцев, при этом раз в месяц проветривать пакеты.</div>
          </div>
          <div class="faq-item">
            <button class="faq-question">Есть ли запах?</button>
            <div class="faq-answer">Благодаря пластику запах практически отсутствует. При открытии пакета лёгкий естественный запах органики.</div>
          </div>
          <div class="faq-item">
            <button class="faq-question">Чем отличается от коровьего?</button>
            <div class="faq-answer">Слоновий навоз более рыхлый, содержит больше волокон и микроорганизмов.</div>
          </div>
      </section>
      <section id="contact">
          <h2>Контакты и самовывоз</h2>
          <p>📞 +7 (915) 062-34-53 — оператор (9:00–16:00 МСК)</p>
          <p>✉️ slon.girl@yandex.ru</p>
          <p>📍 Сочи, Адлерский район, с. Нижняя Шиловка, в 3 км от остановки «Социализм»</p>
          <h3>Как нас найти</h3>
          <iframe src="https://yandex.ru/map-widget/v1/?ll=40.013756,43.485096&z=14" width="100%" height="300" frameborder="0"></iframe>
      </section>
    </main>
    <footer>
        <p>© 2025 Плодородный Слон — Навозно. Надёжно. Натурально.</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>
