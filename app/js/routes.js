"use strict";

angular.module('myApp.routes', ['ngRoute'])

 .config(['$routeProvider', function($routeProvider) {
    $routeProvider.when('/home', {
       templateUrl: 'partials/home.html',
       controller: 'HomeCtrl'
    });

    $routeProvider.when('/matchmaker', {
       templateUrl: 'partials/matchmaker.html',
       controller: 'matchmakerCtrl'
    });

    $routeProvider.when('/game/:game_id', {
       templateUrl: 'partials/game.html',
       controller: 'GameCtrl'
    });

    $routeProvider.otherwise({redirectTo: '/home'});
 }]);
