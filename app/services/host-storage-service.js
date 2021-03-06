/**
 * MikeDB Service
 */
export class HostStorageService {
  constructor($http, $q, $interval, API, $location, $websocket, MessageBusService) {
    'ngInject';

    this.$http = $http;
    this.$q = $q;
    this.$interval = $interval;
    this.API = API;
    this.$location = $location;
    this.$websocket = $websocket;
    this.messageBusService = MessageBusService;

    this.$http.defaults.headers.common.API_KEY = this.API.HOST_API_KEY; // always send api key with every request header
    this.sessionId = null;
    this.MAX_RETRIES = 3; // set to <0 to disable retries
  }

  connect(dbName = null) {
    const url = this.API.getHostWebsocketUrl(dbName);
    if (!url) {
      throw "HOST STORAGE is not initialized";
    }

    this.disconnect();  // disconnect first if needed
    this.sessionId = null;
    let socketUrl = url;
    if (socketUrl.indexOf('ws://') !== 0 && socketUrl.indexOf('wss://') !== 0) {  // expand relative url to a full one
      let protocol = 'ws' + (this.$location.protocol() === 'https' ? 's' : '');
      socketUrl = protocol + '://' + this.$location.host() + ':' + this.$location.port() + url;
    }
    console.log("--- socket open");
    this.dataStream = this.$websocket(socketUrl);
    this.dataStream.onMessage(message => {
      if (message.data === 'PONG') {
        return; // ignore keep-alive exchanges
      }
      this.onMessage(message.data);
    }).onOpen(() => {
      console.log("--- on socket opened");
      this.sendMessage({API_KEY: this.API.HOST_API_KEY}).then(() => {   // got to send API_KEY first, otherwise socket will be closed
        this.startKeepAlive();
      });
    }).onClose(() => {
      console.log("--- on socket closed");
      this.onMessage({sessionId: this.sessionId, event: 'CLOSED', message: 'Websocket closed'});
      this.dataStream = null;
      this.sessionId = null;
      this.stopKeepAlive();
    }).onError(err => {
      console.log("--- on socket error: " + err);
      this.onMessage({sessionId: this.sessionId, event: 'ERROR', message: 'Websocket error: ' + err});
    });
  }

  disconnect() {
    if (!this.dataStream) {
      return;
    }

    // unregister listeners
    this.dataStream.onMessageCallbacks = [];
    this.dataStream.onOpenCallbacks = [];
    this.dataStream.onCloseCallbacks = [];
    this.dataStream.onErrorCallbacks = [];

    // close and reset socket sessoin
    console.log("--- socket close");
    this.dataStream.close();
    this.dataStream = null;
    this.sessionId = null;
    this.stopKeepAlive();
  }

  sendMessage(value) {
    if (!this.dataStream) {
      throw "Websocket is not connected";
    }
    return this.dataStream.send(value);  //TODO: JSON.stringify({message: value}) ?
  }

  onMessage(message) {
    let event = HostStorageService.tryJson(message);
    if (!event || typeof event !== "object") {
      //we got some primitive, not an object.
      //console.log(message);
      this.notify('session-message', message);
      return;
    }

    if (event.event === "NEW" && event.sessionId) {
      console.log("--- new session id: " + event.sessionId);
      this.setSessionId(event.sessionId);
      this.notify('session-event', event);
    } else if (event.event === 'OPENED') {
      console.log("-- opened session id: " + event.sessionId);
      this.notify('session-event', event);
    } else if (event.event === 'CLOSED') {
      console.log("-- closed session id: " + event.sessionId);
      this.notify('session-event', event);
    } else if (event.event === 'ERROR') {
      console.log("-- session error: " + event.message);
      this.notify('session-event', event);
    } else if (event.event /*&& this.sessionId !== event.sessionId*/) {  // do not ignore our own updates
      //console.log(message);
      console.log("-- DB event " + event.event + " for key=" + event.key + " from session id: " + event.sessionId);
      this.notify('db-event', event);
    } else {
      //we got some object but it is not an event.
      //console.log(message);
      this.notify('session-message', event);
    }
  }

  static tryJson(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return str;
    }
  }

  startKeepAlive() {
    this.keepAliveWatchdog = this.$interval(() => {
      this.sendMessage('PING');   //send keep-alive exchanges
    }, 10000);    // every 10 seconds
    this.keepAliveWatchdog.catch(() => {
      this.keepAliveWatchdog = null;
    });
  }

  stopKeepAlive() {
    if (this.keepAliveWatchdog) {
      this.$interval.cancel(this.keepAliveWatchdog);
    }
  }

  notify(name, event) {
    this.messageBusService.broadcast(name, event);
  }

  setSessionId(sessionId) {
    this.sessionId = sessionId;
    this.$http.defaults.headers.common.SESSION_ID = this.sessionId; // always send session id with every request header
  }

  /**
   * Validates HTTP result code, and resolves async request promise.
   * (not for public use)
   */
  static validateResponse(deferred, response) {
    if (response && (response.status === 200 || response.status === 201)) {
      deferred.resolve(response.data);  // resource exists or was created
    }
    else if (response && (response.status === 204)) {
      deferred.resolve(null);   // resource is empty
    }
    else if (response && (response.status || response.statusText)) {
      let message = 'Http error:';
      if (response.status) {
        message += '(' + response.status + ')';
      }
      if (response.statusText) {
        message += ' ' + response.statusText;
      }
      deferred.reject(message);
    }
    else if (response && response.message) {
      deferred.reject('Error: ' + response.message);
    }
    else if (response) {
      deferred.reject(response);
    }
    else {
      deferred.reject('No response');
    }
  }

  /**
   * Select appropriate request Media Type header based on Value type
   * (not for public use)
   */
  static prepareHeaders(value) {
    if (typeof value === 'string' && value !== null) {
      return {
        'Content-Type': 'text/plain;charset=utf-8',
      };
    } else {
      return {
        'Content-Type': 'application/json;charset=utf-8',
      };
    }
  }

  /**
   * Stores new key=>value pair
   * @returns {*} status code 201 when inserted successfully
   */
  set(key, value, dbName = null) {
    const deferred = this.$q.defer();
    const url = this.API.getHostApiUrl(dbName);
    if (!url) {
      deferred.reject("HOST STORAGE is not initialized");
      return deferred.promise;
    }

    const self = this;
    let retry = 0;
    let request = function () {
      self.$http.put(url + key, value, {headers: HostStorageService.prepareHeaders(value)})
        .then(response => {
          HostStorageService.validateResponse(deferred, response);
        }, err => {
          if (retry < self.MAX_RETRIES) {
            retry++;
            console.log("! HTTP retry #" + retry);
            self.notify('http-event', {event: 'RETRY', message: "HTTP retry #" + retry});
            request();
          } else {
            HostStorageService.validateResponse(deferred, err);
          }
        });
    };

    request();

    return deferred.promise;
  }

  /**
   * Stores new key=>value pair, or adds to existing value if it is a collection
   * @returns {*} status code 201 when inserted successfully
   */
  add(key, value, index = null, dbName = null) {
    const deferred = this.$q.defer();
    const url = this.API.getHostApiUrl(dbName);
    if (!url) {
      deferred.reject("HOST STORAGE is not initialized");
      return deferred.promise;
    }

    if (!Array.isArray(value)) {
      value = [value];
    }
    const self = this;
    let retry = 0;
    let request = function () {
      self.$http.post(url + key, value, {params: {index: index}, headers: HostStorageService.prepareHeaders(value)})
        .then(response => {
          HostStorageService.validateResponse(deferred, response);
        }, err => {
          if (retry < self.MAX_RETRIES) {
            retry++;
            console.log("! HTTP retry #" + retry);
            self.notify('http-event', {event: 'RETRY', message: "HTTP retry #" + retry});
            request();
          } else {
            HostStorageService.validateResponse(deferred, err);
          }
        });
    };

    request();

    return deferred.promise;
  }

  /**
   * Retrive Object, Primitive or a Collection assosiated with given Key
   * @param key
   * @param firstResult (optional) index of the first element in resulting collection to retrieve
   * @param maxResults (optional) number of elements from resulting collection to retrieve
   * @returns {*} 200 if record retrieved or status code 204 when no such record
   */
  get(key, firstResult = 0, maxResults = -1, dbName = null) {
    const deferred = this.$q.defer();
    const url = this.API.getHostApiUrl(dbName);
    if (!url) {
      deferred.reject("HOST STORAGE is not initialized");
      return deferred.promise;
    }

    const self = this;
    let retry = 0;
    let request = function () {
      self.$http.get(url + key, {params: {firstResult: firstResult, maxResults: maxResults}})
        .then(response => {
          HostStorageService.validateResponse(deferred, response);
        }, err => {
          if (retry < self.MAX_RETRIES) {
            retry++;
            console.log("! HTTP retry #" + retry);
            self.notify('http-event', {event: 'RETRY', message: "HTTP retry #" + retry});
            request();
          } else {
            HostStorageService.validateResponse(deferred, err);
          }
        });
    };

    request();

    return deferred.promise;
  }

  /**
   * Count how many items associated with given Key
   * @param key
   * @returns {*} 1- for simple key=>value pairs, collection size for key=>[collection]
   */
  count(key, dbName = null) {
    const deferred = this.$q.defer();
    const url = this.API.getHostApiUrl(dbName);
    if (!url) {
      deferred.reject("HOST STORAGE is not initialized");
      return deferred.promise;
    }

    const self = this;
    let retry = 0;
    let request = function () {
      self.$http.head(url + key)
        .then(response => {
          response.data = response.headers('Content-Length');
          HostStorageService.validateResponse(deferred, response);
        }, err => {
          if (retry < self.MAX_RETRIES) {
            retry++;
            console.log("! HTTP retry #" + retry);
            self.notify('http-event', {event: 'RETRY', message: "HTTP retry #" + retry});
            request();
          } else {
            HostStorageService.validateResponse(deferred, err);
          }
        });
    };

    request();

    return deferred.promise;
  }

  /**
   * Delete a record with given Key, or a single value from record's value list by it's id or by index if provided
   */
  delete(key, id, index = null, dbName = null) {
    const deferred = this.$q.defer();
    const url = this.API.getHostApiUrl(dbName);
    if (!url) {
      deferred.reject("HOST STORAGE is not initialized");
      return deferred.promise;
    }

    const self = this;
    let retry = 0;
    let request = function () {
      self.$http.delete(url + key, {params: {id: id, index: index}})
        .then(response => {
          HostStorageService.validateResponse(deferred, response);
        }, err => {
          if (retry < self.MAX_RETRIES) {
            retry++;
            console.log("! HTTP retry #" + retry);
            self.notify('http-event', {event: 'RETRY', message: "HTTP retry #" + retry});
            request();
          } else {
            HostStorageService.validateResponse(deferred, err);
          }
        });
    };

    request();

    return deferred.promise;
  }

  /**
   * Modify a single item in a collection associated with the key
   */
  update(key, value, index = null, dbName = null) {
    const deferred = this.$q.defer();
    const url = this.API.getHostApiUrl(dbName);
    if (!url) {
      deferred.reject("HOST STORAGE is not initialized");
      return deferred.promise;
    }

    const self = this;
    let retry = 0;
    let request = function () {
      self.$http.patch(url + key, value,
        {params: {index: index}, headers: HostStorageService.prepareHeaders(value)})
        .then(response => {
          HostStorageService.validateResponse(deferred, response);
        }, err => {
          if (retry < self.MAX_RETRIES) {
            retry++;
            console.log("! HTTP retry #" + retry);
            self.notify('http-event', {event: 'RETRY', message: "HTTP retry #" + retry});
            request();
          } else {
            HostStorageService.validateResponse(deferred, err);
          }
        });
    };

    request();

    return deferred.promise;
  }
}