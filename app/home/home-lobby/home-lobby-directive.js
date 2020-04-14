export function HomeLobbyDirective() {
  return {
    restrict: 'E',
    templateUrl: '/home/home-lobby/home-lobby-directive.html',
    scope: {
      lobby: '='
    },
    //bindToController: true,
    // controller: function ($attrs, $scope) {
    //   'ngInject';
    //   console.log("this.lobby=" + this.lobby);
    //   console.log("$attrs.lobby=" + $attrs.lobby);
    //   console.log("$scope.lobby=" + $scope.lobby);
    // }
  };
}
