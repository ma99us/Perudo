export class AlertService {
  constructor($uibModal) {
    'ngInject';

    this.$uibModal = $uibModal;
    this.msg = null;
    this.level = null;

    // intercept all unhandled errors
    window.onerror = (errorMsg, url, lineNumber) => {
      const msg = `Error: ${errorMsg}; ${url}:${lineNumber}`;
      console.log(msg); // #DEBUG
      this.error(msg);
      return false;
    }
  }

  message(message = null) {
    this.msg = message;
    this.level = 'MESSAGE';
  }

  warning(message = null) {
    if (message) {
      console.log(message);
    }
    this.msg = message;
    this.level = 'WARNING';
  }

  error(message = null) {
    if (message) {
      console.log("ERROR: " + message);
    }
    this.msg = message;
    this.level = 'ERROR';
  }

  get alert() {
    return{
      level: this.level,
      message: this.msg,
      isMessage() {
        return this.message || false;
      },
      isError() {
        return this.level === 'ERROR' && this.message;
      },
      isWarning() {
        return this.level === 'WARNING' && this.message;
      }
    }
  }

  showPopup(title, message) {
    return this.$uibModal.open({
      animation: false,
      ariaLabelledBy: 'modal-title',
      ariaDescribedBy: 'modal-body',
      templateUrl: './services/alert-service-popup.html',
      controller: function ($uibModalInstance) {
        this.title = title;
        this.message = message;

        this.cancel = function () {
          $uibModalInstance.dismiss('cancel');
        };
      },
      controllerAs: '$ctrl',
      size: 'lg',
  });
  }
}