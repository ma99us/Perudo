export function GameBoardDiceDirective() {
  return {
    restrict: 'E',
    templateUrl: './game/board/dice-directive.html',
    scope: true,
    bindToController: {
      size: '<',    // number - size in 'em' units
      color: '<',   // html css color
      value: '<',   // value from 1-6 or '?' for unknown
      mark: '<',    // boolean - highlite or not
      mute: '<',    // boolean - disable or not
      nohide: '<',  // never hide, show unknown instead
      val: '<'      // the whole dice object to overwrite the with above properties
    },
    controllerAs: '$ctrl',
    controller: function () {
      this.$onInit = function () {
        // init scope variables here (only once!)
        if(!this.size){
          this.size = 2;  // default size
        }
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

      this.getSize = function () {
        return this.size;
      };

      this.getStyle = function () {
        return this.isMarked() ? {'box-shadow': '0px 0px 5px '+this.getColor()} : {};
      };

      this.isDarkColor = function(color){
        return false;
        //return color === '#000000' || color === 'black' || color === '' || color === '#000' || color === 0; // not used for now
      };

      this.getImage = function () {
        if(this.getValue() === 1){
          return this.isDarkColor(this.getColor()) ? './img/one-w.svg' : './img/one.svg';
        } else if (this.getValue() === 2) {
          return this.isDarkColor(this.getColor()) ? './img/two-w.svg' : './img/two.svg';
        } else if (this.getValue() === 3) {
          return this.isDarkColor(this.getColor()) ? './img/three-w.svg' : './img/three.svg';
        } else if (this.getValue() === 4) {
          return this.isDarkColor(this.getColor()) ? './img/four-w.svg' : './img/four.svg';
        } else if (this.getValue() === 5) {
          return this.isDarkColor(this.getColor()) ? './img/five-w.svg' : './img/five.svg';
        } else if (this.getValue() === 6) {
          return this.isDarkColor(this.getColor()) ? './img/six-w.svg' : './img/six.svg';
        } else if(this.getValue() != null || this.nohide) {
          return this.isDarkColor(this.getColor()) ? './img/unknown-w.svg' : './img/unknown.svg';
        } else {
          return './img/blank.svg';
        }
      };
    }
  };
}
