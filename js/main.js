requirejs.config({
  baseUrl: 'js/',
  shim: {
    'lib/jquery': {
      exports: '$'
    },
    'lib/underscore': {
      exports: '_'
    }
  }
});

requirejs(['game'], function (Game) {
  var game = new Game();
});
