const debug = require('debug')('JiraStatus')
const JSR = require('./JiraStatusReporter')
let jsr = new JSR()

const config = require('./config')

const faIcons = {
    Epic: 'fa:fa-fort-awesome',
    Story: 'fa:fa-book-reader',
    Task: 'fa:fa-tasks',
    'Sub-task': 'fa:fa-subscript',
    Bug: 'fa:fa-bug'
}

const useFontawesome = 'fa' in config() && config().fa

async function getA(x) {
    const r = await getB(x)
    console.log(`A: x = ${x} and r = ${r}`)
    return (`A ${r}`)
}

function getB(x) {
    return new Promise((resolve, reject) => {
        console.log(`B: x = ${x}`)
        resolve(`B ${x}`)
    })
}

async function getFields() {
    debug(`getFields() called`)
    return await jsr.get('field')
}

async function formatFieldsHtml(fields) {
    let response = []
    response.push(`<table style="width: auto;" class="table table-striped table-hover table-sm"><thead class="thead-dark"><tr><th scope="col">${[
        'ID',
        'Name',
        'Custom',
        'Navigable',
        'Searchable',
        'Clause Names'
    ].join('</th><th scope="col">')}</th></tr></thead><tbody>`)
    fields.forEach((f) => {
        response.push(
            `<tr><th scope="row">${f.id}</th><td>${[
                f.name,
                f.custom,
                f.navigable,
                f.searchable,
                f.clauseNames.join('<br>')
            ].join('</td><td>')}</td></tr>`
        )
    })
    response.push('</tbody></table>')
    return (response.join(''))
}

function getFontawesomeJsLink() {
    if (useFontawesome) {
        return `<script src="${config().fa}" crossorigin="anonymous"></script>`
    } else {
        return ''
    }
}

function getFontawesomeIcon(issueType) {
    if (useFontawesome) {
        debug(`getFaIcon(${issueType}) returning ${faIcons[issueType]}`)
        return `${faIcons[issueType]} `
    } else {
        return ''
    }
}

function formatCssClassName(jiraName) {
    return jiraName.replace(/\s/g, '')
}

async function getConfig() {
    const cfg = config()
    cfg.jira.password = '***REMOVED***'
    return cfg
}

async function formatConfigHtml(configDetails) {
    let response = []
    response.push(`
            <dl class="row">
            <dt class="col-sm-3">
            Jira Username
            </dt>
            <dd class="col-sm-9">
            ${config().jira.username}
            </dd>
            <dt class="col-sm-3">
            Jira URL
            </dt>
            <dd class="col-sm-9">
            ${config().jira.protocol}://${config().jira.host}
            </dd>
            <dt class="col-sm-3">
            API
            </dt>
            <dd class="col-sm-9">
            ${config().jira.apiVersion}
            </dd>
            <dt class="col-sm-3">
            Server: Port
            </dt>
            <dd class="col-sm-9">
            ${config().server.port.port}
            </dd>
            <dt class="col-sm-3">
            Graphic Server
            </dt>
            <dd class="col-sm-9">
            ${config().graphicServer.protocol}://${
        config().graphicServer.server
        }:${config().graphicServer.port}/${config().graphicServer.script}
            </dd>
            <dt class="col-sm-3">
            Project
            </dt>
            <dd class="col-sm-9">
            ${config().project}
            </dd>
            </dl>`)
}

module.exports = {
    getConfig,
    getFields,
    formatConfigHtml,
    formatFieldsHtml,
    useFontawesome,
    faIcons,
    getFontawesomeIcon,
    getFontawesomeJsLink,
    formatCssClassName,
}
