'use strict';

/* Controllers */

angular.module('myApp.controllers', [])

.controller('RootCtrl', ['$scope', 'FBAuth', 'GameManager',
  function($scope, FBAuth, GameManager) {
    FBAuth.login_anon();
  }
])

.controller('HomeCtrl', [
  function() {
  }
])

.controller('GameCtrl', ['$scope', 'Matchmaker', 'FB', 'FBAuth',
  function($scope, Matchmaker, FB, FBAuth) {
    $scope.game = null;
    $scope.player = FBAuth.current_user;

    // match current player to game
    Matchmaker.match();

    $scope.add = function() {
      $scope.remoteGame.questions.push({q: "sweet"});
    };
  }
]);
