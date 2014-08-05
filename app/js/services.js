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

.service('Auth', ['FBURL', '$firebaseSimpleLogin', '$rootScope', '$q', '$timeout',
  function(FBURL, $firebaseSimpleLogin, $rootScope, $q, $timeout) {

    var auth_obj = $firebaseSimpleLogin(new Firebase(FBURL));

    var that = this;

    this.login_anon = function() {
      return auth_obj.$getCurrentUser().then(function(user) {
        if (!user) {
          return auth_obj.$login('anonymous', {rememberMe: false});
        }
      });
    };

    this.logout = function() {
      if (that.current_user) {
        var deferred = $q.defer();
        auth_obj.$logout();
        $timeout(function() {
          deferred.reject();
        }, 3000);
        $rootScope.$on('$firebaseSimpleLogin:logout', function() {
          deferred.resolve();
        });
        return deferred.promise;
      }
    };

    this.current_user = null;

    $rootScope.$on('$firebaseSimpleLogin:login', function(event, user) {
      that.current_user = user;
      console.log('Logged in as:', user.id);
    });

    $rootScope.$on('$firebaseSimpleLogin:logout', function() {
      that.current_user = null;
      console.log('Logged out');
    });

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
    }

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

      remove: function(name) {
        return this.$fbref.$remove(name);
      },

      push: function(data) {
        return this.list().then( function(list) {
          return list.$add(data);
        }).then(function(ref) {
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

.factory('AvailableGames', ['Collection',
  function(Collection) {
    return new Collection('/available_games');
  }
])

.service('Matchmaker', ['AF', '$q', '$timeout', '$rootScope', 'Games',
         'AvailableGames',
  function(AF, $q, $timeout, $rootScope, Games, AvailableGames) {


    /**
     * Match current user to a game.
     */
    this.match = function(user) {
      return findAvailableGame().then(enterGame).then(waitForMatch).then(cleanUp);

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
        return Games.find(availableGame.game_id).then(function(game) {

          var gameData = {};
          var player = game.player1 ? "player2" : "player1";

          gameData[player] = user;

          if (game.$value === 'empty' ) {
            gameData['available_game_id'] = availableGame.$id;
            game.$inst().$set(gameData);
          } else {
            game.$inst().$update(gameData);
          }

          return game;
        });
      }

      function waitForMatch(game) {
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

      function cleanUp(game) {
        AvailableGames.remove(game.available_game_id);
        game.available_game_id = null;
        game.save();

        return game;
      }

      function createGame() {
        return Games.push('empty').then(function(game) {
          return AvailableGames.push({
            game_id: game.$id,
            player1: user.id,
          })
        });
      }

      function canEnterGame(availableGame) {
        return availableGame && (availableGame.player1 !== user.id);
      }

    };
  }
])

.service('GameManager', ['FB', 'AF', '$q', '$rootScope', '$location',
  function(FB, AF, $q, $rootScope, $location) {

    return;

    // init
    var that = this;

    // firebase references
    var $game = null;

    // 'local' variables
    var deferred_game_ref = $q.defer();
    var authenticated = FB.ref('/.info/authenticated');
    var connected = FB.ref('/.info/connected');
    var player = null;

    // 'class' variables
    this.game = deferred_game_ref.promise;

    /**
     * MANAGE PLAYERS
     **/
    $rootScope.$on('matchmaker:gameFound', function(event, game_id, player_num) {
      // resolve game promise
      $game = AF.ref('/games/' + game_id);
      deferred_game_ref.resolve($game);

      // get player ref - lol, angularfire object does not have 'onDisconnect'
      player = FB.ref('/games/' + game_id + '/' + player_num);

      // handle session-end and refresh
      connected.on('value', function(snap) {
        if (snap.val() === true) {
          player.onDisconnect().remove();
        }
      });

      // handle back/forward on history
      $rootScope.$on('$routeChangeStart', function() {
        if ($location.path() === '/home') {
          player.remove();
          // reset promise
          deferred_game_ref = $q.defer();
          that.game = deferred_game_ref.promise;
        }
      });
    });

    /**
     * MANAGE GAMES
     **/
    this.game.then(function($game) {
      $game.$on('change', function() {
        // if player 2 leaves...
        if ($game.questions && $game.player1 && !$game.player2) {
          console.log('player 2 left');

        // if player 1 leaves...
        } else if ($game.questions && $game.player2 && !$game.player1) {
          console.log('player 1 left');

        // if both players leave...
        } else if ($game.questions && !$game.player2 && !$game.player1) {
          $game.$remove();
        }
      });
    });

  }
]);

})();
