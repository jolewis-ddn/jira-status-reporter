// Load config
const fs = require('fs')

let cfg = {}

try {
    cfg = JSON.parse(fs.readFileSync('./jiraConfig.json'))
    // TODO: sanity check values
} catch (err) {
    throw new Error("Unable to find jiraConfig.json")
}

module.exports = {
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
    }
}
