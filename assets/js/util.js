export class Tooltip {
  constructor () {
    this._div = document.getElementById('tooltip')
  }

  set (x, y, offsetX, offsetY, html) {
    this._div.innerHTML = html

    // Assign display: block so that the offsetWidth is valid
    this._div.style.display = 'block'

    // Prevent the div from overflowing the page width
    const tooltipWidth = this._div.offsetWidth

    // 1.2 is a magic number used to pad the offset to ensure the tooltip
    // never gets close or surpasses the page's X width
    if (x + offsetX + (tooltipWidth * 1.2) > window.innerWidth) {
      x -= tooltipWidth
      offsetX *= -1
    }

    this._div.style.top = (y + offsetY) + 'px'
    this._div.style.left = (x + offsetX) + 'px'
  }

  hide = () => {
    this._div.style.display = 'none'
  }
}

export class Caption {
  constructor () {
    this._div = document.getElementById('status-text')
  }

  set (text) {
    this._div.innerText = text
    this._div.style.display = 'block'
  }

  hide () {
    this._div.style.display = 'none'
  }
}

// Minecraft Java Edition default server port: 25565
// Minecraft Bedrock Edition default server port: 19132
const MINECRAFT_DEFAULT_PORTS = [25565, 19132]

export function formatMinecraftServerAddress (ip, port) {
  if (port && !MINECRAFT_DEFAULT_PORTS.includes(port)) {
    return ip + ':' + port
  }
  return ip
}

// Detect gaps in versions by matching their indexes to knownVersions
export function formatMinecraftVersions (versions, knownVersions) {
  if (!versions || !versions.length || !knownVersions || !knownVersions.length) {
    return
  }

  let currentVersionGroup = []
  const versionGroups = []

  for (let i = 0; i < versions.length; i++) {
    // Look for value mismatch between the previous index
    // Require i > 0 since lastVersionIndex is undefined for i === 0
    if (i > 0 && versions[i] - versions[i - 1] !== 1) {
      versionGroups.push(currentVersionGroup)
      currentVersionGroup = []
    }

    currentVersionGroup.push(versions[i])
  }

  // Ensure the last versionGroup is always pushed
  if (currentVersionGroup.length > 0) {
    versionGroups.push(currentVersionGroup)
  }

  if (versionGroups.length === 0) {
    return
  }

  // Remap individual versionGroups values into named versions
  return versionGroups.map(versionGroup => {
    const startVersion = knownVersions[versionGroup[0]]

    if (versionGroup.length === 1) {
      // A versionGroup may contain a single version, only return its name
      // This is a cosmetic catch to avoid version labels like 1.0-1.0
      return startVersion
    } else {
      const endVersion = knownVersions[versionGroup[versionGroup.length - 1]]

      return startVersion + '-' + endVersion
    }
  }).join(', ')
}

export function formatTimestamp (millis) {
  const date = new Date(0)
  date.setUTCSeconds(millis / 1000)
  return date.toLocaleTimeString()
}

export function formatDate (millis) {
  const date = new Date(0)
  date.setUTCSeconds(millis / 1000)
  return date.toLocaleDateString()
}

export function formatPercent (x, over) {
  const val = Math.round((x / over) * 100 * 10) / 10
  return val + '%'
}

export function formatNumber (x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function isArrayEqual (a, b) {
  if (typeof a === 'undefined' || typeof a !== typeof b) {
    return false
  }
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

export function isObjectEqual (a, b, props) {
  if (typeof a === 'undefined' || typeof a !== typeof b) {
    return false
  }
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]

    if (typeof a[prop] === 'undefined' || typeof a[prop] !== typeof b[prop] || a[prop] !== b[prop]) {
      return false
    }
  }
  return true
}

// From http://detectmobilebrowsers.com/
export function isMobileBrowser () {
  var check = false;
  // eslint-disable-next-line no-useless-escape
  (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4)))check = true })(navigator.userAgent || navigator.vendor || window.opera)
  return check
}
