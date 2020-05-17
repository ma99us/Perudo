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

  canMoveUp(idx) {
    return idx > 1;
  }

  canMoveDown(idx) {
    return idx > 0 && idx < this.game.playerService.players.length - 1;
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
    if(this.playerService.players.length < 2){
      this.alertService.warning("Invite more players or add BOTs to start the game");
      return;
    }
    this.game.updateState('GAME');
  }

  leaveGame() {
    this.removePlayer(this.game.playerService.player);
  }

  addBotPlayer(){
    this.gameBotService.addBotPlayer();
  }

  removePlayer(player) {
    if (player.id === this.game.playerService.player.id) {
      // remove all bots also
      this.gameBotService.removeBotPlayer();
    }
    this.gameBotService.removeBotPlayer(player);  // also removes regular players
  }
}