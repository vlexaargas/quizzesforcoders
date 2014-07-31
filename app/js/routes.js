"use strict";

angular.module('myApp.routes', ['ngRoute'])

 .config(['$routeProvider', function($routeProvider) {
    $routeProvider.when('/home', {
       templateUrl: 'partials/home.html',
       controller: 'HomeCtrl'
    });

    $routeProvider.when('/game', {
       templateUrl: 'partials/game.html',
       controller: 'GameCtrl'
    });

    $routeProvider.otherwise({redirectTo: '/home'});
 }])

.run(['$rootScope', '$location', 'Auth',
  function($rootScope, $location, Auth) {
    // listen for route changes
    $rootScope.$on('$routeChangeStart', function(event, next, current) {
      if ($location.path() !== '/home') {
        if (!Auth.current_user) {
          $location.path('/home');
        }
      }
    });
  }
]);
