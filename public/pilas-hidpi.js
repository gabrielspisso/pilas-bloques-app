/*
 * Pilas Bloques: renders the pilasweb canvas with as many real pixels as the screen shows.
 * pilasweb sizes the canvas to its logical size (e.g. 420x480) and disables image smoothing,
 * so on high-density screens the scene is stretched and looks blurry/pixelated.
 * Logical coordinates (pilas.opciones.ancho/alto, actors, camera) do not change: only the
 * backing store is larger and the stage is drawn scaled. The same applies when the scene iframe is
 * shown larger than that size. Loaded by pilas.html right after pilasweb.js.
 * public/libs is regenerated on install, which is why this lives in its own versioned file.
 */
(function (global) {
  var MAX_DENSITY = 2;
  var MAX_SCALE = 3;
  var Pilas = global.Pilas;
  var createjs = global.createjs;
  if (!Pilas || !createjs || !createjs.Stage) return;

  global.pbCanvasScale = 1;

  // The canvas fills the iframe, so innerWidth is the width at which the scene is shown.
  function currentScale(logicalWidth) {
    var density = Math.min(MAX_DENSITY, Math.max(1, Number(global.devicePixelRatio) || 1));
    var enlargement = Math.max(1, (Number(global.innerWidth) || 0) / logicalWidth);
    return Math.min(MAX_SCALE, density * enlargement);
  }

  var originalSize = Pilas.prototype.definir_tamano_del_canvas;
  Pilas.prototype.definir_tamano_del_canvas = function () {
    originalSize.call(this);
    var scale = currentScale(this.opciones.ancho);
    global.pbCanvasScale = scale;
    this.canvas.width = Math.round(this.opciones.ancho * scale);
    this.canvas.height = Math.round(this.opciones.alto * scale);
  };

  var originalUpdateContext = createjs.Stage.prototype.updateContext;
  createjs.Stage.prototype.updateContext = function (ctx) {
    var scale = global.pbCanvasScale || 1;
    if (scale !== 1) ctx.scale(scale, scale);
    return originalUpdateContext.call(this, ctx);
  };

  var originalPointer = createjs.Stage.prototype._updatePointerPosition;
  if (originalPointer) {
    createjs.Stage.prototype._updatePointerPosition = function (id, e, pageX, pageY) {
      originalPointer.apply(this, arguments);
      var scale = global.pbCanvasScale || 1;
      if (scale === 1) return;
      var data = this._getPointerData(id);
      // EaselJS always rewrites rawX/rawY, but x/y only in these cases: otherwise they are
      // the previous (already logical) position and must not be divided again.
      if (data.inBounds || this.mouseMoveOutside) { data.x /= scale; data.y /= scale; }
      data.rawX /= scale; data.rawY /= scale;
      if (id == this._primaryPointerID) { this.mouseX = data.x; this.mouseY = data.y; }
    };
  }

  // pilasweb disables smoothing (meant for pixel art); Pilas Bloques sprites are high-resolution
  // images drawn much smaller, which looks jagged without it.
  var originalIniciar = Pilas.prototype.iniciar;
  Pilas.prototype.iniciar = function () {
    var result = originalIniciar.apply(this, arguments);
    var ctx = this.canvas && this.canvas.getContext ? this.canvas.getContext('2d') : null;
    if (ctx) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
    return result;
  };
})(window);
