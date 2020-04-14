export class GameBoardController {
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
    console.log("* Game Board; game=" + this.game);
  }

  $onDestroy() {
  }

  finishGame(){
    this.game.updateState('FINISHED');
  }
}