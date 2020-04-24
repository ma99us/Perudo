export class PlayerService {
  constructor(LocalStorageService, API, HostStorageService, AlertService) {
    'ngInject';

    this.localStorageService = LocalStorageService;
    this.API = API;
    this.hostStorageService = HostStorageService;
    this.alertService = AlertService;

    this.isReady = false;   // player is fully initialized
    this.player = null;   // self player
    this.players = [];  // current game players
  }

  loadPlayer(gameName) {
    this.player = this.localStorageService.getObject(gameName);
  }

  unloadPlayer(){
    this.player = null;
    this.isReady = false;
  }

  isSpectator() {
    return this.player && this.player.spectator;
  }

  isValidPlayer(player) {
    return player && player.name && player.id;
  }

  canEditPlayer(player) {
    return this.player.isHost || this.player.id === player.id;
  }

  getSelfPlayerIndex() {
    return this.getPlayerIndex(this.player);
  }

  getPlayerIndex(player) {
    return this.players.findIndex(p => p.id === player.id);
  }

  getPlayerByIndex(index){
    return this.players[index];
  }

  getPlayerById(id){
    return this.players.find(p => p.id === id);
  }

  getPrevPlayerIndex(index) {
    return index > 0 ? index - 1 : this.players.length - 1;
  }

  getNextPlayerIndex(index) {
    return index < (this.players.length - 1) ? index + 1 : 0;
  }

  getPlayers() {
    return this.hostStorageService.get("players").then(data => {
      this.alertService.message();
      this.players = ((!Array.isArray(data) && data !== null) ? [data] : data) || []; // should always be an array
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  updatePlayers(player, index = null) {
    return this.hostStorageService.update("players", player, index).then(data => {
      this.alertService.message();
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  removePlayers(player) {
    return this.hostStorageService.delete("players", player.id).then(data => {
      this.alertService.message();
    }).catch(err => {
      this.alertService.error(err);
    })
  }
}