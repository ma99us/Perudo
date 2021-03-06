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
    return this.player;
  }

  unloadPlayer(){
    this.player = null;
    this.isReady = false;
  }

  get isHost() {
    return this.player && this.player.isHost;
  }

  get isSpectator() {
    return this.player && this.player.spectator;
  }

  get isBot() {
    return this.player && this.player.bot;
  }

  isValidPlayer(player) {
    return player && player.name && player.id;
  }

  canEditPlayer(player) {
    return this.player.isHost || this.player.id === player.id;
  }

  get selfPlayerIndex() {
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

  getPlayerBySessionId(sessionId){
    return this.players.find(p => p.sessionId === sessionId);
  }

  getPrevPlayerIndex(index) {
    return index > 0 ? index - 1 : this.players.length - 1;
  }

  getNextPlayerIndex(index) {
    return index < (this.players.length - 1) ? index + 1 : 0;
  }

  getPlayers() {
    return this.hostStorageService.get("players").then(data => {
      this.players = ((!Array.isArray(data) && data !== null) ? [data] : data) || []; // should always be an array
      let selfPlayer = this.getPlayerById(this.player.id);
      if (selfPlayer) {
        this.player.isHost = selfPlayer.isHost != null ? selfPlayer.isHost : this.player.isHost;
        this.player.spectator = selfPlayer.spectator != null ? selfPlayer.spectator : this.player.spectator;
        this.player.bot = selfPlayer.bot != null ? selfPlayer.bot : this.player.bot;
      }
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  updatePlayers(player, index = null) {
    return this.hostStorageService.update("players", player, index).then(data => {
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  removePlayers(player) {
    return this.hostStorageService.delete("players", player.id).then(data => {
    }).catch(err => {
      this.alertService.error(err);
    })
  }
}