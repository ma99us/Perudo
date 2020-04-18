export function HomeLobbyDirective() {
  return {
    restrict: 'E',
    templateUrl: './home/home-lobby/home-lobby-directive.html',
    scope: {
      lobby: '='
    },
    //bindToController: true,
    // controller: function ($attrs, $scope) {
    //   'ngInject';
    //   console.log("this.game=" + this.game);
    //   console.log("$attrs.game=" + $attrs.game);
    //   console.log("$scope.game=" + $scope.game);
    // }
  };
}
