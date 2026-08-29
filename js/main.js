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
// Se arma como una función reutilizable (window.initVehicleMarquee) porque hay
// páginas (ficha.html, index.html) que insertan las tarjetas de forma dinámica
// desde data/vehiculos.json DESPUÉS de que este archivo ya corrió. Esas páginas
// llaman a window.initVehicleMarquee() ellas mismas apenas terminan de insertar
// el HTML. Si ya había un motor corriendo sobre el mismo carrusel (por ejemplo,
// contenido estático de respaldo reemplazado por el real), lo apaga prolijamente
// antes de reconstruirlo, para que nunca queden dos motores compitiendo.
function initVehicleMarquee() {
	var marquee = document.querySelector('.vehicle_marquee');
	var track = document.querySelector('.vehicle_track');
	if (!marquee || !track || !track.children.length) return;

	if (typeof marquee._marqueeTeardown === 'function') {
		marquee._marqueeTeardown();
		marquee._marqueeTeardown = null;
	}

	// Arrancamos siempre desde un scroll conocido (0). Esto importa cuando esta
	// función se llama una segunda vez sobre un carrusel que ya venía corriendo
	// (por ejemplo: index.html lo inicializa primero con la maqueta estática y
	// después de nuevo con los vehículos reales de data/vehiculos.json). Si el
	// usuario llegó a arrastrar el carrusel justo en esos milisegundos antes de
	// que lleguen los datos reales, sin este reset quedaría un scrollLeft viejo
	// aplicado sobre el contenido nuevo.
	marquee.scrollLeft = 0;

	// Duplicamos las tarjetas UNA sola vez para que el loop sea infinito y sin cortes
	var originalCards = Array.prototype.slice.call(track.children);
	originalCards.forEach(function (card) {
		track.appendChild(card.cloneNode(true));
	});

	// Algunos estilos del template aplican una transición CSS al "transform"
	// (típicamente solo visible en resoluciones de escritorio). Eso hacía que el
	// auto-scroll, que cambia el transform cuadro a cuadro, se viera trabado en
	// PC (cada cambio se "peleaba" con la transición anterior sin completarla).
	// Lo forzamos sin transición para que el auto-scroll se vea fluido. El
	// arrastre manual no se ve afectado porque usa scrollLeft, no transform.
	track.style.setProperty('transition', 'none', 'important');

	// Evita que el navegador arrastre las imágenes/links de forma nativa
	// (esto era lo que impedía que funcionara el arrastre con mouse en PC)
	function onDragStart(e) { e.preventDefault(); }
	track.addEventListener('dragstart', onDragStart);

	var autoOffset = 0; // desplazamiento visual acumulado del auto-scroll (px), tanto en PC como en celular

	var halfWidth = 0;
	function recalcHalfWidth() {
		halfWidth = track.scrollWidth / 2;
	}
	recalcHalfWidth();
	$(window).on('resize.vehicleMarquee', recalcHalfWidth);

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
	var autoScrollRafId = null;
	var destroyed = false;

	function autoScroll() {
		if (destroyed) return;
		// Sigue moviéndose solo aunque el mouse esté encima; sólo se detiene
		// mientras se está arrastrando (mouse), tocando (celular) o deslizando por inercia.
		if (!isDragging && !isTouching && !isInertia && halfWidth > 0) {
			// El auto-scroll SIEMPRE se anima con "transform" (no con scrollLeft),
			// tanto en PC como en celular. En iPhone/Android es necesario porque
			// Safari (y a veces Chrome mobile) IGNORA los cambios de scrollLeft
			// hechos por JS mientras nadie toca la pantalla (bug conocido de
			// WebKit). En PC, mover scrollLeft de a incrementos chicos y continuos
			// también puede no pintarse de forma fluida en algunos navegadores —
			// por eso ahora usamos el mismo método en todos los dispositivos.
			// El desplazamiento se traspasa al scroll real recién cuando el
			// usuario empieza a arrastrar (mouse, ver onPointerDown) o a tocar
			// (celular, ver onTouchStart), para que el arrastre arranque
			// exactamente desde donde se ve el carrusel, sin saltos.
			autoOffset += SPEED;
			if (autoOffset >= halfWidth) autoOffset -= halfWidth;
			track.style.transform = 'translateX(' + (-autoOffset) + 'px)';
		}
		autoScrollRafId = requestAnimationFrame(autoScroll);
	}
	autoScrollRafId = requestAnimationFrame(autoScroll);

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
	function onPointerDown(e) {
		if (e.pointerType === 'touch') return;
		if (inertiaRafId) cancelAnimationFrame(inertiaRafId);
		isInertia = false;
		// Traspasamos el desplazamiento visual (que hasta ahora vivía en el
		// transform del auto-scroll) al scroll real, para que el arrastre con
		// mouse arranque exactamente desde donde se ve el carrusel, sin saltos.
		if (autoOffset !== 0) {
			marquee.scrollLeft = wrapScrollLeft(marquee.scrollLeft + autoOffset);
			autoOffset = 0;
			track.style.transform = 'translateX(0px)';
		}
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
	}

	function onPointerMove(e) {
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
	}

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
	marquee.addEventListener('pointerdown', onPointerDown);
	marquee.addEventListener('pointermove', onPointerMove);
	marquee.addEventListener('pointerup', endDrag);
	marquee.addEventListener('pointercancel', endDrag);
	marquee.addEventListener('pointerleave', endDrag);

	// Evita que un arrastre termine "clickeando" un link de vehículo por error,
	// y evita una segunda navegación cuando ya redirigimos a mano en pointerup.
	function onTrackClick(e) {
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
	}
	track.addEventListener('click', onTrackClick, true);

	// --- Celular: dejamos el swipe nativo (más fluido que reimplementarlo a mano),
	// sólo pausamos el auto-scroll mientras el dedo está tocando para que no compita
	// contra el swipe del usuario ---
	function onTouchStart() {
		// Traspasamos el desplazamiento visual (que hasta ahora vivía solo en el
		// transform) al scroll real, así el dedo arranca a arrastrar exactamente
		// desde donde se ve el carrusel, sin ningún salto.
		if (autoOffset !== 0) {
			marquee.scrollLeft = wrapScrollLeft(marquee.scrollLeft + autoOffset);
			autoOffset = 0;
			track.style.transform = 'translateX(0px)';
		}
		isTouching = true;
	}
	function onTouchEnd() {
		setTimeout(function () { isTouching = false; }, 300);
	}
	marquee.addEventListener('touchstart', onTouchStart, { passive: true });
	marquee.addEventListener('touchend', onTouchEnd, { passive: true });
	marquee.addEventListener('touchcancel', onTouchEnd, { passive: true });

	// Permite volver a llamar a initVehicleMarquee() más adelante (por ejemplo,
	// cuando se reemplaza el contenido estático de respaldo por el real) sin
	// dejar dos motores corriendo en paralelo ni escuchando eventos duplicados.
	marquee._marqueeTeardown = function () {
		destroyed = true;
		if (autoScrollRafId) cancelAnimationFrame(autoScrollRafId);
		if (inertiaRafId) cancelAnimationFrame(inertiaRafId);
		$(window).off('resize.vehicleMarquee', recalcHalfWidth);
		track.removeEventListener('dragstart', onDragStart);
		marquee.removeEventListener('pointerdown', onPointerDown);
		marquee.removeEventListener('pointermove', onPointerMove);
		marquee.removeEventListener('pointerup', endDrag);
		marquee.removeEventListener('pointercancel', endDrag);
		marquee.removeEventListener('pointerleave', endDrag);
		track.removeEventListener('click', onTrackClick, true);
		marquee.removeEventListener('touchstart', onTouchStart);
		marquee.removeEventListener('touchend', onTouchEnd);
		marquee.removeEventListener('touchcancel', onTouchEnd);
		marquee.classList.remove('dragging');
		track.style.transform = '';
	};
}
// La corremos apenas carga la página por si el carrusel ya trae contenido
// estático de entrada (sin esperar a ningún fetch).
initVehicleMarquee();
// Y la exponemos para que páginas con contenido dinámico (ficha.html,
// index.html) la llamen ellas mismas apenas insertan las tarjetas reales.
window.initVehicleMarquee = initVehicleMarquee;
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
