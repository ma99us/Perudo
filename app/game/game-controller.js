export class GameController {
  constructor($routeParams, $location, API, HostStorageService, MessageBusService, AlertService,
              LobbyService, PlayerService) {
    'ngInject';

    this.id = Number($routeParams.id);
    this.$location = $location;
    this.API = API;
    this.hostStorageService = HostStorageService;
    this.messageBusService = MessageBusService;
    this.alertService = AlertService;
    this.lobbyService = LobbyService;
    this.playerService = PlayerService;

    this.state = null;  // current game state. (LOBBY, GAME, FINISHED)
    this.gameName = "Perudo";
  }

  $onInit() {
    if (!this.id) {
      console.log("no game id, go Home");
      this.alertService.warning("Game ID is required to join a game.");
      this.goHome();
      return;
    }

    this.playerService.loadPlayer("game.gameField-player");
    if (!this.playerService.isValidPlayer(this.playerService.player)) {
      console.log("no player info, go Home");
      this.alertService.warning("Player Name is required to join a game.");
      this.goHome();
      return;
    }

    console.log(`* Game; game id=${this.id}, player: \"${this.playerService.player.name}\" (id: ${this.playerService.player.id})`);

    this.mbsDbListener = this.messageBusService.on("db-event", (event, data) => {
      console.log("db-event: " + JSON.stringify(data));
      if (data.key === 'players') {
        this.getPlayers();
      }
      else if (data.key === 'state') {
        this.getState();
      }
    });
    this.mbsEventsListener = this.messageBusService.on("session-event", (event, data) => {
      console.log("session-event: " + JSON.stringify(data));
      if(data.event === 'OPENED' && data.sessionId === this.hostStorageService.sessionId){
        this.onOpened();
      } else if (data.event === 'ERROR') {
        this.alertService.error(data.event.message);
      } else if (data.event === 'CLOSED') {
        this.alertService.warning(data.event.message);
      }
    });
    this.mbsMessagesListener = this.messageBusService.on("session-message", (event, data) => {
      console.log("session-message: " + data);
    });

    this.API.setDbName(this.API.HOST_DB_NAME + this.id);
    this.alertService.warning("Entering game...");
    this.hostStorageService.connect();
  }

  $onDestroy() {
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

    this.unregisterLobby();
    this.playerService.unloadPlayer();
  }

  onOpened() {
    this.getState()
      .then(() => {
        this.alertService.message();
        return this.lobbyService.getLobby(this.id);
      })
      .then(() => {
        return this.getPlayers();
      })
      .then(() => {
        if (!this.playerService.player.inLobby) {
          this.playerService.player.spectator = !(!this.state || this.state === 'LOBBY');
          return this.playerService.updatePlayers(this.playerService.player);
        }
      })
      .catch(err => {
        this.alertService.error(err);
      })
      .finally(() => {
        this.alertService.message();
        this.playerService.isReady = true;
        this.notify('game-event', {
          source: 'PlayerService',
          isReady: this.playerService.isReady
        });
      });
  }

  notify(name, event) {
    this.messageBusService.broadcast(name, event);
  }

  goHome() {
    this.$location.path('/');
  }

  checkSelf() {
    const idx = this.playerService.getSelfPlayerIndex();
    this.playerService.player.isHost = idx === 0; // player index 0 is always a host
    if (!this.playerService.player.inLobby && idx >= 0) { // was not in game, but now is
      this.playerService.player.inLobby = true;
      this.registerLobby();
    } else if(this.playerService.player.inLobby && idx < 0){ // was in game, but now is not
      this.playerService.player.inLobby = false;
      this.goHome();
    }
    return idx >= 0;
  }

  getState() {
    let stateUpdated = false;
    return this.hostStorageService.get("state")
      .then(data => {
      this.alertService.message();
        if (this.state !== data) {
          this.state = data;
          stateUpdated = true;
        }
      })
      .then(() => {
        if(stateUpdated){
          return this.hostStorageService.get("lastStateUpdate")
        }
      })
      .then(data => {
        if(stateUpdated && data){
          this.lastStateUpdate = new Date(data);
        }
      })
      .then(() => {
        if (stateUpdated) {
          this.updateLobby();
        }
      })
      .catch(err => {
        this.alertService.error(err);
    })
  }

  updateState(state) {
    let stateUpdated = this.state !== state;
    return this.hostStorageService.update("state", state).then(data => {
      this.alertService.message();
      if(stateUpdated){
        let lastStateUpdate = new Date();
        return this.hostStorageService.update("lastStateUpdate", lastStateUpdate.getTime());
      }
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  getPlayers() {
    return this.playerService.getPlayers()
      .then(() => {
        this.checkSelf();
        return this.updateLobby();
      });
  }

  registerLobby() {
    if (!this.playerService.player.isHost || this.state || this.lobbyService.lobby) {
      return;
    }
    this.lobbyService.lobby = {
      id: this.id,
      gameName: this.gameName,
      playersNum: this.playerService.players.length,
      host: this.playerService.player.name,
      state: this.state,
      lastStateUpdate: this.lastStateUpdate
    };
    return this.lobbyService.updateLobby()
      .then(data => {
        return this.updateState('LOBBY');
      })
  }

  unregisterLobby() {
    if (this.playerService.players.length > 0) {
      return;
    }
    return this.lobbyService.unregisterLobby();
  }

  updateLobby() {
    if (!this.playerService.player.isHost) {
      return;
    }
    this.lobbyService.lobby.playersNum = this.playerService.players.length;
    this.lobbyService.lobby.host = this.playerService.player.name;
    this.lobbyService.lobby.state =  this.state;
    this.lobbyService.lobby.lastStateUpdate =  this.lastStateUpdate;
    return this.lobbyService.updateLobby();
  }
}