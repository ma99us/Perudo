// import config constants
import {API} from "../config/config-constant.js";

// import app services
import {LocalStorageService} from "../services/local-storage-service.js";
import {HostStorageService} from "../services/host-storage-service.js";
import {MessageBusService} from "../services/message-bus-service.js";
import {AlertService} from "../services/alert-service.js";

// import game services
import {LobbyService} from "./lobby-service.js";
import {PlayerService} from "./player-service.js";

// import app components
import {LobbyComponent} from "./lobby/lobby-component.js";
import {GameComponent} from "./game-component.js";
import {GameBoardComponent} from "./board/game-board-component.js";
import {GameScoreComponent} from "./score/game-score-component.js";

// directives
import {LobbyPlayerDirective} from "./lobby/lobby-player-directive.js";
import {GameBoardDiceDirective} from "./board/dice-directive.js";   //TODO: should not be global
import {GameBoardNumInputDirective} from "./board/num-input-directive.js";   //TODO: should not be global
import {GameBoardDiceInputDirective} from "./board/dice-input-directive.js";   //TODO: should not be global

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
  .directive('dice', GameBoardDiceDirective)
  .directive('numInput', GameBoardNumInputDirective)
  .directive('diceInput', GameBoardDiceInputDirective)
  .name;