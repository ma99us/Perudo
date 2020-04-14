export class GameController {
  constructor(HostStorageService) {
    'ngInject';

    this.hostStorageService = HostStorageService;
  }

  $onInit() {
    //this.getPlayers();
  }

  $onDestroy() {

  }

  getPlayers() {
    this.hostStorageService.get("players").then(data => {
      this.error = null;
      this.players = ((!Array.isArray(data) && data !== null) ? [data] : data) || []; // players should always be an array or null
      this.countPlayers();
    }).catch(err => {
      this.error = err;
    })
  }

  updatePlayer(index, player) {
    // if(player.status === "Good") {
    //   player.status = "OK"
    // } else if (player.status === "OK") {
    //   player.status = "So-so";
    // } else if (player.status === "So-so") {
    //   player.status = "Good";
    // }

    this.hostStorageService.update(this.key, index, player).then(data => {
      this.error = null;
      this.getPlayers();
    }).catch(err => {
      this.error = err;
    })
  }

  deletePlayer(idx) {
    this.hostStorageService.delete("players", idx).then(data => {
      this.error = null;
      this.getPlayers();
    }).catch(err => {
      this.error = err;
    })
  }

  countPlayers() {
    this.hostStorageService.count("players").then(data => {
      this.error = null;
      this.count = data;
    }).catch(err => {
      this.error = err;
    })
  }
}