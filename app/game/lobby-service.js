export class LobbyService {
  constructor(API, HostStorageService, AlertService) {
    'ngInject';

    this.API = API;
    this.hostStorageService = HostStorageService;
    this.alertService = AlertService;

    this.lobby = null;  // current game game registration. (key is in a separate/parent database!)
  }

  getLobby(id) {
    return this.hostStorageService.get("lobbies", 0, -1, this.API.HOST_DB_NAME)   // use home db
      .then(data => {
        this.alertService.message();
        const lobbies = ((!Array.isArray(data) && data !== null) ? [data] : data) || [];
        this.lobby = lobbies.find(l => l.id === id);
      }).catch(err => {
        this.alertService.error(err);
      })
  }

  registerLobby(lobby) {
    if (this.lobby) {
      return;
    }
    return this.hostStorageService.add("lobbies", lobby, 0, this.API.HOST_DB_NAME)  // use home db
      .then(data => {
        this.alertService.message();
        this.lobby = lobby;
      }).catch(err => {
        this.alertService.error(err);
      });
  }

  unregisterLobby() {
    if (!this.lobby) {
      return;
    }
    return this.hostStorageService.delete("lobbies", this.lobby.id, null, this.API.HOST_DB_NAME)   // use home db
      .then(() => {
        this.alertService.message();
      })// use home db
      .catch(err => {
        this.alertService.error(err);
      });
  }

  updateLobby(lobby) {
    if (!this.lobby) {
      return;
    }
    this.lobby.playersNum = lobby.playersNum;
    this.lobby.host = lobby.host;
    this.lobby.state = lobby.state;
    return this.hostStorageService.update("lobbies", this.lobby, null, this.API.HOST_DB_NAME)   // use home db
      .then(() => {
        this.alertService.message();
      })
      .catch(err => {
        this.alertService.error(err);
      });
  }
}