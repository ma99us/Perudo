// import config constants
import {API} from "/config/config-constant.js";

// import app services
import {LocalStorageService} from "/services/local-storage-service.js";
import {HostStorageService} from "/services/host-storage-service.js";
import {MessageBusService} from "/services/message-bus-service.js";

// import app components
import {GameComponent} from "/game/game-component.js";

export const GameModule = angular
  .module('game', [])
  .constant('API', API)
  .service('LocalStorageService', LocalStorageService)
  .service('HostStorageService', HostStorageService)
  .service('MessageBusService', MessageBusService)
  .component('game', GameComponent)
  .name;