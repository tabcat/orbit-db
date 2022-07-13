
import EventEmitter from 'events'
import Monitor from './monitor.js'

const prefix = 'psd/v1'
const version = 'v1'

function sortAlphabetical (a, b) {
  const nameA = a.name.toUpperCase(); // ignore upper and lowercase
  const nameB = b.name.toUpperCase(); // ignore upper and lowercase
  if (nameA < nameB) {
    return -1;
  }

  if (nameA > nameB) {
    return 1;
  }

  // names must be equal
  return 0;
}

const refresh = () => {
  self.open = monitor.peers.has(remotePeerId)
}

export class Direct {
  constructor (pubsub, localPeerId, remotePeerId, onMessage) {
    this.pubsub = pubsub
    this.localPeerId = localPeerId
    this.remotePeerId = remotePeerId
    this.topic = Direct.directTopic(localPeerId, remotePeerId)

    this._onMessage = onMessage

    this.events = new EventEmitter()
    this.monitor = new Monitor(pubsub, this.topic)
    this.open = null
  }

  static directTopic (localPeerId, remotePeerId) {
    const [peer1, peer2] = [localPeerId, remotePeerId].sort(sortAlphabetical)
    return ['', prefix, version, peer1, peer2].join('/')
  }

  async start (interval) {
    await this.pubsub.subscribe(this.topic, this._onMessage)
    await this.monitor.start(interval)

    const refresh = () => {
      this.open = this.monitor.peers.has(this.remotePeerId)
    }
    refresh()

    this.monitor.events.on('update', refresh)
  }

  async stop () {
    await this.pubsub.unsubscribe(this.topic, this._onMessage)
    await this.monitor.stop()

    this.open = false
  }

  async publish (data) {
    if (!this.open) {
      throw new Error('direct pubsub not open')
    }

    await this.pubsub.publish(this.topic, data)
  }
}
