// import angular from './lib/angular';
import "./lib/angular-route/angular-route.js";
import "./lib/angular-resource/angular-resource.js";
import "./lib/angular-sanitize/angular-sanitize.js";

import {HomeModule} from "./home/home-module.js";
import {GameModule} from "./game/game-module.js";

export const App = angular.module('App', [
  'ngRoute',
  'ngSanitize',
  'ngWebSocket',
  HomeModule,
  GameModule
]).config(function ($locationProvider, $routeProvider, $sceDelegateProvider) {
  'ngInject';

  $locationProvider.hashPrefix('');

  $routeProvider
    .when('/:id', {
      template: '<game></game>'
    })
    .when('/', {
      template: '<home></home>'
    })
    .otherwise('/');

  $sceDelegateProvider.resourceUrlWhitelist([
    // Allow same origin resource loads.
    'self',
    // Allow loading from our assets domain.  Notice the difference between * and **.
    'http://ghost:8181/mike-db/**',
    'http://gerdov.com/mike-db/**'
    //'ws://gerdov.com/mike-db/**'
  ]);
})
  .controller(function ($scope) {
    'ngInject';

  })
  .run(function () {
    'ngInject';
    console.log("App started");
  })
  .name;

angular.bootstrap(document.documentElement, [App]);