"use strict";

const debug = require('debug')('config-js')
const fs = require('fs')

const DEFAULT_FILENAME = './jiraConfig.json'
const ALT_FILENAME = './.JiraStatusServer.json'

module.exports = function () {
    let configFilename = DEFAULT_FILENAME
    // If .JiraStatusServer.json exists, use it to get the config filename
    try {
        let newCfg = JSON.parse(fs.readFileSync(ALT_FILENAME))
        configFilename = newCfg.config
        // debug(`custom config filename found: ${configFilename}`)
    }
    catch (err) {
        // debug(`custom config filename not found, so using default: ${configFilename}`)
    }

    // debug(`config created... ${configFilename}...`)

    try {
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
            project: cfg.project,
            fa: cfg.fa
        }
        return config
    } catch (err) {
        throw new Error(`Unable to find or parse config file "${configFilename}"`)
    }    
}