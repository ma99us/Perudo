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

    this.gameData = null;
    this.playedAt = null;
  }

  $onInit() {
    console.log("* Game Score; game=" + this.game);

    this.getGameData();
  }

  $onDestroy() {
  }

  getGameData() {
    return this.hostStorageService.get("gameData").then(data => {
        this.alertService.message();
        this.gameData = data;
        this.playedAt = this.game.lastStateUpdate;
      })
      .catch(err => {
        this.alertService.error(err);
      })
  }

  newLobby() {
    this.$location.path('/' + Math.floor(Math.random() * Math.floor(100000) + 1));
  }
}