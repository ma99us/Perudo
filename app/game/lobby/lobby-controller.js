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

  startGame(){
    this.game.updateState('GAME');
  }

  leaveGame() {
    this.game.playerService.removePlayers(this.game.playerService.player);
  }
}