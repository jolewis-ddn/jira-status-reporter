"use strict";

const debug = require('debug')('JSR-file-manager')

class JiraStatusReporterFileManager {
    constructor(homeDir) {
        this.homeDir = homeDir
    }

    getHomeDir() { 
        debug(`getHomeDir() called... returning ${this.homeDir}`)
        return(this.homeDir) 
    }
}

module.exports = JiraStatusReporterFileManager
