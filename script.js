(function() {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');

    hamburger.addEventListener('click', function() {
        navLinks.classList.toggle('active');
    });

    document.querySelectorAll('#navLinks a').forEach(function(link) {
        link.addEventListener('click', function() {
            navLinks.classList.remove('active');
        });
    });

    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    var navbar = document.getElementById('navbar');
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    var typingTarget = document.getElementById('typingTarget');
    var originalText = typingTarget.textContent;
    typingTarget.textContent = '';
    var charIndex = 0;

    function typeChar() {
        if (charIndex < originalText.length) {
            typingTarget.textContent = originalText.substring(0, charIndex + 1);
            charIndex++;
            setTimeout(typeChar, 45);
        } else {
            typingTarget.style.borderRight = '2px solid #00ff41';
            setInterval(function() {
                typingTarget.style.borderRight = typingTarget.style.borderRight === 'none' ? '2px solid #00ff41' : 'none';
            }, 500);
            startProgressAnimation();
            startSegmentAnimation();
        }
    }

    setTimeout(typeChar, 800);

    var progressFill = document.getElementById('heroProgressFill');
    var heroPercent = document.getElementById('heroPercent');
    var heroSpeed = document.getElementById('heroSpeed');
    var heroEta = document.getElementById('heroEta');
    var progress = 0;

    function startProgressAnimation() {
        function tick() {
            if (progress < 68) {
                progress += Math.random() * 1.5;
                if (progress > 68) progress = 68;
                progressFill.style.width = progress + '%';
                heroPercent.textContent = Math.floor(progress) + '%';
                var speed = (8.5 + Math.random() * 2).toFixed(1);
                heroSpeed.textContent = speed + ' MB/s';
                var remaining = (2.4 * 1024 * (1 - progress / 100)) / (speed * 1024 * 1024);
                var mins = Math.floor(remaining / 60);
                var secs = Math.floor(remaining % 60);
                heroEta.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
                setTimeout(tick, 150);
            }
        }
        tick();
    }

    function startSegmentAnimation() {
        var segFills = document.querySelectorAll('.seg-fill');
        segFills.forEach(function(fill) {
            var target = parseInt(fill.getAttribute('data-target'));
            var current = 0;
            function animate() {
                if (current < target) {
                    current += Math.random() * 3;
                    if (current > target) current = target;
                    fill.style.width = current + '%';
                    setTimeout(animate, 100);
                }
            }
            setTimeout(animate, 200 + Math.random() * 800);
        });
    }

    document.querySelectorAll('.download-btn').forEach(function(button) {
        button.addEventListener('click', function() {
            window.open('https://github.com/Bibhuti05/UFDLoader/releases/tag/Alpha', '_blank');
        });
    });

    document.querySelectorAll('.feature-card, .step, .usage-card, .download-card').forEach(function(el) {
        el.classList.add('fade-in');
    });

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in').forEach(function(el) {
        observer.observe(el);
    });
})();