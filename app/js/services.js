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

.service('AngularfireCollection', ['AF', '$q',
  function(AF, $q) {

    this.list = function(cb, err) { // returns af ref
      var return_val;

      if (cb || err) {
        return_val = AF.ref(this.baseURL).$asArray().$loaded(cb, err);
      } else {
        return_val = AF.ref(this.baseURL).$asArray();
      }

      return return_val;
    };

    this.find = function (name, cb, err) { // returns af ref
      var return_val;

      if (cb || err) {
        return_val = AF.ref(this.baseURL+'/'+name).$asObject().$loaded(cb,err);
      } else {
        return_val = AF.ref(this.baseURL + '/' + name).$asObject();
      }

      return return_val;
    };

    this.push = function(data) {
      return this.list().$add(data);
    };

  }
])

.service('Game', ['AF', 'AngularfireCollection',
  function(AF, AngularfireCollection) {

    angular.extend(this, AngularfireCollection);

    Object.defineProperty(this, 'baseURL', {
      value: '/game', writable: false
    });

  }
])

.service('AvailableGame', ['AF', 'AngularfireCollection',
  function(AF, AngularfireCollection) {

    angular.extend(this, AngularfireCollection);

    Object.defineProperty(this, 'baseURL', {
      value: '/available_game', writable: false
    });

  }
])

.service('Matchmaker', ['AF', 'Auth', '$q', '$timeout', '$rootScope', 'Game',
         'AvailableGame',
  function(AF, Auth, $q, $timeout, $rootScope, Game, AvailableGame) {

    var cuid = Auth.current_user.id;

    /**
     * Match current user to a game.
     */
    this.match = function() {
      return findOrCreateWaitingRoom().then(enterWaitingRoom)
        .then(waitForMatch).then(enterGame).then(cleanup);
    };

    function findOrCreateWaitingRoom() {
      console.log('Loading waiting room...');

      var deferred        = $q.defer(),
          $available_game = null;

      AvailableGame.list(function(ag) {
        var first_child_name = ag[0] && ag[0].$id,
            has_current_user = !!ag.$getRecord(cuid);

        $available_game = !first_child_name || has_current_user ?
          AvailableGame.find(cuid): AvailableGame.find(first_child_name);

        deferred.resolve($available_game);
      });

      return deferred.promise;
    }

    function enterWaitingRoom($available_game) {
      console.log('Entering waiting room...');

      var deferred   = $q.defer(),
          player_num = null;

      $available_game.$loaded(function(available_game) {

        if (available_game.player1 && available_game.player1 !== cuid) {
          $available_game.player2 = cuid;
          $available_game.full = true;
        } else {
          $available_game.player1 = cuid;
        }

        $available_game.$save();
        deferred.resolve($available_game);
      });

      return deferred.promise;
    }

    function waitForMatch($available_game) {
      console.log('Waiting for match...');

      var deferred   = $q.defer();

      $available_game.$loaded(function(available_game) {
        if (available_game.full) {
          console.log('Match found!');
          deferred.resolve($available_game);
        }
      });

      var unwatch = $available_game.$watch(function(change) {
        if ($available_game.full) {
          console.log('Match found!');
          unwatch();
          deferred.resolve($available_game);
        }
      });

      return deferred.promise;
    }

    function enterGame($available_game) {
      console.log('Entering game...');

      var player_num = $available_game.player1 === cuid ? 1 : 2,
          deferred   = $q.defer(),
          game       = null;

      if (player_num === 1) {
        Game.push({
          player1: $available_game.player1,
          player2: $available_game.player2,
        }).then(function(game) {
          $available_game.game_id = game.name();
          $available_game.$save();

          $rootScope.$emit('matchmaker:gameFound', Game.find(game.name()),
                           player_num);

          deferred.resolve($available_game);
        });
      }

      return deferred.promise;
    }

    function cleanup($available_game) {
      console.log('Entering game...');
      console.log($available_game);

    }

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
