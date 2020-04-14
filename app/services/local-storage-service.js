export class LocalStorageService {
  constructor($window, /*$cookies*/) {
    'ngInject';

    this.$window = $window;
    //this.$cookies = $cookies;
  }

  set(key, value) {
    this.$window.localStorage[key] = value;
  }

  get(key, defaultValue) {
    return this.$window.localStorage[key] || defaultValue;
  }

  setObject(key, value) {
    this.$window.localStorage[key] = JSON.stringify(value);
  }

  getObject(key, defaultValue) {
    try {
      return JSON.parse(this.$window.localStorage[key]);
    }
    catch (err) {
      return defaultValue;
    }
  }

  copyToClipboard(text) {
    // create temp element
    var copyElement = document.createElement("span");
    copyElement.appendChild(document.createTextNode(text));
    copyElement.id = 'tempCopyToClipboard';
    angular.element(document.body.append(copyElement));

    // select the text
    var range = document.createRange();
    range.selectNode(copyElement);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);

    // copy & cleanup
    document.execCommand('copy');
    window.getSelection().removeAllRanges();
    copyElement.remove();
  }
}