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
    this.authenticated = FB.obj('/.info/authenticated');
    this.connected = FB.obj('/.info/connected');

    this.login_anon = function() {
      return auth_obj.$login('anonymous', { rememberMe: true });
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
    });

    $rootScope.$on('$firebaseSimpleLogin:logout', function() {
      that.current_user = null;
    });

  }
])

.service('Matchmaker', ['FB', 'FBAuth', '$q', '$timeout',
  function(FB, FBAuth, $q, $timeout) {
    var that = this;
    var deferred_game_id = $q.defer();

    // firebase references
    var $rooms           = FB.obj('/rooms'),
        $available_rooms = FB.obj('/available_rooms'),
        /* query */
        available_room   = FB.FbRef('/available_rooms').startAt().limit(1),
        $available_room  = FB.obj(available_room);

    this.game_id = deferred_game_id.promise;

    // match current player with an opponent, set up game
    // returns promise
    this.match = function() {
      return findGame().then(function(hasRoom) {
        if (!hasRoom) {
          return makeRoom();
        }
      });
    };

    function findGame() {
      var deferred = $q.defer();

      $available_room.$on('loaded', function(game) {
        if (game) {
          var game_id = Object.keys(game)[0],
              player_id = game[game_id];

          // do not match player with self
          if (FBAuth.current_user.id != player_id) {
            deferred.resolve(true);
            $available_room.$remove(game_id);
            pair(game_id);
          } else { deferred.resolve(false); }

        } else { deferred.resolve(false); }
      });

      return deferred.promise;
    }

    function makeRoom() {
      return $rooms
        .$add({ player1: FBAuth.current_user })
        .then(function(game) {
          deferred_game_id.resolve(game.name());
          return $available_rooms
            .$child(game.name())
            .$set(FBAuth.current_user.id);
        });
    }

    function pair(game_id) {
      var $game = $rooms.$child(game_id);
      $game.$child('player2').$set(FBAuth.current_user);
      prepareGame(game_id);
      deferred_game_id.resolve(game_id);
    }

    function prepareGame(game_id) {
      // add questions
      var $questions = $rooms.$child(game_id).$child('questions');
      $questions.$set([
        {q: "This"},
        {q: "is"},
        {q: "a"},
        {q: "question"},
        {q: "yay"}
      ]);
    }

    /*run test
    var that = this;
    $timeout(function() {
      that.match();
    }, 1000);
    */

  }
]);

})();

