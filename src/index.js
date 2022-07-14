
import { OrbitDB } from './orbitdb.js'

import { LevelDatastore } from 'datastore-level'
// import { KeyChain } from 'libp2p/src/keychain/index.js'
import { Replicator } from './replicator/index.js'

import { StaticAccess } from './components/access/static.js'
import { Entry } from './components/entry/index.js'
import { Identity } from './components/identity/index.js'
import { KeyValue } from './components/store/keyvalue.js'

import { createInstance } from './compat/create-instance.js';

OrbitDB.registry.access.add(StaticAccess)
OrbitDB.registry.entry.add(Entry)
OrbitDB.registry.identity.add(Identity)
OrbitDB.registry.store.add(KeyValue)

OrbitDB.Storage = LevelDatastore
// OrbitDB.Keychain = KeyChain
OrbitDB.Replicator = Replicator

// Backwards Compatability
OrbitDB.createInstance = createInstance

export { OrbitDB }
