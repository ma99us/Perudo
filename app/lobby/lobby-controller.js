export class LobbyController {
  constructor($routeParams, $location, LocalStorageService, API, HostStorageService, MessageBusService) {
    'ngInject';

    this.id = Number($routeParams.id);
    this.$location = $location;
    this.localStorageService = LocalStorageService;
    this.API = API;
    this.hostStorageService = HostStorageService;
    this.messageBusService = MessageBusService;

    this.lobby = null;  // current game lobby registration. (key is in a separate/parent database!)
    this.state = null;  // current game state. (LOBBY, GAME, FINISHED)
    this.players = [];  // current game players
    this.gameName = "Perudo";
  }

  $onInit() {
    if (!this.id) {
      console.log("no game id, go Home");
      this.goHome();
      return;
    }

    this.loadPlayer();
    if (!this.player || !this.player.name) {
      console.log("no player info, go Home");
      this.goHome();
      return;
    }

    console.log("* Lobby; game id=" + this.id + ", player: " + this.player);

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
        this.onEnterLobby();
      } else if (data.event === 'ERROR') {
        this.error = data.event.message;
        this.busyMessage = null;
      }
    });
    this.mbsMessagesListener = this.messageBusService.on("session-message", (event, data) => {
      console.log("session-message: " + data);
    });

    this.API.setDbName(this.API.HOST_DB_NAME + this.id);
    this.busyMessage = "Entering lobby...";
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
  }

  loadPlayer() {
    this.player = this.localStorageService.getObject("perudo-player");
  }

  goHome() {
    this.$location.path('/');
  }

  checkSelf() {
    const idx = this.players.findIndex(p => p.name === this.player.name);
    this.player.isHost = idx === 0; // player index 0 is always a host
    if (!this.player.inLobby && idx >= 0) { // was not in lobby, but now is
      this.player.inLobby = true;
      this.registerLobby();
    } else if(this.player.inLobby && idx < 0){ // was in lobby, but now is not
      this.player.inLobby = false;
      this.goHome();
    }
    return idx >= 0;
  }

  canDeletePlayer(player) {
    return this.player.isHost || this.player.name === player.name;
  }

  getPlayers() {
    return this.hostStorageService.get("players").then(data => {
      this.error = null;
      this.players = ((!Array.isArray(data) && data !== null) ? [data] : data) || []; // should always be an array
      this.checkSelf();
      return this.updateLobby();
    }).catch(err => {
      this.error = err;
    })
  }

  getState() {
    return this.hostStorageService.get("state").then(data => {
      this.error = null;
      if(this.state !== data){
        this.state = data;
        this.updateLobby();
      }
    }).catch(err => {
      this.error = err;
    })
  }

  updateState(state) {
    return this.hostStorageService.update("state", state).then(data => {
      this.error = null;
    }).catch(err => {
      this.error = err;
    })
  }

  updatePlayer(player) {
    // if(player.status === "Good") {
    //   player.status = "OK"
    // } else if (player.status === "OK") {
    //   player.status = "So-so";
    // } else if (player.status === "So-so") {
    //   player.status = "Good";
    // }

    this.hostStorageService.update("players", player).then(data => {
      this.error = null;
    }).catch(err => {
      this.error = err;
    })
  }

  deletePlayer(player) {
    this.hostStorageService.delete("players", player.id).then(data => {
      this.error = null;
    }).catch(err => {
      this.error = err;
    })
  }

  addPlayer(player) {
    this.hostStorageService.add("players", player).then(data => {
      this.error = null;
    }).catch(err => {
      this.error = err;
    })
  }

  getLobby(){
    return this.hostStorageService.get("lobbies", 0, -1, this.API.HOST_DB_NAME).then(data => {
      this.error = null;
      const lobbies = ((!Array.isArray(data) && data !== null) ? [data] : data) || [];
      this.lobby = lobbies.find(l => l.id === this.id);
    }).catch(err => {
      this.error = err;
    })
  }

  registerLobby() {
    if (this.lobby || !this.player.isHost) {
      return;
    }
    this.lobby = {
      id: this.id,
      gameName: this.gameName,
      playersNum: this.players.length,
      host: this.player.name,
      state: this.state
    };
    return this.hostStorageService.add("lobbies", this.lobby, 0, this.API.HOST_DB_NAME)  // use home db
      .then(data => {
        return this.updateState('LOBBY');
      })
      .then(data => {
        this.error = null;
      }).catch(err => {
        this.error = err;
      });
  }

  unregisterLobby() {
    if (!this.lobby || this.players.length > 0) {
      return;
    }
    this.error = null;
    return this.hostStorageService.delete("lobbies", this.lobby.id, null, this.API.HOST_DB_NAME) // use home db
      .catch(err => {
        this.error = err;
      });
  }

  updateLobby() {
    if (!this.lobby || !this.player.isHost) {
      return;
    }
    this.lobby.playersNum = this.players.length;
    this.lobby.host = this.player.name;
    this.lobby.state = this.state;
    this.hostStorageService.update("lobbies", this.lobby, null, this.API.HOST_DB_NAME);  // use home db
  }

  onEnterLobby() {
    this.getState()
      .then(() => {
        if(!this.state || this.state === 'LOBBY'){
          return this.getLobby();
        }
      })
      .then(() => {
        return this.getPlayers();
      })
      .then(() => {
        if ((!this.state || this.state === 'LOBBY') && !this.player.inLobby) {
          return this.addPlayer(this.player);
        }
      })
      .catch(err => {
        this.error = err;
      })
      .finally(() => {
        this.busyMessage = null;
      });
  }
}