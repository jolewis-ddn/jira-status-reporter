"use strict";

const debug = require('debug')('config-js')
const fs = require('fs')

const DEFAULT_FILENAME = './jiraConfig.json'

module.exports = function () {
    let configFilename = DEFAULT_FILENAME
    try {
        // If .JiraStatusServer.json exists, use it to get the config filename
        try {
            let newCfg = JSON.parse(fs.readFileSync('./.JiraStatusServer.json'))
            configFilename = newCfg.config
            debug(`custom config filename found: ${configFilename}`)
        }
        catch (err) {
            debug(`custom config filename not found, so using default: ${configFilename}`)
        }
        debug(`config created... ${configFilename}...`)
        let cfg = JSON.parse(fs.readFileSync(configFilename))

        // TODO: sanity check values
        let config = {
            jira: {
                protocol: cfg.jira.protocol,
                host: cfg.jira.host,
                username: cfg.jira.username,
                password: cfg.jira.password,
                apiVersion: cfg.jira.apiVersion
            },
            server: {
                port: cfg.server
            },
            graphicServer: {
                protocol: cfg.graphicServer.protocol,
                server: cfg.graphicServer.server,
                port: cfg.graphicServer.port,
                script: cfg.graphicServer.script
            },
            project: 'RED'
        }
        return config
    } catch (err) {
        throw new Error(`Unable to find or parser config file "${configFilename}"`)
    }    
}