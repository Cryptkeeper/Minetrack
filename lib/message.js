module.exports = function MessageOf (name, data) {
  return JSON.stringify({
    message: name,
    ...data
  })
}
