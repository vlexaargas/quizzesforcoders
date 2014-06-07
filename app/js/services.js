(function() {
'use strict';

angular.module('myApp.services', ["firebase"])

.service('FB', ['FBURL', '$firebase',
  function(FBURL, $firebase, $firebaseSimpleLogin) {

    this.obj = function(arg) {
      if (typeof  arg === 'string') {
        return $firebase(this.FbRef(arg));
      } else {
        return $firebase(arg);
      }
    };

    this.FbRef = function(path) {
      return new Firebase(FBURL + path);
    };

  }
])

.service('FBAuth', ['FB', 'FBURL', '$firebaseSimpleLogin', '$rootScope', '$q', '$timeout',
  function(FB, FBURL, $firebaseSimpleLogin, $rootScope, $q, $timeout) {

    var auth_obj = $firebaseSimpleLogin(new Firebase(FBURL));

    this.current_user = null;

    this.login_anon = function() {
      return auth_obj.$getCurrentUser().then(function(user) {
        if (!user) {
          return auth_obj.$login('anonymous', {rememberMe: true});
        }
      });
    };

    this.logout = function() {
      var deferred = $q.defer();
      auth_obj.$logout();
      $timeout(function() {
        deferred.reject();
      }, 3000);
      $rootScope.$on('$firebaseSimpleLogin:logout', function() {
        deferred.resolve();
      });
      return deferred.promise;
    };

    var that = this;
    $rootScope.$on('$firebaseSimpleLogin:login', function(event, user) {
      that.current_user = user;
      console.log('Login as:', user.id);
    });

    $rootScope.$on('$firebaseSimpleLogin:logout', function() {
      that.current_user = null;
    });

  }
])

.service('Matchmaker', ['FB', 'FBAuth', '$q', '$timeout', '$rootScope',
  function(FB, FBAuth, $q, $timeout, $rootScope) {
    var that = this;
    var deferred_game_id = $q.defer();

    var Events =  {
      gameFound: 'matchmaker:gameFound'
    };

    // firebase references
    var $games           = FB.obj('/games'),
        $available_games = FB.obj('/available_games'),
        $users = FB.obj('/users'),
        /* query */
        available_game   = FB.FbRef('/available_games').startAt().limit(1),
        $available_game  = FB.obj(available_game);

    this.game_id = deferred_game_id.promise;

    // match current player with an opponent, set up game
    // returns promise
    this.match = function() {
      return findGame().then(function(hasGame) {
        if (!hasGame) {
          return makeGame();
        }
      });
    };

    function findGame() {
      var deferred = $q.defer();

      $available_game.$on('loaded', function(game) {
        if (game) {
          var game_id = Object.keys(game)[0],
              player_id = game[game_id];

          // do not match player with self
          if (FBAuth.current_user.id != player_id) {
            deferred.resolve(true);
            $available_game.$remove(game_id);
            pair(game_id);
          } else { deferred.resolve(false); }

        } else { deferred.resolve(false); }
      });

      return deferred.promise;
    }

    function makeGame() {
      return $games
        .$add({ player1: FBAuth.current_user })
        .then(function(game) {
          broadcastEvent(game.name(), 'player1');
          return $available_games
            .$child(game.name())
            .$set(FBAuth.current_user.id);
        });
    }

    function pair(game_id) {
      var $game = $games.$child(game_id);
      $game.$child('player2').$set(FBAuth.current_user);
      prepareGame(game_id);
      broadcastEvent(game_id, 'player2');
    }

    function prepareGame(game_id) {
      // add questions
      var $questions = $games.$child(game_id).$child('questions');
      $questions.$set([
        {q: "This"},
        {q: "is"},
        {q: "a"},
        {q: "question"},
        {q: "yay"}
      ]);
    }

    function broadcastEvent(game_id, player_num) {
      $rootScope.$emit(Events.gameFound, game_id, player_num);
    }

  }
])

.service('GameManager', ['FB', '$q', '$rootScope', '$location',
  function(FB, $q, $rootScope, $location) {
    // init
    var that = this;

    // firebase references
    var $game = null;

    // 'local' variables
    var deferred_game_ref = $q.defer();
    var authenticated = FB.FbRef('/.info/authenticated');
    var connected = FB.FbRef('/.info/connected');
    var player = null;

    // 'class' variables
    this.game = deferred_game_ref.promise;

    /**
     * MANAGE PLAYERS
     **/
    $rootScope.$on('matchmaker:gameFound', function(event, game_id, player_num) {
      // resolve game promise
      $game = FB.obj('/games/' + game_id);
      deferred_game_ref.resolve($game);

      // get player ref - lol, angularfire object does not have 'onDisconnect'
      player = FB.FbRef('/games/' + game_id + '/' + player_num);

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

