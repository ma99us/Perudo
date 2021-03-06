export function LobbyPlayerDirective() {
  return {
    restrict: 'E',
    templateUrl: './game/lobby/lobby-player-directive.html',
    scope: true,
    bindToController: {
      index: '<',
      player: '<',
      self: '<',
      mute: '<'
    },
    controllerAs: '$ctrl',
    controller: function () {
      this.$onInit = function () {
        //console.log("this.player=" + this.player);
      };

      this.isSelf = function () {
        return this.player && this.self && this.player.id === this.self.id;
      };

      this.isHost = function () {
        //retun this.player.isHost;
        return this.index === 0;  //TODO: make the line above work instead
      };

      this.isSpectator = function() {
        return this.player && this.player.spectator;
      };

      this.isMuted = function() {
        return this.mute;
      };

      this.isBot = function() {
        return this.player && this.player.bot;
      };
    }
  };
}
