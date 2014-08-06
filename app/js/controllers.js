'use strict';

/* Controllers */

angular.module('myApp.controllers', [])

.controller('RootCtrl', ['$scope', 'Auth', 'GameManager', 'current_user',
  function($scope, Auth, GameManager, current_user) {

    // scoped variables
    $scope.logout = function() {
      Auth.logout();
    };
    Auth.login_anon();
  }
])

.controller('HomeCtrl', [
  function() {
  }
])

.controller('GameCtrl', ['$scope', 'Matchmaker', 'GameManager', 'Auth',
  function($scope, Matchmaker, GameManager, Auth) {

    Matchmaker.match();

    //$scope.game = "loading";
    //$scope.player = FBAuth.current_user;

    //// match current player to game

    //GameManager.game.then(function(game) {
      //$scope.game = game;
    //});

  }
]);
