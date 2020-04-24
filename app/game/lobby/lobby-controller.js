export class LobbyController {
  constructor(API, HostStorageService, MessageBusService, AlertService,
              LobbyService, PlayerService) {
    'ngInject';

    this.API = API;
    this.hostStorageService = HostStorageService;
    this.messageBusService = MessageBusService;
    this.alertService = AlertService;
    this.lobbyService = LobbyService;
    this.playerService = PlayerService;

  }

  $onInit() {
    console.log("* Lobby; game=" + this.game);
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
}