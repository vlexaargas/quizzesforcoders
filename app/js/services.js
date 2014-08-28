(function() {
'use strict';

angular.module('myApp.services', ["firebase"])

.service('FB', ['FBURL',
  function(FBURL) {

    this.ref = function(path) {
      return new Firebase(FBURL + path);
    };

  }
])

.service('AF', ['FBURL', '$firebase', 'FB',
  function(FBURL, $firebase, FB) {

    this.ref = function(arg) {
      if (typeof  arg === 'string') {
        return $firebase(FB.ref(arg));
      } else {
        return $firebase(arg);
      }
    };

  }
])

.service('Auth', ['FBURL', '$firebaseSimpleLogin', 'current_user',
  function(FBURL, $firebaseSimpleLogin, current_user) {

    var auth_obj = $firebaseSimpleLogin(new Firebase(FBURL));

    this.login_anon = function() {
      return auth_obj.$getCurrentUser().then(function(user) {
        if (!user) {
          return auth_obj.$login('anonymous', {rememberMe: true});
        }
      });
    };

    this.logout = function() {
      auth_obj.$logout();
    };

  }
])

.factory('current_user', ['$rootScope',
  function($rootScope) {

    var current_user = {};

    $rootScope.$on('$firebaseSimpleLogin:login', function(event, user) {
      console.log('Logged in as:', user.id);
      for (var attr in user) {
        if (user.hasOwnProperty(attr)) {
          current_user[attr] = user[attr];
        }
      }
    });

    $rootScope.$on('$firebaseSimpleLogin:logout', function() {
      console.log('Logged out');
      for (var attr in current_user) {
        if (current_user.hasOwnProperty(attr)) {
          delete current_user[attr];
        }
      }
    });

    return current_user;

  }
])

.factory('AFCollection', ['AF', '$q',
  function(AF, $q) {

    var constructor = function(baseURL) {
      Object.defineProperty(this, 'baseURL', {
        value: baseURL, writable: false
      });
      Object.defineProperty(this, '$fbref', {
        value: AF.ref(this.baseURL),
        writable: false,
      });
    };

    function asObject(ref) {
      return AF.ref(ref).$asObject().$loaded();
    }

    constructor.prototype = {

      list: function() {
        return this.$fbref.$asArray().$loaded();
      },

      first: function() {
        var self = this;
        return self.list().then(function(list){
          var key = list.$keyAt(0);
          return key ? self.find(key) : null;
        });
      },

      find: function (name) {
        return asObject(this.$fbref.$ref().child(name));
      },

      remove: function(param) {
        name = typeof param === 'string' ? param : param.$id;
        return this.$fbref.$remove(name);
      },

      push: function(data, cb) {
        return this.list().then(function(list) {
          return list.$add(null);
        }).then(cb)
        .then(function(ref) {
          ref.set(data);
          return asObject(ref);
        });
      }

    };

    return constructor;

  }
])

.factory('Games', ['AFCollection',
  function(AFCollection) {
    return new AFCollection('/games');
  }
])

.factory('AvailableGames', ['AFCollection',
  function(AFCollection) {
    return new AFCollection('/available_games');
  }
])

.service('Matchmaker', ['AF', '$q', '$timeout', '$rootScope', 'Games',
         'AvailableGames', '$location',
  function(AF, $q, $timeout, $rootScope, Games, AvailableGames, $location) {

    var data = {
      name: null,
      game: null,
      availableGame: null
    };

    this.match = function(user) {
      data.user = user;
      return findAvailableGame().then(enterGame).then(waitForMatch).then(route);
    };

    this.cleanup = function() {
      var game = data.game, availableGame = data.availableGame;
      availableGame && AvailableGames.remove(availableGame);
      game && !(game.player1 && game.player2) && Games.remove(game);
    };

    function findAvailableGame() {
      return AvailableGames.first().then(function(availableGame) {
        if (canEnterGame(availableGame)) {
          return availableGame;
        } else {
          return createGame();
        }
      });
    }

    function enterGame(availableGame) {
      data.availableGame = availableGame;
      return Games.find(availableGame.game_id).then(function(game) {
        var gameData = {};
        var player = game.player1 ? "player2" : "player1";
        gameData[player] = data.user;
        if (game.$value === 'empty' ) {
          gameData.available_game_id = availableGame.$id;
          game.$inst().$set(gameData);
        } else {
          var inst = game.$inst();
          inst.$ref().onDisconnect().remove();
          inst.$update(gameData);
        }
        return game;
      });
    }

    function waitForMatch(game) {
      data.game = game;
      var deferred = $q.defer();
      function resolve() {
        if (game.player1 && game.player2) {
          deferred.resolve(game);
        }
      }
      game.$watch(resolve);
      resolve();
      return deferred.promise;
    }


    function route(game) {
      $location.path('/game/' + game.$id);
    }

    function createGame() {
      return Games.push('empty', destroyOnSessionEnd).then(function(game) {
        return AvailableGames.push({
          game_id: game.$id,
          player1: data.user.id,
        }, destroyOnSessionEnd);
      });
    }

    function canEnterGame(availableGame) {
      return availableGame && (availableGame.player1 !== data.user.id);
    }

    function destroyOnSessionEnd(ref) {
      var deferred = $q.defer();
      ref.onDisconnect().remove();
      deferred.resolve(ref);
      return deferred.promise;
    }

  }
]);

})();
