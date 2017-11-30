(function() {
    var canvas = document.getElementById('work'),
            context = canvas.getContext('2d');

    // resize the canvas to fill browser window dynamically
    window.addEventListener('resize', resizeCanvas, false);

    function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            /**
             * Your drawings need to be inside this function otherwise they will be reset when 
             * you resize the browser window and the canvas goes will be cleared.
             */
            drawStuff(); 
    }
    resizeCanvas();

    function drawStuff() {
        function cross(shift) {
            var canvas = document.getElementById("work");
            var c2 = canvas.getContext('2d');
            c2.fillStyle = '#000';
            c2.beginPath();
            c2.moveTo(shift, 700);
            c2.lineTo(shift + 200,0);
            c2.lineTo(shift + 300,0);
            c2.lineTo(shift + 100,700);
            c2.closePath();
            c2.fill();
        }
        
        cross(-200);
        cross(0);
        cross(200);
        cross(400);
        cross(600);
        cross(800);
        cross(1000);
        cross(1200);
        cross(1400);
        cross(1600);
        cross(1800);
        cross(2000);
        write();
    }
})();