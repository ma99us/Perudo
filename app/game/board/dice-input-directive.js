export function GameBoardDiceInputDirective() {
  return {
    restrict: 'E',
    templateUrl: './game/board/dice-input-directive.html',
    scope: true,
    bindToController: {
      size: '<',  // number - size in 'em' units
      value: '=', // actual entered value (model)
      min: '<',   // number - min value limit (optional, default - 1)
      max: '<'    // number - max value limit (optional, default - 6)
    },
    controllerAs: '$ctrl',
    controller: function () {
      this.$onInit = function () {
        // init scope variables here (only once!)
        if(this.min == null){
          this.min = 1;
        }
        if(this.max == null){
          this.max = 6;
        }
        if(this.size == null){
          this.size = 2;
        }
      };

      // this.getStyle = function () {
      //   return {'width':'2em', 'height':'2em'};
      // };

      this.validateVal = function(val){
        if (this.max != null && val > this.max) {
          return this.max;
        }
        else if (this.min != null && val < this.min) {
          return this.min;
        } else {
          return val;
        }
      };

      this.enc = function (cycle = false) {
        if(this.max != null && this.value + 1 > this.max){
          if (cycle) {
            this.value = this.min;
          }
          return;
        }
        if(this.value == null){
          this.value = this.min;
        } else{
          this.value++;
        }
      };

      this.dec = function () {
        if(this.min != null && this.value - 1 < this.min){
          return;
        }
        if(this.value == null){
          this.value = this.max;
        } else {
          this.value--;
        }
      };
    }
  };
}
