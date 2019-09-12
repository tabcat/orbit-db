'use strict'

const assert = require('assert')
const mapSeries = require('p-map-series')
const fs = require('fs-extra')
const path = require('path')
const rmrf = require('rimraf')
const levelup = require('levelup')
const leveldown = require('leveldown')
const OrbitDB = require('../src/OrbitDB')
const OrbitDBAddress = require('../src/orbit-db-address')
const Identities = require('orbit-db-identity-provider')
const io = require('orbit-db-io')

// Include test utilities
const {
  config,
  startIpfs,
  stopIpfs,
  testAPIs,
} = require('./utils')

const dbPath = './orbitdb/tests/create-open'
const ipfsPath = './orbitdb/tests/create-open/ipfs'
const migrationFixturePath = './test/fixtures/migration/cache-schema-test'
const ipfsFixturesDir = './test/fixtures/ipfs'

Object.keys(testAPIs).forEach(API => {
  describe(`orbit-db - Create & Open (${API})`, function() {
    this.timeout(config.timeout)

    let ipfsd, ipfs, orbitdb, db, address
    let localDataPath

    before(async () => {
      config.daemon1.repo = ipfsPath
      rmrf.sync(config.daemon1.repo)
      rmrf.sync(dbPath)
      ipfsd = await startIpfs(API, config.daemon1)
      ipfs = ipfsd.api
      await fs.copy(path.join(ipfsFixturesDir, 'blocks'), path.join(ipfsd.path, 'blocks'))
      await fs.copy(path.join(ipfsFixturesDir, 'datastore'), path.join(ipfsd.path, 'datastore'))
      orbitdb = await OrbitDB.createInstance(ipfs, { directory: dbPath })
    })

    after(async () => {
      if(orbitdb)
        await orbitdb.stop()

      if (ipfsd)
        await stopIpfs(ipfsd)
    })

    describe('Create', function() {
      describe('Errors', function() {
        it('throws an error if given an invalid database type', async () => {
          let err
          try {
            db = await orbitdb.create('first', 'invalid-type')
          } catch (e) {
            err = e.toString()
          }
          assert.equal(err, 'Error: Invalid database type \'invalid-type\'')
        })

        it('throws an error if given an address instead of name', async () => {
          let err
          try {
            db = await orbitdb.create('/orbitdb/Qmc9PMho3LwTXSaUXJ8WjeBZyXesAwUofdkGeadFXsqMzW/first', 'feed')
          } catch (e) {
            err = e.toString()
          }
          assert.equal(err, 'Error: Given database name is an address. Please give only the name of the database!')
        })

        it('throws an error if database already exists', async () => {
          let err
          try {
            db = await orbitdb.create('first', 'feed', { replicate: false })
            db = await orbitdb.create('first', 'feed', { replicate: false })
          } catch (e) {
            err = e.toString()
          }
          assert.equal(err, `Error: Database '${db.address}' already exists!`)
        })


        it('throws an error if database type doesn\'t match', async () => {
          let err, log, kv
          try {
            log = await orbitdb.kvstore('keyvalue', { replicate: false })
            kv = await orbitdb.eventlog(log.address.toString())
          } catch (e) {
            err = e.toString()
          }
          assert.equal(err, `Error: Database '${log.address}' is type 'keyvalue' but was opened as 'eventlog'`)
        })
      })

      describe('Success', function() {
        before(async () => {
          db = await orbitdb.create('second', 'feed', { replicate: false })
          localDataPath = path.join(dbPath, orbitdb.id, 'cache')
          await db.close()
        })

        it('creates a feed database', async () => {
          assert.notEqual(db, null)
        })

        it('database has the correct address', async () => {
          assert.equal(db.address.toString().indexOf('/orbitdb'), 0)
          assert.equal(db.address.toString().indexOf('zd'), 9)
          assert.equal(db.address.toString().indexOf('second'), 59)
        })

        it('saves the database locally', async () => {
          assert.equal(fs.existsSync(localDataPath), true)
        })

        it('saves database manifest reference locally', async () => {
          const address = db.id
          const manifestHash = address.split('/')[2]
          await db._cache._store.open()
          const value = await db._cache.get(address + '/_manifest')
          assert.equal(value, manifestHash)
        })

        it('saves database manifest file locally', async () => {
          const manifestHash = db.id.split('/')[2]
          const manifest = await io.read(ipfs, manifestHash)
          assert.notEqual(manifest, )
          assert.equal(manifest.name, 'second')
          assert.equal(manifest.type, 'feed')
          assert.notEqual(manifest.accessController, null)
          assert.equal(manifest.accessController.indexOf('/ipfs'), 0)
        })

        it('can pass local database directory as an option', async () => {
          const dir = './orbitdb/tests/another-feed'
          db = await orbitdb.create('third', 'feed', { directory: dir })
          assert.equal(fs.existsSync(dir), true)
        })

        it('loads cache from previous version of orbit-db', async() => {
          const dbName = 'cache-schema-test'

          db = await orbitdb.create(dbName, 'keyvalue')
          const manifestHash = db.address.root
          const migrationDataPath = path.join(dbPath, manifestHash, dbName)

          await db.load()
          assert.equal((await db.get('key')), undefined)
          await db.close()
          await db.drop()

          await fs.copy(migrationFixturePath, migrationDataPath)
          db = await orbitdb.create(dbName, 'keyvalue')
          await db.load()

          assert.equal(manifestHash, db.address.root)
          assert.equal((await db.get('key')), 'value')
        })

        it('loads cache from previous version of orbit-db with the directory option', async() => {
          const dbName = 'cache-schema-test2'
          const directory = path.join(dbPath, "some-other-place")

          await fs.copy(migrationFixturePath, directory)
          db = await orbitdb.create(dbName, 'keyvalue', { directory })
          await db.load()

          assert.equal((await db.get('key')), 'value')
        })

        describe('Access Controller', function() {
          before(async () => {
            if (db) {
              await db.close()
              await db.drop()
            }
          })

          afterEach(async () => {
            if (db) {
              await db.close()
              await db.drop()
            }
          })

          it('creates an access controller and adds ourselves as writer by default', async () => {
            db = await orbitdb.create('fourth', 'feed')
            assert.deepEqual(db.access.write, [orbitdb.identity.id])
          })

          it('creates an access controller and adds writers', async () => {
            db = await orbitdb.create('fourth', 'feed', {
              accessController: {
                write: ['another-key', 'yet-another-key', orbitdb.identity.id]
              }
            })
            assert.deepEqual(db.access.write, ['another-key', 'yet-another-key', orbitdb.identity.id])
          })

          it('creates an access controller and doesn\'t add read access keys', async () => {
            db = await orbitdb.create('seventh', 'feed', { read: ['one', 'two'] })
            assert.deepEqual(db.access.write, [orbitdb.identity.id])
          })
        })

        describe('Defaults', function () {
          before(async () => {
            if (db) {
              await db.close()
              await db.drop()
            }
          })

          afterEach(async () => {
            if (db) {
              await db.close()
              await db.drop()
            }
          })

          it('creates a manifest with no defaults field', async () => {
            db = await orbitdb.create('no-meta', 'docstore')
            const manifest = await io.read(ipfs, db.address.root)
            assert.deepStrictEqual(Object.keys(manifest).filter(k => k === 'defaults'), [])
          })

          it('creates a manifest with a defaults field', async () => {
            db = await orbitdb.create('fourth', 'docstore', {
              mergeDefaults: true,
              defaults: true,
              randomFieldIncludedInManifest: true
            })
            const manifest = await io.read(ipfs, db.address.root)
            assert.strictEqual(manifest.defaults.randomFieldIncludedInManifest, true)
          })
        })
      })
    })

    describe('determineAddress', function() {
      describe('Errors', function() {
        it('throws an error if given an invalid database type', async () => {
          let err
          try {
            await orbitdb.determineAddress('first', 'invalid-type')
          } catch (e) {
            err = e.toString()
          }
          assert.equal(err, 'Error: Invalid database type \'invalid-type\'')
        })

        it('throws an error if given an address instead of name', async () => {
          let err
          try {
            await orbitdb.determineAddress('/orbitdb/Qmc9PMho3LwTXSaUXJ8WjeBZyXesAwUofdkGeadFXsqMzW/first', 'feed')
          } catch (e) {
            err = e.toString()
          }
          assert.equal(err, 'Error: Given database name is an address. Please give only the name of the database!')
        })
      })

      describe('Success', function() {
        before(async () => {
          address = await orbitdb.determineAddress('third', 'feed', { replicate: false })
          localDataPath = path.join(dbPath, address.root, address.path)
        })

        it('does not save the address locally', async () => {
          assert.equal(fs.existsSync(localDataPath), false)
        })

        it('returns the address that would have been created', async () => {
          db = await orbitdb.create('third', 'feed', { replicate: false })
          assert.equal(address.toString().indexOf('/orbitdb'), 0)
          assert.equal(address.toString().indexOf('zd'), 9)
          assert.equal(address.toString(), db.address.toString())
        })
      })
    })

    describe('Open', function() {
      beforeEach(async () => {
        db = await orbitdb.open('abc', { create: true, type: 'feed' })
      })

      it('throws an error if trying to open a database with name only and \'create\' is not set to \'true\'', async () => {
        let err
        try {
          db = await orbitdb.open('XXX', { create: false })
        } catch (e) {
          err = e.toString()
        }
        assert.equal(err, "Error: 'options.create' set to 'false'. If you want to create a database, set 'options.create' to 'true'.")
      })

      it('throws an error if trying to open a database with name only and \'create\' is not set to true', async () => {
        let err
        try {
          db = await orbitdb.open('YYY', { create: true })
        } catch (e) {
          err = e.toString()
        }
        assert.equal(err, `Error: Database type not provided! Provide a type with 'options.type' (${OrbitDB.databaseTypes.join('|')})`)
      })

      it('opens a database - name only', async () => {
        db = await orbitdb.open('abc', { create: true, type: 'feed', overwrite: true })
        assert.equal(db.address.toString().indexOf('/orbitdb'), 0)
        assert.equal(db.address.toString().indexOf('zd'), 9)
        assert.equal(db.address.toString().indexOf('abc'), 59)
      })

      it('opens a database - with a different identity', async () => {
        const identity = await Identities.createIdentity({ id: 'test-id', keystore: orbitdb.keystore })
        db = await orbitdb.open('abc', { create: true, type: 'feed', overwrite: true, identity })
        assert.equal(db.address.toString().indexOf('/orbitdb'), 0)
        assert.equal(db.address.toString().indexOf('zd'), 9)
        assert.equal(db.address.toString().indexOf('abc'), 59)
        assert.equal(db.identity, identity)
      })

      it('opens the same database - from an address', async () => {
        db = await orbitdb.open(db.address)
        assert.equal(db.address.toString().indexOf('/orbitdb'), 0)
        assert.equal(db.address.toString().indexOf('zd'), 9)
        assert.equal(db.address.toString().indexOf('abc'), 59)
      })

      it('opens a database and adds the creator as the only writer', async () => {
        db = await orbitdb.open('abc', { create: true, type: 'feed', overwrite: true })
        assert.equal(db.access.write.length, 1)
        assert.equal(db.access.write[0], db.identity.id)
      })

      it('opens a database with defaults option excluded in manifest', async () => {
        db = await orbitdb.open('abc',
          { create: true, type: 'docstore', overwrite: true })
        db = await orbitdb.open(db.address, { mergeDefaults: true })
        try {
          db.put({ test: 123 })
          throw new Error('should have thrown')
        } catch (e) {
          assert.strictEqual(e.message, `The provided document doesn't contain field '_id'`)
        }
      })

      it('opens a database with defaults option included in manifest, mergeDefaults false', async () => {
        db = await orbitdb.open('abc',
          { create: true, type: 'docstore', overwrite: true, defaults: true })
        db = await orbitdb.open(db.address, { mergeDefaults: false })
        try {
          db.put({ test: 123 })
          throw new Error('should have thrown')
        } catch (e) {
          assert.strictEqual(e.message, `The provided document doesn't contain field '_id'`)
        }
      })

      it('opens a database with defaults option included in manifest, mergeDefaults true', async () => {
        db = await orbitdb.open('abc',
          { create: true, type: 'docstore', overwrite: true, defaults: true, indexBy: 'test' })
        db = await orbitdb.open(db.address, { mergeDefaults: true })
        await db.put({ test: 123 })
      })

      it('doesn\'t open a database if we don\'t have it locally', async () => {
        const address = new OrbitDBAddress(db.address.root.slice(0, -1) + 'A', 'non-existent')
        return new Promise((resolve, reject) => {
          setTimeout(resolve, 900)
          orbitdb.open(address)
            .then(() => reject(new Error('Shouldn\'t open the database')))
            .catch(reject)
        })
      })

      it('throws an error if trying to open a database locally and we don\'t have it', () => {
        const address = new OrbitDBAddress(db.address.root.slice(0, -1) + 'A', 'second')
        return orbitdb.open(address, { localOnly: true })
          .then(() => new Error('Shouldn\'t open the database'))
          .catch(e => {
            assert.equal(e.toString(), `Error: Database '${address}' doesn't exist!`)
          })
      })

      it('open the database and it has the added entries', async () => {
        db = await orbitdb.open('ZZZ', { create: true, type: 'feed' })
        await db.add('hello1')
        await db.add('hello2')

        db = await orbitdb.open(db.address)

        await db.load()
        const res = db.iterator({ limit: -1 }).collect()

        assert.equal(res.length, 2)
        assert.equal(res[0].payload.value, 'hello1')
        assert.equal(res[1].payload.value, 'hello2')
      })
    })
  })
})
