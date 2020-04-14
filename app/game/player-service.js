export class PlayerService {
  constructor(LocalStorageService, API, HostStorageService, AlertService) {
    'ngInject';

    this.localStorageService = LocalStorageService;
    this.API = API;
    this.hostStorageService = HostStorageService;
    this.alertService = AlertService;

    this.player = null;   // self player
    this.players = [];  // current game players
  }

  loadPlayer(gameName) {
    this.player = this.localStorageService.getObject(gameName);
  }

  isValidPlayer(player) {
    return player && player.name;
  }

  canEditPlayer(player) {
    return this.player.isHost || this.player.name === player.name;
  }

  checkSelf() {
    return this.players.findIndex(p => p.name === this.player.name);
  }

  getPlayers() {
    return this.hostStorageService.get("players").then(data => {
      this.alertService.message();
      this.players = ((!Array.isArray(data) && data !== null) ? [data] : data) || []; // should always be an array
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  updatePlayer(player) {
    return this.hostStorageService.update("players", player).then(data => {
      this.alertService.message();
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  removePlayer(player) {
    return this.hostStorageService.delete("players", player.id).then(data => {
      this.alertService.message();
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  addPlayer(player) {
    return this.hostStorageService.add("players", player).then(data => {
      this.alertService.message();
    }).catch(err => {
      this.alertService.error(err);
    })
  }

}