export function LobbyPlayerDirective() {
  return {
    restrict: 'E',
    templateUrl: '/lobby/lobby-player/lobby-player-directive.html',
    scope: true,
    bindToController: {
      index: '=',
      player: '=',
      self: '='
    },
    controllerAs: '$ctrl',
    controller: function () {
      this.$onInit = function () {
        //console.log("this.player=" + this.player);
      };

      this.isSelf = function () {
        return this.player.name === this.self.name;
      };

      this.isHost = function () {
        //retun this.player.isHost;
        return this.index === 0;  //TODO: make the line above work instead
      }
    }
  };
}
