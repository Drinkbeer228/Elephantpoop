const images = [
    'images/1.jpg',
    'images/2.jpg',
    'images/3.jpg'
];
let index = 0;
setInterval(() => {
    index = (index + 1) % images.length;
    document.getElementById('slider').src = images[index];
}, 4000);
