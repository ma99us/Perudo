export function GameBoardNumInputDirective() {
  return {
    restrict: 'E',
    templateUrl: './game/board/num-input-directive.html',
    scope: true,
    bindToController: {
      value: '=',
      min: '<',
      max: '<'
    },
    controllerAs: '$ctrl',
    controller: function () {
      this.$onInit = function () {
        // init scope variables here (only once!)
        if(this.min == null){
          this.min = 0;
        }
        if(this.max == null){
          this.max = 99;
        }
      };

      this.getStyle = function () {
        return {'width': '' + (this.max.toString().length + 2) + 'em'};
      };

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

      this.enc = function () {
        if(this.max != null && this.value + 1 > this.max){
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
