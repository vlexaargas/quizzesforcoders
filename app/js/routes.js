"use strict";

angular.module('myApp.routes', ['ngRoute'])

   // configure views; the authRequired parameter is used for specifying pages
   // which should only be available while logged in
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
   }]);
