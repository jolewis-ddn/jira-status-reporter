"use strict";

const debug = require('debug')('JDR')

const fs = require('fs')
const glob = require('glob')
const path = require('path');

const JiraDataCache = require('./JiraDataCache')

class JiraDataReader {
    constructor() {
        this.cache = new JiraDataCache()
        this.loaded = this.cache.isActive()
        this.REBUILD = 999
        this.REFRESH = 10
        return(this)
    }
    
    getCacheObject() { return(this.cache) }

    rebuild() { return(this.REBUILD) }
    refresh() { return(this.REFRESH) }

    reloadCache(reloadType = this.REFRESH) {
        debug(`reloadCache() called...`)
        let d = this.cache.getCache(true)
        let flist = glob.sync('./data/*.json')
        let updates = 0
        if (reloadType == this.REBUILD) {
            this.clearCache()
        }
        flist.forEach((fname) => {
            if (reloadType == this.REBUILD || !this.cache.containsFile(fname)) {
                updates += 1
                let raw = this._processFile(fname)
                d.push({
                    fullname: fname, 
                    base: path.basename(fname, '.json'), 
                    status: this._parseStatusName(fname),
                    date: this._parseFileDate(fname), 
                    total: raw.total,
                    summary: raw.summary
                })
            }
        })

        debug(`...saving cache (${updates} updates)`)
        this.cache.saveCache(d)
        this.loaded = this.cache.isActive()
        return(updates)
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

    getSeriesData(typeFilter = false) {
        debug(`getSeriesData(${typeFilter}) called...`)
        if (this.loaded) {
            this.seriesData = {}
            this.cache.readCache(true, false).forEach((el, ndx) => {
                if (!(el.status in this.seriesData)) {
                    this.seriesData[el.status] = []
                }
                if (typeFilter) {
                    this.seriesData[el.status].push(el['summary'][typeFilter]['count'])
                } else {
                    this.seriesData[el.status].push(el.total)
                }
            })
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
        this.cache.makeCache()
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
        // Summarize data
        let summary = { Story: { count: 0, issues: [] }, 
            Bug: { count: 0, issues: [] }, 
            Task: { count: 0, issues: [] }, 
            'Sub-task': { count: 0, issues: [] }, 
            Epic: { count: 0, issues: [] }, 
            Test: { count: 0, issues: [] } }
        this.lastData.issues.forEach((i) => {
            summary[i.fields.issuetype.name]['count'] += 1
            summary[i.fields.issuetype.name]['issues'].push(i.key)
        })
        return({ total: this.lastData.total, raw: this.lastData, summary: summary })
    }
}

module.exports = JiraDataReader