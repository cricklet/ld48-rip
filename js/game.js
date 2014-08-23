define(function (require) {
  var B = require('lib/backbone');
  var _ = require('lib/underscore')
  var $ = require('lib/jquery');

  var FPS = 60.0;
  var DT  = 1000.0 / FPS;

  var WIDTH  = 20 * 12 * 3;
  var HEIGHT = 5 * 12 * 3;

  var SPRITE_WIDTH  = 12 * 3;
  var SPRITE_HEIGHT = 12 * 3;

  var PLAYER_SPEED = 0.1;

  var ROBBER_SPAWN_INTERVAL = 10000;
  var ROBBER_SPAWN_SCALE    = 0.9;

  var _imageCache = {};
  function png2Image(png) {
    if (png in _imageCache) {
      return _imageCache[png];
    } else {
      drawing = new Image();
      drawing.src = png;
      _imageCache[png] = drawing;
      return drawing;
    }
  }

  function mapPng2Image(pngs) {
    return _.map(pngs, png2Image);
  }

  ANIMATION_SPEED = 1000.0 * 0.2;
  ANIMATIONS = {
    player_day_idle:   _.map(['sprites/0.png'], png2Image),
    player_day_run:    _.map(['sprites/0.png', 'sprites/1.png'], png2Image),
    player_night_idle: _.map(['sprites/0a.png', 'sprites/0b.png'], png2Image),
    player_night_run:  _.map(['sprites/0a.png', 'sprites/1a.png'], png2Image),
    robber_idle:       _.map(['sprites/2.png'], png2Image),
    robber_run:        _.map(['sprites/2.png', 'sprites/3.png'], png2Image),
    body_day:          _.map(['sprites/4.png'], png2Image),
    body_night:        _.map(['sprites/5.png'], png2Image),
    body_burning:      _.map(['sprites/6a.png', 'sprites/6b.png'], png2Image),
    ghost:             _.map(['sprites/7.png'], png2Image)
  }

  function setCharacterAnimation (character, animation) {
    character.animation = animation;
  }

  function renderCharacter (context, character, dt) {
    if (character.animT === undefined) {
      character.animT = 0;
      character.animIndex = 0;
    }

    var sprites = ANIMATIONS[character.animation];
    var sprite  = sprites[character.animIndex % sprites.length];

    character.animT += dt;
    if (character.animT > ANIMATION_SPEED) {
      character.animT = 0;
      character.animIndex ++;
      character.animIndex %= sprites.length;
    }

    context.save();
    context.translate(character.x, character.y)
    if (character.dir < 0) context.scale(-1, 1);
    context.drawImage(sprite, -SPRITE_WIDTH / 2, -SPRITE_WIDTH / 2, SPRITE_WIDTH, SPRITE_HEIGHT);
    context.restore();
  }

  function bindInputs (inputs) {
    $(document).keydown(function (e) {
      var key = String.fromCharCode(e.keyCode).toLowerCase();
      inputs[key] = true;
    });
    $(document).keyup(function (e) {
      var key = String.fromCharCode(e.keyCode).toLowerCase();
      inputs[key] = false;
    });
  }

  function renderBackground(context) {
    context.fillStyle = '#F0DBC9';
    context.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function renderPlayer(context, player) {
    context.drawImage()
  }

  function createBuffer(canvas) {
    buffer = document.createElement('canvas');
    buffer.width  = canvas.width;
    buffer.height = canvas.height;
    return buffer;
  }

  function drawBuffer(context, buffer) {
    context.drawImage(buffer, 0, 0);
  }

  var Game = function () {
    this.canvas  = $('#canvas')[0];
    this.canvasContext = this.canvas.getContext('2d');
    this.canvasContext.imageSmoothingEnabled = false

    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;

    this.buffer = createBuffer(this.canvas);
    this.bufferContext = this.buffer.getContext('2d');
    this.bufferContext.imageSmoothingEnabled = false

    this.inputs = {}
    bindInputs(this.inputs);

    this.player = {
      x: WIDTH / 2,
      y: HEIGHT / 2
    }

    this.robbers = [ {x: 50, y: 50} ];

    this.t = 0;
    this.runLoop();
  }

  Game.prototype.runLoop = function () {
    var lastTime = Date.now();
    var frameCount = 0;
    var frameStart = Date.now();

    function loop () {
      // calculate FPS
      frameCount += 1;
      if (Date.now() > frameStart + 1000) {
        console.log(frameCount + " fps");
        frameCount = 0;
        frameStart = Date.now();
      }

      // run the game
      this.step(DT);

      setTimeout(loop.bind(this), DT);
    };

    loop.bind(this)();
  }

  function thinkPlayer (dt, inputs, player) {
    var vx = 0;
    var vy = 0;
    if (inputs.w) vy -= 1;
    if (inputs.s) vy += 1;
    if (inputs.a) vx -= 1;
    if (inputs.d) vx += 1;

    var v = Math.sqrt(vx*vx + vy*vy);
    if (v > 0.01) {
      vx = vx / v;
      vy = vy / v;
    }

    player.vx = vx * PLAYER_SPEED;
    player.vy = vy * PLAYER_SPEED;
    player.v  = v  * PLAYER_SPEED;
    player.x  += dt * player.vx;
    player.y  += dt * player.vy;

    if (player.animation === undefined) {
      player.animation = 'player_day_idle';
    }

    if (player.v < 0.01) {
      player.animation = 'player_day_idle';
    } else {
      player.animation = 'player_day_run';
    }

    if (player.vx > 0.01)  player.dir = 1;
    if (player.vx < -0.01) player.dir = -1;
  }

  function createRobber () {
    return { x: 20, y: 20 }
  }

  function thinkRobber (dt, t, robber) {
    robber.vx = 0;
    robber.vy = 0;
    robber.v  = 0;

    if (robber.animation === undefined) {
      robber.animation = 'robber_idle';
    }

    if (robber.v < 0.01) {
      robber.animation = 'robber_idle';
    } else {
      robber.animation = 'robber_run';
    }

    if (robber.vx > 0.01)  robber.dir = 1;
    if (robber.vx < -0.01) robber.dir = -1;
  }

  function thinkRobbers (dt, t, robbers) {
    for (var i in robbers) {
      var robber = robbers[i];
      thinkRobber(dt, t, robber);
    }
  }

  Game.prototype.step = function(dt) {
    this.t += dt;

    thinkPlayer(dt, this.inputs, this.player);
    thinkRobbers(dt, this.t, this.robbers);

    renderBackground(this.bufferContext);
    renderCharacter(this.bufferContext, this.player, dt);
    for (var i in this.robbers) {
      renderCharacter(this.bufferContext, this.robbers[i], dt);
    }

    drawBuffer(this.canvasContext, this.buffer);
  }

  _.extend(Game.prototype, B.Events);

  return Game;
});
