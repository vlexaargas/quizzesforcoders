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
    this.authenticated = FB.FbRef('/.info/authenticated');
    this.connected = FB.FbRef('/.info/connected');

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
          broadcastEvent(game.name());
          return $available_games
            .$child(game.name())
            .$set(FBAuth.current_user.id);
        });
    }

    function pair(game_id) {
      var $game = $games.$child(game_id);
      $game.$child('player2').$set(FBAuth.current_user);
      prepareGame(game_id);
      broadcastEvent(game_id);
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

    function broadcastEvent(game_id) {
      $rootScope.$emit(Events.gameFound, game_id);
    }

  }
])

.service('GameManager', ['FBAuth', '$location', '$rootScope',
  function(FBAuth, $location, $rootScope) {

    $rootScope.$on('matchmaker:gameFound', function(event, game_id) {
    });

  }
]);


})();

