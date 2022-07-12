
import { OrbitDB as ODB } from './orbitdb'

import { LevelDatastore } from 'datastore-level'
import { KeyChain } from 'libp2p/src/keychain/index.js'
import { Replicator } from './replicator/index.js'

import { StaticAccess } from './access/static.js'
import { Entry } from './entry/index.js'
import { Identity } from './identity/index.js'
import { KeyValue } from './store/keyvalue.js'

ODB.registry.access.add(StaticAccess)
ODB.registry.entry.add(Entry)
ODB.registry.identity.add(Identity)
ODB.registry.store.add(KeyValue)

ODB.Storage = LevelDatastore
ODB.Keychain = KeyChain
ODB.Replicator = Replicator

export const OrbitDB = ODB
