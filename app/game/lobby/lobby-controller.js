export class LobbyController {
  constructor(API, HostStorageService, MessageBusService, AlertService,
              LobbyService, PlayerService, GameBotService) {
    'ngInject';

    this.API = API;
    this.hostStorageService = HostStorageService;
    this.messageBusService = MessageBusService;
    this.alertService = AlertService;
    this.lobbyService = LobbyService;
    this.playerService = PlayerService;
    this.gameBotService = GameBotService;
  }

  $onInit() {
    console.log("* Lobby; game=" + this.game.gameName+"; id="+this.game.id);
  }

  $onDestroy() {
  }

  moveUpPlayers(p) {
    let pIndex = this.game.playerService.getPlayerIndex(p);
    let insIndex = this.game.playerService.getPrevPlayerIndex(pIndex);
    this.game.playerService.updatePlayers(p, insIndex);
  }

  moveDownPlayers(p) {
    let pIndex = this.game.playerService.getPlayerIndex(p);
    let insIndex = this.game.playerService.getNextPlayerIndex(pIndex);
    this.game.playerService.updatePlayers(p, insIndex);
  }

  startGame(){
    this.game.updateState('GAME');
  }

  leaveGame() {
    this.game.playerService.removePlayers(this.game.playerService.player);
  }

  addBotPlayer(){
    this.gameBotService.addBotPlayer();
  }

  removePlayer(player) {
    this.gameBotService.removeBotPlayer(player);  // also removes regular players
  }
}