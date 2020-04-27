// import config constants
import {API} from "../config/config-constant.js";

// import app services
import {LocalStorageService} from "../services/local-storage-service.js";
import {HostStorageService} from "../services/host-storage-service.js";
import {MessageBusService} from "../services/message-bus-service.js";

// import app components
import {HomeComponent} from "./home-component.js";
import {ChatComponent} from "../chat/chat-component.js";

// directives
import {HomeLobbyDirective} from "./home-lobby/home-lobby-directive.js";

export const HomeModule = angular
  .module('home', [])
  .constant('API', API)
  .service('LocalStorageService', LocalStorageService)
  .service('HostStorageService', HostStorageService)
  .service('MessageBusService', MessageBusService)
  .component('home', HomeComponent)
  .component('chat', ChatComponent)
  .directive('homeLobby', HomeLobbyDirective)
  .name;