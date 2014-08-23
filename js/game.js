define(function (require) {
  var B = require('lib/backbone');
  var _ = require('lib/underscore')
  var $ = require('lib/jquery');

  var FPS = 60.0;
  var DT  = 1.0 / FPS;

  var WIDTH  = 20 * 12 * 3;
  var HEIGHT = 5 * 12 * 3;

  var SPRITE_WIDTH  = 14 * 3;
  var SPRITE_HEIGHT = 14 * 3;

  var PLAYER_HEALTH = 10;

  var PLAYER_SPEED = 80;
  var ROBBER_SPEED = 30;

  var ROBBER_SPAWN_INTERVAL = 10;
  var ROBBER_SPAWN_SCALE    = 0.98;

  var ROBBER_STOP_TIME     = 1.0;
  var ROBBER_AIM_TIME      = 3.0;
  var ROBBER_FIRE_DELAY    = 0.5;
  var ROBBER_COOLDOWN_TIME = 1.0;

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

  function clamp (num, min, max) {
      return num < min ? min : (num > max ? max : num);
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

    this.state = {
      robber_spawn_time:     ROBBER_SPAWN_INTERVAL,
      robber_spawn_interval: ROBBER_SPAWN_INTERVAL
    }

    this.player  = createPlayer();
    this.robbers = [ createRobber() ];
    this.bodies  = [];
    this.effects = [];

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
  }

  function thinkPlayer (dt, inputs, player) {
    var vx = 0;
    var vy = 0;
    if (inputs.w) vy -= 1;
    if (inputs.s) vy += 1;
    if (inputs.a) vx -= 1;
    if (inputs.d) vx += 1;

    moveCharacter(dt, player, vx, vy, PLAYER_SPEED);

    if (player.animation === undefined) {
      player.animation = 'player_day_idle';
    }

    if (player.v < 1) {
      player.animation = 'player_day_idle';
    } else {
      player.animation = 'player_day_run';
    }

    if (player.vx > 1)  player.dir = 1;
    if (player.vx < -1) player.dir = -1;
  }

  function createRobber () {
    return {
      x: Math.random() < 0.5 ? -SPRITE_WIDTH / 2 : WIDTH + SPRITE_WIDTH / 2,
      y: Math.random() * HEIGHT,
      type:  'robber',
      heatlh: 1
    }
  }

  function createPlayer () {
    return {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      type:   'player',
      health: PLAYER_HEALTH
    }
  }

  var ROBBER_RUN  = 0;
  var ROBBER_STOP = 1;
  var ROBBER_AIM  = 2;
  var ROBBER_FIRE = 3;
  var ROBBER_COOL = 4;

  function chooseRobberRunGoal (robber) {
    var xRange = WIDTH * 0.3;
    var x = robber.x - (-0.5 + Math.random()) * xRange;
    x = clamp(x, SPRITE_WIDTH, WIDTH - SPRITE_WIDTH);

    var y = Math.random () * HEIGHT;
    y = clamp(y, SPRITE_WIDTH, HEIGHT - SPRITE_WIDTH);

    robber.run_x = x;
    robber.run_y = y;
  }

  function thinkRobberRun (dt, t, robber) {
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

  function thinkRobberStop (dt, t, robber) {
    if (robber.stop_time == undefined) {
      robber.stop_time = t + ROBBER_STOP_TIME;
    }

    robber.vx = 0;
    robber.vy = 0;
    robber.v  = 0;
    robber.dir = robber.x < WIDTH / 2 ? 1 : -1;

    if (t > robber.stop_time) {
      robber.state = ROBBER_AIM;
      delete robber.stop_time;
      return;
    }
  }

  function thinkRobberAim (dt, t, robber, rayTracer) {
    if (robber.aim_time == undefined) {
      robber.aim_time = t + ROBBER_AIM_TIME;
    }

    var intersection = rayTracer(robber.x, robber.y, robber.dir);

    if (intersection !== null) {
      if (intersection.character.type === 'player') {
        robber.state = ROBBER_FIRE;
        return;
      }
    }

    if (t > robber.aim_time) {
      robber.state = ROBBER_RUN;
      delete robber.aim_time;
      return;
    }
  }

  function thinkRobberFire (dt, t, robber) {
    if (robber.fire_time == undefined) {
      robber.fire_time = t + ROBBER_FIRE_DELAY;
    }

    if (t > robber.fire_time) {
      robber.firing = true;
      robber.state = ROBBER_COOL;
      delete robber.fire_time;
      return;
    }
  }

  function thinkRobberCool (dt, t, robber) {
    if (robber.cool_time == undefined) {
      robber.cool_time = t + ROBBER_FIRE_DELAY;
    }

    if (t > robber.cool_time) {
      robber.state = ROBBER_RUN;
      delete robber.cool_time;
      return;
    }
  }

  function thinkRobber (dt, t, robber, rayTracer) {
    if (robber.state == undefined) {
      robber.state = ROBBER_RUN;
    }

    if (robber.state == ROBBER_RUN) {
      thinkRobberRun(dt, t, robber);
    } else if (robber.state == ROBBER_STOP) {
      thinkRobberStop(dt, t, robber);
    } else if (robber.state == ROBBER_AIM) {
      thinkRobberAim(dt, t, robber, rayTracer);
    } else if (robber.state == ROBBER_FIRE) {
      thinkRobberFire(dt, t, robber);
    } else if (robber.state == ROBBER_COOL) {
      thinkRobberCool(dt, t, robber);
    }

    if (robber.animation === undefined) {
      robber.animation = 'robber_idle';
    }

    if (robber.v < 1) {
      robber.animation = 'robber_idle';
    } else {
      robber.animation = 'robber_run';
    }

    if (robber.vx > 1)  robber.dir = 1;
    if (robber.vx < -1) robber.dir = -1;
  }

  function thinkRobbers (dt, t, robbers, rayTracer) {
    for (var i in robbers) {
      var robber = robbers[i];
      thinkRobber(dt, t, robber, rayTracer);
    }
  }

  function generateRayTracer (all) {
    return function (x, y, dir) {
      x += dir * SPRITE_WIDTH * 0.75;

      function intersects (character) {
        var dy = character.y - y;
        if (Math.abs(dy) > SPRITE_HEIGHT / 2) return -1;
        var dx = character.x - x;
        if (dx * dir > 0) return Math.abs(dx);
        return -1;
      }

      var result = null;
      for (var i in all) {
        var character = all[i];
        var distance = intersects(character);

        if (distance === -1) continue;
        if (result === null || distance < result.distance) {
          if (result === null) result = {};
          result.distance = distance;
          result.character = character;
        }
      }

      return result;
    }
  }

  function spawnRobbers(t, robbers, state) {
    if (t > state.robber_spawn_time) {
      robbers.push(createRobber());

      state.robber_spawn_interval *= ROBBER_SPAWN_SCALE;
      state.robber_spawn_time     += state.robber_spawn_interval;
    }
  }

  function renderCharacters(context, characters, dt) {
    var sorted = _.sortBy(characters, function (character) {
      return character.y
    });

    for (var i in sorted) {
      renderCharacter(context, sorted[i], dt);
    }
  }

  function thinkFiring(t, all, effects, rayTracer) {
    for (var i in all) {
      var character = all[i];
      if (!character.firing) continue;
      character.firing = false;

      var intersection = rayTracer(character.x, character.y, character.dir);
      var distance = intersection ? intersection.distance : WIDTH;

      effects.push({
        x: character.x + SPRITE_WIDTH
        t: t
      });

      if (intersection !== null) {
        intersection.character.health --;
        console.log("HIT", intersection.character));
      }
    }
  }

  Game.prototype.step = function(dt) {
    this.t += dt;

    spawnRobbers(this.t, this.robbers, this.state);

    var allCharacters = [this.player].concat(this.robbers);
    var rayTracer     = generateRayTracer(allCharacters);

    thinkPlayer(dt, this.inputs, this.player);
    thinkRobbers(dt, this.t, this.robbers, rayTracer);
    thinkFiring(t, allCharacters, this.effects rayTracer);

    renderBackground(this.bufferContext);
    renderCharacters(this.bufferContext, allCharacters, dt);

    drawBuffer(this.canvasContext, this.buffer);
  }

  _.extend(Game.prototype, B.Events);

  return Game;
});
