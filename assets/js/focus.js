export class FocusManager {
  constructor (app) {
    this._app = app
  }

  reset () {
  }

  setFocus = (event, serverRegistration) => {
    console.log(serverRegistration.data.name)
  }
}
