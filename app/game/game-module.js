// import config constants
import {API} from "/config/config-constant.js";

// import app services
import {LocalStorageService} from "/services/local-storage-service.js";
import {HostStorageService} from "/services/host-storage-service.js";
import {MessageBusService} from "/services/message-bus-service.js";
import {AlertService} from "/services/alert-service.js";
// import game services
import {LobbyService} from "/game/lobby-service.js";
import {PlayerService} from "/game/player-service.js";

// import app components
import {LobbyComponent} from "/game/lobby/lobby-component.js";
import {GameComponent} from "/game/game-component.js";
import {GameBoardComponent} from "/game/board/game-board-component.js";
import {GameScoreComponent} from "/game/score/game-score-component.js";

// directives
import {LobbyPlayerDirective} from "/game/lobby/lobby-player-directive.js";

export const GameModule = angular
  .module('game', [])
  .constant('API', API)
  .service('LocalStorageService', LocalStorageService)
  .service('HostStorageService', HostStorageService)
  .service('MessageBusService', MessageBusService)
  .service('AlertService', AlertService)
  .service('LobbyService', LobbyService)
  .service('PlayerService', PlayerService)
  .component('game', GameComponent)
  .component('lobby', LobbyComponent)
  .component('board', GameBoardComponent)
  .component('score', GameScoreComponent)
  .directive('lobbyPlayer', LobbyPlayerDirective)
  .name;