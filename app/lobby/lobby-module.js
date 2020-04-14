// import config constants
import {API} from "/config/config-constant.js";

// import app services
import {LocalStorageService} from "/services/local-storage-service.js";
import {HostStorageService} from "/services/host-storage-service.js";
import {MessageBusService} from "/services/message-bus-service.js";

// import app components
import {LobbyComponent} from "/lobby/lobby-component.js";

// directives
import {LobbyPlayerDirective} from "/lobby/lobby-player/lobby-player-directive.js";

export const GameLobbyModule = angular
  .module('game.lobby', [])
  .constant('API', API)
  .service('LocalStorageService', LocalStorageService)
  .service('HostStorageService', HostStorageService)
  .service('MessageBusService', MessageBusService)
  .component('lobby', LobbyComponent)
  .directive('lobbyPlayer', LobbyPlayerDirective)
  .name;