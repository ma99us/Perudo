export function GameBoardDiceDirective() {
  return {
    restrict: 'E',
    templateUrl: './game/board/dice-directive.html',
    scope: true,
    bindToController: {
      color: '<',   // html css color
      value: '<',   // value from 1-6 or '?' for unknown
      mark: '<',  // boolean
      mute: '<',   // boolean
      val: '<'     // the whole dice object with above properties
    },
    controllerAs: '$ctrl',
    controller: function () {
      this.$onInit = function () {
        // init scope variables here (only once!)
      };

      this.isMarked = function () {
        return this.mark != null ? this.mark : (this.val ? this.val.mark : false);
      };

      this.isMuted = function () {
        return this.mute != null ? this.mute : (this.val ? this.val.mute : false);
      };

      this.getValue = function () {
        return this.value != null ? this.value : (this.val ? this.val.value : null);
      };

      this.getColor = function () {
        return this.color != null ? this.color : (this.val ? this.val.color : '');
      };

      this.getStyle = function () {
        return this.isMarked() ? {'text-shadow': '0px 0px 5px '+this.getColor()} : {};
      };
    }
  };
}
