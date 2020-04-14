export class MessageBusService {
  constructor($rootScope) {
    'ngInject';

    this.$rootScope = $rootScope;
  }

  broadcast(event, data) {
    this.$rootScope.$broadcast(event, data);
  }

  on(event, callback) {
    return this.$rootScope.$on(event, callback);
  }
}