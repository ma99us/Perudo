export const API = new function () {
  //this.HOST_LOCATION = '';   // <- release (localhost)
  this.HOST_LOCATION = 'ghost:8181';  // <- development (beta)
  //this.HOST_LOCATION = 'localhost:8181';  // <- development (alpha)
  this.HOST_API_KEY = 'PERUDO53cr3tK3y';
  this.HOST_DB_NAME = ':memory:perudo-';
  this.dbName = undefined;

  this.setDbName = (dbName = null) => {
    this.dbName = dbName;
    this.HOST_API_URL = this.getHostApiUrl(dbName !== null ? this.dbName : this.HOST_DB_NAME);
    this.HOST_WEBSOCKET_URL = this.getHostWebsocketUrl(dbName !== null ? this.dbName : this.HOST_DB_NAME);
    return this.dbName;
  };

  this.getHostApiUrl = (dbName) => {
    if (dbName === null) {
      return this.HOST_API_URL;
    }
    let apiHost = this.HOST_LOCATION ? 'http://' + this.HOST_LOCATION : '';
    return apiHost + '/mike-db/api/' + dbName + '/';
  };

  this.getHostWebsocketUrl = (dbName) => {
    if (dbName === null) {
      return this.HOST_WEBSOCKET_URL;
    }
    let socketHost = this.HOST_LOCATION ? 'ws://' + this.HOST_LOCATION : '';
    return socketHost + '/mike-db/subscribe' + '/' + dbName;
  };

  this.HOST_API_URL = this.getHostApiUrl(this.HOST_DB_NAME);
  this.HOST_WEBSOCKET_URL = this.getHostWebsocketUrl(this.HOST_DB_NAME);


};