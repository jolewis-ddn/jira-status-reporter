const debug = require('debug')('jira-data-cache')
const fs = require('fs')
const path = require('path');

const DEFAULT_CACHE_FILENAME = '.jiraCache.json'

const REBUILD = 999
const REFRESH = 1

class JiraDataCache {
    constructor(cacheFilename = DEFAULT_CACHE_FILENAME) {
        debug('JiraDataCache created')
        this.loaded = false
        this.filename = cacheFilename
        this.readCache(false, true)
    }

    containsFile(filename) {
        debug(`containsFile(${filename}) called...`)
        if (this.cache) {
            let containsFilename = false
            debug(`...checking cache...`)
            this.cache.forEach((el) => {
                if (el.fullname == filename || el.base == filename || (el.base + ".json") == filename) {
                    containsFilename = true
                }
            })
            debug(`... returning ${containsFilename}`)
            return(containsFilename)
        } else {
            debug(`... returning false (B)`)
            return(false)
        }
    }

    makeCache() {
        debug('makeCache() called')
        return(this.saveCache([]))
    }

    saveCache(data) {
        debug('saveCache() called')
        fs.writeFileSync(this.filename, JSON.stringify(data))
        this.cache = data
        this.loaded = true
        debug(` ... loaded? ${this.loaded}`)
        return(this.cache)
    }

    _validateCache() {
        if (fs.existsSync(this.filename)) {
            return(true)
        } else {
            return(false)
        }
    }

    updateCache(returnCache = false, failSilently = false) {
        debug(`updateCache(${returnCache}, ${failSilently}) called...`)
        if (this.loaded) {
            return(this.cache)
        } else {
            debug(`cache not loaded, so returning null`)
            return(null)
        }
    }

    readCache(returnCache = false, failSilently = false) {
        debug('readCache() called')
        if (this._validateCache()) {
            const rawCache = fs.readFileSync(this.filename)
            try {
                this.cache = JSON.parse(rawCache)
                this.loaded = true
                if (returnCache) {
                    debug('...returning cache')
                    return(this.cache)
                } else {
                    debug('...returning this')
                    return(this)
                }
            } catch (err) {
                debug(`...caught exception ${err}`)
                return(this)
            }
        } else {
            this.makeCache()
            if (failSilently) {
                debug('...readCache() failing silently')
                return(this)
            } else {
                debug('...readCache() failing NOT silently')
                throw new Error('No cache file found')
            }
        }
    }

    getCache(createIfEmpty = false) {
        if (this.loaded) {
            return(this.cache)
        } else {
            if (createIfEmpty) {
                return(this.makeCache())
            } else {
                return(null)
            }
        }
    }

    isActive() { return(this.loaded) }

    wipe(unlinkFile = true) {
        debug(`reset(${unlinkFile}) called...`)
        if (unlinkFile) {
            if (fs.existsSync(this.filename)) {
                fs.unlinkSync(this.filename)
                fs.writeFileSync(this.filename, JSON.stringify([]))
            } else {
                debug(`${this.filename} doesn't exist`)
            }
        }

        this.loaded = false
        this.cache = null
        return(this)
    }
}

module.exports = JiraDataCache