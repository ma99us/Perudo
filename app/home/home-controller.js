// import {LocalStorageService} from "../services/local-storage-service";

export class HomeController {
  constructor($location, LocalStorageService, API, HostStorageService, MessageBusService) {
    'ngInject';

    this.$location = $location;
    this.localStorageService = LocalStorageService;
    this.API = API;
    this.hostStorageService = HostStorageService;
    this.messageBusService = MessageBusService;

    this.lobbies = [];
  }

  $onInit() {
    this.loadPlayer();

    console.log("* Home; no game id, player: " + this.player);

    this.mbsDbListener = this.messageBusService.on("db-event", (event, data) => {
      console.log("db-event: " + JSON.stringify(data));
      if (data.key === 'lobbies') {
        this.getLobbies();
      }
    });
    this.mbsEventsListener = this.messageBusService.on("session-event", (event, data) => {
      console.log("session-event: " + JSON.stringify(data));
      if(data.event === 'OPENED' && data.sessionId === this.hostStorageService.sessionId){
        this.onEnterHome();
      } else if(data.event === 'ERROR'){
        this.error = data.event.message;
        this.busyMessage = null;
      }
    });
    this.mbsMessagesListener = this.messageBusService.on("session-message", (event, data) => {
      console.log("session-message: " + data);
    });

    this.API.setDbName(); // no game id, use API.HOST_DB_NAME by default
    this.busyMessage = "Loading Home...";
    this.hostStorageService.connect();
  }

  $onDestroy() {
    this.savePlayer();

    this.hostStorageService.disconnect();

    if(this.mbsDbListener){
      this.mbsDbListener();
    }
    if(this.mbsEventsListener){
      this.mbsEventsListener();
    }
    if(this.mbsMessagesListener){
      this.mbsMessagesListener();
    }
  }

  loadPlayer() {
    this.player = this.localStorageService.getObject("perudo-player");
  }

  savePlayer() {
    this.player.id = this.player.id || Math.floor(Math.random() * Math.floor(10000000) + 1);
    this.localStorageService.setObject("perudo-player", this.player);
  }

  newLobby() {
    this.savePlayer();
    this.$location.path('/' + Math.floor(Math.random() * Math.floor(100000) + 1));
  }

  joinLobby(id) {
    this.savePlayer();
    this.$location.path('/' + id);
  }

  getLobbies() {
    return this.hostStorageService.get("lobbies").then(data => {
      this.error = null;
      this.lobbies = ((!Array.isArray(data) && data !== null) ? [data] : data) || []; // should always be an array
    }).catch(err => {
      this.error = err;
    })
  }

  onEnterHome() {
    this.getLobbies()
      .finally(() => {
        this.busyMessage = null;
      });
  }
}