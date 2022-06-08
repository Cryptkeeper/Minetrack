const fs = require('fs/promises')
const path = require('path')
const fetch = require('node-fetch')

const config = require('../config.json')

const DEFAULT_CONFIG = { type: 'remote', updateInterval: 86400000 }
const LOCAL_VERSIONS_PATH = path.resolve(__dirname, '../minecraft_versions.json')

/**
 * The global versions provider.
 *
 * @type {VersionsProvider}
 */
let provider

class VersionsProvider {
  // editionId -> [versionValue] mappings
  names = {};
  protocolNumbers = {};

  setEditionData (edition, names, protocolNumbers) {
    this.names[edition] = names
    this.protocolNumbers[edition] = protocolNumbers
  }

  /**
   * Updates the version data.
   *
   * @returns {Promise} a promise containing the update result
   */
  async update () {}
}

class LocalVersionsProvider extends VersionsProvider {
  async update () {
    const raw = await fs.readFile(LOCAL_VERSIONS_PATH, 'utf8')
    const editions = JSON.parse(raw)

    for (const [edition, versions] of Object.entries(editions)) {
      this.setEditionData(
        edition,
        versions.map(version => version.name),
        versions.map(version => version.protocolId)
      )
    }
  }
}

const REMOTE_EDITION_NAMES = {
  java: 'PC',
  bedrock: 'PE',
  education: 'EDU'
}

class RemoteVersionsProvider extends VersionsProvider {
  constructor (endpoint) {
    super()
    this.endpoint = endpoint
  }

  async update () {
    const res = await fetch(this.endpoint)
    const { editions } = await res.json()

    for (const [rawEdition, data] of Object.entries(editions)) {
      const edition = REMOTE_EDITION_NAMES[rawEdition]
      const versions = data.versions
        .filter(version => version.protocolNumber !== null)
        // Sort versions chronologically (mimic local behavior)
        .reverse()

      if (edition === 'PC') {
        // Ignore versions older than 1.7.2
        // We cannot rely on protocol numbers since they are reused across versions.
        const onePointSeven = versions.findIndex(version => version.name === '1.7.2')
        versions.splice(0, onePointSeven)
      }

      this.setEditionData(
        edition,
        versions.map(version => version.name),
        versions.map(version => version.protocolNumber)
      )
    }
  }
}

module.exports = {
  initProvider: async function () {
    const { type, updateInterval } = config.versions || DEFAULT_CONFIG

    switch (type) {
      case 'local':
        provider = new LocalVersionsProvider()
        break
      case 'mc-versions':
        // See https://github.com/hugmanrique/mc-versions
        provider = new RemoteVersionsProvider('https://raw.githubusercontent.com/hugmanrique/mc-versions/main/versions.json')
        break
      default:
        throw new Error(`Unknown versions provider type "${type}"`)
    }
    if (updateInterval <= 0) {
      throw new Error(`Invalid non-positive versions provider update interval: ${updateInterval}`)
    }

    async function update () {
      await provider.update()
      setTimeout(update, updateInterval) // Schedule next update
    }
    await update() // Wait for initial update (populates data)
  },
  getProvider: function () {
    if (!provider) {
      throw new Error('Versions provider has not been initialized')
    }
    return provider
  }
}
