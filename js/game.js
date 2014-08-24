define(function (require) {
  var B = require('lib/backbone');
  var _ = require('lib/underscore')
  var $ = require('lib/jquery');
  var H = require('lib/howler');

  var FPS = 60.0;
  var DT  = 1.0 / FPS;

  var WIDTH  = 20 * 12 * 3;
  var HEIGHT = 5 * 12 * 3;

  var STATE_DAY = 0;
  var STATE_NIGHT = 1;

  var SPRITE_WIDTH  = 14 * 3;
  var SPRITE_HEIGHT = 14 * 3;

  var PLAYER_SIZE = 8 * 3;
  var ROBBER_SIZE = 8 * 3;
  var BODY_SIZE   = 10 * 3;
  var GHOST_SIZE  = 8 * 3;

  var PLAYER_HEALTH = 10;

  var PLAYER_SPEED = 80;
  var ROBBER_SPEED = 30;

  var ROBBER_SPAWN_INTERVAL = 5;
  var ROBBER_SPAWN_SCALE    = 0.95;

  var RECOIL_SOURCE = 4;
  var RECOIL_TARGET = 6;

  var ROBBER_STOP_TIME     = 0.25;
  var ROBBER_AIM_TIME      = 3.0;
  var ROBBER_FIRE_DELAY    = 0.25;
  var ROBBER_COOLDOWN_TIME = 0.25;

  var GUNFIRE_OFFSET_X    = 5 * 3;
  var GUNFIRE_OFFSET_Y    = 1 * 3;
  var GUNFIRE_RENDER_TIME = 0.1;

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

  ANIMATION_SPEED = 0.2;
  ANIMATIONS = {
    0: { // day
      player_idle:       _.map(['sprites/0.png'], png2Image),
      player_run:        _.map(['sprites/0.png', 'sprites/1.png'], png2Image),
      robber_idle:       _.map(['sprites/2.png'], png2Image),
      robber_idle_shoot: _.map(['sprites/8.png'], png2Image),
      robber_run:        _.map(['sprites/2.png', 'sprites/3.png'], png2Image),
      body:              _.map(['sprites/4.png'], png2Image),
      shadow:            _.map(['sprites/11.png'], png2Image)
    },
    1: { // night
      player_idle:  _.map(['sprites/0a.png', 'sprites/0b.png'], png2Image),
      player_run:   _.map(['sprites/0a.png', 'sprites/1a.png'], png2Image),
      body:         _.map(['sprites/5.png'], png2Image),
      body_burning: _.map(['sprites/6a.png', 'sprites/6b.png'], png2Image),
      ghost:        _.map(['sprites/7.png'], png2Image),
      shadow:       _.map(['sprites/11.png'], png2Image)
    }
  }

  SOUNDS = {
    gunfire: new H.Howl({urls: ['audio/shot.wav']}),
    step:    new H.Howl({urls: ['audio/step.wav']})
  }

  function setCharacterAnimation (character, animation) {
    character.animation = animation;
  }

  function renderGunfire (context, gunfire, dt) {
    context.beginPath();

    var startX = gunfire.x;
    var startY = gunfire.y;
    var endX   = startX + gunfire.dir * gunfire.distance;
    var endY   = startY;

    startX += gunfire.dir * GUNFIRE_OFFSET_X;
    startY += GUNFIRE_OFFSET_Y;
    endX   -= gunfire.dir * GUNFIRE_OFFSET_X;
    endY   += GUNFIRE_OFFSET_Y;

    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.lineWidth = 2;
    context.strokeStyle = "#fff";
    context.stroke();
  }

  function renderCharacter (context, character, state, dt) {
    if (character.animT === undefined) {
      character.animT = 0;
      character.animIndex = 0;
    }

    var sprites = ANIMATIONS[state.time][character.animation];
    var sprite  = sprites[character.animIndex % sprites.length];
    var shadow  = ANIMATIONS[state.time]['shadow'][0];

    character.animT += dt;
    if (character.animT > ANIMATION_SPEED) {
      character.animT = 0;
      character.animIndex ++;
      character.animIndex %= sprites.length;

      if (character.animIndex === 0) {
        if (character.animation === 'player_run'||
            character.animation === 'player_run') {
          SOUNDS.step.play();
        }
      }
    }

    context.save();
    context.translate(character.x, character.y)
    if (character.dir < 0) context.scale(-1, 1);
    context.drawImage(sprite, -SPRITE_WIDTH / 2, -SPRITE_HEIGHT / 2, SPRITE_WIDTH, SPRITE_HEIGHT);
    context.drawImage(shadow, -SPRITE_WIDTH / 2, -SPRITE_HEIGHT / 2, SPRITE_WIDTH, SPRITE_HEIGHT);
    context.restore();
  }

  function clamp (num, min, max) {
      return num < min ? min : (num > max ? max : num);
  }

  var KEY_CODE_MAP = {
    37: 'a',
    38: 'w',
    39: 'd',
    40: 's',
    189: '-',
    187: '=',
    32: ' '
  }

  function bindInputs (inputs) {
    function getChar(e) {
      if (e.keyCode >= 48 && e.keyCode <= 90) {
        return String.fromCharCode(e.keyCode).toLowerCase();
      }

      if (e.keyCode in KEY_CODE_MAP) {
        return KEY_CODE_MAP[e.keyCode];
      }

      return null;
    }

    $(document).keydown(function (e) {
      var key = getChar(e);
      if (key) inputs[key] = true;
    });
    $(document).keyup(function (e) {
      var key = getChar(e);
      if (key) inputs[key] = false;
    });
  }

  var _background;
  function getBackground() {
    if (_background !== undefined) return _background;

    _background = document.createElement('canvas');
    _background.width  = WIDTH;
    _background.height = HEIGHT;

    context = _background.getContext('2d');

    var colors = ['#f3e2d3', '#f1dece', '#F0DBC9', '#EBD6C5', '#E6D0BE'];
    for (var i in colors) {
      context.fillStyle = colors[i];
      var startY = i * HEIGHT / colors.length;
      var endY   = startY + HEIGHT / colors.length;
      context.fillRect(0, startY, WIDTH, endY);
    }

    for (var i = 0; i < 50; i ++) {
      var x = Math.floor(Math.random() * 20) * WIDTH / 20;
      var y = Math.floor(Math.random() * 5) * HEIGHT / 5;
      context.fillStyle = 'rgba(50,50,50,0.04)';
      context.fillRect(x, y, WIDTH / 20, HEIGHT / 5);
    }

    for (var i = 0; i < 100; i ++) {
      var x = Math.floor(Math.random() * 40) * WIDTH / 40;
      var y = Math.floor(Math.random() * 10) * HEIGHT / 10;
      context.fillStyle = 'rgba(200,200,200,0.2)';
      context.fillRect(x, y, WIDTH / 40, HEIGHT / 10);
    }

    return _background;
  }

  function renderBackground(context) {
    context.drawImage(getBackground(), 0, 0, WIDTH, HEIGHT);
  }

  function generateNightOverlay(lightColor) {
    var width = 80;
    var height = 20;
    var cx = width * 0.5 - 0.5;
    var cy = height * 0.5 - 0.5;

    var el = document.createElement('canvas');
    el.width  = 80;
    el.height = 20;

    context = el.getContext('2d');

    for (var x = 0; x < width; x ++) {
      for (var y = 0; y < height; y ++) {
        var dx = x - cx;
        var dy = y - cy;
        var dist = Math.sqrt(dx*dx + dy*dy);

        var shadow = 1 - 1.0 / Math.sqrt(clamp(dist, 1, 10));;
        shadow = 0.4 + 0.6 * shadow;
        context.fillStyle = 'rgba(0,0,0,' + shadow + ')';
        context.fillRect(x, y, 1, 1);

        var light = 1.0 / clamp(dist, 1, 100);
        light = 0 + 0.3 * light;
        context.fillStyle = 'rgba(' + lightColor + ',' + light + ')';
        context.fillRect(x, y, 1, 1);
      }
    }

    return el;
  }

  var _nights;
  var _nightsT;
  var _nightsIndex;
  function getNightOverlay(dt) {
    if (_nights === undefined) {
      _nights = [];
      _nights.push(generateNightOverlay('255,200,100'));
      _nights.push(generateNightOverlay('255,185,80'));
      _nightsT = 0;
      _nightsIndex = 0;
    }

    _nightsT -= dt;
    if (_nightsT < 0) {
      _nightsIndex ++;
      _nightsT = 0.5 + Math.random() * ANIMATION_SPEED;
    }

    return _nights[_nightsIndex % _nights.length];
  }

  function renderNight(dt, context, player) {
    var overlay = getNightOverlay(dt);
    var w = WIDTH * 2;
    var h = HEIGHT * 2
    var x = player.x;
    var y = player.y;
    context.drawImage(overlay, x - w/2, y - h/2, w, h);
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

    this.state = {
      robber_next_spawn:     ROBBER_SPAWN_INTERVAL,
      robber_spawn_interval: ROBBER_SPAWN_INTERVAL,
      time:                  STATE_DAY
    }

    this.player  = createPlayer();
    this.robbers = [ createRobber() ];
    this.bodies  = [];
    this.effects = [];

    H.Howler.volume(0.1);

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
        //console.log(frameCount + " fps");
        frameCount = 0;
        frameStart = Date.now();
      }

      // run the game
      this.step(DT);

      setTimeout(loop.bind(this), 1000 * DT);
    };

    loop.bind(this)();
  }

  function moveCharacter (dt, character, vx, vy, speed) {
    var v = Math.sqrt(vx*vx + vy*vy);
    if (v > 1) {
      vx = vx / v;
      vy = vy / v;
    }

    character.vx = vx * speed;
    character.vy = vy * speed;
    character.v  = v  * speed;
    character.x  += dt * character.vx;
    character.y  += dt * character.vy;

    if (character.dir === undefined) character.dir = 1;

    if (character.vx > 1)  character.dir = 1;
    if (character.vx < -1) character.dir = -1;
  }

  function thinkPlayer (dt, inputs, player, state) {
    var vx = 0;
    var vy = 0;
    if (inputs.w) vy -= 1;
    if (inputs.s) vy += 1;
    if (inputs.a) vx -= 1;
    if (inputs.d) vx += 1;

    moveCharacter(dt, player, vx, vy, PLAYER_SPEED);

    if (inputs[' ']) {
      inputs[' '] = false;
      if (state.time === STATE_DAY) {
        player.firing = true;
        player.x -= player.dir * RECOIL_SOURCE;
      }
    }

    var animation = 'player';

    if (player.v < 1) {
      animation += '_idle';
    } else {
      animation += '_run';
    }

    player.animation = animation;
  }

  function createRobber () {
    return {
      x: Math.random() < 0.5 ? -ROBBER_SIZE / 2 : WIDTH + ROBBER_SIZE / 2,
      y: Math.random() * HEIGHT,
      size:  ROBBER_SIZE,
      type:  'robber',
      health: 1
    }
  }

  function createBody (robber) {
    return {
      x: robber.x,
      y: robber.y - 4,
      size: BODY_SIZE,
      type: 'body',
      dir:  -robber.hit_dir,
      animation: 'body'
    }
  }

  function createPlayer () {
    return {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      size:   PLAYER_SIZE,
      type:   'player',
      health: PLAYER_HEALTH
    }
  }

  function createGunfireEffect (x, y, dir, dist) {
    return {
      x: x,
      y: y,
      dir: dir,
      distance: dist,
      type: 'gunfire_effect'
    }
  }

  var ROBBER_RUN  = 0;
  var ROBBER_STOP = 1;
  var ROBBER_AIM  = 2;
  var ROBBER_FIRE = 3;
  var ROBBER_COOL = 4;

  var ROBBER_THINKS = [
    thinkRobberRun, thinkRobberStop, thinkRobberAim,
    thinkRobberFire, thinkRobberCool
  ]

  function chooseRobberRunGoal (robber) {
    var xRange = WIDTH * 0.3;
    var x = robber.x - (-0.5 + Math.random()) * xRange;
    x = clamp(x, robber.size, WIDTH - robber.size);

    var y = Math.random () * HEIGHT;
    y = clamp(y, robber.size, HEIGHT - robber.size);

    robber.run_x = x;
    robber.run_y = y;
  }

  function thinkRobberRun (dt, robber) {
    if (robber.run_x == undefined || robber.run_y == undefined) {
      chooseRobberRunGoal(robber);
    }

    var vx = robber.run_x - robber.x;
    var vy = robber.run_y - robber.y;
    moveCharacter(dt, robber, vx, vy, ROBBER_SPEED);

    if (Math.sqrt(vx * vx + vy * vy) < 1) {
      delete robber.run_x;
      delete robber.run_y;
      robber.state = ROBBER_STOP;
    }
  }

  function thinkRobberStop (dt, robber) {
    if (robber.stop_time == undefined) {
      robber.stop_time = ROBBER_STOP_TIME;
    }

    robber.vx = 0;
    robber.vy = 0;
    robber.v  = 0;
    robber.dir = robber.x < WIDTH / 2 ? 1 : -1;

    robber.stop_time -= dt;
    if (robber.stop_time < 0) {
      robber.state = ROBBER_AIM;
      delete robber.stop_time;
      return;
    }
  }

  function thinkRobberAim (dt, robber, rayTracer) {
    if (robber.aim_time == undefined) {
      robber.aim_time = ROBBER_AIM_TIME * Math.random()
                        + ROBBER_AIM_TIME / 2;
    }

    var intersection = rayTracer(robber);

    if (intersection !== null
        && intersection.character.type === 'player') {
      robber.state = ROBBER_FIRE;
      return;
    }

    robber.aim_time -= dt;
    if (robber.aim_time < 0) {
      robber.state = ROBBER_RUN;
      delete robber.aim_time;
      return;
    }
  }

  function thinkRobberFire (dt, robber) {
    if (robber.fire_time == undefined) {
      robber.fire_time = ROBBER_FIRE_DELAY;
    }

    robber.fire_time -= dt;
    if (robber.fire_time < 0) {
      robber.firing = true;
      robber.state = ROBBER_COOL;
      robber.x -= robber.dir * RECOIL_SOURCE;
      delete robber.fire_time;
      return;
    }
  }

  function thinkRobberCool (dt, robber) {
    if (robber.cool_time == undefined) {
      robber.cool_time = ROBBER_FIRE_DELAY;
    }

    robber.cool_time -= dt;
    if (robber.cool_time < 0) {
      robber.state = ROBBER_RUN;
      delete robber.cool_time;
      return;
    }
  }

  function thinkRobber (dt, robber, rayTracer) {
    if (robber.state === undefined) {
      robber.state = ROBBER_RUN;
    }

    ROBBER_THINKS[robber.state](dt, robber, rayTracer);

    var animation = 'robber';

    if (robber.v < 1) {
      animation += '_idle';
    } else {
      animation += '_run';
    }

    if (robber.state === ROBBER_COOL) {
      animation += '_shoot';
    }

    robber.animation = animation;
  }

  function thinkRobbers (dt, robbers, rayTracer) {
    for (var i in robbers) {
      var robber = robbers[i];
      thinkRobber(dt, robber, rayTracer);
    }
  }

  function generateRayTracer (all) {
    return function (source) {
      var dir = source.dir;
      var x = source.x;
      var y = source.y;

      function intersects (target) {
        if (target === source) return -1;

        var dy = target.y - y;
        if (Math.abs(dy) > target.size / 2) return -1;
        var dx = target.x - x;
        if (dx * dir > 0) return Math.abs(dx);
        return -1;
      }

      var result = null;
      for (var i in all) {
        var target = all[i];
        var distance = intersects(target);

        if (distance === -1) continue;
        if (result === null || distance < result.distance) {
          if (result === null) {
            result = {
              x: source.x, y: source.y, dir: dir
            };
          }
          result.distance = distance;
          result.character = target;
        }
      }

      return result;
    }
  }

  function thinkSpawn(dt, robbers, state) {
    state.robber_next_spawn -= dt;

    if (state.robber_next_spawn > 0) return;

    robbers.push(createRobber());
    state.robber_spawn_interval *= ROBBER_SPAWN_SCALE;
    state.robber_next_spawn     = state.robber_spawn_interval;
  }

  function thinkFiring(all, effects, rayTracer) {
    for (var i in all) {
      var character = all[i];
      if (!character.firing) continue;
      character.firing = false;

      SOUNDS.gunfire.play();

      var intersection = rayTracer(character);
      var distance = WIDTH;

      if (intersection !== null) {
        distance = intersection.distance;
        intersection.character.health --;
        intersection.character.hit_dir = intersection.dir;
        intersection.character.x += intersection.dir * RECOIL_TARGET;

      }

      effects.push(createGunfireEffect(
        character.x,
        character.y,
        character.dir,
        distance
      ));
    }
  }

  function renderAll(context, characters, bodies, effects, state, dt) {
    var all = characters.concat(effects).concat(bodies);
    var sorted = _.sortBy(all, function (obj) {
      return obj.y
    });

    for (var i in sorted) {
      var obj = sorted[i];
      if (obj.type === 'player'
          || obj.type === 'robber'
          || obj.type === 'ghost') {
        renderCharacter(context, obj, state, dt);
      }
      if (obj.type === 'body') {
        renderCharacter(context, obj, state, dt);
      }

      if (obj.type === 'gunfire_effect') {
        renderGunfire(context, obj, dt);
      }
    }
  }

  function thinkEffects(dt, effects) {
    for (var i in effects) {
      var effect = effects[i];

      if (effect.t === undefined) effect.t = 0;
      effect.t += dt;

      if (effect.type === 'gunfire_effect' && effect.t > GUNFIRE_RENDER_TIME) {
        effect.done = true;
      }
    }
  }

  var _mute = false;
  function thinkAudio (inputs) {
    if (inputs.m) {
      inputs.m = false;
      _mute = !_mute;
      if (_mute) {
        H.Howler.mute();
      } else {
        H.Howler.unmute();
      }
    }

    if (inputs['-']) {
      inputs['-'] = false;
      H.Howler.volume(H.Howler.volume() - 0.05);
    }

    if (inputs['=']) {
      inputs['='] = false;
      H.Howler.volume(H.Howler.volume() + 0.05);
    }
  }

  var _paused = false;
  function thinkPaused (inputs) {
    if (inputs.p) {
      inputs.p = false;
      _paused = !_paused;
    }

    return _paused;
  }

  function thinkState(state, inputs) {
    if (inputs.x) {
      inputs.x = false;
      if (state.time === STATE_DAY) {
        state.time = STATE_NIGHT;
      } else if (state.time === STATE_NIGHT) {
        state.time = STATE_DAY;
      }
    }
  }

  function thinkDead (player, robbers, bodies) {
    for (var i in robbers) {
      var robber = robbers[i];
      if (robber.health <= 0) {
        bodies.push(createBody(robber));
        robber.dead = true;
      }
    }
  }

  Game.prototype.step = function(dt) {
    if (thinkPaused(this.inputs)) {
      return;
    }

    thinkState(this.state, this.inputs);
    thinkAudio(this.inputs);
    thinkPlayer(dt, this.inputs, this.player, this.state);

    var allCharacters = [];

    if (this.state.time == STATE_DAY) {
      allCharacters = [this.player].concat(this.robbers);
      var rayTracer     = generateRayTracer(allCharacters);

      thinkSpawn(dt, this.robbers, this.state);
      thinkRobbers(dt, this.robbers, rayTracer);
      thinkFiring(allCharacters, this.effects, rayTracer);
      thinkDead(this.player, this.robbers, this.bodies);

    } else if (this.state.time == STATE_NIGHT) {
      allCharacters = [this.player];
    }

    thinkEffects(dt, this.effects);

    this.effects = _.filter(this.effects, function (effect) {
      return effect.done !== true;
    });

    this.robbers = _.filter(this.robbers, function (robber) {
      return robber.dead !== true;
    });

    renderBackground(this.bufferContext);
    if (this.state.time === STATE_NIGHT) {
      renderNight(dt, this.bufferContext, this.player);
    }

    renderAll(this.bufferContext, allCharacters, this.bodies,
              this.effects, this.state, dt);

    drawBuffer(this.canvasContext, this.buffer);
  }

  _.extend(Game.prototype, B.Events);

  return Game;
});
