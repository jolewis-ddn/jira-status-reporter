"use strict";

const debug = require('debug')('JSR-file-manager')

const DATA_PATH = "data"

class JiraStatusReporterFileManager {
    constructor(homeDir) {
        this.homeDir = homeDir
    }

    getHomeDir() { 
        debug(`getHomeDir() called... returning ${this.homeDir}`)
        return(this.homeDir) 
    }

    buildChartUrl() {
        return new Promise((resolve, reject) => {
            resolve("ok")
            // reject(err)
        })
    }
}

module.exports = JiraStatusReporterFileManager
