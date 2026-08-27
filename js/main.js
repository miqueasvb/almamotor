(function ($) {
"use strict";

// TOP Menu Sticky
$(window).on('scroll', function () {
  var scroll = $(window).scrollTop();
  if (scroll < 400) {
    $('#back-top').fadeIn(500);
  } else {
    $('#back-top').fadeIn(500);
  }
});


$(document).ready(function(){

// mobile_menu
var menu = $('ul#navigation');
if(menu.length){
	menu.slicknav({
		prependTo: ".mobile_menu",
		closedSymbol: '+',
		openedSymbol:'-'
	});
};

// vehicle_marquee - carrusel de vehículos: loop infinito + auto-scroll continuo + arrastre (mouse y touch)
var $vehicleMarquee = $('.vehicle_marquee');
var $vehicleTrack = $('.vehicle_track');
if ($vehicleMarquee.length && $vehicleTrack.length) {
	var marquee = $vehicleMarquee.get(0);
	var track = $vehicleTrack.get(0);

	// ¿Es un dispositivo táctil (celular/tablet)? En esos, el auto-scroll se anima
	// con "transform" en vez de "scrollLeft" (ver función autoScroll más abajo).
	var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
	var autoOffset = 0; // desplazamiento visual acumulado del auto-scroll en celular (px)

	// Duplicamos las tarjetas UNA sola vez para que el loop sea infinito y sin cortes
	var originalCards = Array.prototype.slice.call(track.children);
	originalCards.forEach(function (card) {
		track.appendChild(card.cloneNode(true));
	});

	// Evita que el navegador arrastre las imágenes/links de forma nativa
	// (esto era lo que impedía que funcionara el arrastre con mouse en PC)
	track.addEventListener('dragstart', function (e) { e.preventDefault(); });

	var halfWidth = 0;
	function recalcHalfWidth() {
		halfWidth = track.scrollWidth / 2;
	}
	recalcHalfWidth();
	$(window).on('resize', recalcHalfWidth);

	var SPEED = 0.6; // velocidad del auto-scroll (px por frame)
	var isDragging = false;
	var isTouching = false;
	var isInertia = false;
	var dragMoved = false;
	var startX = 0;
	var startScrollLeft = 0;
	var moveSamples = []; // últimas posiciones para calcular la velocidad al soltar
	var inertiaVelocity = 0;
	var inertiaRafId = null;

	function autoScroll() {
		// Sigue moviéndose solo aunque el mouse esté encima; sólo se detiene
		// mientras se está arrastrando (mouse), tocando (celular) o deslizando por inercia.
		if (!isDragging && !isTouching && !isInertia && halfWidth > 0) {
			if (isTouchDevice) {
				// En iPhone/Android, Safari (y en algunos casos Chrome mobile) IGNORA
				// los cambios de scrollLeft hechos por JS mientras nadie está tocando
				// la pantalla — es un bug conocido de WebKit. Por eso el auto-scroll no
				// se movía en celular aunque el arrastre con el dedo sí funcionaba (ese
				// lo maneja el propio sistema táctil, no JS). La solución es animar el
				// movimiento con "transform", que siempre se pinta, y trasladarlo al
				// scroll real recién cuando el usuario empieza a tocar (ver touchstart).
				autoOffset += SPEED;
				if (autoOffset >= halfWidth) autoOffset -= halfWidth;
				track.style.transform = 'translateX(' + (-autoOffset) + 'px)';
			} else {
				marquee.scrollLeft += SPEED;
				if (marquee.scrollLeft >= halfWidth) {
					marquee.scrollLeft -= halfWidth;
				}
			}
		}
		requestAnimationFrame(autoScroll);
	}
	requestAnimationFrame(autoScroll);

	function wrapScrollLeft(value) {
		if (halfWidth <= 0) return value;
		while (value < 0) value += halfWidth;
		while (value >= halfWidth) value -= halfWidth;
		return value;
	}

	// Desliza con inercia (fricción) después de soltar, igual que el scroll táctil nativo
	function runInertia() {
		if (Math.abs(inertiaVelocity) < 0.05) {
			isInertia = false;
			return;
		}
		isInertia = true;
		marquee.scrollLeft = wrapScrollLeft(marquee.scrollLeft - inertiaVelocity);
		inertiaVelocity *= 0.95; // fricción: más cerca de 1 = desliza más lejos
		inertiaRafId = requestAnimationFrame(runInertia);
	}

	var pointerDownTarget = null;
	var suppressNextClick = false;

	// --- Arrastre con mouse (PC) ---
	marquee.addEventListener('pointerdown', function (e) {
		if (e.pointerType === 'touch') return;
		if (inertiaRafId) cancelAnimationFrame(inertiaRafId);
		isInertia = false;
		isDragging = true;
		dragMoved = false;
		pointerDownTarget = e.target;
		startX = e.pageX;
		startScrollLeft = marquee.scrollLeft;
		moveSamples = [{ x: e.pageX, t: performance.now() }];
		marquee.classList.add('dragging');
		try { marquee.setPointerCapture(e.pointerId); } catch (err) {}
		// OJO: no hacemos e.preventDefault() acá. Si se cancela el pointerdown,
		// el navegador anula también el click de compatibilidad que vendría
		// después, aunque el usuario no haya arrastrado nada — por eso el botón
		// "Ver más" dejaba de responder al simple click. Solo cancelamos el
		// comportamiento por defecto más abajo, una vez que se confirma que
		// hay arrastre real (pointermove).
	});

	marquee.addEventListener('pointermove', function (e) {
		if (!isDragging || e.pointerType === 'touch') return;
		var dx = e.pageX - startX;
		if (Math.abs(dx) > 4) dragMoved = true;
		if (dragMoved) e.preventDefault();
		var newScrollLeft = startScrollLeft - dx;

		if (halfWidth > 0) {
			while (newScrollLeft < 0) {
				newScrollLeft += halfWidth;
				startScrollLeft += halfWidth;
			}
			while (newScrollLeft >= halfWidth) {
				newScrollLeft -= halfWidth;
				startScrollLeft -= halfWidth;
			}
		}
		marquee.scrollLeft = newScrollLeft;

		moveSamples.push({ x: e.pageX, t: performance.now() });
		if (moveSamples.length > 6) moveSamples.shift();
	});

	function endDrag(e) {
		if (e && e.pointerType === 'touch') return;
		isDragging = false;
		marquee.classList.remove('dragging');

		if (e && e.pointerId !== undefined) {
			try { marquee.releasePointerCapture(e.pointerId); } catch (err) {}
		}

		// Navegación manual y garantizada: en vez de confiar en que el navegador
		// dispare el "click" nativo sobre el link (algo que con el arrastre por
		// pointer events puede perderse según el navegador), si al soltar NO hubo
		// arrastre y se soltó sobre un link (el botón "Ver más" o la miniatura),
		// redirigimos nosotros mismos.
		if (e && e.type === 'pointerup' && !dragMoved && pointerDownTarget) {
			var link = pointerDownTarget.closest ? pointerDownTarget.closest('a') : null;
			if (link && link.getAttribute('href')) {
				suppressNextClick = true;
				var href = link.href;
				if (link.getAttribute('target') === '_blank') {
					window.open(href, '_blank');
				} else {
					window.location.href = href;
				}
			}
		}
		pointerDownTarget = null;

		// Calculamos la velocidad de los últimos movimientos y largamos la inercia,
		// para que siga deslizando suave al soltar (como en celular) en vez de frenar en seco.
		if (moveSamples.length >= 2) {
			var first = moveSamples[0];
			var last = moveSamples[moveSamples.length - 1];
			var dt = last.t - first.t;
			if (dt > 0) {
				var velocityPerMs = (last.x - first.x) / dt; // px por ms
				inertiaVelocity = velocityPerMs * 16; // aprox px por frame (~60fps)
				var MAX_VELOCITY = 45;
				if (inertiaVelocity > MAX_VELOCITY) inertiaVelocity = MAX_VELOCITY;
				if (inertiaVelocity < -MAX_VELOCITY) inertiaVelocity = -MAX_VELOCITY;
				if (Math.abs(inertiaVelocity) > 0.3) {
					if (inertiaRafId) cancelAnimationFrame(inertiaRafId);
					inertiaRafId = requestAnimationFrame(runInertia);
				}
			}
		}
		moveSamples = [];
	}
	marquee.addEventListener('pointerup', endDrag);
	marquee.addEventListener('pointercancel', endDrag);
	marquee.addEventListener('pointerleave', endDrag);

	// Evita que un arrastre termine "clickeando" un link de vehículo por error,
	// y evita una segunda navegación cuando ya redirigimos a mano en pointerup.
	track.addEventListener('click', function (e) {
		if (suppressNextClick) {
			e.preventDefault();
			e.stopPropagation();
			suppressNextClick = false;
			return;
		}
		if (dragMoved) {
			e.preventDefault();
			e.stopPropagation();
			dragMoved = false;
		}
	}, true);

	// --- Celular: dejamos el swipe nativo (más fluido que reimplementarlo a mano),
	// sólo pausamos el auto-scroll mientras el dedo está tocando para que no compita
	// contra el swipe del usuario ---
	marquee.addEventListener('touchstart', function () {
		// Traspasamos el desplazamiento visual (que hasta ahora vivía solo en el
		// transform) al scroll real, así el dedo arranca a arrastrar exactamente
		// desde donde se ve el carrusel, sin ningún salto.
		if (autoOffset !== 0) {
			marquee.scrollLeft = wrapScrollLeft(marquee.scrollLeft + autoOffset);
			autoOffset = 0;
			track.style.transform = 'translateX(0px)';
		}
		isTouching = true;
	}, { passive: true });
	marquee.addEventListener('touchend', function () {
		setTimeout(function () { isTouching = false; }, 300);
	}, { passive: true });
	marquee.addEventListener('touchcancel', function () {
		setTimeout(function () { isTouching = false; }, 300);
	}, { passive: true });
}
// blog-menu
  // $('ul#blog-menu').slicknav({
  //   prependTo: ".blog_menu"
  // });

// review-active
$('.slider_active').owlCarousel({
  loop:true,
  margin:0,
  items:1,
  autoplay:true,
  nav:false,
  dots:true,
  autoplayHoverPause: true,
  autoplaySpeed: 800,
  responsive:{
      0:{
          items:1
      },
      767:{
          items:1
      },
      992:{
          items:1
      }
  }
});
// review-active
$('.textmonial_active').owlCarousel({
  loop:true,
  margin:100,
  items:1,
  autoplay:true,
  navText:['<i class="Flaticon flaticon-left"></i>','<i class="Flaticon flaticon-right"></i>'],
  nav:true,
  dots:false,
  autoplayHoverPause: true,
  autoplaySpeed: 800,
  responsive:{
      0:{
          items:1,
          nav:false,
      },
      767:{
          items:1,
          nav:true,
      },
      992:{
          items:1
      }
  }
});

// about_active
$('.about_active').owlCarousel({
  loop:true,
  margin:0,
  items:1,
  autoplay:true,
  navText:['<i class="ti-angle-left"></i>','<i class="ti-angle-right"></i>'],
  nav:true,
  dots:false,
  autoplayHoverPause: true,
  autoplaySpeed: 800,
  responsive:{
      0:{
          items:1,
          nav:false,
      },
      767:{
          items:1,
          nav:false,
      },
      992:{
          items:1
      }
  }
});

// review-active
$('.testmonial_active').owlCarousel({
  loop:true,
  margin:0,
items:1,
autoplay:true,
navText:['<i class="ti-angle-left"></i>','<i class="ti-angle-right"></i>'],
  nav:true,
dots:false,
autoplayHoverPause: true,
autoplaySpeed: 800,
  responsive:{
      0:{
          items:1,
          dots:false,
          nav:false,
      },
      767:{
          items:1,
          dots:false,
          nav:false,
      },
      992:{
          items:1,
          nav:false
      },
      1200:{
          items:1,
          nav:false
      },
      1500:{
          items:1
      }
  }
});

// for filter
  // init Isotope
  var $grid = $('.grid').isotope({
    itemSelector: '.grid-item',
    percentPosition: true,
    masonry: {
      // use outer width of grid-sizer for columnWidth
      columnWidth: 1
    }
  });

  // filter items on button click
  $('.portfolio-menu').on('click', 'button', function () {
    var filterValue = $(this).attr('data-filter');
    $grid.isotope({ filter: filterValue });
  });

  //for menu active class
  $('.portfolio-menu button').on('click', function (event) {
    $(this).siblings('.active').removeClass('active');
    $(this).addClass('active');
    event.preventDefault();
	});
  
  // wow js
  new WOW().init();

  // counter 
  $('.counter').counterUp({
    delay: 10,
    time: 10000
  });

/* magnificPopup img view */
$('.popup-image').magnificPopup({
	type: 'image',
	gallery: {
	  enabled: true
	}
});

/* magnificPopup img view */
$('.img-pop-up').magnificPopup({
	type: 'image',
	gallery: {
	  enabled: true
	}
});

/* magnificPopup video view */
$('.popup-video').magnificPopup({
	type: 'iframe'
});


  // scrollIt for smoth scroll
  $.scrollIt({
    upKey: 38,             // key code to navigate to the next section
    downKey: 40,           // key code to navigate to the previous section
    easing: 'linear',      // the easing function for animation
    scrollTime: 600,       // how long (in ms) the animation takes
    activeClass: 'active', // class given to the active nav element
    onPageChange: null,    // function(pageIndex) that is called when page is changed
    topOffset: 0           // offste (in px) for fixed top navigation
  });

  // scrollup bottom to top
  $.scrollUp({
    scrollName: 'scrollUp', // Element ID
    topDistance: '4500', // Distance from top before showing element (px)
    topSpeed: 300, // Speed back to top (ms)
    animation: 'fade', // Fade, slide, none
    animationInSpeed: 200, // Animation in speed (ms)
    animationOutSpeed: 200, // Animation out speed (ms)
    scrollText: '<i class="fa fa-angle-double-up"></i>', // Text for element
    activeOverlay: false, // Set CSS color to display scrollUp active point, e.g '#00FFFF'
  });


  // blog-page

  //brand-active
$('.brand-active').owlCarousel({
  loop:true,
  margin:30,
items:1,
autoplay:true,
  nav:false,
dots:false,
autoplayHoverPause: true,
autoplaySpeed: 800,
  responsive:{
      0:{
          items:1,
          nav:false

      },
      767:{
          items:4
      },
      992:{
          items:7
      }
  }
});

// blog-dtails-page

$('.project-active').owlCarousel({
    loop: true,
    margin: 30,
    items: 1,
    autoplay: true,
    autoplayTimeout: 4000,      // Tiempo entre cada movimiento automático
    autoplayHoverPause: true,
    smartSpeed: 800,            // Velocidad de la transición (evita que sea muy lenta)
    slideBy: 1,                 // Mueve de a 1 elemento para evitar huecos al final
    navText: ['<i class="Flaticon flaticon-left-arrow"></i>','<i class="Flaticon flaticon-right-arrow"></i>'],
    nav: true,
    dots: false,
    responsive:{
        0:{ items: 1, nav: false },
        767:{ items: 1, nav: false },
        992:{ items: 2, nav: false },
        1200:{ items: 1 },
        1501:{ items: 2 }
    }
});

if (document.getElementById('default-select')) {
  $('select').niceSelect();
}

  //about-pro-active
$('.details_active').owlCarousel({
  loop:true,
  margin:0,
items:1,
// autoplay:true,
navText:['<i class="ti-angle-left"></i>','<i class="ti-angle-right"></i>'],
nav:true,
dots:false,
// autoplayHoverPause: true,
// autoplaySpeed: 800,
  responsive:{
      0:{
          items:1,
          nav:false

      },
      767:{
          items:1,
          nav:false
      },
      992:{
          items:1,
          nav:false
      },
      1200:{
          items:1,
      }
  }
});

});

// resitration_Form
$(document).ready(function() {
	$('.popup-with-form').magnificPopup({
		type: 'inline',
		preloader: false,
		focus: '#name',

		// When elemened is focused, some mobile browsers in some cases zoom in
		// It looks not nice, so we disable it:
		callbacks: {
			beforeOpen: function() {
				if($(window).width() < 700) {
					this.st.focus = false;
				} else {
					this.st.focus = '#name';
				}
			}
		}
	});
});



//------- Mailchimp js --------//  
function mailChimp() {
  $('#mc_embed_signup').find('form').ajaxChimp();
}
mailChimp();



// Search Toggle
    $("#search_input_box").hide();
    $("#search_1").on("click", function () {
        $("#search_input_box").slideToggle();
        $("#search_input").focus();
    });

    // --- CORRECCIÓN PARA QUE LOS CARRUSELES NO SE QUEDEN EN BLANCO ---
    $(window).on('load', function() {
        $('.owl-carousel').trigger('refresh.owl.carousel');
    });

    let resizeTimer;
    $(window).on('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            $('.owl-carousel').trigger('refresh.owl.carousel');
        }, 200);
    });
    // -----------------------------------------------------------------

})(jQuery);