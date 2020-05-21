function getPlayerCountOrNull (resp) {
  if (resp) {
    return resp.players.online
  } else {
    return null
  }
}

module.exports = {
  getPlayerCountOrNull
}
