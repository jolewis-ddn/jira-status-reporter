"use strict";

const debug = require('debug')('JDR')

const fs = require('fs')
const glob = require('glob')
const path = require('path');

const JiraDataCache = require('./JiraDataCache')

const REBUILD = 999
const REFRESH = 10

class JiraDataReader {
    constructor() {
        this.cache = new JiraDataCache()
        this.loaded = this.cache.isActive()
        return(this)
    }
    
    getCacheObject() { return(this.cache) }

    reloadCache(reloadType = REFRESH) {
        debug(`reloadCache() called...`)
        let d = this.cache.getCache()
        let flist = glob.sync('./data/*.json')
        let updates = 0
        if (reloadType == REBUILD) {
            this.clearCache()
            flist.forEach((fname) => {
                updates += 1
                let raw = this._processFile(fname)
                d.push({
                    fullname: fname, 
                    base: path.basename(fname, '.json'), 
                    status: this._parseStatusName(fname),
                    date: this._parseFileDate(fname), 
                    total: raw.total
                })
            })
        } else {
            flist.forEach((fname) => {
                if (!this.cache.containsFile(fname)) {
                    updates += 1
                    let raw = this._processFile(fname)
                    d.push({
                        fullname: fname, 
                        base: path.basename(fname, '.json'), 
                        status: this._parseStatusName(fname),
                        date: this._parseFileDate(fname), 
                        total: raw.total
                    })
                }
            })
        }
        debug(`...saving cache (${updates} updates)`)
        this.cache.saveCache(d)
        this.loaded = this.cache.isActive()
        // debug(`...this.loaded = ${this.loaded}`)
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
            // if (!this.dates) {
                this.dates = []
                try {
                    const interimCache = this.cache.readCache(true, false)
                    interimCache.forEach((el, ndx) => {
                        if (!this.dates.includes(el.date)) {
                            this.dates.push(el.date)
                        }
                    })
                } catch (err) {
                    debug(`... Error during interimCache: ${err}`)
                }
            // }
            debug(`... returning this.dates`)
            return(this.dates.sort())
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

    clearCache() {
        // this.cache.reset()
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

module.exports = JiraDataReader