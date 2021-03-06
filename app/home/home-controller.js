export class HomeController {
  constructor($location, LocalStorageService, API, HostStorageService, MessageBusService, AlertService) {
    'ngInject';

    this.$location = $location;
    this.localStorageService = LocalStorageService;
    this.API = API;
    this.hostStorageService = HostStorageService;
    this.messageBusService = MessageBusService;
    this.alertService = AlertService;

    this.lobbies = [];
    this.player = null; // self player
  }

  $onInit() {
    this.loadPlayer();

    console.log("* Home; no game id, player: " + this.player);

    this.mbsDbListener = this.messageBusService.on("db-event", (event, data) => {
      //console.log("db-event: " + JSON.stringify(data));
      if (data.key === 'lobbies') {
        this.getLobbies();
      }
    });
    this.mbsEventsListener = this.messageBusService.on("session-event", (event, data) => {
      //console.log("session-event: " + JSON.stringify(data));
      if (data.event === 'OPENED' && data.sessionId === this.hostStorageService.sessionId) {
        this.onOpened();
      } else if (data.event === 'ERROR') {
        this.alertService.error(data.message);
      } else if (data.event === 'CLOSED') {
        this.alertService.warning(data.message);
      }
    });
    // this.mbsMessagesListener = this.messageBusService.on("session-message", (event, data) => {
    //   console.log("session-message: " + data);
    // });

    this.API.setDbName(); // no game id, use API.HOST_DB_NAME by default
    this.alertService.warning("Loading Home...");
    this.hostStorageService.connect();
  }

  $onDestroy() {
    this.savePlayer();

    this.hostStorageService.disconnect();

    if (this.mbsDbListener) {
      this.mbsDbListener();
    }
    if (this.mbsEventsListener) {
      this.mbsEventsListener();
    }
    // if (this.mbsMessagesListener) {
    //   this.mbsMessagesListener();
    // }
  }

  onOpened() {
    this.getLobbies()
      .finally(() => {
        //this.alertService.message();
      });
  }

  loadPlayer() {
    this.player = this.localStorageService.getObject("game.gameField-player") || {};
  }

  savePlayer() {
    if (!this.player || !this.player.name) {
      this.alertService.warning("Player must have a name!");
      return false;
    }
    this.player.id = this.player.id || Math.floor(Math.random() * Math.floor(10000000) + 1);
    this.player.color = this.player.color || 'black';
    this.localStorageService.setObject("game.gameField-player", this.player);
    return true;
  }

  getLobbies() {
    return this.hostStorageService.get("lobbies").then(data => {
      this.alertService.message();
      this.lobbies = ((!Array.isArray(data) && data !== null) ? [data] : data) || []; // should always be an array
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  newLobby() {
    if (this.savePlayer()) {
      this.$location.path('/' + Math.floor(Math.random() * Math.floor(100000) + 1));
    }
  }

  joinLobby(id) {
    if (this.savePlayer()) {
      this.$location.path('/' + id);
    }
  }

  deleteLobby(id) {
    return this.hostStorageService.delete("lobbies", id)
      .then(() => {
        this.alertService.message();
      }).catch(err => {
        this.alertService.error(err);
      })
  }

  debugDeleteAllLobbies() {
    return this.hostStorageService.delete("lobbies")
      .then(() => {
        this.alertService.message();
      }).catch(err => {
        this.alertService.error(err);
      });
  }
}