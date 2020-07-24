"use strict";

const debug = require('debug')('JDR')

const fs = require('fs')
const glob = require('glob')
const path = require('path');

class JiraDataReader {
    constructor() {
        this.cache = new JiraDataCache()
        this.loaded = this.cache.isActive()
        return(this)
    }
    
    processAllFiles(forceRefresh = false) {
        debug('processAllFiles() called')
        if (!this.loaded || forceRefresh) {
            let d = []
            let flist = glob.sync('./data/*.json')
            flist.forEach((fname) => {
                let raw = this._processFile(fname)
                d.push({
                    fullname: fname, 
                    base: path.basename(fname, '.json'), 
                    status: this._parseStatusName(fname),
                    date: this._parseFileDate(fname), 
                    total: raw.total
                })
            })
            this.cache.saveCache(d)
            this.loaded = this.cache.isActive()
            debug(`...this.loaded = ${this.loaded}`)
        }
        return(this)
    }
    
    getDataSummary() {
        debug('getDataSummary() called...')
        if (!this.loaded) {
            this.processAllFiles()
        }

        try {
            let summary = this.cache.readCache(true, false)
            debug(`... returning summary`)
            return(summary)
        } catch (err) {
            return(err)
        }
    }

    getDates() {
        debug('getDates() called...')
        if (this.loaded) {
            if (!this.dates) {
                this.dates = []
                this.cache.readCache(true, false).forEach((el, ndx) => {
                    if (!this.dates.includes(el.date)) {
                        this.dates.push(el.date)
                    }
                })
            }
            debug(`... returning this.dates`)
            return(this.dates)
        } else {
            debug('... no data loaded')
            return([])
        }
    }

    getSeriesData() {
        if (this.loaded) {
            if (!this.seriesData) {
                this.seriesData = {}
                this.cache.readCache(true, false).forEach((el, ndx) => {
                    if (!(el.status in this.seriesData)) {
                        this.seriesData[el.status] = []
                    }
                    this.seriesData[el.status].push(el.total)
                })
            }
            return(this.seriesData)
        } else {
            debug('... no data loaded')
            return({})
        }
    }

    getAllFiles() {
        if (!this.loaded) {
            this.processAllFiles()
        }
        return(this.allFiles)
    }

    reset() { return(this.clearCache()) }

    clearCache() {
        this.cache.reset()
        this.loaded = this.cache.isActive()
        return(this)
    }

    _parseStatusName(fname) {
        const bname = path.basename(fname, '.json')
        return(bname.substring(0, bname.length-11))
    }

    _parseFileDate(fname) {
        return(fname.substring(fname.length-15, fname.length-5))
    }

    _processFile(fname) {
        debug(`_processFile(${fname}) called`)
        this.lastFilename = fname
        this.lastFiledate = this._parseFileDate(fname)
        debug(`...lastFileDate = ${this.lastFiledate}`)
        let data = fs.readFileSync(fname)
        this.lastData = JSON.parse(data)
        debug(`this.lastData.total = ${this.lastData.total}`)
        return({ total: this.lastData.total, raw: this.lastData })
    }
}

class JiraDataCache {
    constructor() {
        debug('JiraDataCache created')
        this.loaded = false
        this.filename = '.jiraCache.json'
        this.readCache(false, true)
    }

    saveCache(data) {
        debug('saveCache() called')
        fs.writeFileSync(this.filename, JSON.stringify(data))
        this.loaded = true
    }

    _validateCache() {
        if (fs.existsSync(this.filename)) {
            return(true)
        } else {
            return(false)
        }
    }

    readCache(returnCache = false, failSilently = false) {
        debug('readCache() called')
        if (this._validateCache()) {
            this.rawCache = fs.readFileSync(this.filename)
            this.cache = JSON.parse(this.rawCache)
            this.loaded = true
            if (returnCache) {
                debug('...returning cache')
                return(this.cache)
            } else {
                debug('...returning this')
                return(this)
            }
        } else {
            if (failSilently) {
                debug('...readCache() failing silently')
                return(this)
            } else {
                debug('...readCache() failing NOT silently')
                throw new Error('No cache file found')
            }
        }
    }

    getCache() {
        if (this.loaded) {
            return(this.cache)
        } else {
            return(null)
        }
    }

    isActive() { return(this.loaded) }

    reset(unlinkFile = true) {
        if (unlinkFile) {
            fs.unlink(this.filename)
        }

        this.loaded = false
        this.rawCache = null
        this.cache = null
    }
}

module.exports = JiraDataReader