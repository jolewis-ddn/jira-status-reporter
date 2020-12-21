const debug = require('debug')('jira-data-cache')
const fs = require('fs')
const path = require('path');

const DEFAULT_CACHE_FILENAME = '.jiraCache.json'

const REBUILD = 999
const UPDATE  = 500
const REFRESH = 1

class JiraDataCache {
    constructor(cacheFilename = DEFAULT_CACHE_FILENAME) {
        debug('JiraDataCache created')
        this.loaded = false
        this.filename = cacheFilename
        this.readCache(false, true)
    }

    getCacheFilename() { return(this.filename) }
    
    /**
     * Has this file already been processed and cached?
     *
     * @param {string} filename File name (excluding path)
     * @returns boolean
     * @memberof JiraDataCache
     */
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

    /**
     * Create an empty cache
     *
     * @returns array Cache
     * @memberof JiraDataCache
     */
    makeCache() {
        debug('makeCache() called')
        return(this.saveCache([]))
    }

    /**
     * Create a new cache with the provided data
     *
     * @param {array} data To be stored in the cache
     * @returns array Cache
     * @memberof JiraDataCache
     */
    saveCache(data) {
        debug('saveCache() called')
        fs.writeFileSync(this.filename, JSON.stringify(data))
        this.cache = data
        this.loaded = true
        debug(` ... loaded? ${this.loaded}`)
        return(this.cache)
    }

    /**
     * Is the cache valid?
     *
     * @returns boolean
     * @memberof JiraDataCache
     */
    _validateCache() {
        if (fs.existsSync(this.filename)) {
            return(true)
        } else {
            return(false)
        }
    }

    /**
     * Has the cache been processed and loaded?
     *
     * @param {boolean} [returnCache=false]
     * @param {boolean} [failSilently=false]
     * @returns Cache or null
     * @memberof JiraDataCache
     */
    updateCache(returnCache = false, failSilently = false) {
        debug(`updateCache(${returnCache}, ${failSilently}) called...`)
        if (this.loaded) {
            return(this.cache)
        } else {
            debug(`cache not loaded, so returning null`)
            return(null)
        }
    }

    /**
     * Read the cache from the local file
     *
     * @param {boolean} [returnCache=false] Return the cache? If false, returns JiraDataReader
     * @param {boolean} [failSilently=false] Don't warn if the cache had to be created
     * @returns Cache or JiraDataCache
     * @memberof JiraDataCache
     */
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

    /**
     * Rretrieve the cache, optionally creating it if empty
     *
     * @param {boolean} [createIfEmpty=false] Make the cache if it doesn't already exist
     * @returns Cache or null
     * @memberof JiraDataCache
     */
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

    /**
     * Remove the cache content and optionally the file
     *
     * @param {boolean} [unlinkFile=true] Remove the file
     * @returns JiraDataCache
     * @memberof JiraDataCache
     */
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