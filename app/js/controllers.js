'use strict';

/* Controllers */

angular.module('myApp.controllers', [])

.controller('RootCtrl', ['FBAuth',
  function(FBAuth) {
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

    // bind firebase data
    Matchmaker.game_id.then(function(game_id) {
      $scope.game = FB.obj('/rooms/' + game_id);
      $scope.game.$bind($scope, 'remoteGame');
    });

    $scope.add = function() {
      $scope.remoteGame.questions.push({q: "sweet"});
    };
  }
]);
