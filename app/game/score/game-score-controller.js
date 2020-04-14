export class GameScoreController {
  constructor($location, API, HostStorageService, MessageBusService, AlertService,
              LobbyService, PlayerService) {
    'ngInject';

    this.$location = $location;
    this.API = API;
    this.hostStorageService = HostStorageService;
    this.messageBusService = MessageBusService;
    this.alertService = AlertService;
    this.lobbyService = LobbyService;
    this.playerService = PlayerService;

  }

  $onInit() {
    console.log("* Game Score; game=" + this.game);
  }

  $onDestroy() {
  }

  newLobby() {
    this.$location.path('/' + Math.floor(Math.random() * Math.floor(100000) + 1));
  }
}