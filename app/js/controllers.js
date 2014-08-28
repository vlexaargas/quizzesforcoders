(function() {
'use strict';

angular.module('myApp.controllers', [])

.controller('RootCtrl', ['$scope', 'Auth',
  function($scope, Auth) {

    $scope.ready = false;

    Auth.login_anon().then(function() {
      $scope.ready = true;
    });

    // this is just in here for testing
    $scope.logout = function() {
      Auth.logout();
    };

  }
])

.controller('HomeCtrl', ['$scope',
  function($scope) { }
])

.controller('matchmakerCtrl', ['$scope', 'current_user', 'Matchmaker',
  function($scope, current_user, Matchmaker) {

    Matchmaker.match(current_user);

    $scope.$on('$destroy', function() {
      Matchmaker.cleanup();
    });

  }
])

.controller('GameCtrl', [
  function() {
  }
]);

}());
