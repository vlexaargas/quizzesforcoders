'use strict';

/* Controllers */

angular.module('myApp.controllers', [])

.controller('RootCtrl', ['$scope', 'FBAuth', 'GameManager',
  function($scope, FBAuth, GameManager) {
    // scoped variables
    $scope.logout = function() {
      FBAuth.logout()
    }
    FBAuth.login_anon();
  }
])

.controller('HomeCtrl', [
  function() {
  }
])

.controller('GameCtrl', ['$scope', 'Matchmaker', 'GameManager', 'FBAuth',
  function($scope, Matchmaker, GameManager, FBAuth) {

    $scope.game = "loading";
    $scope.player = FBAuth.current_user;

    // match current player to game
    Matchmaker.match();

    GameManager.game.then(function(game) {
      $scope.game = game;
    });

  }
]);
